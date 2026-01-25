import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuccessScoreRow {
  storeName: string;
  status: string;
  operationalExcellence: number | null;
  ratings: number | null;
  menuDetails: number | null;
  menuMarkup: number | null;
  sustainablePackaging: number | null;
  currencyCode: string;
  sales: number;
}

// Map English status to database values
function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'excellent': 'Excellent',
    'great': 'Great',
    'good': 'Good',
    'fair': 'Fair',
    'poor': 'Poor',
  };
  return statusMap[status.toLowerCase()] || 'Fair';
}

// Normalize store name for matching
function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, scoreMonth } = await req.json();
    
    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: "No CSV content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have header and at least one data row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    console.log("CSV Headers:", headers);
    
    // Map headers (handle variations)
    const storeNameIdx = headers.findIndex((h: string) => h.includes('store name') || h.includes('nom') || h.includes('restaurant'));
    const statusIdx = headers.findIndex((h: string) => h === 'status' || h === 'statut');
    const opExIdx = headers.findIndex((h: string) => h.includes('operational') || h.includes('opérationnel'));
    const ratingsIdx = headers.findIndex((h: string) => h === 'ratings' || h.includes('note'));
    const menuDetailsIdx = headers.findIndex((h: string) => h.includes('menu details') || h.includes('détails menu'));
    const menuMarkupIdx = headers.findIndex((h: string) => h.includes('menu markup') || h.includes('majoration'));
    const sustainableIdx = headers.findIndex((h: string) => h.includes('sustainable') || h.includes('emballage'));
    const currencyIdx = headers.findIndex((h: string) => h.includes('currency') || h.includes('devise'));
    const salesIdx = headers.findIndex((h: string) => h === 'sales' || h.includes('ventes') || h.includes('ca'));

    if (storeNameIdx === -1 || statusIdx === -1) {
      return new Response(
        JSON.stringify({ error: "Required columns not found: Store name and Status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse data rows
    const parsedRows: SuccessScoreRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v: string) => v.trim());
      if (values.length < 2) continue;
      
      const parseNumber = (idx: number): number | null => {
        if (idx === -1) return null;
        const val = values[idx];
        if (!val || val === 'NA' || val === 'N/A' || val === '') return null;
        const num = parseFloat(val.replace(',', '.'));
        return isNaN(num) ? null : num;
      };

      parsedRows.push({
        storeName: values[storeNameIdx] || '',
        status: values[statusIdx] || 'Fair',
        operationalExcellence: parseNumber(opExIdx),
        ratings: parseNumber(ratingsIdx),
        menuDetails: parseNumber(menuDetailsIdx),
        menuMarkup: parseNumber(menuMarkupIdx),
        sustainablePackaging: parseNumber(sustainableIdx),
        currencyCode: currencyIdx !== -1 ? values[currencyIdx] || 'EUR' : 'EUR',
        sales: parseNumber(salesIdx) || 0,
      });
    }

    console.log(`Parsed ${parsedRows.length} rows`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all restaurants for matching
    const { data: restaurants, error: restError } = await supabase
      .from('restaurants')
      .select('id, name');

    if (restError) {
      console.error("Error fetching restaurants:", restError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch restaurants" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build normalized name map
    const restaurantMap = new Map<string, { id: string; name: string }>();
    for (const rest of restaurants || []) {
      const normalized = normalizeStoreName(rest.name);
      restaurantMap.set(normalized, { id: rest.id, name: rest.name });
    }

    // Match and prepare inserts
    const scoreMonthDate = scoreMonth || new Date().toISOString().slice(0, 7) + '-01';
    const matched: Array<{
      restaurant_id: string;
      restaurant_name: string;
      score_month: string;
      score_tier: string;
      operational_excellence: number | null;
      ratings: number | null;
      menu_details: number | null;
      sustainable_packaging: number | null;
      sales_amount: number;
      currency_code: string;
    }> = [];
    const unmatched: string[] = [];

    for (const row of parsedRows) {
      const normalizedName = normalizeStoreName(row.storeName);
      
      // Try exact match first
      let match = restaurantMap.get(normalizedName);
      
      // Try partial match
      if (!match) {
        for (const [key, value] of restaurantMap.entries()) {
          if (key.includes(normalizedName) || normalizedName.includes(key)) {
            match = value;
            break;
          }
        }
      }
      
      // Try even looser match (extract city/location from name)
      if (!match) {
        const parts = row.storeName.split('-').map((p: string) => p.trim().toLowerCase());
        for (const part of parts) {
          if (part.length < 3) continue;
          for (const [key, value] of restaurantMap.entries()) {
            if (key.includes(part)) {
              match = value;
              break;
            }
          }
          if (match) break;
        }
      }

      if (match) {
        matched.push({
          restaurant_id: match.id,
          restaurant_name: match.name,
          score_month: scoreMonthDate,
          score_tier: mapStatus(row.status),
          operational_excellence: row.operationalExcellence,
          ratings: row.ratings,
          menu_details: row.menuDetails,
          sustainable_packaging: row.sustainablePackaging,
          sales_amount: row.sales,
          currency_code: row.currencyCode,
        });
      } else {
        unmatched.push(row.storeName);
      }
    }

    console.log(`Matched: ${matched.length}, Unmatched: ${unmatched.length}`);

    // Upsert data
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const record of matched) {
      // Check if exists
      const { data: existing } = await supabase
        .from('success_scores')
        .select('id')
        .eq('restaurant_id', record.restaurant_id)
        .eq('score_month', record.score_month)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from('success_scores')
          .update({
            score_tier: record.score_tier,
            operational_excellence: record.operational_excellence,
            ratings: record.ratings,
            menu_details: record.menu_details,
            sustainable_packaging: record.sustainable_packaging,
            sales_amount: record.sales_amount,
            currency_code: record.currency_code,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error("Update error:", updateError);
          errorCount++;
        } else {
          updatedCount++;
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { restaurant_name, ...recordToInsert } = record;
        const { error: insertError } = await supabase
          .from('success_scores')
          .insert(recordToInsert);

        if (insertError) {
          console.error("Insert error:", insertError);
          errorCount++;
        } else {
          insertedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalRows: parsedRows.length,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: unmatched.length,
          errors: errorCount,
        },
        validation: {
          restaurants: matched.map(m => ({
            id: m.restaurant_id,
            name: m.restaurant_name,
            orderCount: 1,
          })),
          unmatchedStores: unmatched,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing success score CSV:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
