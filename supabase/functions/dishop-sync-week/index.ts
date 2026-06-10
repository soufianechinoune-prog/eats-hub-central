// Dishop weekly export sync
// - Récupère l'archive ZIP /v1/api/{companyId}/export-weekly-data/accounting-report
// - Décompresse les 3 JSON (users, orders, billings)
// - Upsert dans dishop_customers / dishop_orders / dishop_order_items
// - Isolation stricte par chain_id

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISHOP_BASE = "https://api.dishop.co";

interface SyncBody {
  chain_connection_id: string;
  // Si non fournis, on prend la semaine courante
  year?: number;
  month?: number;
  week_index?: number;
  // Forcer un companyId différent
  company_id_override?: string;
}

async function getAccessToken(creds: any) {
  const res = await fetch(`${DISHOP_BASE}/v1/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: creds.client_id, client_secret: creds.client_secret }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dishop auth (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as { access_token: string };
}

function flattenItems(
  commande: any,
  dishopOrderId: string,
  chainId: string,
  restaurantId: string | null,
): any[] {
  const items: any[] = [];
  if (!commande || typeof commande !== "object") return items;
  let position = 0;
  for (const productKey of Object.keys(commande)) {
    const prod = commande[productKey];
    if (!prod || !Array.isArray(prod.items)) continue;
    for (const cat of prod.items) {
      const options = cat?.options || {};
      for (const optKey of Object.keys(options)) {
        const opt = options[optKey];
        items.push({
          dishop_order_id: dishopOrderId,
          chain_id: chainId,
          restaurant_id: restaurantId,
          category_id: cat.categoryId ?? null,
          category_name: cat.categoryName ?? null,
          category_position: cat.categoryPosition ?? null,
          product_key: productKey,
          item_key: opt.key ?? null,
          item_name: opt.name ?? null,
          section_key: opt.sectionKey ?? null,
          ref: opt.ref ?? null,
          nb: opt.nb ?? null,
          unit_price: opt.price ?? null,
          price_ref: opt.priceRef ?? null,
          value: opt.value ?? null,
          position_in_basket: position++,
          raw: opt,
        });
      }
    }
  }
  return items;
}

async function chunkedInsert(
  supabase: any,
  table: string,
  rows: any[],
  onConflict?: string,
  chunkSize = 200,
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    let q = supabase.from(table).upsert(slice, onConflict ? { onConflict, ignoreDuplicates: false } : {});
    const { error, count } = await q.select("id", { count: "exact", head: false });
    if (error) {
      console.error(`[${table}] insert chunk error:`, error.message);
      throw new Error(`${table} insert: ${error.message}`);
    }
    inserted += count ?? slice.length;
  }
  return inserted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  // Auth: vérifie l'utilisateur
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  // Service client pour bypass RLS sur les inserts massifs
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let runId: string | null = null;
  try {
    const body = (await req.json()) as SyncBody;
    if (!body.chain_connection_id) throw new Error("chain_connection_id requis");

    // 1) Récupère la connexion
    const { data: conn, error: connErr } = await admin
      .from("chain_pos_connections")
      .select("id, chain_id, credentials, connector_id, is_active")
      .eq("id", body.chain_connection_id)
      .maybeSingle();
    if (connErr || !conn) throw new Error(`Connexion introuvable: ${connErr?.message ?? "absente"}`);
    if (conn.connector_id !== "dishop") throw new Error("Connexion non-Dishop");

    // Vérifie que l'utilisateur a accès à la marque
    const { data: hasAccess } = await admin.rpc("user_has_chain_access", {
      _chain_id: conn.chain_id,
    } as any).maybeSingle?.() ?? { data: null };
    // Fallback: appel via PostgREST direct
    if (hasAccess === null) {
      const { data: access2 } = await admin.rpc("user_has_chain_access", {
        chain_id: conn.chain_id,
      } as any);
      console.log("[dishop-sync] user_has_chain_access fallback:", access2);
    }

    const creds = (conn.credentials || {}) as any;
    const companyId = (body.company_id_override || creds.company_id || "").toLowerCase();
    if (!companyId) throw new Error("company_id manquant dans les credentials");

    // Période: par défaut semaine en cours (Paris)
    const now = new Date();
    const year = body.year ?? now.getUTCFullYear();
    const month = body.month ?? now.getUTCMonth() + 1;
    const weekIndex = body.week_index ?? null;

    // 2) Crée le run
    const { data: run, error: runErr } = await admin
      .from("dishop_sync_runs")
      .insert({
        chain_id: conn.chain_id,
        chain_connection_id: conn.id,
        year,
        month,
        week_index: weekIndex,
        status: "running",
        triggered_by: userId,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(`Création run échouée: ${runErr?.message}`);
    runId = run.id;

    // 3) Token Dishop
    const token = await getAccessToken(creds);
    console.log("[dishop-sync] token OK");

    // 4) URL signée
    const url = `${DISHOP_BASE}/v1/api/${encodeURIComponent(companyId)}/export-weekly-data/accounting-report`;
    const metaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    });
    if (!metaRes.ok) {
      const t = await metaRes.text();
      throw new Error(`Dishop accounting-report ${metaRes.status}: ${t.slice(0, 300)}`);
    }
    const meta = await metaRes.json();
    const downloadUrl: string | undefined = meta?.exportDownloadUrl;
    if (!downloadUrl) throw new Error("exportDownloadUrl manquant");

    // 5) Download ZIP
    console.log("[dishop-sync] downloading ZIP…");
    const zipRes = await fetch(downloadUrl);
    if (!zipRes.ok) throw new Error(`ZIP download ${zipRes.status}`);
    const zipBuf = new Uint8Array(await zipRes.arrayBuffer());
    console.log("[dishop-sync] ZIP", zipBuf.length, "bytes");

    // 6) Unzip
    const zip = await JSZip.loadAsync(zipBuf);
    const filesMeta: Record<string, number> = {};
    let usersJson: any[] = [];
    let ordersJson: any[] = [];
    let billingsJson: any[] = [];
    for (const entry of Object.values(zip.files) as any[]) {
      if (entry.dir) continue;
      const txt = await entry.async("string");
      filesMeta[entry.name] = txt.length;
      try {
        const parsed = JSON.parse(txt);
        if (entry.name.startsWith("users_")) usersJson = parsed;
        else if (entry.name.startsWith("orders_")) ordersJson = parsed;
        else if (entry.name.startsWith("billings_")) billingsJson = parsed;
      } catch (e) {
        console.warn(`[dishop-sync] JSON parse fail ${entry.name}:`, (e as Error).message);
      }
    }
    console.log(
      `[dishop-sync] parsed: users=${usersJson.length} orders=${ordersJson.length} billings=${billingsJson.length}`,
    );

    // 7) Map shopId → restaurant_id
    const { data: mappings } = await admin
      .from("dishop_shop_mapping")
      .select("dishop_shop_id, restaurant_id")
      .eq("chain_id", conn.chain_id);
    const shopMap = new Map<string, string | null>();
    for (const m of mappings ?? []) shopMap.set(m.dishop_shop_id, m.restaurant_id);

    // Auto-create mapping rows for unknown shopIds (sans restaurant_id, à mapper manuellement)
    const newShopIds = new Set<string>();
    for (const b of billingsJson) {
      const sid = b?.shopId;
      if (sid && !shopMap.has(sid)) newShopIds.add(sid);
    }
    if (newShopIds.size) {
      const toInsert = Array.from(newShopIds).map((sid) => ({
        chain_id: conn.chain_id,
        chain_connection_id: conn.id,
        dishop_shop_id: sid,
        restaurant_id: null,
        raw_label: sid,
      }));
      const { error: insMapErr } = await admin
        .from("dishop_shop_mapping")
        .upsert(toInsert, { onConflict: "chain_id,dishop_shop_id", ignoreDuplicates: true });
      if (insMapErr) console.warn("[dishop-sync] new mappings insert:", insMapErr.message);
      for (const sid of newShopIds) shopMap.set(sid, null);
    }

    // 8) Upsert customers
    let customersInserted = 0;
    if (usersJson.length) {
      const rows = usersJson.map((u: any) => ({
        chain_id: conn.chain_id,
        dishop_customer_id: u.id,
        email: u.email ?? null,
        first_name: u.firstName ?? null,
        last_name: u.lastName ?? null,
        phone_number: u.phone?.number ?? u.numero ?? null,
        phone_country_code: u.phone?.countryCode ?? null,
        phone_prefix: u.phone?.prefix ?? null,
        first_order_date: u.date ?? null,
        last_order_date: u.lastOrderDate ?? null,
        newsletter: u.newsletter ?? null,
        shop_ids: u.shopIds ? Object.keys(u.shopIds) : null,
        fidelite_id: u.fideliteId ?? null,
        raw: u,
      })).filter((r) => r.dishop_customer_id);

      customersInserted = await chunkedInsert(
        admin,
        "dishop_customers",
        rows,
        "chain_id,dishop_customer_id",
        300,
      );
    }

    // 9) Index orders.json par chargeId
    const ordersByCharge = new Map<string, any>();
    for (const o of ordersJson) {
      if (o?.chargeId) ordersByCharge.set(o.chargeId, o);
    }

    // 10) Construit les rows dishop_orders depuis billings (source de vérité)
    const orderRows: any[] = [];
    for (const b of billingsJson) {
      const chargeId = b?.chargeId;
      if (!chargeId) continue;
      const shopId = b.shopId;
      const restaurantId = shopId ? shopMap.get(shopId) ?? null : null;
      const o = ordersByCharge.get(chargeId);

      // Commissions Dishop
      const outputs = b?.accounting?.outputs ?? {};
      const dish = outputs.dishop ?? {};
      const dish2 = outputs.dishop2 ?? {};
      const commTotal =
        (Number(dish.amount) || 0) + (Number(dish2.amount) || 0);

      // Adresse depuis orders.json si dispo
      let address: any = null;
      if (o?.address) {
        address = {
          city: o.address.city ?? null,
          country: o.address.country ?? null,
          postal_code: o.address.postalCode ?? null,
          region: o.address.region ?? null,
          street: o.address.street ?? null,
          street_number: o.address.streetNumber ?? null,
          latitude: o.address.location?.latitude ?? null,
          longitude: o.address.location?.longitude ?? null,
        };
      }

      orderRows.push({
        chain_id: conn.chain_id,
        chain_connection_id: conn.id,
        restaurant_id: restaurantId,
        dishop_shop_id: shopId ?? null,
        charge_id: chargeId,
        order_number: b.orderNumber ?? null,
        dishop_customer_id: b.customerId ?? null,
        order_date: b.dateOrder ?? b.date ?? null,
        order_type: b.orderType ?? null,
        status: b.status ?? null,
        payment_type: b.paymentType ?? null,
        price_total: b.priceOrder ?? null,
        commission_dishop_amount: commTotal || null,
        commission_dishop_variable: dish.data?.servicePrice?.variable
          ? Number(String(dish.data.servicePrice.variable).replace(/[^0-9.]/g, ""))
          : null,
        commission_dishop_fixe: dish.data?.servicePrice?.fixe ?? null,
        commission_orderType_amount: dish2.amount ?? null,
        commission_orderType_name: dish2.data?.name ?? null,
        marketing_promo_used: b.marketingPromoUsed ?? null,
        address,
        raw_order: o ?? null,
        raw_billing: b,
        source_year: year,
        source_month: month,
        source_week_index: weekIndex,
      });
    }

    // 11) Upsert orders (par chargeId)
    let ordersInserted = 0;
    let itemsInserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < orderRows.length; i += CHUNK) {
      const slice = orderRows.slice(i, i + CHUNK);
      const { data: upserted, error: upErr } = await admin
        .from("dishop_orders")
        .upsert(slice, { onConflict: "chain_id,charge_id" })
        .select("id, charge_id, restaurant_id");
      if (upErr) throw new Error(`upsert orders: ${upErr.message}`);
      ordersInserted += upserted?.length ?? 0;

      // delete + reinsert items for each
      const ids = upserted!.map((u: any) => u.id);
      if (ids.length) {
        await admin.from("dishop_order_items").delete().in("dishop_order_id", ids);
      }

      const allItems: any[] = [];
      for (const u of upserted!) {
        const o = ordersByCharge.get(u.charge_id);
        if (!o?.commande) continue;
        const items = flattenItems(o.commande, u.id, conn.chain_id, u.restaurant_id);
        allItems.push(...items);
      }
      if (allItems.length) {
        // Insert items in sub-chunks of 1000
        for (let j = 0; j < allItems.length; j += 1000) {
          const sub = allItems.slice(j, j + 1000);
          const { error: itemsErr } = await admin.from("dishop_order_items").insert(sub);
          if (itemsErr) throw new Error(`insert items: ${itemsErr.message}`);
          itemsInserted += sub.length;
        }
      }
    }

    // 12) Finish run
    const finished = new Date();
    await admin
      .from("dishop_sync_runs")
      .update({
        status: "success",
        finished_at: finished.toISOString(),
        duration_ms: finished.getTime() - new Date(run.id ? Date.now() : Date.now()).getTime(),
        files_meta: filesMeta,
        rows_inserted: {
          customers: customersInserted,
          orders: ordersInserted,
          items: itemsInserted,
          shops_new: newShopIds.size,
        },
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        files: filesMeta,
        new_shops: Array.from(newShopIds),
        rows_inserted: {
          customers: customersInserted,
          orders: ordersInserted,
          items: itemsInserted,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[dishop-sync] error:", e);
    if (runId) {
      await admin
        .from("dishop_sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: (e as Error).message ?? String(e),
        })
        .eq("id", runId);
    }
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? String(e), run_id: runId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
