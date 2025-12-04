import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SalesRow {
  restaurant_id: string;
  date: string;
  revenue_ttc: number;
  order_count: number;
  average_basket: number;
  period_type: "current" | "previous";
  platform: string;
  currency: string;
}

interface ParseResult {
  success: boolean;
  reportType: string;
  dryRun: boolean;
  stats: {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  validation: {
    dateRange: {
      start: string | null;
      end: string | null;
    };
    restaurants: Array<{ id: string; name: string; orderCount: number }>;
  };
  errorDetails: string[];
}

// Parse CSV line handling quoted fields
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

// Parse numeric value from string (handles comma decimal separator)
function parseNumeric(value: string): number {
  if (!value || value.trim() === "") return 0;
  // Replace comma with dot for decimal separator
  const cleaned = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Parse date from "2025-11-01 00:00:00.000" format
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  
  // Extract date part (YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, restaurantId, dryRun = false } = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ success: false, error: "csvContent is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!restaurantId) {
      return new Response(
        JSON.stringify({ success: false, error: "restaurantId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[parse-sales-over-time] Starting parse, dryRun=${dryRun}, restaurantId=${restaurantId}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch restaurant name for validation display
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .single();

    if (!restaurant) {
      return new Response(
        JSON.stringify({ success: false, error: "Restaurant not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Parse CSV
    const lines = csvContent.split("\n").filter((line: string) => line.trim());
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "CSV file is empty or invalid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Find header row
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].includes("Période") && lines[i].includes("Ventes")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not find CSV headers (Période, Ventes)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const headers = parseCSVLine(lines[headerRowIndex]);
    console.log(`[parse-sales-over-time] Headers found:`, headers);

    // Map header indices
    const headerMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      headerMap[h.toLowerCase().trim()] = idx;
    });

    // Required columns
    const periodIdx = headerMap["période"] ?? headerMap["periode"];
    const dateStartIdx = headerMap["date de début"] ?? headerMap["date de debut"];
    const salesIdx = headerMap["ventes"];
    const ordersIdx = headerMap["commandes"];
    const basketIdx = headerMap["panier moyen"];
    const currencyIdx = headerMap["code de devise"];

    if (periodIdx === undefined || dateStartIdx === undefined || salesIdx === undefined || ordersIdx === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required columns. Found: ${headers.join(", ")}` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Parse data rows
    const dataLines = lines.slice(headerRowIndex + 1);
    const rows: SalesRow[] = [];
    const errorDetails: string[] = [];
    let skipped = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line.trim()) continue;

      const values = parseCSVLine(line);
      
      const periodRaw = values[periodIdx]?.trim();
      const dateRaw = values[dateStartIdx]?.trim();
      const salesRaw = values[salesIdx];
      const ordersRaw = values[ordersIdx];
      const basketRaw = basketIdx !== undefined ? values[basketIdx] : undefined;
      const currencyRaw = currencyIdx !== undefined ? values[currencyIdx]?.trim() : "EUR";

      // Parse period type
      let periodType: "current" | "previous";
      if (periodRaw?.toLowerCase().includes("cette période") || periodRaw?.toLowerCase().includes("cette periode")) {
        periodType = "current";
      } else if (periodRaw?.toLowerCase().includes("dernière période") || periodRaw?.toLowerCase().includes("derniere periode")) {
        periodType = "previous";
      } else {
        console.log(`[parse-sales-over-time] Unknown period type at line ${i + 2}: ${periodRaw}`);
        skipped++;
        continue;
      }

      // Parse date
      const date = parseDate(dateRaw);
      if (!date) {
        console.log(`[parse-sales-over-time] Invalid date at line ${i + 2}: ${dateRaw}`);
        skipped++;
        continue;
      }

      // Parse numeric values
      const revenue_ttc = parseNumeric(salesRaw);
      const order_count = Math.round(parseNumeric(ordersRaw));
      const average_basket = basketRaw ? parseNumeric(basketRaw) : (order_count > 0 ? revenue_ttc / order_count : 0);

      rows.push({
        restaurant_id: restaurantId,
        date,
        revenue_ttc,
        order_count,
        average_basket: Math.round(average_basket * 100) / 100,
        period_type: periodType,
        platform: "uber_eats",
        currency: currencyRaw || "EUR",
      });
    }

    console.log(`[parse-sales-over-time] Parsed ${rows.length} rows, skipped ${skipped}`);

    // Calculate stats
    const currentRows = rows.filter(r => r.period_type === "current");
    const dates = currentRows.map(r => r.date).sort();
    const totalOrders = currentRows.reduce((sum, r) => sum + r.order_count, 0);

    const result: ParseResult = {
      success: true,
      reportType: "sales_over_time",
      dryRun,
      stats: {
        totalRows: rows.length,
        inserted: 0,
        updated: 0,
        skipped,
        errors: 0,
      },
      validation: {
        dateRange: {
          start: dates[0] || null,
          end: dates[dates.length - 1] || null,
        },
        restaurants: [
          {
            id: restaurant.id,
            name: restaurant.name,
            orderCount: totalOrders,
          },
        ],
      },
      errorDetails,
    };

    // If dry run, return validation results
    if (dryRun) {
      result.stats.inserted = rows.length;
      console.log(`[parse-sales-over-time] Dry run complete, ${rows.length} rows would be inserted`);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert data
    const { error: upsertError, data: upsertData } = await supabase
      .from("daily_sales_uber")
      .upsert(rows, {
        onConflict: "restaurant_id,date,platform,period_type",
        ignoreDuplicates: false,
      })
      .select();

    if (upsertError) {
      console.error(`[parse-sales-over-time] Upsert error:`, upsertError);
      result.success = false;
      result.stats.errors = rows.length;
      result.errorDetails.push(upsertError.message);
    } else {
      result.stats.inserted = upsertData?.length || rows.length;
      console.log(`[parse-sales-over-time] Upsert complete, ${result.stats.inserted} rows`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[parse-sales-over-time] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
