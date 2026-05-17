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
  dateRange: {
    start: string | null;
    end: string | null;
  };
  restaurants: {
    count: number;
    ids: string[];
    names: string[];
  };
  unknownRestaurantIds: string[];
  skippedRows: Array<{ row: number; reason: string; data: Record<string, string> }>;
  errorMessages: string[];
  restaurantStats: Record<string, { inserted: number; updated: number; skipped: number }>;
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

// Parse numeric value, handling comma as decimal separator
function parseNumeric(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
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

// Parse datetime from CSV format "YYYY-MM-DD HH:00"
function parseDateTime(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Handle format "2025-06-03 08:00"
  const cleaned = dateStr.trim();
  
  // Try parsing as ISO format
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  // Try parsing "YYYY-MM-DD HH:mm" format
  const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})$/);
  if (match) {
    const [, datePart, hours, minutes] = match;
    return new Date(`${datePart}T${hours}:${minutes}:00`).toISOString();
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, restaurantId, dryRun = false } = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'CSV content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all restaurants for matching
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id');

    if (restaurantsError) {
      console.error('Error fetching restaurants:', restaurantsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch restaurants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create restaurant lookup maps
    const restaurantByStoreId = new Map<string, { id: string; name: string }>();
    const restaurantByNormalizedName = new Map<string, { id: string; name: string }>();
    
    for (const r of restaurants || []) {
      if (r.uber_store_id) {
        restaurantByStoreId.set(r.uber_store_id, { id: r.id, name: r.name });
      }
      restaurantByNormalizedName.set(normalizeRestaurantName(r.name), { id: r.id, name: r.name });
    }

    // Fetch secondary UUIDs from restaurant_uber_ids
    const { data: uberIdMappings } = await supabase
      .from('restaurant_uber_ids')
      .select('restaurant_id, uber_store_id');

    if (uberIdMappings && restaurants) {
      const restaurantById = new Map((restaurants || []).map(r => [r.id, r]));
      uberIdMappings.forEach(mapping => {
        const restaurant = restaurantById.get(mapping.restaurant_id);
        if (restaurant && mapping.uber_store_id) {
          restaurantByStoreId.set(mapping.uber_store_id, { id: restaurant.id, name: restaurant.name });
        }
      });
    }

    // Fetch name aliases
    const { data: nameAliases } = await supabase
      .from('restaurant_name_aliases')
      .select('normalized_name, restaurant_id');

    const restaurantByAlias = new Map<string, string>();
    for (const alias of nameAliases || []) {
      restaurantByAlias.set(alias.normalized_name, alias.restaurant_id);
    }

    // Parse CSV
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'CSV must have header and data rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = parseCSVLine(lines[0]);
    console.log('CSV Headers:', headers);

    // Find column indices
    const colIndices: Record<string, number> = {};
    const columnMappings: Record<string, string[]> = {
      restaurantName: ['Restaurant', 'Nom du restaurant', 'Restaurant Name'],
      storeId: ['Id. externe du restaurant', 'ID du magasin', 'Store ID', 'External Store ID'],
      hourStart: ['Ouverture du restaurant à', 'Restaurant Open At'],
      menuAvailability: ['Disponibilité du menu', 'Menu Availability'],
      online: ['Restaurant en ligne', 'Restaurant Online'],
      offline: ['Restaurant hors ligne', 'Restaurant Offline'],
    };

    for (const [key, possibleNames] of Object.entries(columnMappings)) {
      for (const name of possibleNames) {
        const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
        if (idx !== -1) {
          colIndices[key] = idx;
          break;
        }
      }
    }

    console.log('Column indices:', colIndices);

    // Check required columns
    if (colIndices.hourStart === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required column: Ouverture du restaurant à' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: ParseResult = {
      success: true,
      reportType: 'downtime_report',
      stats: {
        totalRows: lines.length - 1,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      },
      dateRange: {
        start: null,
        end: null,
      },
      restaurants: {
        count: 0,
        ids: [],
        names: [],
      },
      unknownRestaurantIds: [],
      skippedRows: [],
      errorMessages: [],
      restaurantStats: {},
    };

    const rowsToInsert: any[] = [];
    const unknownStoreIds = new Set<string>();
    const unknownStoreDetails: Record<string, { name: string; type: string }> = {};
    const restaurantIdsSet = new Set<string>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    // Process data rows
    // Caches to keep per-row matching O(1) and avoid log spam on large bulk imports
    const restaurantsById = new Map<string, { id: string; name: string }>();
    for (const r of restaurants || []) restaurantsById.set(r.id, { id: r.id, name: r.name });
    const nameResolutionCache = new Map<string, { id: string; name: string } | null>();
    const loggedAliasNames = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);

      // Get restaurant
      let matchedRestaurant: { id: string; name: string } | null = null;

      // If restaurantId override is provided, use it
      if (restaurantId) {
        const restaurant = restaurantsById.get(restaurantId);
        if (restaurant) {
          matchedRestaurant = restaurant;
        }
      } else {
        // Try to match by store ID
        const storeId = colIndices.storeId !== undefined ? values[colIndices.storeId]?.trim() : '';
        if (storeId && restaurantByStoreId.has(storeId)) {
          matchedRestaurant = restaurantByStoreId.get(storeId)!;
        }

        // Try to match by name (with cache)
        if (!matchedRestaurant && colIndices.restaurantName !== undefined) {
          const restaurantName = values[colIndices.restaurantName]?.trim();
          if (restaurantName) {
            if (nameResolutionCache.has(restaurantName)) {
              matchedRestaurant = nameResolutionCache.get(restaurantName)!;
            } else {
              const normalizedName = normalizeRestaurantName(restaurantName);
              if (restaurantByNormalizedName.has(normalizedName)) {
                matchedRestaurant = restaurantByNormalizedName.get(normalizedName)!;
              } else {
                // Check name aliases
                const aliasRestaurantId = restaurantByAlias.get(normalizedName);
                if (aliasRestaurantId) {
                  const aliasRestaurant = restaurantsById.get(aliasRestaurantId);
                  if (aliasRestaurant) {
                    matchedRestaurant = aliasRestaurant;
                    if (!loggedAliasNames.has(restaurantName)) {
                      loggedAliasNames.add(restaurantName);
                      console.log(`Alias match: "${restaurantName}" -> ${aliasRestaurant.name}`);
                    }
                  }
                }

                // Fuzzy match - find closest match (only on first encounter of this name)
                if (!matchedRestaurant) {
                  for (const [key, value] of restaurantByNormalizedName.entries()) {
                    if (key.includes(normalizedName) || normalizedName.includes(key)) {
                      matchedRestaurant = value;
                      break;
                    }
                  }
                }
              }
              nameResolutionCache.set(restaurantName, matchedRestaurant);
            }
          }
        }
      }

      if (!matchedRestaurant) {
        result.stats.skipped++;
        const restaurantName = colIndices.restaurantName !== undefined 
          ? values[colIndices.restaurantName]?.trim() || 'unknown' 
          : 'unknown';
        const storeId = colIndices.storeId !== undefined 
          ? values[colIndices.storeId]?.trim() || '' 
          : '';
        const identifier = storeId || restaurantName;
        unknownStoreIds.add(identifier);
        unknownStoreDetails[identifier] = { 
          name: restaurantName, 
          type: storeId ? 'uber_store_id' : 'restaurant_name' 
        };
        continue;
      }

      // Parse hour_start
      const hourStartStr = values[colIndices.hourStart];
      const hourStart = parseDateTime(hourStartStr);
      
      if (!hourStart) {
        result.stats.skipped++;
        if (result.errorMessages.length < 10) {
          result.errorMessages.push(`Row ${i + 1}: Invalid date format - ${hourStartStr}`);
        }
        continue;
      }

      // Parse minute values
      const menuAvailability = colIndices.menuAvailability !== undefined 
        ? parseNumeric(values[colIndices.menuAvailability]) 
        : 0;
      const online = colIndices.online !== undefined 
        ? parseNumeric(values[colIndices.online]) 
        : 0;
      const offline = colIndices.offline !== undefined 
        ? parseNumeric(values[colIndices.offline]) 
        : 0;

      // Track date range
      const hourDate = new Date(hourStart);
      if (!minDate || hourDate < minDate) minDate = hourDate;
      if (!maxDate || hourDate > maxDate) maxDate = hourDate;

      // Track restaurant
      restaurantIdsSet.add(matchedRestaurant.id);

      // Track restaurant stats
      if (!result.restaurantStats[matchedRestaurant.name]) {
        result.restaurantStats[matchedRestaurant.name] = { inserted: 0, updated: 0, skipped: 0 };
      }

      rowsToInsert.push({
        restaurant_id: matchedRestaurant.id,
        hour_start: hourStart,
        menu_availability_minutes: Math.round(menuAvailability),
        online_minutes: Math.round(online),
        offline_minutes: Math.round(offline),
        platform: 'uber_eats',
      });
    }

    // Phase 1.5: Deduplicate by (restaurant_id, hour_start, platform)
    // This prevents PostgreSQL "ON CONFLICT DO UPDATE cannot affect row a second time" errors
    const deduplicatedMap = new Map<string, any>();

    for (const row of rowsToInsert) {
      const key = `${row.restaurant_id}::${row.hour_start}::${row.platform}`;
      const existing = deduplicatedMap.get(key);
      
      if (existing) {
        // Merge: take max values (they should be identical, but just in case)
        existing.menu_availability_minutes = Math.max(
          existing.menu_availability_minutes || 0, 
          row.menu_availability_minutes || 0
        );
        existing.online_minutes = Math.max(
          existing.online_minutes || 0, 
          row.online_minutes || 0
        );
        existing.offline_minutes = Math.max(
          existing.offline_minutes || 0, 
          row.offline_minutes || 0
        );
      } else {
        deduplicatedMap.set(key, { ...row });
      }
    }

    const deduplicatedRows = Array.from(deduplicatedMap.values());
    const duplicatesMerged = rowsToInsert.length - deduplicatedRows.length;
    console.log(`Deduplicated: ${rowsToInsert.length} → ${deduplicatedRows.length} rows (${duplicatesMerged} duplicates merged)`);

    result.restaurants.ids = Array.from(restaurantIdsSet);
    result.restaurants.count = restaurantIdsSet.size;
    result.dateRange.start = minDate?.toISOString().split('T')[0] || null;
    result.dateRange.end = maxDate?.toISOString().split('T')[0] || null;

    console.log(`Parsed ${deduplicatedRows.length} unique rows for ${result.restaurants.count} restaurants`);

    const validation = {
      unknownStoreIds: Array.from(unknownStoreIds),
      unknownStoreDetails,
      dateRange: result.dateRange,
      restaurants: Object.entries(result.restaurantStats).map(([name]) => ({ name })),
    };

    if (dryRun) {
      result.stats.inserted = deduplicatedRows.length;
      return new Response(
        JSON.stringify({ ...result, validation }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert in batches using deduplicated rows
    const BATCH_SIZE = 500;
    for (let i = 0; i < deduplicatedRows.length; i += BATCH_SIZE) {
      const batch = deduplicatedRows.slice(i, i + BATCH_SIZE);
      
      const { error: insertError } = await supabase
        .from('hourly_availability')
        .upsert(batch, { 
          onConflict: 'restaurant_id,hour_start,platform',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        result.stats.errors += batch.length;
        result.errorMessages.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
      } else {
        result.stats.inserted += batch.length;
      }
    }

    console.log('Import complete:', result);

    return new Response(
      JSON.stringify({ ...result, validation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-downtime-report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
