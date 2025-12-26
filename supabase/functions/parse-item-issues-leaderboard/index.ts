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
      const datePattern = /_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$/i;
      const match = fileName.match(datePattern);
      if (match) {
        dateRangeStart = match[1];
        dateRangeEnd = match[2];
        console.log("[parse-item-issues-leaderboard] Extracted date range from filename:", dateRangeStart, "to", dateRangeEnd);
      }
    }

    // Fallback to year range if no date in filename
    if (!dateRangeStart || !dateRangeEnd) {
      dateRangeStart = `${targetYear}-01-01`;
      dateRangeEnd = `${targetYear}-12-31`;
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

    if (storeIdsFound.size > 0) {
      // Multi-restaurant file: group by store_id
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
          // Items without store_id - use provided restaurantId if available
          if (restaurantId) {
            const { data: rest } = await supabase
              .from("restaurants")
              .select("id, name")
              .eq("id", restaurantId)
              .single();
            if (rest) {
              restaurantsData.push({ id: rest.id, name: rest.name, items });
            }
          }
        } else {
          const restaurant = restaurantsByStoreId.get(storeId);
          if (restaurant) {
            restaurantsData.push({ id: restaurant.id, name: restaurant.name, items });
          } else {
            unknownStoreIds.push(storeId);
            console.warn(`[parse-item-issues-leaderboard] Unknown store_id: ${storeId} (${items.length} items)`);
          }
        }
      }
    } else if (restaurantId) {
      // Single restaurant file: use provided restaurantId
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("id", restaurantId)
        .single();

      if (restaurant) {
        restaurantsData.push({ id: restaurant.id, name: restaurant.name, items: parsedItems });
      }
    }

    if (restaurantsData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No restaurants found. Please select a restaurant or ensure the store_ids match configured restaurants.",
          unknownStoreIds: Array.from(storeIdsFound),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[parse-item-issues-leaderboard] Processing ${restaurantsData.length} restaurants`);

    const result = {
      success: true,
      reportType: "item_issues_leaderboard",
      dryRun,
      stats: {
        totalRows: parsedItems.length,
        inserted: 0,
        updated: 0,
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

      // Delete existing items for this restaurant/year before inserting new ones
      const { error: deleteError } = await supabase
        .from("product_issues_ranking")
        .delete()
        .eq("restaurant_id", restData.id)
        .eq("year", targetYear);

      if (deleteError) {
        console.error(`[parse-item-issues-leaderboard] Delete error for ${restData.name}:`, deleteError);
      }

      // Batch insert with upsert for safety
      const records = restData.items.map(item => ({
        restaurant_id: restData.id,
        year: targetYear,
        item_title: item.item_title,
        volume: item.volume,
        score: item.score,
        issues_delta_percent: item.issues_delta_percent,
        major_issue_type: item.major_issue_type,
        has_missing_customization: item.has_missing_customization,
      }));

      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        const { error: upsertError, data: upsertData } = await supabase
          .from("product_issues_ranking")
          .upsert(batch, {
            onConflict: "restaurant_id,year,item_title",
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
