import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { classifyEcoLine, resolveEcoNeighbours, matchEcoMirrors, observeEcoTransition } from '../_shared/ecoReconciliation.ts';

const schema = z.object({ chainId: z.string().uuid(), restaurantIds: z.array(z.string().uuid()).min(1).max(5), dryRun: z.boolean().default(true) });
Deno.serve(async req => {
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return respond({ error: 'Missing server configuration' }, 500);
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return respond({ error: 'Unauthorized' }, 401);
    const db = createClient(url, key);
    if (token !== key) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return respond({ error: 'Unauthorized' }, 401);
      const scoped = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: admin } = await scoped.rpc('is_super_admin');
      if (!admin) return respond({ error: 'Forbidden' }, 403);
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return respond({ error: parsed.error.flatten() }, 400);
    const { chainId, restaurantIds, dryRun } = parsed.data;
    const { data: restaurants, error: re } = await db.from('restaurants').select('id').eq('chain_id', chainId).in('id', restaurantIds);
    if (re || restaurants?.length !== new Set(restaurantIds).size) return respond({ error: 'Invalid chain scope' }, 403);
    const { data: windows, error: we } = await db.from('eco_observed_rate_windows').select('*');
    if (we || !windows?.length) throw new Error('Candidate windows unavailable');
    const rates = windows.map(r => ({ code: r.code, units: r.rate_units, start: r.valid_from, end: r.valid_to }));
    const results = [];
    for (const restaurantId of restaurantIds) {
      const { data: sources, error } = await db.rpc('get_eco_reconciliation_source', { p_restaurant_id: restaurantId });
      if (error) throw new Error('Source read failed');
      const lines = resolveEcoNeighbours((sources || []).map(s => classifyEcoLine({
        id: s.id, restaurantId, date: s.payout_date, amount: Number(s.amount), sourceKey: s.source_line_key,
        eligible: s.category === 'eco_contribution' || /^(autres frais|other fees)/i.test(s.description || ''),
        volume: s.volume == null ? null : Number(s.volume), periodStart: s.period_start, periodEnd: s.period_end,
      }, rates)));
      if (!dryRun && lines.length) {
        const rows = lines.map(l => ({ adjustment_id: l.id, restaurant_id: restaurantId, chain_id: chainId,
          status: l.status, reason: l.reason, rate_code: l.rate, attribution: l.attribution, candidate_rates: l.candidates,
          real_volume: l.volume, period_start: l.periodStart, period_end: l.periodEnd,
          source_amount: l.amount, source_line_key: l.sourceKey, checked_at: new Date().toISOString() }));
        for (let i = 0; i < rows.length; i += 100) {
          const { error: writeError } = await db.from('eco_reconciliation_audit').upsert(rows.slice(i, i + 100));
          if (writeError) throw new Error('Audit write failed');
        }
      }
      results.push({ restaurantId, counts: lines.reduce<Record<string, number>>((a, l) => {
        a[l.reason] = (a[l.reason] || 0) + 1; return a;
      }, {}), transition: observeEcoTransition(lines), mirrors: matchEcoMirrors(lines), lines });
    }
    return respond({ success: true, dryRun, results, certified: false });
  } catch {
    return respond({ error: 'Reconciliation failed; source amounts remain unchanged' }, 500);
  }
});