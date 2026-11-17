import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { PILOT_STORES, pilotLineAllowed, pilotWindowAllowed, pilotDate } from '../_shared/payoutPilotScope.ts';

const Row = z.object({
  restaurant_id: z.string().uuid(), uber_store_id: z.string().uuid(), restaurant_name: z.string().nullable(),
  payout_reference_id: z.string().min(1), payout_date: z.string().regex(/^2026-\d{2}-\d{2}$/),
  description: z.string().nullable(), category: z.string().min(1), amount: z.number().finite(),
  raw_columns: z.record(z.string()), source_line_key: z.string().regex(/^[a-f0-9]{64}$/),
  source_report_hash: z.string().regex(/^[a-f0-9]{64}$/), source_record_index: z.number().int().nonnegative(),
  order_date_key: z.string().min(1),
});
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('archives'), store: z.string().uuid() }),
  z.object({ action: z.literal('inspect'), store: z.string().uuid(), reportId: z.string().uuid() }),
  z.object({ action: z.literal('request'), store: z.string().uuid(), start: z.string(), end: z.string() }),
  z.object({ action: z.literal('pilotReports'), store: z.string().uuid() }),
  z.object({ action: z.literal('inspectPilot'), store: z.string().uuid(), reportId: z.string().uuid() }),
  z.object({ action: z.literal('stage'), store: z.string().uuid(), rows: z.array(Row).min(1).max(1000) }),
]);

