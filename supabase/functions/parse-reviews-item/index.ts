import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse date from format "24 nov. 2025" or "Nov 24, 2025" or "2025-11-24"
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
  const frMatch = dateStr.match(/(\d{1,2})\s+([a-zéû]+)\. ?\s+(\d{4})/i);
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Handle escaped double quotes ("" -> single ")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the second quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Normalize restaurant name for matching
function normalizeRestaurantName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
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
    
    console.log('Parsing item-level reviews, dryRun:', dryRun, 'restaurantId override:', restaurantId);

    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Fichier vide ou invalide' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    console.log('Headers detected:', JSON.stringify(headers));

    // Map column indices - support multiple naming conventions
    const colMap = {
      orderId: headers.findIndex(h => 
        h.includes('id. de la commande') || 
        h.includes('order id') || 
        h.includes('id de la commande')
      ),
      orderUuid: headers.findIndex(h => 
        h.includes('uuid de la commande') || 
        h.includes('order uuid') || 
        h.includes('uuid_de_la_commande')
      ),
      storeId: headers.findIndex(h => 
        h.includes('id. externe du restaurant') ||
        h.includes('uuid de l\'établissement') || 
        h.includes('store uuid') || 
        h.includes('uuid_de_l\'etablissement') || 
        h.includes('uuid de l\'etablissement')
      ),
      storeName: headers.findIndex(h => 
        h === 'restaurant' ||
        h.includes('nom de l\'établissement') || 
        h.includes('store name') || 
        h.includes('nom_de_l\'etablissement') || 
        h.includes('nom de l\'etablissement')
      ),
      itemExternalId: headers.findIndex(h =>
        h.includes('id. externe de l\'article') ||
        h.includes('external item id') ||
        h.includes('id externe de l\'article')
      ),
      itemUuid: headers.findIndex(h => 
        h.includes('uuid de l\'article') || 
        h.includes('item uuid') || 
        h.includes('uuid_de_l\'article') || 
        h.includes('uuid de l\'article')
      ),
      itemTitle: headers.findIndex(h => 
        h === 'nom du plat' ||
        h === 'titre de l\'article' || 
        h === 'item title' || 
        h === 'nom de l\'article' || 
        h === 'item name'
      ),
      rating: headers.findIndex(h => 
        h === 'valeur de la note' ||
        h === 'item rating' ||
        h === 'note de l\'article'
      ),
      tags: headers.findIndex(h => 
        h.includes('tags de notation') ||
        h.includes('balises') || 
        h.includes('tags') || 
        h.includes('tag')
      ),
      orderDate: headers.findIndex(h => 
        h.includes('date de la commande') || 
        h.includes('order date') || 
        h.includes('date_de_la_commande')
      ),
    };

    console.log('Column mapping:', JSON.stringify(colMap));
    
    // Log first 5 data rows to debug parsing
    console.log('=== DETAILED PARSING DEBUG ===');
    for (let debugIdx = 1; debugIdx <= Math.min(5, lines.length - 1); debugIdx++) {
      const debugRow = parseCSVLine(lines[debugIdx]);
      console.log(`Row ${debugIdx}: ${debugRow.length} columns`);
      console.log(`  storeName[${colMap.storeName}]: "${debugRow[colMap.storeName]}"`);
      console.log(`  itemTitle[${colMap.itemTitle}]: "${debugRow[colMap.itemTitle]}"`);
      console.log(`  itemExternalId[${colMap.itemExternalId}]: "${debugRow[colMap.itemExternalId]}"`);
      console.log(`  rating[${colMap.rating}]: "${debugRow[colMap.rating]}"`);
      console.log(`  tags[${colMap.tags}]: "${debugRow[colMap.tags]}"`);
    }
    console.log('=== END DEBUG ===')

    // Fetch all restaurants + aliases + secondary UUIDs in parallel
    const [{ data: restaurants }, { data: uberIdMappings }, { data: nameAliases }] = await Promise.all([
      supabase.from('restaurants').select('id, name, uber_store_id'),
      supabase.from('restaurant_uber_ids').select('restaurant_id, uber_store_id').limit(500),
      supabase.from('restaurant_name_aliases').select('normalized_name, restaurant_id'),
    ]);

    // Create lookup maps
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

    // Build alias lookup map
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
    
    // Create normalized name lookup for fallback matching
    const normalizedNameToRestaurant = new Map(
      (restaurants || []).map(r => [
        normalizeRestaurantName(r.name), 
        { id: r.id, name: r.name }
      ])
    );

    const stats = {
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    const skippedDetails: { rowIndex: number; reason: string; details: string }[] = [];
    const restaurantStats: Map<string, { name: string; count: number }> = new Map();
    const unknownStoreIds = new Set<string>();
    let dateStart: string | null = null;
    let dateEnd: string | null = null;

    const reviewsToInsert: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 3) continue;
      
      stats.totalRows++;

      const storeId = colMap.storeId >= 0 ? values[colMap.storeId]?.trim() : '';
      const storeName = colMap.storeName >= 0 ? values[colMap.storeName]?.trim() : '';
      const orderUuid = colMap.orderUuid >= 0 ? values[colMap.orderUuid]?.trim() : '';
      const itemExternalId = colMap.itemExternalId >= 0 ? values[colMap.itemExternalId]?.trim() : '';
      const itemUuid = colMap.itemUuid >= 0 ? values[colMap.itemUuid]?.trim() : '';
      const itemTitle = colMap.itemTitle >= 0 ? values[colMap.itemTitle]?.trim() : '';
      const ratingStr = colMap.rating >= 0 ? values[colMap.rating]?.trim() : '';
      const tagsStr = colMap.tags >= 0 ? values[colMap.tags]?.trim() : '';
      const orderDateStr = colMap.orderDate >= 0 ? values[colMap.orderDate]?.trim() : '';

      // Find restaurant - priority order:
      // 1. restaurantId override (manual selection)
      // 2. storeId matching (uber_store_id)
      // 3. storeName normalized matching
      let restaurant = null;
      
      if (restaurantId) {
        // Use the manually selected restaurant for ALL rows
        const override = (restaurants || []).find(r => r.id === restaurantId);
        if (override) {
          restaurant = { id: override.id, name: override.name };
        }
      } 
      
      if (!restaurant && storeId) {
        restaurant = storeIdToRestaurant.get(storeId) ?? null;
      }
      
      // Step 2: Alias matching via restaurant_name_aliases
      if (!restaurant && storeName) {
        const normalizedCsvName = normalizeRestaurantName(storeName);
        restaurant = aliasToRestaurant.get(normalizedCsvName) ?? null;
      }

      // Step 3: Normalized name matching
      if (!restaurant && storeName) {
        const normalizedCsvName = normalizeRestaurantName(storeName);
        restaurant = normalizedNameToRestaurant.get(normalizedCsvName) ?? null;
        
        if (!restaurant) {
          for (const [normalizedDbName, r] of normalizedNameToRestaurant.entries()) {
            if (normalizedDbName.includes(normalizedCsvName) || normalizedCsvName.includes(normalizedDbName)) {
              restaurant = r;
              break;
            }
          }
        }
      }
      
      if (!restaurant) {
        unknownStoreIds.add(storeId || storeName || 'unknown');
        stats.skipped++;
        skippedDetails.push({
          rowIndex: i + 1,
          reason: 'unknown_store',
          details: `Store: ${storeName || storeId || 'N/A'}`
        });
        continue;
      }

      // Skip if no item info
      if (!itemTitle && !itemUuid && !itemExternalId) {
        stats.skipped++;
        skippedDetails.push({
          rowIndex: i + 1,
          reason: 'no_item',
          details: 'Pas d\'article identifié'
        });
        continue;
      }

      // Track restaurant stats
      if (!restaurantStats.has(restaurant.id)) {
        restaurantStats.set(restaurant.id, { name: restaurant.name, count: 0 });
      }
      restaurantStats.get(restaurant.id)!.count++;

      // Parse date
      const orderDate = parseDate(orderDateStr);
      if (orderDate) {
        if (!dateStart || orderDate < dateStart) dateStart = orderDate;
        if (!dateEnd || orderDate > dateEnd) dateEnd = orderDate;
      }

      // Parse rating (0 or 1 for item-level)
      const rating = ratingStr !== '' ? parseInt(ratingStr, 10) : 0;
      
      // Parse tags
      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

      // Determine thumb up/down based on rating
      const thumbUp = rating === 1 ? 1 : 0;
      const thumbDown = rating === 0 ? 1 : 0;

      // Use external ID, then UUID, then row index as fallback for item_id
      const itemId = itemExternalId || itemUuid || `row_${i}`;

      reviewsToInsert.push({
        restaurant_id: restaurant.id,
        item_id: itemId,
        item_title: itemTitle || 'Article inconnu',
        rating: rating,
        thumb_up: thumbUp,
        thumb_down: thumbDown,
        tags: tags,
        review_date: orderDate,
        platform: 'uber_eats',
      });
    }

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
    };

    if (dryRun) {
      stats.inserted = reviewsToInsert.length;
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

    // Insert reviews
    for (const review of reviewsToInsert) {
      const { error } = await supabase
        .from('menu_item_reviews')
        .insert(review);

      if (error) {
        console.error('Insert error:', error);
        stats.errors++;
      } else {
        stats.inserted++;
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
