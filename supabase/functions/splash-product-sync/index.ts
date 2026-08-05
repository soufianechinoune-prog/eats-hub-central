import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPLASH_BASE_URL = "https://api2.splash360.fr";
const SPLASH_TOKEN_URL = `${SPLASH_BASE_URL}/oauth/v2/token`;
const SPLASH_CLIENT_ID = Deno.env.get("SPLASH_CLIENT_ID") ?? "4194_4aq9h0ehmhc0w4gkggsg0kk80wg4gg0s8wkoc8k0goksgsgc0o";
const SPLASH_CLIENT_SECRET = Deno.env.get("SPLASH_CLIENT_SECRET") ?? "5tjsus6ioj8ccow0o4ww4sggkss4k8sgckksg4o0kcsco0w0kc";

async function getAccessToken(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: SPLASH_CLIENT_ID,
    client_secret: SPLASH_CLIENT_SECRET,
    username: email,
    password,
  });
  const res = await fetch(SPLASH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Auth Splash360 échouée (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Pas d'access_token");
  return data.access_token;
}

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to, monthDate: from };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      splash_id,
      month,
      dry_run = false,
      chain_connection_id,
      page_size = 100,
      max_pages = 200,
    } = body as Record<string, any>;

    if (!splash_id || !month) {
      return new Response(JSON.stringify({ error: "splash_id et month (YYYY-MM) requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Mapping splash_id -> restaurant
    const { data: mapping, error: mapErr } = await supabase
      .from("splash360_restaurant_mapping")
      .select("restaurant_id, chain_id")
      .eq("restaurant_splash_id", splash_id)
      .maybeSingle();
    if (mapErr) throw new Error(`Mapping lookup failed: ${mapErr.message}`);
    if (!mapping?.restaurant_id) throw new Error(`Aucun mapping restaurant pour splash_id ${splash_id}`);

    // Credentials
    let email = Deno.env.get("SPLASH_EMAIL") ?? "";
    let password = Deno.env.get("SPLASH_PASSWORD") ?? "";
    let connQuery = supabase
      .from("chain_pos_connections")
      .select("credentials, chain_id")
      .eq("connector_id", "splash360")
      .eq("is_active", true);
    connQuery = chain_connection_id
      ? connQuery.eq("id", chain_connection_id)
      : connQuery.eq("chain_id", mapping.chain_id);
    const { data: conn } = await connQuery.maybeSingle();
    const creds = (conn?.credentials ?? {}) as Record<string, string>;
    email = creds.email || email;
    password = creds.password || password;
    if (!email || !password) throw new Error("Credentials Splash360 introuvables");

    const token = await getAccessToken(email, password);
    const { from, to, monthDate } = monthBounds(month);

    // Pagination /api/export/orders
    const agg = new Map<string, {
      product_id: string;
      product_name: string;
      quantity_total: number;
      revenue_excl_vat: number;
      revenue_incl_vat: number;
      orders: Set<string>;
    }>();

    let page = 0;
    let ordersSeen = 0;
    let sampleOrder: unknown = null;
    let lastUrl = "";

    while (page < max_pages) {
      const restaurantParam = body.restaurant_param === null || body.restaurant_param === "none"
        ? ""
        : `&${body.restaurant_param ?? "restaurant"}=${splash_id}`;
      const url = `${SPLASH_BASE_URL}/api/export/orders?page=${page}&pageSize=${page_size}&fromDate=${from}&toDate=${to}${restaurantParam}`;
      lastUrl = url;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`export/orders error (${res.status}): ${(await res.text()).slice(0, 500)}`);
      const rawText = await res.text();
      if (body.debug_raw) {
        return new Response(JSON.stringify({ debug_raw: rawText.slice(0, 3000), url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = JSON.parse(rawText);
      const orders: any[] = Array.isArray(json) ? json : (json.data ?? json.orders ?? json.items ?? json.results ?? json.content ?? []);
      if (!orders.length) break;
      if (!sampleOrder) sampleOrder = orders[0];

      for (const o of orders) {
        ordersSeen++;
        const orderId = String(o.id ?? o.orderId ?? o.reference ?? ordersSeen);
        const lines: any[] = o.items ?? o.orderItems ?? o.products ?? o.lines ?? [];
        for (const it of lines) {
          const pid = String(it.productId ?? it.product_id ?? it.id ?? it.sku ?? it.name ?? "unknown");
          const pname = String(it.productName ?? it.product_name ?? it.name ?? it.label ?? pid);
          const qty = num(it.quantity ?? it.qty ?? 1);
          const ttc = num(it.totalPriceTTC ?? it.priceTTC ?? it.total_ttc ?? it.price ?? 0) ||
            num(it.unitPriceTTC ?? it.unit_price_ttc ?? 0) * qty;
          const ht = num(it.totalPriceHT ?? it.priceHT ?? it.total_ht ?? 0) ||
            num(it.unitPriceHT ?? it.unit_price_ht ?? 0) * qty;
          const cur = agg.get(pid) ?? {
            product_id: pid,
            product_name: pname,
            quantity_total: 0,
            revenue_excl_vat: 0,
            revenue_incl_vat: 0,
            orders: new Set<string>(),
          };
          cur.quantity_total += qty;
          cur.revenue_incl_vat += ttc;
          cur.revenue_excl_vat += ht;
          cur.orders.add(orderId);
          agg.set(pid, cur);
        }
      }

      if (orders.length < page_size) break;
      page++;
    }

    const rows = Array.from(agg.values())
      .map((p) => ({
        restaurant_id: mapping.restaurant_id,
        chain_id: mapping.chain_id,
        month: monthDate,
        product_id: p.product_id,
        product_name: p.product_name,
        quantity_total: Math.round(p.quantity_total),
        revenue_excl_vat: Number(p.revenue_excl_vat.toFixed(2)),
        revenue_incl_vat: Number(p.revenue_incl_vat.toFixed(2)),
        order_count: p.orders.size,
      }))
      .sort((a, b) => b.revenue_excl_vat - a.revenue_excl_vat);

    let upserted = 0;
    if (!dry_run && rows.length) {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from("splash_product_monthly")
          .upsert(chunk, { onConflict: "restaurant_id,month,product_id" });
        if (error) throw new Error(`Upsert failed: ${error.message}`);
        upserted += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        splash_id,
        month,
        restaurant_id: mapping.restaurant_id,
        pages_fetched: page + 1,
        orders_seen: ordersSeen,
        products: rows.length,
        upserted,
        top10: rows.slice(0, 10),
        sample_order: dry_run ? sampleOrder : undefined,
        last_url: dry_run ? lastUrl : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
