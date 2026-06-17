// Cron quotidien : planifie un backfill incrémental Uber sur J-3 → J-1
// pour tous les restaurants actifs disposant d'un uber_store_id.
// Inséré dans la file `backfill_jobs` (status=pending) — le worker
// (uber-backfill-worker, tick toutes les minutes) dépile la file.
// Anti-doublon via la clé unique sur orders.order_id (ON CONFLICT).

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
    let windowDays = 3;
    // Par défaut on planifie l'ensemble des reports nécessaires pour garder à jour
    // ventes (PAYMENT + ORDER_HISTORY), avis (CUSTOMER + MENU_ITEM), erreurs et downtime.
    // Sans ces 5 derniers, les métriques décrochent à J+3.
    let reportTypes: string[] = [
      'PAYMENT_DETAILS_REPORT',
      'ORDER_HISTORY_REPORT',
      'CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT',
      'MENU_ITEM_FEEDBACK_REPORT',
      'ORDER_ERRORS_TRANSACTION_REPORT',
      'ORDER_ERRORS_MENU_ITEM_REPORT',
      'DOWNTIME_REPORT',
    ];
    try {
      const body = await req.json();
      if (body?.window_days && Number.isFinite(body.window_days)) {
        windowDays = Math.max(1, Math.min(30, Math.floor(body.window_days)));
      }
      if (body?.report_type) {
        // rétro-compat : accepte une string unique
        reportTypes = [String(body.report_type)];
      } else if (Array.isArray(body?.report_types) && body.report_types.length > 0) {
        reportTypes = body.report_types.map((t: any) => String(t));
      }
    } catch (_) {
      // body optionnel
    }

    // Fenêtre J-(windowDays+1) → J-1 en UTC (worker cap automatiquement J-2 si besoin)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - (windowDays + 1));

    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    const { data: restos, error: restoErr } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id')
      .not('uber_store_id', 'is', null)
      .neq('uber_store_id', '');

    if (restoErr) throw restoErr;

    const restaurants = restos || [];
    if (restaurants.length === 0) {
      return new Response(
        JSON.stringify({ status: 'ok', inserted: 0, message: 'No active uber restaurants' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobs = restaurants.flatMap((r: any) =>
      reportTypes.map((rt) => ({
        restaurant_id: r.id,
        restaurant_name: r.name,
        uber_store_id: r.uber_store_id,
        month_start: startStr,
        month_end: endStr,
        status: 'pending',
        attempts: 0,
        report_type: rt,
        vague: 999, // 999 = vague "daily"
      }))
    );

    const { error: insErr } = await supabase.from('backfill_jobs').insert(jobs);
    if (insErr) throw insErr;


    console.log(`[daily-backfill] Enqueued ${jobs.length} jobs for ${startStr} → ${endStr}`);

    // Réveille immédiatement le worker (sinon il faut attendre le tick suivant)
    try {
      await fetch(`${supabaseUrl}/functions/v1/uber-backfill-worker`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          apikey: supabaseServiceKey,
        },
        body: '{}',
      });
    } catch (e) {
      console.warn('[daily-backfill] Failed to wake worker (will run on next tick):', e);
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        inserted: jobs.length,
        window: `${startStr} → ${endStr}`,
        report_types: reportTypes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[daily-backfill] Fatal:', err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
