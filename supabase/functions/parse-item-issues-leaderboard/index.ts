import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedItem {
  item_title: string;
  volume: number;
  score: number;
  issues_delta_percent: number | null;
  major_issue_type: string | null;
  has_missing_customization: boolean;
  store_id: string | null;
}

interface RestaurantData {
  id: string;
  name: string;
  items: ParsedItem[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, restaurantId, year, fileName, dryRun = false } = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ success: false, error: "csvContent is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const targetYear = year || new Date().getFullYear();
    console.log("[parse-item-issues-leaderboard] Starting parse, year:", targetYear, "fileName:", fileName);

    // Extract date range from filename if available (format: _YYYY-MM-DD_YYYY-MM-DD.csv)
    let dateRangeStart: string | null = null;
    let dateRangeEnd: string | null = null;
    
    if (fileName) {
      // Support formats: _2025-12-15_2025-12-21.csv, _2025-12-15_2025-12-21_3.csv, _2025-12-15_2025-12-21 (3).csv
      const datePattern = /_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})(?:[_\s]*(?:\(\d+\)|\d+))?(?:\.csv)?$/i;
      const match = fileName.match(datePattern);
      if (match) {
        dateRangeStart = match[1];
        dateRangeEnd = match[2];
        console.log("[parse-item-issues-leaderboard] Extracted date range from filename:", dateRangeStart, "to", dateRangeEnd);
      } else {
        console.log("[parse-item-issues-leaderboard] Could not extract date from filename:", fileName);
        // Return error - we require date range in filename to avoid bad data
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Impossible de détecter la période depuis le nom du fichier. Gardez le nom de fichier original d'Uber Eats (ex: Classement_articles_2025-12-15_2025-12-21.csv)",
            fileName 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    } else {
      // No filename provided
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nom de fichier requis pour détecter la période. Assurez-vous de garder le nom de fichier original d'Uber Eats." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse CSV
    const lines = csvContent.split("\n").filter((line: string) => line.trim());
    
    // Find header line - support both old and new v3 format
    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes("article") || line.includes("item") || line.includes("volume") || 
          line.includes("nombre") || line.includes("articles incorrects")) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not find header row" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const headers = parseCSVLine(lines[headerIndex]);
    console.log("[parse-item-issues-leaderboard] Headers:", headers);

    // Map columns - support both old and new v3 format
    const columnMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const lower = h.toLowerCase().trim();
      // Item title columns
      if (lower === "article" || lower === "item" || lower === "nom de l'article" || lower === "articles incorrects") columnMap.item_title = i;
      // Volume columns
      if (lower === "volume" || lower === "occurrences" || lower === "nombre") columnMap.volume = i;
      // Score columns
      if (lower === "score" || lower.includes("score")) columnMap.score = i;
      // Delta/variation columns
      if (lower.includes("variation") || lower.includes("delta") || lower.includes("%")) columnMap.issues_delta = i;
      // Issue type columns
      if (lower.includes("problème principal") || lower.includes("issue type") || lower.includes("type de problème") || lower === "problème avec le plat") columnMap.major_issue = i;
      // Customization columns - check for "oui/non" or count
      if (lower.includes("personnalisation") || lower.includes("customization") || lower === "personnalisations incorrectes") columnMap.has_customization = i;
      // Store ID column (v3 format)
      if (lower === "id. externe du restaurant" || lower === "external store id" || lower === "store_id") columnMap.store_id = i;
    });

    console.log("[parse-item-issues-leaderboard] Column mapping:", columnMap);

    // Fetch all restaurants for matching
    const { data: allRestaurants } = await supabase
      .from("restaurants")
      .select("id, name, uber_store_id");

    const restaurantsByStoreId = new Map<string, { id: string; name: string }>();
    if (allRestaurants) {
      for (const r of allRestaurants) {
        if (r.uber_store_id) {
          restaurantsByStoreId.set(r.uber_store_id, { id: r.id, name: r.name });
        }
      }
    }

    // Parse all items and group by store_id
    const parsedItems: ParsedItem[] = [];
    const skippedDetails: Array<{ rowIndex: number; reason: string; details: string }> = [];
    const storeIdsFound = new Set<string>();

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 2) continue;

      const itemTitle = values[columnMap.item_title]?.trim();
      if (!itemTitle) {
        skippedDetails.push({ rowIndex: i, reason: "no_item_title", details: "Empty item title" });
        continue;
      }

      // Parse has_missing_customization - can be "oui/non" or a number
      let hasMissingCustomization = false;
      if (columnMap.has_customization !== undefined) {
        const customValue = values[columnMap.has_customization]?.toLowerCase().trim();
        if (customValue === "oui" || customValue === "yes") {
          hasMissingCustomization = true;
        } else {
          // If it's a number > 0, consider it as having customization issues
          const numValue = parseInt(customValue);
          hasMissingCustomization = !isNaN(numValue) && numValue > 0;
        }
      }

      // Get store_id if available
      const storeId = columnMap.store_id !== undefined ? values[columnMap.store_id]?.trim() || null : null;
      if (storeId) {
        storeIdsFound.add(storeId);
      }

      parsedItems.push({
        item_title: itemTitle,
        volume: parseNumber(values[columnMap.volume]),
        score: parseFloat(values[columnMap.score]?.replace(",", ".") || "0") || 0,
        issues_delta_percent: columnMap.issues_delta !== undefined ? parsePercentage(values[columnMap.issues_delta]) : null,
        major_issue_type: values[columnMap.major_issue]?.trim() || null,
        has_missing_customization: hasMissingCustomization,
        store_id: storeId,
      });
    }

    console.log(`[parse-item-issues-leaderboard] Parsed ${parsedItems.length} items, found ${storeIdsFound.size} unique store_ids`);

    // Group items by restaurant
    const restaurantsData: RestaurantData[] = [];
    const unknownStoreIds: string[] = [];

    // If a specific restaurantId is provided, use it for ALL items (ignore store_id from CSV)
    if (restaurantId) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("id", restaurantId)
        .single();

      if (restaurant) {
        restaurantsData.push({ id: restaurant.id, name: restaurant.name, items: parsedItems });
        console.log(`[parse-item-issues-leaderboard] Using selected restaurant: ${restaurant.name} for all ${parsedItems.length} items`);
        // Still track unknown store_ids for informational purposes
        for (const storeId of storeIdsFound) {
          if (!restaurantsByStoreId.has(storeId)) {
            unknownStoreIds.push(storeId);
          }
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Restaurant with ID ${restaurantId} not found`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    } else if (storeIdsFound.size > 0) {
      // No restaurantId provided: Multi-restaurant file, group by store_id
      const itemsByStoreId = new Map<string, ParsedItem[]>();
      for (const item of parsedItems) {
        const key = item.store_id || "unknown";
        if (!itemsByStoreId.has(key)) {
          itemsByStoreId.set(key, []);
        }
        itemsByStoreId.get(key)!.push(item);
      }

      for (const [storeId, items] of itemsByStoreId) {
        if (storeId === "unknown") {
          continue; // Skip items without store_id in multi-restaurant mode
        }
        const restaurant = restaurantsByStoreId.get(storeId);
        if (restaurant) {
          restaurantsData.push({ id: restaurant.id, name: restaurant.name, items });
        } else {
          unknownStoreIds.push(storeId);
          console.warn(`[parse-item-issues-leaderboard] Unknown store_id: ${storeId} (${items.length} items)`);
        }
      }
    }

    if (restaurantsData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Aucun restaurant trouvé. Veuillez sélectionner un restaurant ou vérifier que les store_ids correspondent aux restaurants configurés.",
          unknownStoreIds: Array.from(storeIdsFound),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[parse-item-issues-leaderboard] Processing ${restaurantsData.length} restaurants`);

    // Calculate insert/update stats by checking existing records
    let toInsert = 0;
    let toUpdate = 0;

    for (const restData of restaurantsData) {
      // Fetch existing records for this restaurant and date range
      const { data: existingRecords } = await supabase
        .from("product_issues_ranking")
        .select("item_title")
        .eq("restaurant_id", restData.id)
        .eq("date_range_start", dateRangeStart)
        .eq("date_range_end", dateRangeEnd);

      const existingTitles = new Set(existingRecords?.map(r => r.item_title) || []);

      for (const item of restData.items) {
        if (existingTitles.has(item.item_title)) {
          toUpdate++;
        } else {
          toInsert++;
        }
      }
    }

    const result = {
      success: true,
      reportType: "item_issues_leaderboard",
      dryRun,
      stats: {
        totalRows: parsedItems.length,
        inserted: toInsert,
        updated: toUpdate,
        skipped: skippedDetails.length,
        errors: 0,
      },
      errorDetails: [] as string[],
      validation: {
        dateRange: {
          start: dateRangeStart,
          end: dateRangeEnd,
        },
        restaurants: restaurantsData.map(r => ({ id: r.id, name: r.name, orderCount: r.items.length })),
        unknownStoreIds,
        skippedDetails,
        autoDetectedRestaurants: restaurantsData.map(r => r.name),
      },
    };

    if (dryRun) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process each restaurant
    for (const restData of restaurantsData) {
      console.log(`[parse-item-issues-leaderboard] Processing ${restData.name}: ${restData.items.length} items`);

      // DELETE ONLY for this specific date range (not the entire year!)
      // This allows cumulative imports for different periods
      const { error: deleteError } = await supabase
        .from("product_issues_ranking")
        .delete()
        .eq("restaurant_id", restData.id)
        .eq("date_range_start", dateRangeStart)
        .eq("date_range_end", dateRangeEnd);

      if (deleteError) {
        console.error(`[parse-item-issues-leaderboard] Delete error for ${restData.name}:`, deleteError);
      } else {
        console.log(`[parse-item-issues-leaderboard] Deleted existing data for ${restData.name} period ${dateRangeStart} to ${dateRangeEnd}`);
      }

      // Build records WITH date range columns
      const records = restData.items.map(item => ({
        restaurant_id: restData.id,
        year: targetYear,
        item_title: item.item_title,
        volume: item.volume,
        score: item.score,
        issues_delta_percent: item.issues_delta_percent,
        major_issue_type: item.major_issue_type,
        has_missing_customization: item.has_missing_customization,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
      }));

      // Deduplicate records by item_title (keep record with highest volume)
      const uniqueRecords = Array.from(
        records.reduce((map, record) => {
          const existing = map.get(record.item_title);
          if (!existing || record.volume >= existing.volume) {
            map.set(record.item_title, record);
          }
          return map;
        }, new Map<string, typeof records[0]>())
      ).map(([_, record]) => record);

      console.log(`[parse-item-issues-leaderboard] ${restData.name}: ${records.length} records -> ${uniqueRecords.length} after deduplication`);

      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < uniqueRecords.length; i += batchSize) {
        const batch = uniqueRecords.slice(i, i + batchSize);
        
        const { error: upsertError, data: upsertData } = await supabase
          .from("product_issues_ranking")
          .upsert(batch, {
            onConflict: "restaurant_id,item_title,date_range_start,date_range_end",
            ignoreDuplicates: false,
          })
          .select();

        if (upsertError) {
          console.error(`[parse-item-issues-leaderboard] Upsert error for ${restData.name}:`, upsertError);
          result.stats.errors += batch.length;
          result.errorDetails.push(`${restData.name}: ${upsertError.message}`);
        } else {
          result.stats.inserted += upsertData?.length || batch.length;
        }
      }
    }

    console.log(`[parse-item-issues-leaderboard] Import complete: ${result.stats.inserted} inserted, ${result.stats.errors} errors`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[parse-item-issues-leaderboard] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d-]/g, "");
  return parseInt(cleaned) || 0;
}

function parsePercentage(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[%\s]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
