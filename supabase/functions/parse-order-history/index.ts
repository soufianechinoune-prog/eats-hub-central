import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseResult {
  success: boolean;
  reportType: string;
  stats: {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  dateRange?: {
    start: string;
    end: string;
  };
  restaurants: {
    id: string;
    name: string;
    count: number;
  }[];
  errors?: string[];
}

// Parse CSV line handling quoted fields
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

// Parse numeric value with comma as decimal separator
function parseNumeric(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse datetime from CSV format
function parseDateTime(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Format: "01/11/2024 10:48:16" or "01/11/2024 10:48"
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [_, day, month, year, hours, minutes, seconds = '00'] = match;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+00:00`;
  }
  return null;
}

// Normalize restaurant name for matching
function normalizeRestaurantName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { csvContent, restaurantId, dryRun = false } = await req.json();

    if (!csvContent) {
      throw new Error('CSV content is required');
    }

    // Fetch all restaurants for matching
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id');

    if (restaurantsError) {
      throw new Error(`Failed to fetch restaurants: ${restaurantsError.message}`);
    }

    // Create lookup maps
    const restaurantByStoreId = new Map<string, { id: string; name: string }>();
    const restaurantByName = new Map<string, { id: string; name: string }>();

    for (const r of restaurants || []) {
      if (r.uber_store_id) {
        restaurantByStoreId.set(r.uber_store_id, { id: r.id, name: r.name });
      }
      restaurantByName.set(normalizeRestaurantName(r.name), { id: r.id, name: r.name });
    }

    // Parse CSV
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    
    // Find header row
    let headerIndex = 0;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('id. de la commande') || line.includes('id de la commande')) {
        headerIndex = i;
        break;
      }
    }

    const headers = parseCSVLine(lines[headerIndex]);
    const headerMap = new Map<string, number>();
    headers.forEach((h, i) => {
      headerMap.set(h.toLowerCase().trim(), i);
    });

    // Column mappings
    const getCol = (row: string[], ...names: string[]): string => {
      for (const name of names) {
        const idx = headerMap.get(name.toLowerCase());
        if (idx !== undefined && row[idx]) return row[idx];
      }
      return '';
    };

    const result: ParseResult = {
      success: true,
      reportType: 'order-history',
      stats: {
        totalRows: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      },
      restaurants: [],
      errors: [],
    };

    const restaurantStats = new Map<string, { id: string; name: string; count: number }>();
    const recordsToUpsert: any[] = [];
    let minDate: string | null = null;
    let maxDate: string | null = null;

    // Process data rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 5) continue;

      result.stats.totalRows++;

      const uberOrderId = getCol(row, 'id. de la commande', 'id de la commande');
      if (!uberOrderId) {
        result.stats.skipped++;
        continue;
      }

      // Find restaurant
      let matchedRestaurant: { id: string; name: string } | undefined;

      if (restaurantId) {
        // Use override
        const overrideRestaurant = restaurants?.find(r => r.id === restaurantId);
        if (overrideRestaurant) {
          matchedRestaurant = { id: overrideRestaurant.id, name: overrideRestaurant.name };
        }
      } else {
        // Try store ID
        const storeId = getCol(row, 'id. du restaurant', 'id du restaurant');
        if (storeId && restaurantByStoreId.has(storeId)) {
          matchedRestaurant = restaurantByStoreId.get(storeId);
        }

        // Try name matching
        if (!matchedRestaurant) {
          const restaurantName = getCol(row, 'restaurant');
          if (restaurantName) {
            const normalizedName = normalizeRestaurantName(restaurantName);
            matchedRestaurant = restaurantByName.get(normalizedName);
          }
        }
      }

      if (!matchedRestaurant) {
        result.stats.skipped++;
        result.errors?.push(`Row ${i + 1}: Restaurant not found`);
        continue;
      }

      // Track restaurant stats
      const key = matchedRestaurant.id;
      if (!restaurantStats.has(key)) {
        restaurantStats.set(key, { id: key, name: matchedRestaurant.name, count: 0 });
      }
      restaurantStats.get(key)!.count++;

      // Parse order datetime
      const orderDatetime = parseDateTime(getCol(row, 'heure de la commande'));
      if (orderDatetime) {
        if (!minDate || orderDatetime < minDate) minDate = orderDatetime;
        if (!maxDate || orderDatetime > maxDate) maxDate = orderDatetime;
      }

      // Build record
      const record = {
        restaurant_id: matchedRestaurant.id,
        uber_order_id: uberOrderId,
        uber_flow_id: getCol(row, 'uuid du processus', 'uuid de la commande') || null,
        order_status: getCol(row, 'statut de la commande') || null,
        delivery_status: getCol(row, 'statut de livraison') || null,
        cancelled_by: getCol(row, 'annulée par') || null,
        item_count: parseNumeric(getCol(row, 'nombre de plats du menu')),
        order_amount: parseNumeric(getCol(row, 'montant moyen des commandes', 'montant de la commande')),
        order_datetime: orderDatetime,
        merchant_accept_time: parseDateTime(getCol(row, 'heure d\'acceptation par le commerçant')),
        accept_delay_minutes: parseNumeric(getCol(row, 'délai pour accepter')),
        initial_prep_time_minutes: parseNumeric(getCol(row, 'temps de préparation initial')),
        extended_prep: getCol(row, 'temps de préparation plus long ?') === '1',
        extended_prep_time_minutes: parseNumeric(getCol(row, 'temps de préparation plus long')),
        courier_arrival_time: parseDateTime(getCol(row, 'heure d\'arrivée du coursier')),
        courier_departure_time: parseDateTime(getCol(row, 'heure de départ du coursier')),
        delivery_time: parseDateTime(getCol(row, 'heure de livraison')),
        total_delivery_time_minutes: parseNumeric(getCol(row, 'délai de livraison total')),
        courier_wait_time_minutes: parseNumeric(getCol(row, 'temps d\'attente du coursier (restaurant)')),
        avoidable_wait_time_minutes: parseNumeric(getCol(row, 'temps d\'attente du coursier pouvant être évité')),
        customer_wait_time_minutes: parseNumeric(getCol(row, 'temps d\'attente du coursier (utilisateur d\'uber eats)')),
        total_prep_delivery_time_minutes: parseNumeric(getCol(row, 'temps total de préparation et de livraison')),
        total_order_duration_minutes: parseNumeric(getCol(row, 'durée de la commande')),
        multi_order_type: getCol(row, 'type de multi-commande') || null,
        fulfillment_type: getCol(row, 'type de commande honorée') || null,
        order_channel: getCol(row, 'canal de commande') || null,
        brand: getCol(row, 'marque eats') || null,
        uber_one: getCol(row, 'pass abonnement', 'uber one').toUpperCase().includes('UBER_ONE'),
        platform: 'uber_eats',
      };

      recordsToUpsert.push(record);
    }

    // Upsert records if not dry run
    if (!dryRun && recordsToUpsert.length > 0) {
      // Process in batches of 500
      const batchSize = 500;
      for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
        const batch = recordsToUpsert.slice(i, i + batchSize);
        
        const { error: upsertError, count } = await supabase
          .from('order_history')
          .upsert(batch, { 
            onConflict: 'restaurant_id,uber_order_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          result.errors?.push(`Batch ${Math.floor(i / batchSize) + 1}: ${upsertError.message}`);
          result.stats.errors += batch.length;
        } else {
          result.stats.inserted += batch.length;
        }
      }
    } else if (dryRun) {
      result.stats.inserted = recordsToUpsert.length;
    }

    // Set date range
    if (minDate && maxDate) {
      result.dateRange = {
        start: minDate.split('T')[0],
        end: maxDate.split('T')[0],
      };
    }

    // Set restaurant stats
    result.restaurants = Array.from(restaurantStats.values());

    console.log('Parse order history result:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error parsing order history:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        reportType: 'order-history',
        stats: { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
        restaurants: [],
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
