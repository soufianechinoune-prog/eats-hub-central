import { Webhook } from "standardwebhooks";
import { z } from "zod";

export type EventType = "stock" | "prices" | "catalog" | "orders";
export interface VerifiedEvent {
  webhookId: string;
  eventType: EventType;
  clientId: string;
  payload: unknown;
}

const ItemId = z.string().min(1).max(200);
const Stock = z.array(z.object({ item_id: ItemId, status: z.enum(["available", "unavailable"]) })).max(5000);
const Prices = z.array(z.object({ item_id: ItemId, price: z.number().finite().nonnegative() })).max(1);
const Catalog = z.object({ catalog_id: z.number().int().nonnegative(), revision: z.number().int().nonnegative(), installed_at: z.string().datetime({ offset: true }) });
const Orders = z.object({ order_id: z.string().min(1).max(200), status: z.enum(["paid", "cancelled"]), amount: z.number().finite().nonnegative().nullable(), occurred_at: z.string().datetime({ offset: true }), reason: z.string().max(2000).nullable() });
const Challenge = z.object({ challenge: z.string().min(1).max(4096) });
const schemas = { stock: Stock, prices: Prices, catalog: Catalog, orders: Orders };

// The declared URL determines the event. The unsuffixed URL is stock-only,
// matching the initial activation request; never infer an event from its body.
export function resolveTarget(url: string): { eventType: EventType; clientId: string } | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const index = parts.indexOf("splash-webhook");
    if (index < 0) return null;
    const tail = parts.slice(index + 1);
    let eventType: EventType = "stock";
    if (tail.length === 2) {
      const event = tail.shift();
      if (event !== "stock" && event !== "prices" && event !== "catalog" && event !== "orders") return null;
      eventType = event;
    }
    if (tail.length !== 1) return null;
    const clientId = decodeURIComponent(tail[0]);
    if (!clientId || clientId.length > 200 || /[\s/\x00-\x1f]/.test(clientId)) return null;
    return { eventType, clientId };
  } catch { return null; }
}

export function createHandler(options: {
  secret: () => string | undefined;
  persist: (event: VerifiedEvent) => Promise<void>;
  corsHeaders: Record<string, string>;
}) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...options.corsHeaders, "Content-Type": "application/json" },
  });
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: options.corsHeaders });
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    const secret = options.secret();
    if (!secret) return json({ error: "service unavailable" }, 503);
    const id = req.headers.get("webhook-id") ?? "";
    const ts = req.headers.get("webhook-timestamp") ?? "";
    const sig = req.headers.get("webhook-signature") ?? "";
    // Canonical seconds preserve the exact signed timestamp with the official library.
    if (!id || id.length > 200 || !/^(0|[1-9]\d{0,11})$/.test(ts) || !sig || sig.length > 4096) return json({ error: "unauthorized" }, 401);
    if (Number(req.headers.get("content-length") ?? 0) > 1_000_000) return json({ error: "payload too large" }, 413);
    let bytes: Uint8Array;
    try {
      const reader = req.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > 1_000_000) { await reader.cancel(); return json({ error: "payload too large" }, 413); }
          chunks.push(part.value);
        }
      }
      bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    } catch { return json({ error: "invalid request" }, 400); }
    let payload: unknown;
    try {
      // Fatal decoding refuses malformed UTF-8 instead of changing signed bytes.
      const raw = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      payload = new Webhook(secret).verify(raw, { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig });
    } catch { return json({ error: "unauthorized" }, 401); }
    if (payload && typeof payload === "object" && !Array.isArray(payload) && "challenge" in payload) {
      const parsed = Challenge.safeParse(payload);
      return parsed.success ? json(parsed.data) : json({ error: "invalid challenge" }, 400);
    }
    const target = resolveTarget(req.url);
    if (!target) return json({ error: "invalid event URL" }, 400);
    // Documented test calls never change application state.
    if (Array.isArray(payload) && payload.length === 0 && (target.eventType === "stock" || target.eventType === "prices")) return new Response(null, { status: 204, headers: options.corsHeaders });
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const test = payload as Record<string, unknown>;
      if ((target.eventType === "catalog" && test.catalog_id === 0 && test.revision === 0) ||
          (target.eventType === "orders" && typeof test.order_id === "string" && test.order_id.startsWith("TEST-"))) return new Response(null, { status: 204, headers: options.corsHeaders });
    }
    const parsed = schemas[target.eventType].safeParse(payload);
    if (!parsed.success) return json({ error: "invalid event payload" }, 400);
    try {
      // Await durable storage before acknowledging: detached work may be lost.
      await options.persist({ webhookId: id, ...target, payload: parsed.data });
      return new Response(null, { status: 204, headers: options.corsHeaders });
    } catch {
      // No headers, client IDs, signatures, bodies or raw errors are logged.
      console.error("Splash webhook durable storage failed");
      return json({ error: "storage unavailable" }, 503);
    }
  };
}