// Uber Eats orders.notification webhook
// Receives real-time order events and stores them in uber_live_orders
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-uber-signature, x-uber-signature-v2",
};

const SIGNING_KEY = Deno.env.get("UBER_WEBHOOK_SIGNING_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawBody = await req.text();

  // Verify HMAC signature
  const signature =
    req.headers.get("x-uber-signature-v2") ??
    req.headers.get("x-uber-signature") ??
    "";

  if (SIGNING_KEY) {
    const expected = await hmacSha256Hex(SIGNING_KEY, rawBody);
    const provided = signature.replace(/^sha256=/i, "").trim();
    if (!provided || !timingSafeEqual(expected, provided)) {
      console.warn("[uber-orders-webhook] invalid signature", {
        provided_len: provided.length,
      });
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log raw event for debugging
  try {
    await supabase.from("webhook_logs").insert({
      source: "uber-orders-webhook",
      event_type: payload?.event_type ?? "orders.notification",
      payload,
    });
  } catch (_) { /* non-blocking */ }

  // Uber sends: { event_type, event_time, meta: { user_id, resource_id, status, ... }, resource_href }
  // For orders.notification, resource_href is a URL to fetch the full order.
  const meta = payload?.meta ?? {};
  const uberOrderId: string | undefined =
    meta.resource_id ?? payload?.order_id ?? payload?.id;
  const uberStoreId: string | undefined =
    meta.user_id ?? meta.store_id ?? payload?.store_id;
  const status: string | undefined = meta.status ?? payload?.status;
  const eventTime: string =
    payload?.event_time ?? new Date().toISOString();

  if (!uberOrderId || !uberStoreId) {
    console.warn("[uber-orders-webhook] missing order/store id", { meta });
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve restaurant + chain
  const { data: mapping } = await supabase
    .from("restaurant_uber_ids")
    .select("restaurant_id, restaurants:restaurant_id(chain_id)")
    .eq("uber_store_id", uberStoreId)
    .maybeSingle();

  const restaurantId: string | null = mapping?.restaurant_id ?? null;
  const chainId: string | null =
    (mapping as any)?.restaurants?.chain_id ?? null;

  // Try to extract amount if present in payload
  const grossAmount: number | null =
    payload?.order?.payment?.charges?.total?.amount != null
      ? Number(payload.order.payment.charges.total.amount) / 100
      : payload?.gross_amount_incl_vat ?? null;

  const { error } = await supabase
    .from("uber_live_orders")
    .upsert(
      {
        uber_order_id: uberOrderId,
        uber_store_id: uberStoreId,
        restaurant_id: restaurantId,
        chain_id: chainId,
        status,
        gross_amount_incl_vat: grossAmount,
        order_placed_at: eventTime,
        last_event_at: new Date().toISOString(),
        raw_payload: payload,
      },
      { onConflict: "uber_order_id" },
    );

  if (error) {
    console.error("[uber-orders-webhook] upsert failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
