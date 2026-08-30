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

// Deliveroo CSV timestamps are LOCAL Paris time ("2026-07-16 23:58:59").
// We convert to an absolute instant by applying the Paris offset for that date.
function parisToUtcISO(raw: string): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || "0"));
  // Offset of Europe/Paris at that instant (approximation good for +/-1h DST)
  const guess = new Date(naive);
  const parisStr = guess.toLocaleString("en-US", { timeZone: "Europe/Paris" });
  const offsetMs = new Date(parisStr).getTime() - guess.getTime();
  return new Date(naive - offsetMs).toISOString();
}

const num = (v: string) => {
  const n = parseFloat((v || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    // Mapping deliveroo name -> restaurant
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
    const iName = idx("deliveroo_name"), iOrder = idx("order_number"), iStatus = idx("status");
    const iSent = idx("sent_at"), iDeliv = idx("delivered_at"), iSub = idx("subtotal");
    const iCom = idx("commission"), iVat = idx("commission_vat"), iNet = idx("net");
    if (iName < 0 || iOrder < 0 || iSent < 0 || iSub < 0) {
      return new Response(JSON.stringify({ error: "En-têtes CSV inattendus", header }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows: any[] = [];
    const unmatched = new Map<string, { count: number; subtotal: number }>();
    const perRestaurant = new Map<string, { id: string; name: string; count: number; subtotal: number }>();
    let skipped = 0;
    let minDate: string | null = null, maxDate: string | null = null;
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const f = parseCSVLine(lines[i]);
      const name = f[iName];
      const orderNumber = f[iOrder];
      const sent = parisToUtcISO(f[iSent]);
      if (!name || !orderNumber || !sent) { skipped++; continue; }

      const key = `${name}|${orderNumber}|${sent}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);

      const r = byName.get(normalize(name));
      const subtotal = num(f[iSub]);
      const commission = Math.abs(num(f[iCom]));
      const commissionVat = Math.abs(num(f[iVat]));
      const net = iNet >= 0 && f[iNet] !== "" ? num(f[iNet]) : subtotal - commission - commissionVat;
      const status = f[iStatus] || "Terminée";

      const day = f[iSent].slice(0, 10);
      if (!minDate || day < minDate) minDate = day;
      if (!maxDate || day > maxDate) maxDate = day;

      if (!r) {
        const u = unmatched.get(name) || { count: 0, subtotal: 0 };
        u.count++; u.subtotal += subtotal;
        unmatched.set(name, u);
      } else {
        const p = perRestaurant.get(r.id) || { id: r.id, name: r.name, count: 0, subtotal: 0 };
        p.count++; p.subtotal += subtotal;
        perRestaurant.set(r.id, p);
      }

      rows.push({
        chain_id: r?.chain_id ?? null,
        restaurant_id: r?.id ?? null,
        deliveroo_name: name,
        normalized_name: normalize(name),
        order_number: orderNumber,
        status,
        sent_at: sent,
        delivered_at: parisToUtcISO(f[iDeliv] || ""),
        subtotal,
        commission,
        commission_vat: commissionVat,
        net,
        source_file: fileName || null,
      });
    }

    const summary = {
      totalRows: rows.length,
      skipped,
      matched: rows.filter((r) => r.restaurant_id).length,
      unmatchedRows: rows.filter((r) => !r.restaurant_id).length,
      dateRange: { start: minDate, end: maxDate },
      restaurants: Array.from(perRestaurant.values()).sort((a, b) => b.subtotal - a.subtotal),
      unmatchedNames: Array.from(unmatched.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.subtotal - a.subtotal),
      revenue: rows.filter((r) => r.status === "Terminée").reduce((s, r) => s + r.subtotal, 0),
      netOfCommission: rows.filter((r) => r.status === "Terminée").reduce((s, r) => s + r.net, 0),
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
        .from("deliveroo_sales_orders")
        .upsert(chunk, { onConflict: "deliveroo_name,order_number,sent_at" });
      if (error) errors.push(`${i}-${i + chunk.length}: ${error.message}`);
      else inserted += chunk.length;
    }

    return new Response(JSON.stringify({ ...summary, inserted, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-deliveroo-orders failed", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