Deno.serve(async req => {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return reply({ error: 'Missing server configuration' }, 500);
    const db = createClient(url, key);
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply({ error: 'Unauthorized' }, 401);
    if (token !== key) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return reply({ error: 'Unauthorized' }, 401);
      const scoped = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: role } = await scoped.rpc('get_user_role');
      if (role !== 'super_admin') return reply({ error: 'Forbidden' }, 403);
    }
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return reply({ error: 'Invalid pilot request' }, 400);
    const body = parsed.data;
    const restaurantId = PILOT_STORES[body.store];
    if (!restaurantId) return reply({ error: 'Store outside approved pilot' }, 403);
    const { data: restaurant } = await db.from('restaurants').select('id,uber_store_id').eq('id', restaurantId).single();
    if (restaurant?.uber_store_id !== body.store) return reply({ error: 'Store mapping changed' }, 409);
    if (body.action === 'pilotReports') {
      const { data, error } = await db.from('payout_pilot_reports').select('id,start_date,end_date,status,created_at,completed_at,refusal_status')
        .eq('uber_store_id', body.store);
      if (error) throw new Error('Pilot query failed');
      return reply({ reports: data });
    }
    if (body.action === 'request') {
      if (!pilotWindowAllowed(body.store, body.start, body.end)) return reply({ error: 'Window outside approved pilot' }, 400);
      const { data: existing } = await db.from('payout_pilot_reports').select('id,status').eq('uber_store_id', body.store).eq('start_date', body.start).eq('end_date', body.end).maybeSingle();
      if (existing) return reply({ alreadyRequested: true, report: existing });
      const { data: cached } = await db.from('uber_app_token').select('access_token,expires_at').eq('id', true).single();
      if (!cached?.access_token || Date.parse(cached.expires_at) <= Date.now() + 60000) return reply({ error: 'Cached Uber token unavailable; no request sent' }, 409);
      const { data: reserved, error: reserveError } = await db.from('payout_pilot_reports').insert({
        restaurant_id: restaurantId, uber_store_id: body.store, start_date: body.start, end_date: body.end,
      }).select('id').single();
      if (reserveError || !reserved) return reply({ error: 'Window already reserved; no request sent' }, 409);
      const response = await fetch('https://api.uber.com/v1/eats/report', {
        method: 'POST', headers: { Authorization: `Bearer ${cached.access_token}`, 'Content-Type': 'application/json', 'Accept-Language': 'fr-FR', 'X-Uber-Locale': 'fr_FR' },
        body: JSON.stringify({ report_type: 'PAYMENT_DETAILS_REPORT', store_uuids: [body.store], start_date: body.start, end_date: body.end }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.workflow_id !== 'string') {
        await db.from('payout_pilot_reports').update({ status: 'refused', refusal_status: response.status }).eq('id', reserved.id);
        return reply({ emitted: true, refused: true, httpStatus: response.status, retryAfter: response.headers.get('retry-after') });
      }
      const { error: registration } = await db.from('payout_pilot_reports').update({ status: 'requested', workflow_id: result.workflow_id }).eq('id', reserved.id);
      if (registration) throw new Error('Pilot report registration failed');
      return reply({ emitted: true, reportId: reserved.id, status: 'requested' });
    }
    if (body.action === 'archives') {
      const { data, error } = await db.from('reports').select('id,start_date,end_date,completed_at')
        .eq('restaurant_id', restaurantId).eq('report_type', 'PAYMENT_DETAILS_REPORT').eq('status', 'completed')
        .lte('start_date', '2026-11-15').gte('end_date', '2026-06-01').order('completed_at', { ascending: false }).limit(1000);
      if (error) throw new Error('Archive query failed');
      return reply({ archives: data });
    }
    if (body.action === 'inspect' || body.action === 'inspectPilot') {
      const table = body.action === 'inspect' ? 'reports' : 'payout_pilot_reports';
      const fields = body.action === 'inspect' ? 'sections,restaurant_id,report_type,start_date,end_date,status' : 'sections,restaurant_id,start_date,end_date,status';
      const { data: report, error } = await db.from(table).select(fields)
        .eq('id', body.reportId).single();
      if (error || !report || report.restaurant_id !== restaurantId || (body.action === 'inspect' ? report.report_type !== 'PAYMENT_DETAILS_REPORT' || report.status !== 'completed' : report.status !== 'received')) return reply({ error: 'Archive not eligible' }, 400);
      const sections = report.sections as { download_url?: string }[] | null;
      if (!sections?.length) return reply({ readable: false, reason: 'no_sections' });
      const allRows: unknown[] = [];
      for (const section of sections) {
        if (!section.download_url) return reply({ readable: false, reason: 'no_download_url' });
        const location = new URL(section.download_url);
        if (location.protocol !== 'https:' || !(location.hostname.endsWith('.uber.com') || location.hostname.endsWith('.amazonaws.com') || location.hostname.endsWith('.cloudfront.net'))) return reply({ readable: false, reason: 'untrusted_archive_host' });
        const download = await fetch(location, { signal: AbortSignal.timeout(15000) });
        if (!download.ok) return reply({ readable: false, http_status: download.status });
        const csvContent = await download.text();
        if (csvContent.length > 50000000 || csvContent.trimStart().startsWith('<')) return reply({ readable: false, reason: 'not_csv' });
        const { data, error: parseError } = await db.functions.invoke('parse-payment-report', {
          body: { csvContent, adjustmentsOnly: true, dryRun: true, pilotStore: body.store, previewSourceRows: true, dataSource: 'uber_api' },
        });
        if (parseError || data?.success !== true || !Array.isArray(data?.sourceRows)) return reply({ readable: false, reason: 'source_validation_failed', detail: data?.error ?? null });
        allRows.push(...data.sourceRows);
      }
      return reply({ readable: true, reportId: body.reportId, start: report.start_date, end: report.end_date, rows: allRows });
    }
    const rows = body.rows;
    if (rows.some(r => !pilotLineAllowed(body.store, r.restaurant_id, pilotDate(r.order_date_key)) || r.uber_store_id !== body.store || ['05G2PXLG9Z79FXQ', '2OAJXO4XY0LOBRE'].includes(r.payout_reference_id))) return reply({ error: 'Source row outside approved pilot' }, 400);
    const refs = [...new Set(rows.map(r => r.payout_reference_id))];
    if (refs.length !== 1) return reply({ error: 'One complete payout group per stage request' }, 400);
    const snapshot = async () => {
      const { data, error } = await db.from('payout_adjustment_lines').select('id,source_line_key,source_duplicate_of,category')
        .eq('restaurant_id', restaurantId).eq('payout_reference_id', refs[0]).limit(10000);
      if (error) throw new Error('Payout snapshot failed');
      return data ?? [];
    };
    const before = await snapshot();
    const { data: inserted, error } = await db.rpc('stage_payout_adjustment_lines', { p_rows: rows });
    if (error) throw new Error(`Staging failed: ${error.message}`);
    const after = await snapshot();
    const previous = new Set(before.filter(r => r.source_duplicate_of).map(r => r.id));
    const marked = after.filter(r => r.source_duplicate_of && !previous.has(r.id));
    return reply({ success: true, inserted, alreadyPresent: rows.length - Number(inserted), markedDuplicates: marked.length,
      markedByCategory: marked.reduce<Record<string, number>>((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + 1; return acc; }, {}) });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Pilot failed' }, 500);
  }
});