import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  reportType?: string;        // default: PAYMENT_DETAILS_REPORT
  restaurantIds?: string[];   // if omitted: all Chicken Street with uber_store_id
  months: { year: number; month: number }[]; // e.g. [{year:2026, month:2}]
  testMode?: boolean;         // if true: limit to 1 restaurant
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: BackfillRequest = await req.json();
    const reportType = body.reportType || 'PAYMENT_DETAILS_REPORT';
    const months = body.months || [];
    const testMode = body.testMode === true;

    if (months.length === 0) {
      return new Response(JSON.stringify({ error: 'months[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve target restaurants
    let restaurantIds = body.restaurantIds || [];
    if (restaurantIds.length === 0) {
      const { data: restos, error } = await supabase
        .from('restaurants')
        .select('id, name, uber_store_id')
        .not('uber_store_id', 'is', null)
        .neq('uber_store_id', '');
      if (error) throw error;
      restaurantIds = (restos || []).map((r: any) => r.id);
    }

    if (testMode) {
      restaurantIds = restaurantIds.slice(0, 1);
    }

    console.log(`Backfill: ${restaurantIds.length} restos × ${months.length} mois (${reportType})`);

    const results: any[] = [];
    let success = 0;
    let failed = 0;

    for (const restaurantId of restaurantIds) {
      for (const m of months) {
        const { start, end } = monthRange(m.year, m.month);
        try {
          const { data, error } = await supabase.functions.invoke('uber-create-report', {
            body: {
              restaurantId,
              reportType,
              startDate: start,
              endDate: end,
            },
          });
          if (error) throw error;
          results.push({ restaurantId, month: `${m.year}-${m.month}`, ok: true, workflow_id: data?.workflow_id });
          success++;
        } catch (e: any) {
          results.push({ restaurantId, month: `${m.year}-${m.month}`, ok: false, error: e.message });
          failed++;
        }
        // Throttle: 300ms between calls to avoid Uber rate limits
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        ok: success,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
