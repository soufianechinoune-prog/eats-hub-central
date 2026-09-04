// Audit des autorisations boutiques Uber (POS reporting).
//
// Pour chaque restaurant disposant d'un uber_store_id, on tente la création d'un
// rapport PAYMENT_DETAILS_REPORT sur 1 seule journée (fenêtre déjà versée).
// C'est le SEUL test réellement authoritatif : c'est cet appel qui renvoie
// `user_not_allowed` quand la boutique n'est pas rattachée au POS.
//
// Résultat écrit sur `restaurants` :
//   - OK      → uber_auth_checked_at = now, uber_auth_error = null, uber_pos_activated_at conservé/posé
//   - refusé  → uber_pos_activated_at = null, uber_auth_error = motif Uber
//   - 429     → aucun changement (retenté au prochain batch)
//
// Traitement par lots bornés + reprise (les restaurants déjà vérifiés depuis
// `since` sont ignorés), pour rester dans la wall-clock d'une edge function.
//
// Body: { limit?: number, delayMs?: number, reenqueue?: boolean,
//         since?: ISO date (défaut: il y a 12h), storeIds?: string[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vague basse priorité (le worker plafonne le débit au-delà de 1000).
const RETRO_VAGUE = 1200;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Fenêtres hebdomadaires juin → août 2026 (historique à ré-enfiler).
function historyWindows(): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  const cursor = new Date('2026-06-01T00:00:00Z');
  const hardEnd = new Date('2026-08-31T00:00:00Z');
  // Uber refuse les 2 derniers jours.
  const maxEnd = new Date();
  maxEnd.setUTCHours(0, 0, 0, 0);
  maxEnd.setUTCDate(maxEnd.getUTCDate() - 3);
  const finalEnd = hardEnd < maxEnd ? hardEnd : maxEnd;

  while (cursor <= finalEnd) {
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + 6);
    windows.push({ start: isoDay(cursor), end: isoDay(end > finalEnd ? finalEnd : end) });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return windows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: any = {};
  try {
    body = await req.json();
  } catch (_) {
    body = {};
  }

  const limit = Math.min(Math.max(Number(body?.limit) || 30, 1), 60);
  const delayMs = Math.min(Math.max(Number(body?.delayMs) || 1500, 300), 10000);
  const reenqueue = body?.reenqueue !== false;
  const since = body?.since
    ? new Date(String(body.since)).toISOString()
    : new Date(Date.now() - 12 * 3600_000).toISOString();

  // Journée de test : J-9 (déjà versée par Uber, hors fenêtre interdite J-2).
  const probeDay = new Date();
  probeDay.setUTCHours(0, 0, 0, 0);
  probeDay.setUTCDate(probeDay.getUTCDate() - 9);
  const probeDate = isoDay(probeDay);

  try {
    let query = supabase
      .from('restaurants')
      .select('id, name, uber_store_id, chain_id, is_active, uber_auth_checked_at')
      .not('uber_store_id', 'is', null)
      .neq('uber_store_id', '');

    if (Array.isArray(body?.storeIds) && body.storeIds.length > 0) {
      query = query.in('uber_store_id', body.storeIds as string[]);
    } else {
      query = query.or(`uber_auth_checked_at.is.null,uber_auth_checked_at.lt.${since}`);
    }

    const { data: restos, error: restoErr } = await query.order('name').limit(limit);
    if (restoErr) throw restoErr;

    const restaurants = restos || [];
    if (restaurants.length === 0) {
      const { count: remaining } = await supabase
        .from('restaurants')
        .select('id', { count: 'exact', head: true })
        .not('uber_store_id', 'is', null)
        .neq('uber_store_id', '')
        .or(`uber_auth_checked_at.is.null,uber_auth_checked_at.lt.${since}`);
      return new Response(
        JSON.stringify({ status: 'done', checked: 0, remaining: remaining ?? 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authorized: any[] = [];
    const denied: any[] = [];
    const throttled: any[] = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < restaurants.length; i++) {
      const r: any = restaurants[i];
      if (i > 0) await new Promise((res) => setTimeout(res, delayMs));

      let resp: Response | null = null;
      let payload: any = {};
      try {
        resp = await fetch(`${supabaseUrl}/functions/v1/uber-create-report`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
          },
          body: JSON.stringify({
            restaurantId: r.id,
            reportType: 'PAYMENT_DETAILS_REPORT',
            startDate: probeDate,
            endDate: probeDate,
          }),
        });
        payload = await resp.json().catch(() => ({}));
      } catch (e: any) {
        throttled.push({ name: r.name, uber_store_id: r.uber_store_id, error: String(e?.message || e) });
        continue;
      }

      const errMsg = String(payload?.error || payload?.detail || '');
      const isRateLimit = resp.status === 429 || /too_many_requests|TooManyRequests/i.test(errMsg);
      const isDenied = /user_not_allowed|authorisation failed|authorization failed|unauthorized|403/i.test(errMsg);

      if (resp.ok && payload?.workflow_id) {
        await supabase
          .from('restaurants')
          .update({
            uber_auth_checked_at: nowIso,
            uber_auth_error: null,
            uber_pos_activated_at: nowIso,
          })
          .eq('id', r.id)
          .is('uber_pos_activated_at', null);
        await supabase
          .from('restaurants')
          .update({ uber_auth_checked_at: nowIso, uber_auth_error: null })
          .eq('id', r.id);
        authorized.push({ id: r.id, name: r.name, uber_store_id: r.uber_store_id });
        continue;
      }

      if (isRateLimit) {
        throttled.push({ name: r.name, uber_store_id: r.uber_store_id, error: '429 Uber' });
        // Petit recul pour ne pas empiler les 429 sur le reste du lot.
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }

      if (isDenied) {
        await supabase
          .from('restaurants')
          .update({
            uber_auth_checked_at: nowIso,
            uber_auth_error: errMsg.slice(0, 300),
            uber_pos_activated_at: null,
          })
          .eq('id', r.id);
        denied.push({
          id: r.id,
          name: r.name,
          uber_store_id: r.uber_store_id,
          chain_id: r.chain_id,
          is_active: r.is_active,
          error: errMsg.slice(0, 200),
        });
        continue;
      }

      // Autre erreur (transitoire) : on n'altère pas l'état d'autorisation.
      throttled.push({ name: r.name, uber_store_id: r.uber_store_id, error: errMsg.slice(0, 200) || `HTTP ${resp.status}` });
    }

    // Ré-enfilage de l'historique juin → août pour les boutiques autorisées.
    let enqueued = 0;
    if (reenqueue && authorized.length > 0) {
      const windows = historyWindows();
      const jobs = windows.flatMap((w) =>
        authorized.map((r) => ({
          restaurant_id: r.id,
          restaurant_name: r.name,
          uber_store_id: r.uber_store_id,
          month_start: w.start,
          month_end: w.end,
          status: 'pending',
          attempts: 0,
          rate_limit_retries: 0,
          last_error: null,
          report_id: null,
          completed_at: null,
          next_attempt_at: nowIso,
          report_type: 'PAYMENT_DETAILS_REPORT',
          vague: RETRO_VAGUE,
        })),
      );
      const CHUNK = 200;
      for (let i = 0; i < jobs.length; i += CHUNK) {
        const { error } = await supabase
          .from('backfill_jobs')
          .upsert(jobs.slice(i, i + CHUNK), { onConflict: 'restaurant_id,month_start,report_type' });
        if (error) throw error;
        enqueued += Math.min(CHUNK, jobs.length - i);
      }
    }

    const { count: remaining } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .not('uber_store_id', 'is', null)
      .neq('uber_store_id', '')
      .or(`uber_auth_checked_at.is.null,uber_auth_checked_at.lt.${since}`);

    console.log(
      `[uber-auth-audit] checked=${restaurants.length} ok=${authorized.length} denied=${denied.length} throttled=${throttled.length} enqueued=${enqueued} remaining=${remaining ?? 0}`,
    );

    return new Response(
      JSON.stringify({
        status: 'ok',
        probe_date: probeDate,
        checked: restaurants.length,
        authorized: authorized.length,
        denied,
        throttled,
        enqueued,
        remaining: remaining ?? 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[uber-auth-audit] Fatal:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
