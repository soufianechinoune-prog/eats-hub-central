import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const normalize = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const num = (v: string) => {
  const n = parseFloat((v || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: string) => {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const unauthorized = () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Auth: shared ingest key (collecteur externe) OR authenticated user JWT (UI d'import)
  const expectedKey = Deno.env.get("DELIVEROO_INGEST_KEY");
  const providedKey = req.headers.get("x-api-key");
  const authHeader = req.headers.get("Authorization") ?? "";

  if (providedKey) {
    if (!expectedKey || providedKey !== expectedKey) return unauthorized();
  } else {
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return unauthorized();
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return unauthorized();
  }

  try {
    const { csvContent, fileName, dryRun } = await req.json();

    if (typeof csvContent !== "string" || csvContent.trim().length === 0) {
      return new Response(JSON.stringify({ error: "csvContent requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: maps, error: mapErr } = await supabase
      .from("restaurant_deliveroo_ids")
      .select("deliveroo_store_name, restaurants(id, name, chain_id)");
    if (mapErr) throw mapErr;

    const byName = new Map<string, { id: string; name: string; chain_id: string }>();
    for (const m of maps || []) {
      const r: any = (m as any).restaurants;
      if (r) byName.set(normalize((m as any).deliveroo_store_name), r);
    }

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const iDate = idx("date"), iName = idx("deliveroo_name"), iCampId = idx("campaign_id");
    const iCampName = idx("campaign_name"), iStatus = idx("campaign_status");
    const iSpend = idx("ad_spend"), iAdSales = idx("ad_sales_clicks"), iAdOrders = idx("ad_orders_clicks");
    const iClicks = idx("clicks"), iViews = idx("views"), iCpc = idx("avg_cpc");

    if (iDate < 0 || iName < 0 || iSpend < 0) {
      return new Response(JSON.stringify({ error: "En-têtes CSV inattendus", header }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows: any[] = [];
    const unmatched = new Map<string, { count: number; spend: number }>();
    const perRestaurant = new Map<string, { id: string; name: string; days: number; spend: number; adSales: number }>();
    let skipped = 0;
    let minDate: string | null = null, maxDate: string | null = null;
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const f = parseCSVLine(lines[i]);
      const name = f[iName];
      const date = (f[iDate] || "").slice(0, 10);
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue; }

      const campaignId = (iCampId >= 0 ? f[iCampId] : "") || "";
      const key = `${name}|${campaignId}|${date}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);

      const r = byName.get(normalize(name));
      const spend = num(f[iSpend]);
      const adSales = iAdSales >= 0 ? num(f[iAdSales]) : 0;

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      if (!r) {
        const u = unmatched.get(name) || { count: 0, spend: 0 };
        u.count++; u.spend += spend;
        unmatched.set(name, u);
      } else {
        const p = perRestaurant.get(r.id) || { id: r.id, name: r.name, days: 0, spend: 0, adSales: 0 };
        p.days++; p.spend += spend; p.adSales += adSales;
        perRestaurant.set(r.id, p);
      }

      rows.push({
        date,
        chain_id: r?.chain_id ?? null,
        restaurant_id: r?.id ?? null,
        deliveroo_name: name,
        normalized_name: normalize(name),
        campaign_id: campaignId,
        campaign_name: iCampName >= 0 ? (f[iCampName] || null) : null,
        campaign_status: iStatus >= 0 ? (f[iStatus] || null) : null,
        ad_spend: spend,
        ad_sales_clicks: adSales,
        ad_orders_clicks: iAdOrders >= 0 ? num(f[iAdOrders]) : 0,
        clicks: iClicks >= 0 ? num(f[iClicks]) : 0,
        views: iViews >= 0 ? num(f[iViews]) : 0,
        avg_cpc: iCpc >= 0 ? numOrNull(f[iCpc]) : null,
        source_file: fileName || null,
      });
    }

    const totalSpend = rows.reduce((s, r) => s + r.ad_spend, 0);
    const totalAdSales = rows.reduce((s, r) => s + r.ad_sales_clicks, 0);

    const summary = {
      totalRows: rows.length,
      skipped,
      matched: rows.filter((r) => r.restaurant_id).length,
      unmatchedRows: rows.filter((r) => !r.restaurant_id).length,
      dateRange: { start: minDate, end: maxDate },
      restaurants: Array.from(perRestaurant.values()).sort((a, b) => b.spend - a.spend),
      unmatchedNames: Array.from(unmatched.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.spend - a.spend),
      totalSpend,
      totalAdSales,
      roas: totalSpend > 0 ? totalAdSales / totalSpend : null,
    };

    if (dryRun) {
      return new Response(JSON.stringify({ dryRun: true, ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let inserted = 0;
    const errors: string[] = [];
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("deliveroo_ads")
        .upsert(chunk, { onConflict: "deliveroo_name,campaign_id,date" });
      if (error) errors.push(`${i}-${i + chunk.length}: ${error.message}`);
      else inserted += chunk.length;
    }

    return new Response(JSON.stringify({ ...summary, inserted, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-deliveroo-ads failed", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
