// Passe de rattrapage rétroactive des versements Uber.
//
// Problème corrigé : les rapports PAYMENT_DETAILS_REPORT sont demandés en
// fenêtres glissantes J-4 → J-1. Or Uber ne rattache le versement d'une
// commande qu'au lundi suivant (J+6/J+7 pour une commande de début de semaine).
// Les commandes du lundi/mardi/mercredi sont donc lues AVANT que le versement
// existe et gardent `payout_date = null` pour toujours.
//
// Cette fonction ré-enfile des jobs PAYMENT_DETAILS_REPORT sur une semaine de
// versement déjà payée (par défaut : J-14 → J-8), pour tous les restaurants
// disposant d'un uber_store_id. Idempotent : upsert sur la clé unique
// (restaurant_id, month_start, report_type).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vague dédiée au rattrapage : priorité BASSE (le tri est croissant, donc
// 1200 > 999 = daily → le rattrapage passe après l'import du jour).
const RETRO_VAGUE = 1200;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    // Fenêtres à retraiter : soit explicites, soit la semaine de versement
    // qui vient d'être payée (J-14 → J-8).
    let windows: { start: string; end: string }[] = [];

    if (Array.isArray(body?.windows) && body.windows.length > 0) {
      windows = body.windows
        .map((w: any) => ({ start: String(w.start), end: String(w.end) }))
        .filter((w: any) => /^\d{4}-\d{2}-\d{2}$/.test(w.start) && /^\d{4}-\d{2}-\d{2}$/.test(w.end));
    } else if (body?.start && body?.end) {
      windows = [{ start: String(body.start), end: String(body.end) }];
    } else {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - 14);
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() - 8);
      windows = [{ start: isoDay(start), end: isoDay(end) }];
    }

    if (windows.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid window provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Garde-fou : bornage du volume enfilé par appel.
    if (windows.length > 12) windows = windows.slice(0, 12);

    const { data: restos, error: restoErr } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id')
      .not('uber_store_id', 'is', null)
      .neq('uber_store_id', '');
    if (restoErr) throw restoErr;

    const restaurants = restos || [];
    if (restaurants.length === 0) {
      return new Response(
        JSON.stringify({ status: 'ok', upserted: 0, message: 'No uber restaurants' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const nowIso = new Date().toISOString();
    const jobs = windows.flatMap((w) =>
      restaurants.map((r: any) => ({
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

    // Upsert par paquets pour rester sous les limites de payload.
    let upserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < jobs.length; i += CHUNK) {
      const chunk = jobs.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('backfill_jobs')
        .upsert(chunk, { onConflict: 'restaurant_id,month_start,report_type' });
      if (error) throw error;
      upserted += chunk.length;
    }

    console.log(
      `[payout-retro] Upserted ${upserted} PAYMENT_DETAILS jobs on ${windows
        .map((w) => `${w.start}→${w.end}`)
        .join(', ')}`,
    );

    // Réveille le worker (sinon attente du tick suivant).
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
      console.warn('[payout-retro] Worker wake failed (next tick will pick it up):', e);
    }

    return new Response(
      JSON.stringify({ status: 'ok', upserted, restaurants: restaurants.length, windows }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[payout-retro] Fatal:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
