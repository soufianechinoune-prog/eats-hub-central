// Worker de backfill historique Uber Eats.
// Appelé par cron toutes les minutes. Picke jusqu'à PARALLEL jobs pending,
// lance la création de rapports Uber en parallèle (POST async), et sort.
// Le webhook uber-report-webhook ingère les commandes et marquera les jobs
// comme "done" via le workflow_id stocké.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Combien de jobs traiter en parallèle par tick.
// L'API Uber tient largement la charge ; le polling étant async côté Uber
// (webhook), on ne fait QUE le POST de création ici → très peu coûteux.
const PARALLEL = 2;
// Délai entre chaque job dans un même tick du worker (anti-burst 429).
const INTER_JOB_DELAY_MS = 1500;

// Limite stricte de l'API Uber pour PAYMENT_DETAILS_REPORT et autres rapports.
const MAX_DAYS_PER_REPORT = 30;

interface JobRow {
  job_id: string;
  restaurant_id: string;
  restaurant_name: string;
  uber_store_id: string;
  month_start: string; // YYYY-MM-DD
  month_end: string;   // YYYY-MM-DD
  attempts: number;
  report_type: string | null;
  vague: number;
}

/**
 * Découpe une plage de dates en sous-plages de max N jours (inclusif).
 * Ex: 2024-07-01 → 2024-07-31 (31 jours) avec maxDays=30
 *  → [["2024-07-01","2024-07-30"], ["2024-07-31","2024-07-31"]]
 */
function splitDateRange(start: string, end: string, maxDays: number): Array<[string, string]> {
  const ranges: Array<[string, string]> = [];
  const startDate = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');

  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const chunkEnd = new Date(cursor);
    // maxDays inclusif → on ajoute (maxDays - 1) jours
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + (maxDays - 1));
    const finalEnd = chunkEnd > endDate ? endDate : chunkEnd;
    ranges.push([
      cursor.toISOString().slice(0, 10),
      finalEnd.toISOString().slice(0, 10),
    ]);
    cursor = new Date(finalEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return ranges;
}

async function processJob(
  job: JobRow,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseServiceKey: string,
): Promise<{ status: string; job_id: string; detail?: string }> {
  const reportType = job.report_type || 'PAYMENT_DETAILS_REPORT';
  console.log(`Processing job ${job.job_id} → ${job.restaurant_name} ${job.month_start} [vague ${job.vague}/${reportType}]`);

  try {
    const ranges = splitDateRange(job.month_start, job.month_end, MAX_DAYS_PER_REPORT);
    const workflowIds: string[] = [];

    // Retry helper avec backoff exponentiel sur 429 (TooManyRequests).
    // Ne consomme PAS un attempt côté job : c'est juste Uber qui throttle.
    async function createReportWithRetry(startDate: string, endDate: string): Promise<string> {
      const maxRetries = 5;
      let delayMs = 2000; // 2s, 4s, 8s, 16s, 32s
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const createResponse = await fetch(
          `${supabaseUrl}/functions/v1/uber-create-report`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
            },
            body: JSON.stringify({ restaurantId: job.restaurant_id, reportType, startDate, endDate }),
          }
        );
        const createData = await createResponse.json();

        if (createResponse.ok && createData.workflow_id) {
          return createData.workflow_id;
        }

        const errMsg = String(createData.error || `HTTP ${createResponse.status}`);
        const isRateLimit = errMsg.includes('too_many_requests') || errMsg.includes('TooManyRequests') || createResponse.status === 429;

        if (isRateLimit && attempt < maxRetries - 1) {
          const jitter = Math.floor(Math.random() * 500);
          console.log(`Job ${job.job_id}: 429 from Uber, retry ${attempt + 1}/${maxRetries} in ${delayMs + jitter}ms`);
          await new Promise((r) => setTimeout(r, delayMs + jitter));
          delayMs *= 2;
          continue;
        }
        throw new Error(errMsg);
      }
      throw new Error('Max retries exhausted on 429');
    }

    // Sérialise les sous-plages d'un job, avec un petit délai entre chaque
    // pour éviter de bombarder Uber sur le même store_uuid.
    for (let i = 0; i < ranges.length; i++) {
      const [startDate, endDate] = ranges[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 800));
      const wfId = await createReportWithRetry(startDate, endDate);
      workflowIds.push(wfId);
    }

    // Stocker les workflow_id (concaténés si plusieurs) sur le job.
    // Le job reste "running" jusqu'au webhook (qui matche le 1er workflow_id reçu).
    await supabase
      .from('backfill_jobs')
      .update({
        report_id: workflowIds.join(','),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.job_id);

    console.log(`Job ${job.job_id} dispatched → ${workflowIds.length} workflow(s): ${workflowIds.join(',')}`);
    return { status: 'dispatched', job_id: job.job_id, detail: workflowIds.join(',') };
  } catch (err: any) {
    const errMsg = String(err.message || err);
    console.error(`Job ${job.job_id} failed: ${errMsg}`);
    const newStatus = job.attempts >= 3 ? 'failed' : 'pending';
    await supabase
      .from('backfill_jobs')
      .update({
        status: newStatus,
        last_error: errMsg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.job_id);
    return { status: 'job_failed', job_id: job.job_id, detail: errMsg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Reset des jobs bloqués > 30 min
    const { data: resetCount } = await supabase.rpc('reset_stale_backfill_jobs');
    if (resetCount && resetCount > 0) {
      console.log(`Reset ${resetCount} stale running job(s)`);
    }

    // 2. Pick jusqu'à PARALLEL jobs atomiquement
    const { data: jobs, error: pickErr } = await supabase.rpc('pick_next_backfill_job', { p_limit: PARALLEL });

    if (pickErr) {
      console.error('Failed to pick jobs:', pickErr);
      return new Response(
        JSON.stringify({ error: 'pick_failed', detail: pickErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log('No pending job available');
      return new Response(
        JSON.stringify({ status: 'idle', message: 'No pending jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Picked ${jobs.length} job(s) for parallel processing`);

    // 3. Traiter tous les jobs en parallèle
    const results = await Promise.allSettled(
      (jobs as JobRow[]).map((j) => processJob(j, supabase, supabaseUrl, supabaseServiceKey))
    );

    const summary = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { status: 'rejected', job_id: (jobs as JobRow[])[i].job_id, detail: String(r.reason) };
    });

    return new Response(
      JSON.stringify({ status: 'ok', processed: jobs.length, results: summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Worker fatal error:', err);
    return new Response(
      JSON.stringify({ error: 'fatal', detail: String(err.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
