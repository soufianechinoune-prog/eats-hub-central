import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  reportType?: string;
  restaurantIds?: string[];
  months: { year: number; month: number }[];
  vague?: string;
  testMode?: boolean;
  dryRun?: boolean;
  triggeredBy?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Uber API refuses any window > 30 days. Split 31-day months into 2 windows.
function splitInto30DayWindows(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // 28..31
  if (lastDay <= 30) {
    return [{ start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` }];
  }
  return [
    { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-30` },
    { start: `${year}-${pad(month)}-31`, end: `${year}-${pad(month)}-31` },
  ];
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

    // Pre-compute all windows (per month, splitting 31-day months)
    const allWindows: { year: number; month: number; start: string; end: string }[] = [];
    for (const m of months) {
      for (const w of splitInto30DayWindows(m.year, m.month)) {
        allWindows.push({ year: m.year, month: m.month, ...w });
      }
    }

    const totalPlanned = restaurantIds.length * allWindows.length;
    console.log(`Backfill (${vague}): ${restaurantIds.length} restos × ${allWindows.length} fenêtres = ${totalPlanned} (${reportType})${dryRun ? ' [DRY RUN]' : ''}`);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        totalPlanned,
        restaurantCount: restaurantIds.length,
        monthCount: months.length,
        windowCount: allWindows.length,
        reportType,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Earliest start / latest end across all windows
    const sortedWindows = [...allWindows].sort((a, b) => a.start.localeCompare(b.start));
    const firstStart = sortedWindows[0].start;
    const lastEnd = sortedWindows[sortedWindows.length - 1].end;

    const { data: runRow, error: runErr } = await supabase
      .from('backfill_runs')
      .insert({
        vague,
        report_type: reportType,
        restaurant_ids: restaurantIds,
        start_date: firstStart,
        end_date: lastEnd,
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
      for (const w of allWindows) {
        let okThisJob = false;
        let lastError: string | null = null;
        let workflowId: string | undefined;

        for (let attempt = 1; attempt <= 2 && !okThisJob; attempt++) {
          try {
            const { data, error } = await supabase.functions.invoke('uber-create-report', {
              body: { restaurantId, reportType, startDate: w.start, endDate: w.end },
            });
            if (error) throw error;
            okThisJob = true;
            workflowId = data?.workflow_id;
          } catch (e: any) {
            lastError = e?.message ?? String(e);
            // Retry only on rate-limit-ish errors
            if (attempt < 2 && /429|rate|limit/i.test(lastError ?? '')) {
              console.warn(`Rate limit on ${restaurantId} ${w.start}, retry in 5s`);
              await sleep(5000);
              continue;
            }
            break;
          }
        }

        if (okThisJob) {
          success++;
          results.push({ restaurantId, window: `${w.start}→${w.end}`, ok: true, workflow_id: workflowId });
        } else {
          failed++;
          results.push({ restaurantId, window: `${w.start}→${w.end}`, ok: false, error: lastError });
        }

        await sleep(500);
      }
    }

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
