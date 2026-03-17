import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseResult {
  success: boolean;
  reportType: string;
  dryRun?: boolean;
  stats: {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    expandedRecords?: number;
  };
  validation?: {
    dateRange: {
      start: string | null;
      end: string | null;
    };
    restaurants: {
      id: string;
      name: string;
      orderCount: number;
    }[];
    unknownStoreIds: string[];
    unknownStoreDetails?: Record<string, { name: string; type: 'store_id' | 'restaurant_name' }>;
    skippedDetails: {
      rowIndex: number;
      reason: string;
      details: string;
    }[];
  };
  errorDetails: string[];
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
  const cleaned = value.replace(/[€$\s]/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse datetime from CSV format - supports multiple formats
function parseDateTime(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (isoMatch) {
    const [_, year, month, day, hours, minutes, seconds] = isoMatch;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+00:00`;
  }
  
  const frMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (frMatch) {
    const [_, day, month, year, hours, minutes, seconds = '00'] = frMatch;
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

// Normalize for loose matching (remove hyphens, extra spaces)
function normalizeForLooseMatch(name: string): string {
  return normalizeRestaurantName(name)
    .replace(/-/g, '')
    .replace(/\s+/g, '');
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// Find restaurant by partial/fuzzy name matching
function findRestaurantByPartialName(
  csvName: string,
  restaurantByName: Map<string, { id: string; name: string }>
): { id: string; name: string } | null {
  // Try loose match first (ignoring hyphens, spaces, accents)
  const looseNormalized = normalizeForLooseMatch(csvName);
  for (const [_, restaurant] of restaurantByName.entries()) {
    if (normalizeForLooseMatch(restaurant.name) === looseNormalized) {
      console.log(`Loose match: "${csvName}" -> "${restaurant.name}"`);
      return restaurant;
    }
  }

  // Fuzzy match: try Levenshtein distance on normalized names (tolerance: 2 chars)
  const normalizedCsv = normalizeRestaurantName(csvName);
  let bestMatch: { id: string; name: string } | null = null;
  let bestDistance = Infinity;
  for (const [normalizedName, restaurant] of restaurantByName.entries()) {
    const dist = levenshtein(normalizedCsv, normalizedName);
    if (dist <= 2 && dist < bestDistance) {
      bestDistance = dist;
      bestMatch = restaurant;
    }
  }
  if (bestMatch) {
    console.log(`Fuzzy match (distance=${bestDistance}): "${csvName}" -> "${bestMatch.name}"`);
    return bestMatch;
  }

  // Try extracting city part from "Chicken Street - City" pattern
  const cityMatch = csvName.match(/Chicken\s*Street\s*[-–—]\s*(.+)/i);
  if (!cityMatch) return null;

  const cityPart = normalizeRestaurantName(cityMatch[1]);
  if (!cityPart || cityPart.length < 3) return null;

  const matches: { id: string; name: string }[] = [];
  for (const [normalizedName, restaurant] of restaurantByName.entries()) {
    if (normalizedName.includes(cityPart)) {
      matches.push(restaurant);
    }
  }

  if (matches.length === 1) {
    console.log(`Partial match: "${csvName}" -> "${matches[0].name}"`);
    return matches[0];
  }

  if (matches.length > 1) {
    console.log(`Ambiguous match: "${csvName}" -> ${matches.map(m => m.name).join(', ')} - picking first`);
    return matches[0];
  }

  return null;
}

// Categorize error type based on the info column
function categorizeError(errorInfo: string): string {
  if (!errorInfo) return 'Autre';
  
  const lower = errorInfo.toLowerCase();
  
  if (lower.includes('missing_item') || lower.includes('article manquant')) {
    return 'Articles manquants';
  }
  if (lower.includes('wrong_item') || lower.includes('article incorrect')) {
    return 'Article incorrect';
  }
  if (lower.includes('food_quality') || lower.includes('qualité')) {
    return 'Problèmes liés à la qualité des aliments';
  }
  if (lower.includes('wrong_order') || lower.includes('commande incorrecte')) {
    return 'Commande incorrecte';
  }
  if (lower.includes('cold') || lower.includes('froid')) {
    return 'Problèmes liés à la qualité des aliments';
  }
  if (lower.includes('spoiled') || lower.includes('périmé')) {
    return 'Problèmes liés à la qualité des aliments';
  }
  
  return 'Autre';
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

    console.log(`[parse-inaccurate-orders v4] dryRun=${dryRun}, restaurantId=${restaurantId || 'none'}`);

    // Fetch all restaurants for matching
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id');

    if (restaurantsError) {
      throw new Error(`Failed to fetch restaurants: ${restaurantsError.message}`);
    }

    // Fetch secondary/historical uber store IDs
    const { data: uberIds } = await supabase
      .from('restaurant_uber_ids')
      .select('uber_store_id, restaurant_id');

    // Fetch name aliases
    const { data: nameAliases } = await supabase
      .from('restaurant_name_aliases')
      .select('normalized_name, restaurant_id');

    // Create lookup maps
    const restaurantByStoreId = new Map<string, { id: string; name: string }>();
    const restaurantByName = new Map<string, { id: string; name: string }>();
    const restaurantByAlias = new Map<string, string>(); // normalized_name -> restaurant_id

    for (const r of restaurants || []) {
      if (r.uber_store_id) {
        restaurantByStoreId.set(r.uber_store_id, { id: r.id, name: r.name });
      }
      restaurantByName.set(normalizeRestaurantName(r.name), { id: r.id, name: r.name });
    }

    // Add secondary/historical UUIDs to the lookup map
    for (const mapping of uberIds || []) {
      const restaurant = restaurants?.find(r => r.id === mapping.restaurant_id);
      if (restaurant && !restaurantByStoreId.has(mapping.uber_store_id)) {
        restaurantByStoreId.set(mapping.uber_store_id, { id: restaurant.id, name: restaurant.name });
      }
    }

    // Add name aliases to lookup
    for (const alias of nameAliases || []) {
      restaurantByAlias.set(alias.normalized_name, alias.restaurant_id);
    }

    // Parse CSV
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    
    // Find header row
    let headerIndex = 0;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('problème avec la commande') || 
          line.includes('articles incorrects') ||
          line.includes('client remboursé')) {
        headerIndex = i;
        break;
      }
    }

    const headers = parseCSVLine(lines[headerIndex]);
    const headerMap = new Map<string, number>();
    headers.forEach((h, i) => {
      headerMap.set(h.toLowerCase().trim(), i);
    });

    console.log('Headers found:', headers.slice(0, 15).join(', '));

    // Column getter helper
    const getCol = (row: string[], ...names: string[]): string => {
      for (const name of names) {
        const idx = headerMap.get(name.toLowerCase());
        if (idx !== undefined && row[idx]) return row[idx].trim();
      }
      return '';
    };

    const result: ParseResult = {
      success: true,
      reportType: 'inaccurate_orders',
      dryRun,
      stats: {
        totalRows: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      },
      validation: {
        dateRange: { start: null, end: null },
        restaurants: [],
        unknownStoreIds: [],
        unknownStoreDetails: {},
        skippedDetails: [],
      },
      errorDetails: [],
    };

    const restaurantStats = new Map<string, { id: string; name: string; orderCount: number }>();
    const recordsToUpsert: any[] = [];
    const seenKeys = new Set<string>();
    let minDate: string | null = null;
    let maxDate: string | null = null;

    // Process data rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 5) continue;

      result.stats.totalRows++;

      const uberOrderId = getCol(row, 'id. de la commande', 'id de la commande', 'order id');
      if (!uberOrderId) {
        result.stats.skipped++;
        result.validation?.skippedDetails.push({
          rowIndex: i + 1,
          reason: 'missing_order_id',
          details: 'No order ID found',
        });
        continue;
      }

      // Find restaurant
      let matchedRestaurant: { id: string; name: string } | undefined;

      if (restaurantId) {
        const overrideRestaurant = restaurants?.find(r => r.id === restaurantId);
        if (overrideRestaurant) {
          matchedRestaurant = { id: overrideRestaurant.id, name: overrideRestaurant.name };
        }
      } else {
        // Try uber_store_id first
        const storeId = getCol(row, 'id du restaurant', 'id restaurant', 'store id', 'restaurant id');
        if (storeId && restaurantByStoreId.has(storeId)) {
          matchedRestaurant = restaurantByStoreId.get(storeId);
        }

        // Fallback to name matching
        if (!matchedRestaurant) {
          const restaurantName = getCol(row, 'restaurant', 'nom du restaurant', 'store name', 'restaurant name');
          if (restaurantName) {
            const normalizedName = normalizeRestaurantName(restaurantName);
            
            // 1. Exact normalized name match
            matchedRestaurant = restaurantByName.get(normalizedName);

            // 2. Check name aliases
            if (!matchedRestaurant) {
              const aliasRestaurantId = restaurantByAlias.get(normalizedName);
              if (aliasRestaurantId) {
                const r = restaurants?.find(r => r.id === aliasRestaurantId);
                if (r) {
                  matchedRestaurant = { id: r.id, name: r.name };
                  console.log(`Alias match: "${restaurantName}" -> "${r.name}"`);
                }
              }
            }

            // 3. Fuzzy/partial name match
            if (!matchedRestaurant) {
              matchedRestaurant = findRestaurantByPartialName(restaurantName, restaurantByName) || undefined;
            }
          }
        }
      }

      if (!matchedRestaurant) {
        result.stats.skipped++;
        const restaurantName = getCol(row, 'restaurant', 'nom du restaurant', 'store name', 'restaurant name');
        const storeIdForError = getCol(row, 'id du restaurant', 'id restaurant', 'store id', 'restaurant id');
        
        // Determine the type of unknown: real store_id or restaurant name
        const hasRealStoreId = !!storeIdForError && !storeIdForError.includes(' ');
        const unknownKey = hasRealStoreId ? storeIdForError : (restaurantName || storeIdForError);
        const unknownType: 'store_id' | 'restaurant_name' = hasRealStoreId ? 'store_id' : 'restaurant_name';
        
        if (unknownKey && !result.validation!.unknownStoreIds.includes(unknownKey)) {
          result.validation!.unknownStoreIds.push(unknownKey);
          result.validation!.unknownStoreDetails![unknownKey] = {
            name: restaurantName || unknownKey,
            type: unknownType,
          };
        }
        result.validation?.skippedDetails.push({
          rowIndex: i + 1,
          reason: 'restaurant_not_found',
          details: `Restaurant not found: name="${restaurantName}" storeId="${storeIdForError}"`,
        });
        continue;
      }

      // Track restaurant stats
      const key = matchedRestaurant.id;
      if (!restaurantStats.has(key)) {
        restaurantStats.set(key, { id: key, name: matchedRestaurant.name, orderCount: 0 });
      }
      restaurantStats.get(key)!.orderCount++;

      // Parse dates
      const orderDatetime = parseDateTime(getCol(row, 'heure de la commande', 'order time'));
      const refundDatetimeRaw = getCol(row, 'heure du remboursement', 'refund time');
      const refundDatetime = parseDateTime(refundDatetimeRaw);
      const errorDate = orderDatetime || refundDatetime;
      
      if (errorDate) {
        const dateOnly = errorDate.split('T')[0];
        if (!minDate || dateOnly < minDate) minDate = dateOnly;
        if (!maxDate || dateOnly > maxDate) maxDate = dateOnly;
      }

      // Get error details
      const errorType = getCol(row, 'problème avec la commande', 'issue with order');
      const errorInfo = getCol(row, "informations concernant le problème lié à l'article", 'item issue info');
      const incorrectItems = getCol(row, 'articles incorrects', 'incorrect items');
      const customerComment = getCol(row, 'commentaires du client', 'customer comments');
      
      // Parse financial impact
      const refundTotal = parseNumeric(getCol(row, 'client remboursé', 'customer refunded'));
      const refundMerchant = parseNumeric(getCol(row, 'remboursement pris en charge par le commerçant', 'merchant refund'));
      
      // New columns
      const orderChannel = getCol(row, 'canal de la commande', 'order channel') || null;
      const orderAmount = parseNumeric(getCol(row, 'montant moyen de la commande', 'average order amount'));

      // Split multiple items if present (separated by |)
      const items = incorrectItems ? incorrectItems.split('|').map(s => s.trim()).filter(Boolean) : [''];

      // Create one error record per item
      for (const itemTitle of items) {
        // Deduplication key
        const dedupeKey = `${matchedRestaurant.id}|${uberOrderId}|${itemTitle || 'no_item'}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const record = {
          restaurant_id: matchedRestaurant.id,
          uber_order_id: uberOrderId,
          error_date: errorDate,
          error_type: errorType || categorizeError(errorInfo),
          error_category: categorizeError(errorInfo),
          item_title: itemTitle || '',
          error_description: errorInfo || customerComment || null,
          financial_impact: refundMerchant || refundTotal || null,
          order_channel: orderChannel,
          order_amount: orderAmount,
          refund_datetime: refundDatetime,
        };

        recordsToUpsert.push(record);
      }
    }

    // Track expanded records count (items split from CSV rows)
    if (recordsToUpsert.length > result.stats.totalRows) {
      result.stats.expandedRecords = recordsToUpsert.length;
    }

    console.log(`Parsed ${result.stats.totalRows} rows, prepared ${recordsToUpsert.length} records to upsert (expanded: ${result.stats.expandedRecords ?? 'none'})`);

    // Set date range
    if (minDate && maxDate) {
      result.validation!.dateRange = { start: minDate, end: maxDate };
    }

    // Set restaurant stats
    result.validation!.restaurants = Array.from(restaurantStats.values());

    // Upsert records if not dry run
    if (!dryRun && recordsToUpsert.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
        const batch = recordsToUpsert.slice(i, i + batchSize);
        
        const { data, error: upsertError } = await supabase
          .from('order_errors')
          .upsert(batch, {
            onConflict: 'restaurant_id,uber_order_id,item_title',
            ignoreDuplicates: false,
          })
          .select('id');

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          result.errorDetails.push(`Batch ${Math.floor(i / batchSize) + 1}: ${upsertError.message}`);
          result.stats.errors += batch.length;
        } else {
          result.stats.inserted += batch.length;
        }
      }

      result.success = result.stats.errors === 0;
    } else if (dryRun) {
      result.stats.inserted = recordsToUpsert.length;
    }

    console.log('Parse inaccurate orders result:', JSON.stringify({
      ...result,
      stats: result.stats,
      restaurantCount: result.validation?.restaurants.length,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error parsing inaccurate orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        reportType: 'inaccurate_orders',
        stats: { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
        validation: {
          dateRange: { start: null, end: null },
          restaurants: [],
          unknownStoreIds: [],
          unknownStoreDetails: {},
          skippedDetails: [],
        },
        errorDetails: [errorMessage],
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
