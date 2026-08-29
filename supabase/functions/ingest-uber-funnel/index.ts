import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expectedKey = Deno.env.get("UBER_FUNNEL_INGEST_KEY");
  const providedKey = req.headers.get("x-api-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const rows = body?.rows;
    if (!Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "Body must be { rows: [...] }" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build UUID -> {restaurant_id, chain_id, name} lookup from restaurant_uber_ids
    const lookup = new Map<string, { id: string; chain_id: string | null; name: string }>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("restaurant_uber_ids")
        .select("uber_store_id, restaurant_id, restaurants(id, name, chain_id)")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) {
        const uuid = String(r.uber_store_id ?? "").trim().toLowerCase();
        const restaurant: any = r.restaurants;
        if (uuid && !lookup.has(uuid)) {
          lookup.set(uuid, {
            id: r.restaurant_id,
            chain_id: restaurant?.chain_id ?? null,
            name: restaurant?.name ?? "",
          });
        }
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? Math.round(n) : null;
    };

    const received = rows.length;
    const unmatched: string[] = [];
    let matched = 0;
    const payload: Record<string, unknown>[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      if ((row?.status ?? "ok") !== "ok") continue;
      const uuid = String(row?.uuid ?? "").trim();
      if (!uuid) continue;

      const windowLabel = row?.window != null ? String(row.window) : "";
      const dedupKey = `${uuid}||${windowLabel}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const hit = lookup.get(uuid.toLowerCase()) ?? null;
      if (hit) matched++;
      else if (!unmatched.includes(uuid)) unmatched.push(uuid);

      payload.push({
        restaurant_id: hit?.id ?? null,
        chain_id: hit?.chain_id ?? null,
        uber_store_uuid: uuid,
        store_name: hit?.name ?? "",
        window_label: windowLabel,
        visits: toNum(row?.visits),
        menu_views: toNum(row?.menu),
        cart_adds: toNum(row?.cart),
        orders: toNum(row?.orders),
        conversion_rate: toNum(row?.conversion),
        status: row?.status ?? "ok",
        collected_at: new Date().toISOString(),
      });
    }

    let upserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const chunk = payload.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from("uber_conversion_funnel")
        .upsert(chunk, { onConflict: "uber_store_uuid,window_label", count: "exact" })
        .select("id", { count: "exact", head: true });
      if (error) {
        console.error("[ingest-uber-funnel] upsert error", error);
        throw error;
      }
      upserted += count ?? chunk.length;
    }

    console.log(`[ingest-uber-funnel] received=${received} upserted=${upserted} matched=${matched} unmatched=${unmatched.length}`);

    return new Response(JSON.stringify({ received, upserted, matched, unmatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ingest-uber-funnel] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
