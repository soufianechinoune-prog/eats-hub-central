import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { WAVE_CHAIN, MAX_REQUESTS, REFUSAL_LIMIT, waveLineAllowed, uberApiAccessAllowed } from '../_shared/payoutWaveScope.ts';
import { pilotDate } from '../_shared/payoutPilotScope.ts';
type SourceRow = { restaurant_id: string; uber_store_id: string; payout_reference_id: string; order_date_key: string; source_line_key: string; [key: string]: unknown };
Deno.serve(async req => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = authenticateCronRequest(req);
  if (denied) return new Response(denied.body, { status: denied.status, headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  const input = await req.json().catch(() => null);
  if (!input || input.action !== 'tick') return reply({ error: 'Invalid action' }, 400);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply({ error: 'Missing configuration' }, 500);
  const db = createClient(url, key);
  const lease = crypto.randomUUID();
  const { data: locked, error: lockError } = await db.rpc('payout_wave_lock', { p_token: lease });
  if (lockError) return reply({ error: lockError.message }, 500);
  if (!locked) return reply({ skipped: true });
  const update = async (id: string, values: Record<string, unknown>) => {
    const { error } = await db.from('payout_adjustment_backfill_requests').update(values).eq('id', id);
    if (error) throw new Error(error.message);
  };
  const pause = async (reason: string) => {
    const { error } = await db.from('payout_adjustment_backfill_state').update({ status: 'paused', pause_reason: reason }).eq('id', true);
    if (error) throw new Error(error.message);
  };
  try {
    const deadline = Date.now() + 120000;
    const { data: state } = await db.from('payout_adjustment_backfill_state').select('*').eq('id', true).single();
    if (state?.status !== 'running') return reply({ skipped: true });
    // A prior expired lease cannot silently leave in-progress rows stranded.
    await db.from('payout_adjustment_backfill_requests').update({ status: 'received' }).eq('status', 'collecting');
    const { data: uncertain } = await db.from('payout_adjustment_backfill_requests').select('id').eq('status', 'dispatching').limit(1);
    if (uncertain?.length) {
      await pause('Previous dispatch interrupted; outcome requires manual review');
      return reply({ paused: true });
    }
    // Dispatch first; reservation time limits all runs to three requests in a rolling minute.
    if (!state.next_dispatch_at || Date.parse(state.next_dispatch_at) <= Date.now()) {
      const { data: jobs, error } = await db.from('payout_adjustment_backfill_requests').select('*').eq('status', 'queued').order('start_date').order('uber_store_id').limit(MAX_REQUESTS);
      if (error) throw new Error(error.message);
      if (jobs?.length) {
        const { data: cached } = await db.from('uber_app_token').select('access_token,expires_at').eq('id', true).single();
        if (!cached?.access_token || Date.parse(cached.expires_at) <= Date.now() + 60000) {
          await pause('Cached Uber token unavailable');
          return reply({ paused: true });
        }
        let refusals = state.consecutive_refusals;
        for (const job of jobs) {
          const { data: guard } = await db.from('payout_adjustment_backfill_state').select('status').eq('id', true).single();
          if (guard?.status !== 'running') break;
          const { data: r } = await db.from('restaurants').select('chain_id,uber_store_id').eq('id', job.restaurant_id).single();
          if (r?.chain_id !== WAVE_CHAIN || r.uber_store_id !== job.uber_store_id) throw new Error('Store mapping changed');
          const { data: access, error: accessError } = await db.rpc('get_uber_api_access_status', { p_chain_id: WAVE_CHAIN });
          if (accessError) throw new Error('Uber access status unavailable');
          const accessStatus = access?.find((row: { restaurant_id: string; status: string }) => row.restaurant_id === job.restaurant_id)?.status;
          if (!uberApiAccessAllowed(accessStatus)) {
            await update(job.id, { status: 'awaiting_access', error: 'Awaiting Uber API access approval' });
            continue;
          }
          const { data: reservation, error: reservationError } = await db.from('payout_adjustment_backfill_requests').update({ status: 'dispatching', attempts: job.attempts + 1, requested_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued').select('status').maybeSingle();
          if (reservationError) throw new Error(reservationError.message);
          if (reservation?.status !== 'dispatching') continue;
          let response: Response;
          try {
            response = await fetch('https://api.uber.com/v1/eats/report', {
              method: 'POST', headers: { Authorization: `Bearer ${cached.access_token}`, 'Content-Type': 'application/json', 'Accept-Language': 'fr-FR', 'X-Uber-Locale': 'fr_FR' },
              body: JSON.stringify({ report_type: 'PAYMENT_DETAILS_REPORT', store_uuids: [job.uber_store_id], start_date: job.start_date, end_date: job.end_date }), signal: AbortSignal.timeout(20000),
            });
          } catch {
            await update(job.id, { status: 'uncertain', error: 'Request outcome unknown; manual review required, no automatic resend' });
            await pause('Unknown Uber request outcome');
            break;
          }
          const result = await response.json().catch(() => ({}));
          if (!response.ok || typeof result.workflow_id !== 'string') {
            refusals++;
            const retrySeconds = Number(response.headers.get('retry-after'));
            await update(job.id, { status: response.status === 429 || response.status >= 500 ? 'queued' : 'refused', refusal_status: response.status, error: `Uber refused HTTP ${response.status}` });
            await db.from('payout_adjustment_backfill_state').update({ consecutive_refusals: refusals, next_dispatch_at: new Date(Date.now() + Math.max(60000, Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 0)).toISOString() }).eq('id', true);
            if (refusals >= REFUSAL_LIMIT) await pause('Three consecutive Uber refusals');
            break;
          }
          refusals = 0;
          await update(job.id, { workflow_id: result.workflow_id, status: 'requested', error: null });
          await db.from('payout_adjustment_backfill_state').update({ consecutive_refusals: 0, next_dispatch_at: new Date(Date.now() + 60000).toISOString() }).eq('id', true);
        }
      }
    }
    // Collect all sections before any staging; a failed section never causes partial import.
    const { data: received } = await db.from('payout_adjustment_backfill_requests').select('*').eq('status', 'received').order('received_at').limit(3);
    for (const job of received ?? []) {
      if (Date.now() >= deadline) break;
      await update(job.id, { status: 'collecting' });
      try {
        const rows: SourceRow[] = [];
        if (!Array.isArray(job.sections) || !job.sections.length) throw new Error('No report sections');
        for (const section of job.sections) {
          const location = new URL(section.download_url);
          if (location.protocol !== 'https:' || !['.uber.com', '.amazonaws.com', '.cloudfront.net'].some(suffix => location.hostname.endsWith(suffix))) throw new Error('Untrusted archive host');
          const download = await fetch(location, { signal: AbortSignal.timeout(15000) });
          if (!download.ok) throw new Error(`Archive HTTP ${download.status}`);
          const csvContent = await download.text();
          const { data, error } = await db.functions.invoke('parse-payment-report', { body: { csvContent, adjustmentsOnly: true, dryRun: true, waveStore: job.uber_store_id, previewSourceRows: true, dataSource: 'uber_api' } });
          if (error || data?.success !== true || !Array.isArray(data.sourceRows)) throw new Error('Source validation failed');
          rows.push(...data.sourceRows);
        }
        if (rows.some(r => r.restaurant_id !== job.restaurant_id || r.uber_store_id !== job.uber_store_id || !waveLineAllowed(job.chain_id, r.uber_store_id, pilotDate(r.order_date_key)) || ['05G2PXLG9Z79FXQ', '2OAJXO4XY0LOBRE'].includes(r.payout_reference_id))) throw new Error('Source outside approved scope');
        await update(job.id, { status: 'collected', source_rows: rows });
      } catch (e) {
        await update(job.id, { status: 'failed', error: e instanceof Error ? e.message : 'Collection failed' });
      }
    }
    // A store stages only once every window is fully collected; overlap slots cannot be lost.
    const { data: candidate } = await db.from('payout_adjustment_backfill_requests').select('uber_store_id').eq('status', 'collected').order('start_date').limit(100);
    let stagedRequests = 0;
    for (const store of [...new Set((candidate ?? []).map(r => r.uber_store_id))]) {
      if (stagedRequests >= 3 || Date.now() >= deadline) break;
      const { data: jobs } = await db.from('payout_adjustment_backfill_requests').select('*').eq('uber_store_id', store);
      if (jobs?.some(j => ['failed','refused','uncertain'].includes(j.status))) {
        await db.from('payout_adjustment_backfill_requests').update({ status: 'blocked', error: 'Incomplete store collection; no partial staging' }).eq('uber_store_id', store).eq('status', 'collected');
        continue;
      }
      if (!jobs?.length || jobs.some(j => !['collected', 'completed'].includes(j.status))) continue;
      for (const job of jobs.filter(j => j.status === 'collected')) {
        if (stagedRequests >= 3 || Date.now() >= deadline) break;
        stagedRequests++;
        const unique = [...new Map((job.source_rows as SourceRow[]).map(r => [r.source_line_key, r])).values()];
        const groups = new Map<string, SourceRow[]>();
        for (const r of unique) groups.set(r.payout_reference_id, [...(groups.get(r.payout_reference_id) ?? []), r]);
        let inserted = 0;
        try {
          for (const rows of groups.values()) {
            if (rows.length > 1000) throw new Error('Payout exceeds atomic limit');
            const { data, error } = await db.rpc('stage_payout_adjustment_lines', { p_rows: rows });
            if (error) throw new Error(error.message);
            inserted += Number(data);
          }
          await update(job.id, { status: 'completed', completed_at: new Date().toISOString(), inserted_lines: inserted, already_present_lines: unique.length - inserted });
        } catch (e) {
          await update(job.id, { status: 'failed', error: e instanceof Error ? e.message : 'Staging failed' });
        }
      }
    }
    // Missing callbacks and crashed reservations are explicit terminal states, never endless polling.
    await db.from('payout_adjustment_backfill_requests').update({ status: 'failed', error: 'Callback not received within two hours' }).eq('status', 'requested').lt('requested_at', new Date(Date.now() - 7200000).toISOString());
    return reply({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Wave failed';
    await pause(message);
    return reply({ error: message }, 500);
  } finally {
    await db.rpc('payout_wave_finish', { p_token: lease });
  }
});