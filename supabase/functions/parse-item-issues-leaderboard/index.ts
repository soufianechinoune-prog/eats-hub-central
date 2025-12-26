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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, restaurantId, year, dryRun = false } = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ success: false, error: "csvContent is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const targetYear = year || new Date().getFullYear();
    console.log("[parse-item-issues-leaderboard] Starting parse, year:", targetYear);

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

    // Try to auto-detect restaurant from store_id in data
    let detectedRestaurantId = restaurantId;
    let detectedStoreId: string | null = null;

    if (columnMap.store_id !== undefined && !restaurantId) {
      // Look for store_id in first data row
      if (headerIndex + 1 < lines.length) {
        const firstDataRow = parseCSVLine(lines[headerIndex + 1]);
        const storeIdValue = firstDataRow[columnMap.store_id]?.trim();
        
        if (storeIdValue) {
          detectedStoreId = storeIdValue;
          console.log("[parse-item-issues-leaderboard] Detected store_id:", storeIdValue);
          
          // Try to find restaurant by uber_store_id
          const { data: restaurantByStoreId } = await supabase
            .from("restaurants")
            .select("id, name, uber_store_id")
            .eq("uber_store_id", storeIdValue)
            .single();
          
          if (restaurantByStoreId) {
            detectedRestaurantId = restaurantByStoreId.id;
            console.log("[parse-item-issues-leaderboard] Auto-detected restaurant:", restaurantByStoreId.name);
          }
        }
      }
    }

    if (!detectedRestaurantId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Restaurant not found. Please select a restaurant or ensure the store_id matches a configured restaurant.",
          detectedStoreId 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Verify restaurant exists
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", detectedRestaurantId)
      .single();

    if (restError || !restaurant) {
      return new Response(
        JSON.stringify({ success: false, error: "Restaurant not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const parsedItems: ParsedItem[] = [];
    const skippedDetails: Array<{ rowIndex: number; reason: string; details: string }> = [];

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

      parsedItems.push({
        item_title: itemTitle,
        volume: parseNumber(values[columnMap.volume]),
        score: parseFloat(values[columnMap.score]?.replace(",", ".") || "0") || 0,
        issues_delta_percent: columnMap.issues_delta !== undefined ? parsePercentage(values[columnMap.issues_delta]) : null,
        major_issue_type: values[columnMap.major_issue]?.trim() || null,
        has_missing_customization: hasMissingCustomization,
      });
    }

    console.log(`[parse-item-issues-leaderboard] Parsed ${parsedItems.length} items for ${restaurant.name}`);

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
          start: `${targetYear}-01-01`,
          end: `${targetYear}-12-31`,
        },
        restaurants: [{ id: restaurant.id, name: restaurant.name, orderCount: parsedItems.length }],
        unknownStoreIds: [] as string[],
        skippedDetails,
        autoDetectedRestaurant: restaurantId ? null : restaurant.name,
        detectedStoreId,
      },
    };

    if (dryRun) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete existing items for this restaurant/year before inserting new ones
    const { error: deleteError } = await supabase
      .from("product_issues_ranking")
      .delete()
      .eq("restaurant_id", detectedRestaurantId)
      .eq("year", targetYear);

    if (deleteError) {
      console.error("[parse-item-issues-leaderboard] Delete error:", deleteError);
    }

    // Insert data
    for (const item of parsedItems) {
      const { error: insertError } = await supabase
        .from("product_issues_ranking")
        .insert({
          restaurant_id: detectedRestaurantId,
          year: targetYear,
          item_title: item.item_title,
          volume: item.volume,
          score: item.score,
          issues_delta_percent: item.issues_delta_percent,
          major_issue_type: item.major_issue_type,
          has_missing_customization: item.has_missing_customization,
        });

      if (insertError) {
        console.error("[parse-item-issues-leaderboard] Insert error:", insertError);
        result.stats.errors++;
        result.errorDetails.push(`Item "${item.item_title}": ${insertError.message}`);
      } else {
        result.stats.inserted++;
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
