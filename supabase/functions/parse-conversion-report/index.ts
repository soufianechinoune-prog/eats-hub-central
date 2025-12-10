import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversionRow {
  restaurant_id: string;
  date: string;
  visits: number;
  menu_views: number;
  add_to_cart: number;
  orders: number;
  view_rate: number | null;
  cart_rate: number | null;
  conversion_rate: number | null;
  overall_rate: number | null;
  platform: string;
  is_averaged: boolean;
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
    periodInfo: {
      totalPeriods: number;
      singleDayPeriods: number;
      multiDayPeriods: number;
      averagedDays: number;
    };
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

// Parse date from various formats like "2025-11-01" or "2025-11-01 00:00:00.000"
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  
  // Extract date part (YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  
  return null;
}

// Calculate number of days between two dates (inclusive)
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Generate all dates between start and end (inclusive)
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Calculate conversion rates
function calcRates(visits: number, menuViews: number, addToCart: number, orders: number) {
  return {
    view_rate: visits > 0 ? Math.round((menuViews / visits) * 10000) / 100 : null,
    cart_rate: menuViews > 0 ? Math.round((addToCart / menuViews) * 10000) / 100 : null,
    conversion_rate: addToCart > 0 ? Math.round((orders / addToCart) * 10000) / 100 : null,
    overall_rate: visits > 0 ? Math.round((orders / visits) * 10000) / 100 : null,
  };
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

    console.log(`[parse-conversion-report] Starting parse, dryRun=${dryRun}, restaurantId=${restaurantId}`);

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

    // Find header row - look for conversion-specific columns
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      // Check for French conversion headers
      if ((line.includes("utilisateurs ayant visité") || line.includes("utilisateurs ayant visite")) &&
          (line.includes("menu a été consulté") || line.includes("menu a ete consulte") || line.includes("menu consulté"))) {
        headerRowIndex = i;
        break;
      }
      // Alternative: check for date columns + numeric columns
      if (line.includes("date de début") && line.includes("date de fin") && 
          (line.includes("commandes") || line.includes("orders"))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Could not find CSV headers. Expected columns: Date de début, Date de fin, Utilisateurs ayant visité, etc." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const headers = parseCSVLine(lines[headerRowIndex]);
    console.log(`[parse-conversion-report] Headers found:`, headers);

    // Map header indices (handle various French column naming)
    const headerMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      const lh = h.toLowerCase().trim();
      headerMap[lh] = idx;
    });

    // Find column indices with various name variations
    const findColumn = (variations: string[]): number | undefined => {
      for (const v of variations) {
        const found = Object.entries(headerMap).find(([key]) => key.includes(v.toLowerCase()));
        if (found) return found[1];
      }
      return undefined;
    };

    const periodIdx = findColumn(["période", "periode"]);
    const dateStartIdx = findColumn(["date de début", "date de debut"]);
    const dateEndIdx = findColumn(["date de fin"]);
    const visitsIdx = findColumn(["utilisateurs ayant visité", "utilisateurs ayant visite", "visits"]);
    const menuViewsIdx = findColumn(["menu a été consulté", "menu a ete consulte", "menu consulté", "menu views"]);
    const addToCartIdx = findColumn(["plat ajouté", "plat ajoute", "ajouté à la commande", "add to cart"]);
    const ordersIdx = findColumn(["commandes passées", "commandes passees", "commandes", "orders"]);

    console.log(`[parse-conversion-report] Column indices: period=${periodIdx}, dateStart=${dateStartIdx}, dateEnd=${dateEndIdx}, visits=${visitsIdx}, menuViews=${menuViewsIdx}, addToCart=${addToCartIdx}, orders=${ordersIdx}`);

    if (dateStartIdx === undefined || dateEndIdx === undefined || visitsIdx === undefined || 
        menuViewsIdx === undefined || addToCartIdx === undefined || ordersIdx === undefined) {
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
    const rows: ConversionRow[] = [];
    const errorDetails: string[] = [];
    let skipped = 0;
    let singleDayPeriods = 0;
    let multiDayPeriods = 0;
    let averagedDays = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line.trim()) continue;

      const values = parseCSVLine(line);
      
      const periodRaw = periodIdx !== undefined ? values[periodIdx]?.trim() : "";
      const dateStartRaw = values[dateStartIdx]?.trim();
      const dateEndRaw = values[dateEndIdx]?.trim();

      // Only process "Cette période" rows, skip N-1 comparison rows for now
      if (periodRaw && periodRaw.toLowerCase().includes("dernière période")) {
        console.log(`[parse-conversion-report] Skipping N-1 row at line ${i + 2}`);
        skipped++;
        continue;
      }

      // Parse dates
      const startDate = parseDate(dateStartRaw);
      const endDate = parseDate(dateEndRaw);

      if (!startDate || !endDate) {
        console.log(`[parse-conversion-report] Invalid dates at line ${i + 2}: start=${dateStartRaw}, end=${dateEndRaw}`);
        skipped++;
        continue;
      }

      // Parse numeric values
      const visits = Math.round(parseNumeric(values[visitsIdx]));
      const menuViews = Math.round(parseNumeric(values[menuViewsIdx]));
      const addToCart = Math.round(parseNumeric(values[addToCartIdx]));
      const orders = Math.round(parseNumeric(values[ordersIdx]));

      // Calculate period duration
      const periodDays = daysBetween(startDate, endDate);
      
      if (periodDays === 1) {
        // Single day - store exact data
        singleDayPeriods++;
        const rates = calcRates(visits, menuViews, addToCart, orders);
        
        rows.push({
          restaurant_id: restaurantId,
          date: startDate,
          visits,
          menu_views: menuViews,
          add_to_cart: addToCart,
          orders,
          ...rates,
          platform: "uber_eats",
          is_averaged: false,
        });
      } else {
        // Multi-day period - distribute evenly across all days
        multiDayPeriods++;
        averagedDays += periodDays;
        
        const dailyVisits = Math.round(visits / periodDays);
        const dailyMenuViews = Math.round(menuViews / periodDays);
        const dailyAddToCart = Math.round(addToCart / periodDays);
        const dailyOrders = Math.round(orders / periodDays);
        
        // Rates are calculated from distributed values (same as aggregated rates)
        const rates = calcRates(dailyVisits, dailyMenuViews, dailyAddToCart, dailyOrders);
        
        // Generate rows for each day in the period
        const dateRange = getDateRange(startDate, endDate);
        for (const date of dateRange) {
          rows.push({
            restaurant_id: restaurantId,
            date,
            visits: dailyVisits,
            menu_views: dailyMenuViews,
            add_to_cart: dailyAddToCart,
            orders: dailyOrders,
            ...rates,
            platform: "uber_eats",
            is_averaged: true,
          });
        }
      }
    }

    console.log(`[parse-conversion-report] Parsed ${rows.length} daily rows from ${singleDayPeriods + multiDayPeriods} periods (${singleDayPeriods} single-day, ${multiDayPeriods} multi-day covering ${averagedDays} days)`);

    // Calculate stats
    const dates = rows.map(r => r.date).sort();
    const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0);

    const result: ParseResult = {
      success: true,
      reportType: "conversion",
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
        periodInfo: {
          totalPeriods: singleDayPeriods + multiDayPeriods,
          singleDayPeriods,
          multiDayPeriods,
          averagedDays,
        },
      },
      errorDetails,
    };

    // If dry run, return validation results
    if (dryRun) {
      result.stats.inserted = rows.length;
      console.log(`[parse-conversion-report] Dry run complete, ${rows.length} rows would be inserted`);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert data
    const { error: upsertError, data: upsertData } = await supabase
      .from("daily_conversion")
      .upsert(rows, {
        onConflict: "restaurant_id,date,platform",
        ignoreDuplicates: false,
      })
      .select();

    if (upsertError) {
      console.error(`[parse-conversion-report] Upsert error:`, upsertError);
      result.success = false;
      result.stats.errors = rows.length;
      result.errorDetails.push(upsertError.message);
    } else {
      result.stats.inserted = upsertData?.length || rows.length;
      console.log(`[parse-conversion-report] Upsert complete, ${result.stats.inserted} rows`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[parse-conversion-report] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
