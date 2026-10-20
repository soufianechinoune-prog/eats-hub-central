import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncDeletedRange } from "../_shared/splash-deleted-sync.ts";
import type { Cred } from "../_shared/splash-sync.ts";

// Worker de rattrapage des commandes annulées Splash (status=deleted).
// Miroir de splash-ticket-backfill-worker, mais n'écrit QUE dans
// caisse_deleted_orders — jamais dans caisse_tickets ni les rollups.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-key",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_ATTEMPTS = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const workerKeys = [
    Deno.env.get("SPLASH_WORKER_KEY"),
    Deno.env.get("SPLASH_WORKER_CRON_KEY"),
  ].filter(Boolean) as string[];
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Accès : clé worker (cron) ou super-admin connecté.
  const provided = req.headers.get("x-worker-key");
  let allowed = Boolean(provided && workerKeys.includes(provided));
  if (!allowed) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const caller = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: isSuperAdmin } = await caller.rpc("is_super_admin");
      allowed = Boolean(isSuperAdmin);
    }
  }
  if (!allowed) return json({ error: "Unauthorized" }, 401);

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const batch = Math.min(Number(body.batch ?? 4), 8);
  const deadlineMs = Date.now() + Number(body.budget_ms ?? 55000);
  const lockUntil = new Date(Date.now() + 3 * 60000).toISOString();
  const nowIso = new Date().toISOString();

  const results: Record<string, unknown>[] = [];

  try {
    const { data: jobs, error } = await admin
      .from("splash_deleted_backfill_jobs")
      .select("*")
      .in("status", ["pending", "running"])
      .lte("next_attempt_at", nowIso)
      .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
      .order("priority", { ascending: true })
      .order("next_attempt_at", { ascending: true })
      .limit(batch);
    if (error) throw error;
    if (!jobs?.length) return json({ processed: 0, message: "File vide" });

    for (const job of jobs) {
      if (Date.now() > deadlineMs) break;

      await admin
        .from("splash_deleted_backfill_jobs")
        .update({
          status: "running",
          started_at: job.started_at ?? new Date().toISOString(),
          attempts: job.attempts + 1,
          locked_until: lockUntil,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      const { data: creds } = await admin
        .from("splash_restaurant_credentials")
        .select("id, restaurant_id, chain_id, station, client_id, client_secret")
        .eq("restaurant_id", job.restaurant_id)
        .eq("station", job.station)
        .eq("is_active", true)
        .maybeSingle();

      if (!creds) {
        await admin
          .from("splash_deleted_backfill_jobs")
          .update({
            status: "failed",
            locked_until: null,
            last_error: "Aucun accès Splash actif pour cette caisse",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        results.push({ job: job.id, status: "failed", reason: "no_credentials" });
        continue;
      }

      const from = `${job.year}-${String(job.month).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(job.year, job.month, 0)).getUTCDate();
      // +1 jour pour absorber le décalage UTC/Paris des fins de soirée.
      const toDate = new Date(Date.UTC(job.year, job.month - 1, lastDay));
      toDate.setUTCDate(toDate.getUTCDate() + 1);
      const to = toDate.toISOString().slice(0, 10);

      try {
        const res = await syncDeletedRange(
          admin,
          creds as Cred,
          from,
          to,
          Number(job.page_cursor ?? 0),
          200,
          deadlineMs,
        );

        await admin
          .from("splash_deleted_backfill_jobs")
          .update({
            status: res.done ? "completed" : "pending",
            page_cursor: res.next_page,
            orders_upserted: (job.orders_upserted ?? 0) + res.orders,
            last_error: null,
            completed_at: res.done ? new Date().toISOString() : null,
            next_attempt_at: new Date(Date.now() + 5000).toISOString(),
            locked_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.push({ job: job.id, restaurant_id: job.restaurant_id, ...res });
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        const throttled = msg.includes("THROTTLE");
        const attempts = job.attempts + 1;
        const delayMin = throttled ? Math.min(30, 5 * attempts) : Math.min(60, 10 * attempts);
        await admin
          .from("splash_deleted_backfill_jobs")
          .update({
            status: attempts >= MAX_ATTEMPTS && !throttled ? "failed" : "pending",
            last_error: msg.slice(0, 500),
            next_attempt_at: new Date(Date.now() + delayMin * 60000).toISOString(),
            locked_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        results.push({ job: job.id, error: msg, retry_in_min: delayMin });
        if (throttled) break;
      }
    }

    return json({ processed: results.length, results });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
