import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedRow {
  month: string;
  year: number;
  monthNum: number;
  incorrect_orders_count: number;
  missing_items_count: number;
  missing_items_refund: number;
  missing_customization_count: number;
  missing_customization_refund: number;
  wrong_order_count: number;
  wrong_order_refund: number;
  incorrect_item_count: number;
  incorrect_item_refund: number;
  total_refund: number;
  period_type: "current" | "previous";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, restaurantId, dryRun = false } = await req.json();

    if (!csvContent || !restaurantId) {
      return new Response(
        JSON.stringify({ success: false, error: "csvContent and restaurantId are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("[parse-order-accuracy-summary] Starting parse for restaurant:", restaurantId);

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
      if (line.includes("mois") || line.includes("month") || line.includes("commandes incorrectes")) {
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
    console.log("[parse-order-accuracy-summary] Headers:", headers);

    // Map columns
    const columnMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const lower = h.toLowerCase().trim();
      if (lower === "mois" || lower === "month") columnMap.month = i;
      if (lower.includes("commandes incorrectes") && !lower.includes("l'année dernière")) columnMap.incorrect_orders = i;
      if (lower.includes("commandes incorrectes") && lower.includes("l'année dernière")) columnMap.incorrect_orders_prev = i;
      if (lower.includes("articles manquants") && !lower.includes("remboursé")) columnMap.missing_items = i;
      if (lower.includes("articles manquants") && lower.includes("remboursé")) columnMap.missing_items_refund = i;
      if (lower.includes("personnalisation manquante") && !lower.includes("remboursé")) columnMap.missing_customization = i;
      if (lower.includes("personnalisation manquante") && lower.includes("remboursé")) columnMap.missing_customization_refund = i;
      if (lower.includes("mauvaise commande") && !lower.includes("remboursé")) columnMap.wrong_order = i;
      if (lower.includes("mauvaise commande") && lower.includes("remboursé")) columnMap.wrong_order_refund = i;
      if (lower.includes("article incorrect") && !lower.includes("remboursé")) columnMap.incorrect_item = i;
      if (lower.includes("article incorrect") && lower.includes("remboursé")) columnMap.incorrect_item_refund = i;
      if (lower.includes("total remboursé") || (lower === "remboursé" && !lower.includes("article"))) columnMap.total_refund = i;
    });

    console.log("[parse-order-accuracy-summary] Column mapping:", columnMap);

    const monthNameToNum: Record<string, number> = {
      "janvier": 1, "january": 1, "jan": 1,
      "février": 2, "february": 2, "feb": 2, "fév": 2,
      "mars": 3, "march": 3, "mar": 3,
      "avril": 4, "april": 4, "apr": 4, "avr": 4,
      "mai": 5, "may": 5,
      "juin": 6, "june": 6, "jun": 6,
      "juillet": 7, "july": 7, "jul": 7, "juil": 7,
      "août": 8, "august": 8, "aug": 8, "aout": 8,
      "septembre": 9, "september": 9, "sep": 9, "sept": 9,
      "octobre": 10, "october": 10, "oct": 10,
      "novembre": 11, "november": 11, "nov": 11,
      "décembre": 12, "december": 12, "dec": 12, "déc": 12,
    };

    const parsedRows: ParsedRow[] = [];
    const currentYear = new Date().getFullYear();
    const skippedDetails: Array<{ rowIndex: number; reason: string; details: string }> = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 2) continue;

      const monthStr = values[columnMap.month]?.toLowerCase().trim();
      if (!monthStr) continue;

      // Skip totals row
      if (monthStr.includes("total") || monthStr.includes("tous")) {
        skippedDetails.push({ rowIndex: i, reason: "total_row", details: monthStr });
        continue;
      }

      const monthNum = monthNameToNum[monthStr];
      if (!monthNum) {
        skippedDetails.push({ rowIndex: i, reason: "unknown_month", details: monthStr });
        continue;
      }

      // Determine year based on month (if future month, it's previous year)
      const currentMonth = new Date().getMonth() + 1;
      const year = monthNum > currentMonth ? currentYear - 1 : currentYear;

      parsedRows.push({
        month: monthStr,
        year,
        monthNum,
        incorrect_orders_count: parseNumber(values[columnMap.incorrect_orders]),
        missing_items_count: parseNumber(values[columnMap.missing_items]),
        missing_items_refund: parseCurrency(values[columnMap.missing_items_refund]),
        missing_customization_count: parseNumber(values[columnMap.missing_customization]),
        missing_customization_refund: parseCurrency(values[columnMap.missing_customization_refund]),
        wrong_order_count: parseNumber(values[columnMap.wrong_order]),
        wrong_order_refund: parseCurrency(values[columnMap.wrong_order_refund]),
        incorrect_item_count: parseNumber(values[columnMap.incorrect_item]),
        incorrect_item_refund: parseCurrency(values[columnMap.incorrect_item_refund]),
        total_refund: parseCurrency(values[columnMap.total_refund]),
        period_type: "current",
      });
    }

    console.log(`[parse-order-accuracy-summary] Parsed ${parsedRows.length} rows`);

    const result = {
      success: true,
      reportType: "order_accuracy_summary",
      dryRun,
      stats: {
        totalRows: parsedRows.length,
        inserted: 0,
        updated: 0,
        skipped: skippedDetails.length,
        errors: 0,
      },
      errorDetails: [] as string[],
      validation: {
        dateRange: {
          start: parsedRows.length > 0 ? `${Math.min(...parsedRows.map(r => r.year))}-${String(Math.min(...parsedRows.map(r => r.monthNum))).padStart(2, "0")}-01` : null,
          end: parsedRows.length > 0 ? `${Math.max(...parsedRows.map(r => r.year))}-${String(Math.max(...parsedRows.map(r => r.monthNum))).padStart(2, "0")}-28` : null,
        },
        restaurants: [{ id: restaurant.id, name: restaurant.name, orderCount: parsedRows.length }],
        unknownStoreIds: [] as string[],
        skippedDetails,
      },
    };

    if (dryRun) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert data
    for (const row of parsedRows) {
      const { error: upsertError } = await supabase
        .from("monthly_order_accuracy")
        .upsert({
          restaurant_id: restaurantId,
          year: row.year,
          month: row.monthNum,
          period_type: row.period_type,
          incorrect_orders_count: row.incorrect_orders_count,
          missing_items_count: row.missing_items_count,
          missing_items_refund: row.missing_items_refund,
          missing_customization_count: row.missing_customization_count,
          missing_customization_refund: row.missing_customization_refund,
          wrong_order_count: row.wrong_order_count,
          wrong_order_refund: row.wrong_order_refund,
          incorrect_item_count: row.incorrect_item_count,
          incorrect_item_refund: row.incorrect_item_refund,
          total_refund: row.total_refund,
        }, {
          onConflict: "restaurant_id,year,month,period_type",
        });

      if (upsertError) {
        console.error("[parse-order-accuracy-summary] Upsert error:", upsertError);
        result.stats.errors++;
        result.errorDetails.push(`Month ${row.monthNum}/${row.year}: ${upsertError.message}`);
      } else {
        result.stats.inserted++;
      }
    }

    console.log(`[parse-order-accuracy-summary] Import complete: ${result.stats.inserted} inserted, ${result.stats.errors} errors`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[parse-order-accuracy-summary] Error:", error);
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

function parseCurrency(value: string | undefined): number {
  if (!value) return 0;
  // Handle "1 234,56 €" or "1234.56" formats
  let cleaned = value.replace(/[€$\s]/g, "").replace(/\u00A0/g, "");
  // Convert French format (1 234,56) to number
  cleaned = cleaned.replace(/\s/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}
