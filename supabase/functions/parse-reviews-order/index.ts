import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse date from format "24 nov. 2025" or "Nov 24, 2025"
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const frMonths: Record<string, string> = {
    'janv': '01', 'jan': '01',
    'févr': '02', 'fév': '02', 'feb': '02',
    'mars': '03', 'mar': '03',
    'avr': '04', 'apr': '04',
    'mai': '05', 'may': '05',
    'juin': '06', 'jun': '06',
    'juil': '07', 'jul': '07',
    'août': '08', 'aug': '08',
    'sept': '09', 'sep': '09',
    'oct': '10',
    'nov': '11',
    'déc': '12', 'dec': '12'
  };
  
  // French format: "24 nov. 2025"
  const frMatch = dateStr.match(/(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})/i);
  if (frMatch) {
    const day = frMatch[1].padStart(2, '0');
    const monthKey = frMatch[2].toLowerCase().replace('.', '');
    const year = frMatch[3];
    const month = frMonths[monthKey];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // English format: "Nov 24, 2025"
  const enMatch = dateStr.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (enMatch) {
    const monthKey = enMatch[1].toLowerCase().substring(0, 3);
    const day = enMatch[2].padStart(2, '0');
    const year = enMatch[3];
    const month = frMonths[monthKey];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // ISO format
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return dateStr.substring(0, 10);
  }
  
  return null;
}

/**
 * Parse CSV content handling multi-line fields within quotes
 * Returns an array of rows, each row being an array of field values
 */
