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

    if (!csvContent || !restaurantId) {
      return new Response(
        JSON.stringify({ success: false, error: "csvContent and restaurantId are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const targetYear = year || new Date().getFullYear();
    console.log("[parse-item-issues-leaderboard] Starting parse for restaurant:", restaurantId, "year:", targetYear);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify restaurant exists
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .single();

    if (restError || !restaurant) {
      return new Response(
        JSON.stringify({ success: false, error: "Restaurant not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Parse CSV
    const lines = csvContent.split("\n").filter((line: string) => line.trim());
    
    // Find header line
    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes("article") || line.includes("item") || line.includes("volume")) {
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

    // Map columns
    const columnMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const lower = h.toLowerCase().trim();
      if (lower === "article" || lower === "item" || lower === "nom de l'article") columnMap.item_title = i;
      if (lower === "volume" || lower === "occurrences") columnMap.volume = i;
      if (lower === "score" || lower.includes("score")) columnMap.score = i;
      if (lower.includes("variation") || lower.includes("delta") || lower.includes("%")) columnMap.issues_delta = i;
      if (lower.includes("problème principal") || lower.includes("issue type") || lower.includes("type de problème")) columnMap.major_issue = i;
      if (lower.includes("personnalisation") || lower.includes("customization")) columnMap.has_customization = i;
    });

    console.log("[parse-item-issues-leaderboard] Column mapping:", columnMap);

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

      parsedItems.push({
        item_title: itemTitle,
        volume: parseNumber(values[columnMap.volume]),
        score: parseFloat(values[columnMap.score]?.replace(",", ".") || "0") || 0,
        issues_delta_percent: columnMap.issues_delta !== undefined ? parsePercentage(values[columnMap.issues_delta]) : null,
        major_issue_type: values[columnMap.major_issue]?.trim() || null,
        has_missing_customization: columnMap.has_customization !== undefined 
          ? (values[columnMap.has_customization]?.toLowerCase().includes("oui") || values[columnMap.has_customization]?.toLowerCase() === "yes")
          : false,
      });
    }

    console.log(`[parse-item-issues-leaderboard] Parsed ${parsedItems.length} items`);

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
      .eq("restaurant_id", restaurantId)
      .eq("year", targetYear);

    if (deleteError) {
      console.error("[parse-item-issues-leaderboard] Delete error:", deleteError);
    }

    // Insert data
    for (const item of parsedItems) {
      const { error: insertError } = await supabase
        .from("product_issues_ranking")
        .insert({
          restaurant_id: restaurantId,
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
