// Re-queue already "done" DOWNTIME_REPORT backfill jobs whose CSV was parsed by the
// legacy parser (wrong table). Uses the slow retro lane (vague >= 1000) so the worker
// throttles to 2 jobs/tick with 3s spacing — safe against Uber 429s.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let from = '2026-10-01';
  let to = '2026-10-24';
  try {
    const b = await req.json();
    if (/^\d{4}-\d{2}-\d{2}$/.test(b?.from)) from = b.from;
    if (/^\d{4}-\d{2}-\d{2}$/.test(b?.to)) to = b.to;
  } catch (_) { /* defaults */ }

  const { data, error } = await supabase
    .from('backfill_jobs')
    .update({
      status: 'pending', vague: 1000, attempts: 0, rate_limit_retries: 0,
      last_error: null, next_attempt_at: null, report_id: null,
      started_at: null, completed_at: null, updated_at: new Date().toISOString(),
    })
    .eq('report_type', 'DOWNTIME_REPORT')
    .in('status', ['done', 'failed'])
    .gte('month_start', from)
    .lte('month_start', to)
    .select('id');

  return new Response(JSON.stringify(error ? { error: error.message } : { requeued: data?.length ?? 0, from, to }), {
    status: error ? 500 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
