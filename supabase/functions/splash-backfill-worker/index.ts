// Worker côté serveur qui pioche les jobs splash_backfill_jobs en attente,
// appelle sync-splash360 pour chacun, et met à jour le statut.
// Conçu pour être appelé en boucle par un cron pg toutes les minutes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Combien de jobs on traite par invocation (≈ 1 job = 1 mois × 1 resto = ~90 appels Splash ≈ 30-60s)
const BATCH_SIZE = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Récupérer un batch de jobs pending et les marquer running atomiquement
    const { data: pickedJobs, error: pickErr } = await supabase
      .rpc("splash_backfill_pick_batch", { p_batch_size: BATCH_SIZE });

    if (pickErr) {
      console.error("[worker] pick error:", pickErr.message);
      return new Response(
        JSON.stringify({ error: pickErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!pickedJobs || pickedJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending jobs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[worker] picked ${pickedJobs.length} jobs`);

    const results: any[] = [];

    // 2. Pour chaque job, appeler sync-splash360 (séquentiel pour éviter rate-limit Splash)
    for (const job of pickedJobs) {
      const startedAt = Date.now();
      try {
        const syncRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-splash360`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              mode: "sync",
              chain_connection_id: job.connection_id,
              year: job.year,
              month: job.month,
              granularity: "day",
              restaurant_splash_ids: [job.restaurant_splash_id],
              skip_network: true, // ne pas re-traiter le réseau global pour chaque job resto
            }),
          },
        );

        const json = await syncRes.json();
        const elapsed = Date.now() - startedAt;

        if (!syncRes.ok || json.error) {
          throw new Error(json.error || `HTTP ${syncRes.status}`);
        }

        await supabase
          .from("splash_backfill_jobs")
          .update({
            status: "done",
            rows_upserted: json.rows_upserted ?? 0,
            completed_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", job.id);

        results.push({ id: job.id, status: "done", rows: json.rows_upserted, elapsed_ms: elapsed });
      } catch (e: any) {
        console.error(`[worker] job ${job.id} failed:`, e.message);
        const newAttempts = (job.attempts ?? 0) + 1;
        const newStatus = newAttempts >= 3 ? "error" : "pending"; // retry jusqu'à 3 fois
        await supabase
          .from("splash_backfill_jobs")
          .update({
            status: newStatus,
            attempts: newAttempts,
            last_error: e.message?.slice(0, 500),
            started_at: null, // libère pour retry
          })
          .eq("id", job.id);
        results.push({ id: job.id, status: newStatus, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[worker] fatal:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
