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
const PARALLEL = 5;
// Délai entre chaque job dans un même tick du worker (anti-burst 429).
const INTER_JOB_DELAY_MS = 1000;

// Limite stricte de l'API Uber pour PAYMENT_DETAILS_REPORT et autres rapports.
const MAX_DAYS_PER_REPORT = 30;

// Plafond de re-tentatives causées par un throttle Uber (429) avant de basculer
// le job en `failed`. Empêche un store éternellement throttlé de rester `pending` à vie.
const MAX_RATE_LIMIT_RETRIES = 10;

// Fallback de delay (secondes) si Uber ne renvoie pas Retry-After ou si la valeur
// n'est pas exploitable. Volontairement court pour rester réactif (le job repart
// au tick suivant), le throttle reste géré niveau file via next_attempt_at.
const RATE_LIMIT_REQUEUE_DEFAULT_SECONDS = 60;

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

// Sentinelle pour signaler au caller qu'on a épuisé les retries 429 → requeue.
class WorkerRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number, message: string) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Parse un header Retry-After (RFC 7231) : peut être un entier de secondes
 * OU une date HTTP. Retourne le delay en secondes, ou null si non-parsable.
 */
function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  // Cas 1 : entier de secondes
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  // Cas 2 : date HTTP
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) {
    const delta = Math.ceil((parsed - Date.now()) / 1000);
    return delta > 0 ? delta : 0;
  }
  return null;
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
    // Uber Eats refuse endDate dans les 2 derniers jours.
    // On cap month_end à (aujourd'hui - 2 jours) pour le mois courant.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const maxAllowedEnd = new Date(today);
    maxAllowedEnd.setUTCDate(maxAllowedEnd.getUTCDate() - 2);
    const maxAllowedEndStr = maxAllowedEnd.toISOString().slice(0, 10);

    const jobStart = new Date(job.month_start + 'T00:00:00Z');
    if (jobStart > maxAllowedEnd) {
      // Tout le mois est dans la fenêtre interdite (J-2). On skip proprement.
      await supabase.from('backfill_jobs').update({
        status: 'skipped',
        last_error: `Trop tôt : Uber refuse les 2 derniers jours. Réessayer après ${maxAllowedEndStr}.`,
        updated_at: new Date().toISOString(),
      }).eq('id', job.job_id);
      console.log(`Job ${job.job_id} skipped: month_start ${job.month_start} > today-2 (${maxAllowedEndStr})`);
      return { status: 'skipped', job_id: job.job_id, detail: 'Trop tôt (J-2 Uber)' };
    }

    const cappedEnd = job.month_end > maxAllowedEndStr ? maxAllowedEndStr : job.month_end;
    if (cappedEnd !== job.month_end) {
      console.log(`Job ${job.job_id}: month_end capped ${job.month_end} → ${cappedEnd} (Uber J-2 rule)`);
    }

    const ranges = splitDateRange(job.month_start, cappedEnd, MAX_DAYS_PER_REPORT);
    const workflowIds: string[] = [];

    // Retry helper sur 429 (TooManyRequests) :
    //  - honore Retry-After renvoyé par uber-create-report (entier ou date HTTP) ;
    //  - cappe à 2 tentatives in-process avec un sleep cappé à 30s pour rester
    //    largement sous la wall-clock d'une edge function ;
    //  - sur 429 persistant : remonte un WorkerRateLimitError au caller, qui requeue
    //    le job au niveau de la file (next_attempt_at) au lieu de cramer un attempt.
    //  - sur erreur non-429 : throw classique → branche catch externe (failed).
    async function createReportWithRetry(startDate: string, endDate: string): Promise<string> {
      const maxRetries = 2;
      let lastRetryAfterSeconds = RATE_LIMIT_REQUEUE_DEFAULT_SECONDS;
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
        const createData = await createResponse.json().catch(() => ({}));

        if (createResponse.ok && createData.workflow_id) {
          return createData.workflow_id;
        }

        const errMsg = String(createData.error || createData.detail || `HTTP ${createResponse.status}`);
        const isRateLimit =
          createResponse.status === 429 ||
          /too_many_requests|TooManyRequests/i.test(errMsg) ||
          /TooManyRequests/i.test(String(createData.error || ''));

        if (isRateLimit) {
          // Priorité 1 : header HTTP Retry-After de uber-create-report (déjà propagé d'Uber).
          // Priorité 2 : body.retry_after (au cas où le header serait stripped en chemin).
          // Fallback : valeur courte par défaut.
          const headerRetry = parseRetryAfter(createResponse.headers.get('retry-after'));
          const bodyRetry = parseRetryAfter(createData?.retry_after != null ? String(createData.retry_after) : null);
          const retryAfterSeconds = headerRetry ?? bodyRetry ?? RATE_LIMIT_REQUEUE_DEFAULT_SECONDS;
          lastRetryAfterSeconds = retryAfterSeconds;

          if (attempt < maxRetries - 1) {
            // Sleep in-process cappé à 30s pour ne pas exploser la wall-clock de l'edge.
            const sleepMs = Math.min(retryAfterSeconds, 30) * 1000 + Math.floor(Math.random() * 500);
            console.log(`Job ${job.job_id}: 429 from Uber (source=${createData?.source || '?'}), retry ${attempt + 1}/${maxRetries} in ${sleepMs}ms (Retry-After=${retryAfterSeconds}s)`);
            await new Promise((r) => setTimeout(r, sleepMs));
            continue;
          }
          // Retries in-process épuisés → on remonte pour requeue niveau file.
          throw new WorkerRateLimitError(retryAfterSeconds, `429 persistant après ${maxRetries} tentatives in-process`);
        }
        throw new Error(errMsg);
      }
      throw new WorkerRateLimitError(lastRetryAfterSeconds, 'Max retries exhausted on 429');
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
    const errMsg = String(err?.message || err);
    console.error(`Job ${job.job_id} failed: ${errMsg}`);

    // === Branche 429 : requeue au niveau de la file (next_attempt_at) ===
    if (err instanceof WorkerRateLimitError) {
      const currentRlRetries = (job as any).rate_limit_retries ?? 0; // pas exposé par le picker → on relit
      // Relire le compteur réel pour décider du basculement failed.
      const { data: jobRow } = await supabase
        .from('backfill_jobs')
        .select('rate_limit_retries')
        .eq('id', job.job_id)
        .maybeSingle();
      const rlRetries = (jobRow?.rate_limit_retries ?? currentRlRetries) as number;

      if (rlRetries + 1 >= MAX_RATE_LIMIT_RETRIES) {
        await supabase.from('backfill_jobs').update({
          status: 'failed',
          last_error: `Throttle Uber persistant : ${MAX_RATE_LIMIT_RETRIES} requeues 429 atteints. Retenter manuellement plus tard.`,
          rate_limit_retries: rlRetries + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', job.job_id);
        return { status: 'rate_limited_failed', job_id: job.job_id, detail: errMsg };
      }

      // Requeue : pending, next_attempt_at futur, on ne touche pas `attempts`.
      // On compense le +1 fait par pick_next_backfill_job pour ne pas brûler d'attempt.
      const nextAt = new Date(Date.now() + err.retryAfterSeconds * 1000).toISOString();
      await supabase.from('backfill_jobs').update({
        status: 'pending',
        attempts: Math.max(0, (job.attempts ?? 1) - 1),
        rate_limit_retries: rlRetries + 1,
        next_attempt_at: nextAt,
        last_error: `429 Uber → requeue à ${nextAt} (retry #${rlRetries + 1}/${MAX_RATE_LIMIT_RETRIES})`,
        updated_at: new Date().toISOString(),
      }).eq('id', job.job_id);
      console.log(`Job ${job.job_id} requeued (429) → next_attempt_at=${nextAt}, rl_retries=${rlRetries + 1}`);
      return { status: 'rate_limited_requeued', job_id: job.job_id, detail: `requeue in ${err.retryAfterSeconds}s` };
    }

    // === Branche classique : skipped / failed / pending ===
    const isOutOfWindow = /188 days|startDate must be within/i.test(errMsg);
    const newStatus = isOutOfWindow
      ? 'skipped'
      : (job.attempts >= 3 ? 'failed' : 'pending');
    const finalErr = isOutOfWindow
      ? "Hors fenêtre API Uber (188 jours max). Utilise l'import CSV pour cet historique."
      : errMsg.slice(0, 500);
    await supabase
      .from('backfill_jobs')
      .update({
        status: newStatus,
        last_error: finalErr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.job_id);
    return { status: isOutOfWindow ? 'skipped' : 'job_failed', job_id: job.job_id, detail: errMsg };
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

    console.log(`Picked ${jobs.length} job(s) for sequential processing (delay ${INTER_JOB_DELAY_MS}ms)`);

    // 3. Traiter les jobs en série, espacés, pour éviter les 429 Uber
    const summary: any[] = [];
    for (let i = 0; i < (jobs as JobRow[]).length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, INTER_JOB_DELAY_MS));
      try {
        const res = await processJob((jobs as JobRow[])[i], supabase, supabaseUrl, supabaseServiceKey);
        summary.push(res);
      } catch (e: any) {
        summary.push({ status: 'rejected', job_id: (jobs as JobRow[])[i].job_id, detail: String(e?.message || e) });
      }
    }

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
