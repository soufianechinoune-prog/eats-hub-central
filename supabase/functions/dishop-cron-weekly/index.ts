// Dishop weekly cron — fires every Monday 06:00 Paris.
// Iterates all active dishop chain_pos_connections and triggers dishop-sync-week
// for each, in parallel. No JWT required (called by pg_cron); auth is via the
// service-role bypass implemented in dishop-sync-week.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log("[dishop-cron-weekly] started", new Date().toISOString());

  // 1) Liste toutes les connexions Dishop actives
  const { data: connections, error } = await admin
    .from("chain_pos_connections")
    .select("id, chain_id")
    .eq("connector_id", "dishop")
    .eq("is_active", true);

  if (error) {
    console.error("[dishop-cron-weekly] list error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!connections || connections.length === 0) {
    console.log("[dishop-cron-weekly] no active Dishop connection");
    return new Response(JSON.stringify({ ok: true, connections: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[dishop-cron-weekly] ${connections.length} connection(s) to sync`);

  // 2) Lance les syncs en parallèle (chaque appel ~9s, OK pour <20 marques)
  const syncUrl = `${supabaseUrl}/functions/v1/dishop-sync-week`;
  const results = await Promise.allSettled(
    connections.map(async (c) => {
      const res = await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ chain_connection_id: c.id }),
      });
      const text = await res.text();
      let payload: unknown = text;
      try { payload = JSON.parse(text); } catch { /* keep text */ }
      return { connection_id: c.id, chain_id: c.chain_id, status: res.status, payload };
    }),
  );

  const summary = results.map((r, i) => ({
    connection_id: connections[i].id,
    ok: r.status === "fulfilled" && (r.value.status >= 200 && r.value.status < 300),
    detail: r.status === "fulfilled" ? r.value : { error: String(r.reason) },
  }));

  const okCount = summary.filter((s) => s.ok).length;
  console.log(`[dishop-cron-weekly] done: ${okCount}/${summary.length} OK`);

  return new Response(JSON.stringify({ ok: true, total: summary.length, succeeded: okCount, results: summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
