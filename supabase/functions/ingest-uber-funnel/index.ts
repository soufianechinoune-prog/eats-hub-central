import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeName(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, " ")
    // strip common brand prefixes
    .replace(/^\s*(tasty\s*crousty|chicken\s*street|crousty\s*one|bangkok\s*factory|cs)\s*[-–—:]\s*/i, "")
    .replace(/^\s*(tasty\s*crousty|chicken\s*street|crousty\s*one|bangkok\s*factory)\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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

    // Build restaurant lookup (name -> {id, chain_id})
    const lookup = new Map<string, { id: string; chain_id: string | null }>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, chain_id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) {
        const key = normalizeName(r.name ?? "");
        if (key && !lookup.has(key)) lookup.set(key, { id: r.id, chain_id: r.chain_id ?? null });
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Aliases
    const { data: aliases } = await supabase
      .from("restaurant_name_aliases")
      .select("restaurant_id, alias");
    if (aliases) {
      const chainById = new Map<string, string | null>();
      for (const [, v] of lookup) chainById.set(v.id, v.chain_id);
      for (const a of aliases) {
        const key = normalizeName(a.alias ?? "");
        if (key && !lookup.has(key)) {
          lookup.set(key, { id: a.restaurant_id, chain_id: chainById.get(a.restaurant_id) ?? null });
        }
      }
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
      const name = String(row?.name ?? "").trim();
      if (!uuid || !name) continue;

      const windowLabel = row?.window != null ? String(row.window) : null;
      const dedupKey = `${uuid}||${windowLabel ?? ""}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const hit = lookup.get(normalizeName(name)) ?? null;
      if (hit) matched++;
      else if (!unmatched.includes(name)) unmatched.push(name);

      payload.push({
        restaurant_id: hit?.id ?? null,
        chain_id: hit?.chain_id ?? null,
        uber_store_uuid: uuid,
        store_name: name,
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