function parseCSVContent(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (char === '"') {
      // Handle escaped quotes ""
      if (inQuotes && content[i + 1] === '"') {
        currentField += '"';
        i++; // Skip the next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // Skip \r\n sequence
      if (char === '\r' && content[i + 1] === '\n') {
        i++;
      }
      // Only add row if it has content
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
    } else {
      currentField += char;
    }
  }
  
  // Don't forget the last row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

// Normalize restaurant name for alias matching - MUST match UnknownStoreMapping.tsx
function normalizeForAlias(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, dryRun = false, restaurantId } = await req.json();
    
    console.log('Parsing order-level reviews, dryRun:', dryRun, 'restaurantId override:', restaurantId);

    // Use the new CSV parser that handles multi-line fields
    const allRows = parseCSVContent(csvContent);
    
    if (allRows.length < 2) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Fichier vide ou invalide' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = allRows[0].map(h => h.toLowerCase().trim());
    console.log('Headers detected:', headers);

    // Map column indices - support multiple header variations
    const colMap = {
      orderId: headers.findIndex(h => 
        h.includes('id. de la commande') || h.includes('order id')
      ),
      orderUuid: headers.findIndex(h => 
        h.includes('uuid de la commande') || h.includes('order uuid')
      ),
      storeId: headers.findIndex(h => 
        h.includes('id. externe du restaurant') || 
        h.includes('uuid de l\'établissement') || 
        h.includes('external restaurant id') ||
        h.includes('store uuid')
      ),
      storeName: headers.findIndex(h => 
        h === 'restaurant' || 
        h.includes('nom de l\'établissement') || 
        h.includes('store name')
      ),
      workflowUuid: headers.findIndex(h => 
        h.includes('uuid du flux') || h.includes('workflow uuid')
      ),
      rating: headers.findIndex(h => 
        h.includes('valeur de la note') || 
        h.includes('note du restaurant') || 
        h.includes('restaurant rating') || 
        h.includes('rating value')
      ),
      tags: headers.findIndex(h => 
        h.includes('tags de notation') || 
        h.includes('balises') || 
        h.includes('rating tags') ||
        h.includes('tags')
      ),
      comment: headers.findIndex(h => 
        h.includes('commentaire') || h.includes('comment')
      ),
      eaterUuid: headers.findIndex(h => 
        h.includes('uuid du client') || h.includes('eater uuid')
      ),
      orderDate: headers.findIndex(h => 
        h.includes('date de la commande') || h.includes('order date')
      ),
      ratingDate: headers.findIndex(h => 
        h.includes('date de la note') || h.includes('rating date')
      ),
    };

    console.log('Column mapping:', colMap);

    // Fetch all restaurants + aliases + secondary UUIDs in parallel
    const [{ data: restaurants }, { data: uberIdMappings }, { data: nameAliases }] = await Promise.all([
      supabase.from('restaurants').select('id, name, uber_store_id'),
      supabase.from('restaurant_uber_ids').select('restaurant_id, uber_store_id'),
      supabase.from('restaurant_name_aliases').select('normalized_name, restaurant_id'),
    ]);

    // Map by uber_store_id
    const storeIdToRestaurant = new Map(
      (restaurants || [])
        .filter(r => r.uber_store_id)
        .map(r => [r.uber_store_id, { id: r.id, name: r.name }])
    );

    // Add secondary UUIDs
    if (uberIdMappings && restaurants) {
      const restaurantById = new Map((restaurants || []).map(r => [r.id, r]));
      uberIdMappings.forEach(mapping => {
        const restaurant = restaurantById.get(mapping.restaurant_id);
        if (restaurant && mapping.uber_store_id) {
          storeIdToRestaurant.set(mapping.uber_store_id, { id: restaurant.id, name: restaurant.name });
        }
      });
    }

    // Build alias lookup map (normalized_name → restaurant)
    const aliasToRestaurant = new Map<string, { id: string; name: string }>();
    if (nameAliases && restaurants) {
      const restaurantById = new Map((restaurants || []).map(r => [r.id, r]));
      nameAliases.forEach(alias => {
        const restaurant = restaurantById.get(alias.restaurant_id);
        if (restaurant) {
          aliasToRestaurant.set(alias.normalized_name, { id: restaurant.id, name: restaurant.name });
        }
      });
    }

    // Map by normalized name for fallback matching
    const storeNameToRestaurant = new Map(
      (restaurants || []).map(r => [
        normalizeForAlias(r.name), 
        { id: r.id, name: r.name }
      ])
    );

    const stats = {
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      invalidRatings: 0,
      duplicatesRemoved: 0,
    };

    const skippedDetails: { rowIndex: number; reason: string; details: string }[] = [];
    const restaurantStats: Map<string, { name: string; count: number }> = new Map();
    const unknownStoreIds = new Set<string>();
    let dateStart: string | null = null;
    let dateEnd: string | null = null;

    const reviewsToInsert: any[] = [];

    // Process data rows (skip header at index 0)
    for (let i = 1; i < allRows.length; i++) {
      const values = allRows[i];
      if (values.length < 3) continue;
      
      stats.totalRows++;

      const storeId = colMap.storeId >= 0 ? values[colMap.storeId]?.trim() : '';
      const storeName = colMap.storeName >= 0 ? values[colMap.storeName]?.trim() : '';
      const orderUuid = colMap.orderUuid >= 0 ? values[colMap.orderUuid]?.trim() : '';
      const orderId = colMap.orderId >= 0 ? values[colMap.orderId]?.trim() : '';
      const ratingStr = colMap.rating >= 0 ? values[colMap.rating]?.trim() : '';
      const tagsStr = colMap.tags >= 0 ? values[colMap.tags]?.trim() : '';
      const commentStr = colMap.comment >= 0 ? values[colMap.comment]?.trim() : '';
      const orderDateStr = colMap.orderDate >= 0 ? values[colMap.orderDate]?.trim() : '';
      const ratingDateStr = colMap.ratingDate >= 0 ? values[colMap.ratingDate]?.trim() : '';
      const eaterUuid = colMap.eaterUuid >= 0 ? values[colMap.eaterUuid]?.trim() : '';

      // Use restaurantId override if provided, otherwise find by store_id/name
      let restaurant: { id: string; name: string } | null = null;
      
      if (restaurantId) {
        // Use the manually selected restaurant for ALL rows
        const selectedRestaurant = (restaurants || []).find(r => r.id === restaurantId);
        if (selectedRestaurant) {
          restaurant = { id: selectedRestaurant.id, name: selectedRestaurant.name };
        }
      } else {
        // Step 1: UUID matching
        restaurant = storeId ? storeIdToRestaurant.get(storeId) ?? null : null;

        // Step 2: Alias matching via restaurant_name_aliases
        if (!restaurant && storeName) {
          const normalizedCsvName = normalizeForAlias(storeName);
          restaurant = aliasToRestaurant.get(normalizedCsvName) ?? null;
        }

        // Step 3: Normalized name matching
        if (!restaurant && storeName) {
          const normalizedCsvName = normalizeForAlias(storeName);
          restaurant = storeNameToRestaurant.get(normalizedCsvName) ?? null;
          
          // Partial match if exact fails
          if (!restaurant) {
            for (const [name, r] of storeNameToRestaurant.entries()) {
              if (normalizedCsvName.includes(name) || name.includes(normalizedCsvName)) {
                restaurant = r;
                break;
              }
            }
          }
        }
      }

      if (!restaurant) {
        const identifier = storeName || storeId || 'unknown';
        unknownStoreIds.add(identifier);
        stats.skipped++;
        skippedDetails.push({
          rowIndex: i + 1,
          reason: 'unknown_store',
          details: `Restaurant: ${identifier}`
        });
        continue;
      }

      // Track restaurant stats
      if (!restaurantStats.has(restaurant.id)) {
        restaurantStats.set(restaurant.id, { name: restaurant.name, count: 0 });
      }
      restaurantStats.get(restaurant.id)!.count++;

      // Parse both dates: review date (when rating was submitted) and order date (when order was placed)
      const reviewDate = parseDate(ratingDateStr) || parseDate(orderDateStr);
      const orderDate = parseDate(orderDateStr);
      
      // Track date range for validation
      const dateForRange = orderDate || reviewDate;
      if (dateForRange) {
        if (!dateStart || dateForRange < dateStart) dateStart = dateForRange;
        if (!dateEnd || dateForRange > dateEnd) dateEnd = dateForRange;
      }

      // Parse rating (1-5 scale) with validation
      let rating: number | null = null;
      if (ratingStr) {
        const parsedRating = parseInt(ratingStr, 10);
        if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
          rating = parsedRating;
        } else {
          // Log invalid rating for debugging
          console.warn(`Invalid rating "${ratingStr}" for order ${orderUuid || orderId} at row ${i + 1}`);
          stats.invalidRatings++;
        }
      }
      
      // Parse tags
      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

      reviewsToInsert.push({
        restaurant_id: restaurant.id,
        uber_order_id: orderUuid || orderId,
        overall_rating: rating,
        review_date: reviewDate,
        order_date: orderDate,
        tags: tags,
        customer_comment: commentStr || null,
        customer_name: eaterUuid ? `Client ${eaterUuid.substring(0, 8)}` : null,
        platform: 'uber_eats',
      });
    }

    // Deduplicate by uber_order_id before inserting
    const deduplicatedReviews: any[] = [];
    const seenOrderIds = new Map<string, number>();
    
    for (const review of reviewsToInsert) {
      const key = review.uber_order_id;
      if (key) {
        if (seenOrderIds.has(key)) {
          stats.duplicatesRemoved++;
          // Overwrite with latest occurrence
          deduplicatedReviews[seenOrderIds.get(key)!] = review;
        } else {
          seenOrderIds.set(key, deduplicatedReviews.length);
          deduplicatedReviews.push(review);
        }
      } else {
        deduplicatedReviews.push(review);
      }
    }

    console.log(`Deduplication: ${reviewsToInsert.length} → ${deduplicatedReviews.length} (${stats.duplicatesRemoved} duplicates removed)`);

    // Validation data
    const validation = {
      dateRange: {
        start: dateStart,
        end: dateEnd,
      },
      restaurants: Array.from(restaurantStats.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        orderCount: data.count,
      })),
      unknownStoreIds: Array.from(unknownStoreIds),
      skippedDetails,
      invalidRatingsCount: stats.invalidRatings,
      duplicatesRemoved: stats.duplicatesRemoved,
    };

    if (dryRun) {
      stats.inserted = deduplicatedReviews.length;
      console.log('Dry run complete:', stats);
      
      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        stats,
        validation,
        errorDetails: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert reviews in batches of 500 for performance
    const batchSize = 500;
    for (let i = 0; i < deduplicatedReviews.length; i += batchSize) {
      const batch = deduplicatedReviews.slice(i, i + batchSize);
      const { error } = await supabase
        .from('customer_reviews')
        .upsert(batch, {
          onConflict: 'uber_order_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`Batch insert error (${i}-${i + batch.length}):`, error);
        stats.errors += batch.length;
      } else {
        stats.inserted += batch.length;
      }
    }

    console.log('Import complete:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats,
      validation,
      errorDetails: [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
