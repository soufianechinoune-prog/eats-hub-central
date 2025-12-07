import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewRow {
  order_id: string;
  order_uuid: string;
  store_id: string;
  store_name: string;
  workflow_uuid: string;
  rating: number | null;
  tags: string[];
  eater_uuid: string;
  order_date: string;
}

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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, dryRun = false } = await req.json();
    
    console.log('Parsing order-level reviews, dryRun:', dryRun);

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
    console.log('Headers detected:', headers);

    // Map column indices
    const colMap = {
      orderId: headers.findIndex(h => h.includes('id. de la commande') || h.includes('order id')),
      orderUuid: headers.findIndex(h => h.includes('uuid de la commande') || h.includes('order uuid')),
      storeId: headers.findIndex(h => h.includes('uuid de l\'établissement') || h.includes('store uuid')),
      storeName: headers.findIndex(h => h.includes('nom de l\'établissement') || h.includes('store name')),
      workflowUuid: headers.findIndex(h => h.includes('uuid du flux') || h.includes('workflow uuid')),
      rating: headers.findIndex(h => h.includes('note du restaurant') || h.includes('restaurant rating')),
      tags: headers.findIndex(h => h.includes('balises') || h.includes('tags')),
      eaterUuid: headers.findIndex(h => h.includes('uuid du client') || h.includes('eater uuid')),
      orderDate: headers.findIndex(h => h.includes('date de la commande') || h.includes('order date')),
    };

    console.log('Column mapping:', colMap);

    // Fetch all restaurants with uber_store_id
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id')
      .not('uber_store_id', 'is', null);

    const storeIdToRestaurant = new Map(
      (restaurants || []).map(r => [r.uber_store_id, { id: r.id, name: r.name }])
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

      const storeId = colMap.storeId >= 0 ? values[colMap.storeId] : '';
      const orderUuid = colMap.orderUuid >= 0 ? values[colMap.orderUuid] : '';
      const orderId = colMap.orderId >= 0 ? values[colMap.orderId] : '';
      const ratingStr = colMap.rating >= 0 ? values[colMap.rating] : '';
      const tagsStr = colMap.tags >= 0 ? values[colMap.tags] : '';
      const orderDateStr = colMap.orderDate >= 0 ? values[colMap.orderDate] : '';
      const eaterUuid = colMap.eaterUuid >= 0 ? values[colMap.eaterUuid] : '';

      // Find restaurant
      const restaurant = storeIdToRestaurant.get(storeId);
      if (!restaurant) {
        unknownStoreIds.add(storeId);
        stats.skipped++;
        skippedDetails.push({
          rowIndex: i + 1,
          reason: 'unknown_store',
          details: `Store ID: ${storeId}`
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

      // Parse rating (1-5 scale)
      const rating = ratingStr ? parseInt(ratingStr, 10) : null;
      
      // Parse tags
      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

      reviewsToInsert.push({
        restaurant_id: restaurant.id,
        uber_order_id: orderUuid || orderId,
        overall_rating: rating,
        review_date: orderDate,
        tags: tags,
        customer_name: eaterUuid ? `Client ${eaterUuid.substring(0, 8)}` : null,
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
        .from('customer_reviews')
        .upsert(review, {
          onConflict: 'uber_order_id',
          ignoreDuplicates: false,
        });

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
