import { afterEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";
import { createHandler, resolveTarget, type VerifiedEvent } from "../../supabase/functions/_shared/splashWebhookProtocol";

// Public fixture from Splash's integration guide, never a project credential.
const fixture = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const base = "https://example.test/functions/v1/splash-webhook";
function request(body: string, path = "/station-test", age = 0, signature?: string) {
  const timestamp = new Date(Date.now() + age * 1000);
  return new Request(base + path, { method: "POST", body, headers: {
    "webhook-id": "fixture-event", "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature ?? new Webhook(fixture).sign("fixture-event", timestamp, body),
  } });
}
function setup() {
  const events: VerifiedEvent[] = [];
  const persist = vi.fn(async (event: VerifiedEvent) => { if (!events.some(e => e.webhookId === event.webhookId)) events.push(event); });
  return { events, persist, handler: createHandler({ secret: () => fixture, persist, corsHeaders: {} }) };
}
afterEach(() => vi.useRealTimers());
describe("Splash webhook protocol", () => {
  it("checks the guide's fixed signature vector independently", () => {
    const matches = new Webhook(fixture).sign("msg_p5jXN8AQM9LWM0D4loKWxJek", new Date(1614265330000), '{"test": 2432232314}') === "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
    expect(matches).toBe(true);
  });
  it("echoes a signed challenge without any writes", async () => {
    const { handler, persist } = setup();
    const response = await handler(request('{"challenge":"activation-test"}'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "activation-test" });
    expect(persist).not.toHaveBeenCalled();
  });
  it("rejects unsigned challenges", async () => {
    const { handler, persist } = setup();
    expect((await handler(new Request(base, { method: "POST", body: '{"challenge":"test"}' }))).status).toBe(401);
    expect(persist).not.toHaveBeenCalled();
  });
  it.each([-301, 301])("rejects timestamps outside five minutes: %s", async age => {
    expect((await setup().handler(request('[]', "/stock/station-test", age))).status).toBe(401);
  });
  it.each([-300, 300])("accepts timestamps at the five-minute boundary: %s", async age => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    expect((await setup().handler(request('[]', "/stock/station-test", age))).status).toBe(204);
  });
  it("accepts a matching second signature during rotation", async () => {
    const req = request('[]');
    req.headers.set("webhook-signature", `v1,invalid ${req.headers.get("webhook-signature")}`);
    expect((await setup().handler(req)).status).toBe(204);
  });
  it("rejects altered raw JSON even when the JSON value is equivalent", async () => {
    const req = request('[]');
    expect((await setup().handler(request('[ ]', "/station-test", 0, req.headers.get("webhook-signature") ?? ""))).status).toBe(401);
  });
  it("records valid stock events with the exact station and does not double insert", async () => {
    const { handler, events } = setup();
    const raw = '[{"item_id":"prd22947","status":"unavailable","unknown":"ignored"}]';
    expect((await handler(request(raw))).status).toBe(204);
    expect((await handler(request(raw))).status).toBe(204);
    expect(events).toEqual([{ webhookId: "fixture-event", eventType: "stock", clientId: "station-test", payload: [{ item_id: "prd22947", status: "unavailable" }] }]);
  });
  it.each([
    ["/stock/station-test", '[]'], ["/prices/station-test", '[]'],
    ["/catalog/station-test", '{"catalog_id":0,"revision":0,"installed_at":"…"}'],
    ["/orders/station-test", '{"order_id":"TEST-example"}'],
  ])("acknowledges documented tests without writes %s", async (path, raw) => {
    const { handler, persist } = setup(); expect((await handler(request(raw, path))).status).toBe(204); expect(persist).not.toHaveBeenCalled();
  });
  it("does not treat delivery prices as stock or cash prices", async () => {
    const { handler, events } = setup(); const raw = '[{"item_id":"prd1","price":1.5}]';
    expect((await handler(request(raw))).status).toBe(400);
    expect((await handler(request(raw, "/prices/station-test"))).status).toBe(204);
    expect(events[0]?.eventType).toBe("prices");
  });
  it("rejects unknown availability statuses", async () => {
    const { handler, persist } = setup(); expect((await handler(request('[{"item_id":"prd1","status":"deleted"}]'))).status).toBe(400); expect(persist).not.toHaveBeenCalled();
  });
  it("requests a retry when durable persistence fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createHandler({ secret: () => fixture, corsHeaders: {}, persist: async () => { throw new Error("fixture failure"); } });
    expect((await handler(request('[{"item_id":"prd1","status":"available"}]'))).status).toBe(503);
    log.mockRestore();
  });
  it("extracts station from the path, never from query or payload", () => {
    expect(resolveTarget(base + "/stock/station-test?station=other")).toEqual({ eventType: "stock", clientId: "station-test" });
    expect(resolveTarget(base + "/unknown/station-test")).toBeNull();
    expect(resolveTarget(base + "/stock/station%2Fother")).toBeNull();
  });
});