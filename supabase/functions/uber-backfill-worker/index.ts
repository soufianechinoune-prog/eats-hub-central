// Worker de backfill historique Uber Eats.
// Appelé par cron toutes les 2 min. Picke 1 job pending, lance la création
// du rapport Uber (POST async), et sort. Le webhook uber-report-webhook
// existant ingère les commandes et marquera le job comme done via le
// workflow_id stocké.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // 2. Pick 1 job atomiquement
    const { data: jobs, error: pickErr } = await supabase.rpc('pick_next_backfill_job');

    if (pickErr) {
      console.error('Failed to pick job:', pickErr);
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

    const job = jobs[0];
    const reportType = job.report_type || 'PAYMENT_DETAILS_REPORT';
    console.log(`Processing job ${job.job_id} → ${job.restaurant_name} ${job.month_start} [vague ${job.vague}/${reportType}]`);

    // 3. Lancer uber-create-report
    const startDate = job.month_start;
    const endDate = job.month_end;

    try {
      const createResponse = await fetch(
        `${supabaseUrl}/functions/v1/uber-create-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
          },
          body: JSON.stringify({
            restaurantId: job.restaurant_id,
            // reportType vient du job (1 vague = 1 type de rapport)
            // Vague 1: PAYMENT_DETAILS_REPORT (commandes + finance)
            // Vague 2: MENU_ITEM_FEEDBACK_REPORT (items)
            // Vague 3: CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT (avis)
            // Vague 4: ORDER_ERRORS_TRANSACTION_REPORT (erreurs)
            // Vague 5: DOWNTIME_REPORT (disponibilité)
            reportType,
            startDate,
            endDate,
          }),
        }
      );

      const createData = await createResponse.json();

      if (!createResponse.ok || !createData.workflow_id) {
        const errMsg = createData.error || `HTTP ${createResponse.status}`;
        console.error(`Job ${job.job_id} failed: ${errMsg}`);

        // Si max retries → failed, sinon on remet en pending
        const newStatus = job.attempts >= 3 ? 'failed' : 'pending';
        await supabase
          .from('backfill_jobs')
          .update({
            status: newStatus,
            last_error: String(errMsg).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.job_id);

        return new Response(
          JSON.stringify({ status: 'job_failed', job_id: job.job_id, error: errMsg, retry: newStatus === 'pending' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Stocker le workflow_id sur le job (pour que le webhook le retrouve)
      // Le job reste en "running" jusqu'à ce que le webhook le passe en "done"
      await supabase
        .from('backfill_jobs')
        .update({
          report_id: createData.workflow_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.job_id);

      console.log(`Job ${job.job_id} dispatched → workflow ${createData.workflow_id}`);

      return new Response(
        JSON.stringify({
          status: 'dispatched',
          job_id: job.job_id,
          restaurant: job.restaurant_name,
          month: job.month_start,
          workflow_id: createData.workflow_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      console.error(`Job ${job.job_id} threw:`, err);
      const newStatus = job.attempts >= 3 ? 'failed' : 'pending';
      await supabase
        .from('backfill_jobs')
        .update({
          status: newStatus,
          last_error: String(err.message || err).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.job_id);
      return new Response(
        JSON.stringify({ status: 'job_failed', job_id: job.job_id, error: String(err.message || err) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    console.error('Worker fatal error:', err);
    return new Response(
      JSON.stringify({ error: 'fatal', detail: String(err.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
