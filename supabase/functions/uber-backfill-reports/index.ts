import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  reportType?: string;        // default: PAYMENT_DETAILS_REPORT
  restaurantIds?: string[];   // if omitted: all restos with uber_store_id
  months: { year: number; month: number }[];
  vague?: string;             // free-text label, e.g. 'v1', 'v2', 'v3-2024-01'
  testMode?: boolean;         // if true: limit to 1 restaurant
  dryRun?: boolean;           // if true: no Uber call, just count
  triggeredBy?: string;       // user id of super admin who launched
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const vague = body.vague || 'manual';
    const testMode = body.testMode === true;
    const dryRun = body.dryRun === true;

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

    if (testMode) restaurantIds = restaurantIds.slice(0, 1);

    const totalPlanned = restaurantIds.length * months.length;
    console.log(`Backfill (${vague}): ${restaurantIds.length} restos × ${months.length} mois = ${totalPlanned} (${reportType})${dryRun ? ' [DRY RUN]' : ''}`);

    // Dry run: just return the count without doing anything
    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        totalPlanned,
        restaurantCount: restaurantIds.length,
        monthCount: months.length,
        reportType,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Earliest start / latest end for the run record
    const sortedMonths = [...months].sort((a, b) => a.year - b.year || a.month - b.month);
    const firstRange = monthRange(sortedMonths[0].year, sortedMonths[0].month);
    const lastRange = monthRange(sortedMonths[sortedMonths.length - 1].year, sortedMonths[sortedMonths.length - 1].month);

    // Create the run record
    const { data: runRow, error: runErr } = await supabase
      .from('backfill_runs')
      .insert({
        vague,
        report_type: reportType,
        restaurant_ids: restaurantIds,
        start_date: firstRange.start,
        end_date: lastRange.end,
        status: 'running',
        total: totalPlanned,
        triggered_by: body.triggeredBy ?? null,
      })
      .select('id')
      .single();

    if (runErr) console.error('Could not create backfill_runs row:', runErr);
    const runId = runRow?.id ?? null;

    const results: any[] = [];
    let success = 0;
    let failed = 0;

    for (const restaurantId of restaurantIds) {
      for (const m of months) {
        const { start, end } = monthRange(m.year, m.month);
        let attempt = 0;
        let lastError: string | null = null;
        let okThisJob = false;

        while (attempt < 2 && !okThisJob) {
          attempt++;
          try {
            const { data, error } = await supabase.functions.invoke('uber-create-report', {
              body: { restaurantId, reportType, startDate: start, endDate: end },
            });
            if (error) throw error;
            results.push({ restaurantId, month: `${m.year}-${m.month}`, ok: true, workflow_id: data?.workflow_id });
            success++;
            okThisJob = true;
          } catch (e: any) {
            lastError = e?.message ?? String(e);
            // Retry once on rate-limit-ish errors
            if (attempt < 2 && /429|rate|limit/i.test(lastError ?? '')) {
              console.warn(`Rate limit hit on ${restaurantId} ${m.year}-${m.month}, retrying in 5s`);
              await sleep(5000);
              continue;
            }
            results.push({ restaurantId, month: `${m.year}-${m.month}`, ok: false, error: lastError });
            failed++;
          }
        }

        // Throttle to stay safe with Uber API
        await sleep(500);
      }
    }

    // Update run record
    if (runId) {
      await supabase
        .from('backfill_runs')
        .update({
          status: failed === 0 ? 'completed' : 'completed_with_errors',
          ok: success,
          failed,
          results,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        runId,
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
