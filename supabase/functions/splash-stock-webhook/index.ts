import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Item = z.object({ item_id: z.string().min(1).max(200), status: z.string().min(1).max(50) }).passthrough();
const Body = z.array(Item).max(5000);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("SPLASH_STOCK_PARTNER_KEY");
  const provided = req.headers.get("Api-Key");
  if (!expected || provided !== expected) return json({ error: "unauthorized" }, 401);

  // URL: .../splash-stock-webhook/<splash_api_key>
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("splash-stock-webhook");
  const splashKey = idx >= 0 && parts[idx + 1] ? decodeURIComponent(parts[idx + 1]).slice(0, 200) : null;

  let payload: unknown;
  try { payload = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const parsed = Body.safeParse(Array.isArray(payload) ? payload : [payload]);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  const rows = parsed.data.map((it) => ({
    splash_api_key: splashKey,
    item_id: it.item_id,
    item_kind: it.item_id.startsWith("ing") ? "ingredient" : it.item_id.startsWith("prd") ? "product" : null,
    status: it.status,
    raw: it,
  }));

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (rows.length) {
    const { error } = await supabase.from("splash_stock_events").insert(rows);
    if (error) { console.error(error); return json({ error: "storage failed" }, 500); }
  }
  return json({ success: true, received: rows.length });
});
