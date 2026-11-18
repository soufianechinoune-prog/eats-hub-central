import { describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));

import { countAccessToFollow, daysSince, fetchUberApiAccess, recordUberApiAccessRequest, uberApiAccessDisplay, type UberApiAccess } from "./uberApiAccess";

const base: UberApiAccess = {
  restaurant_id: "r1", chain_id: "c1", status: "refuse", last_api_order_at: null, last_refusal_at: "2026-11-18T05:26:02Z",
  refusal_reason: "Uber a refusé l'accès (HTTP 403)", request_id: null, requested_at: null, requested_by_name: null,
};

describe("uberApiAccessDisplay", () => {
  it("refusé sans demande : à demander", () => {
    expect(uberApiAccessDisplay(base)).toBe("refuse");
  });
  it("refusé avec une demande en cours : accès demandé", () => {
    expect(uberApiAccessDisplay({ ...base, request_id: "q1" })).toBe("demande");
  });
  it("l'accès revenu l'emporte sur une vieille demande", () => {
    expect(uberApiAccessDisplay({ ...base, status: "ok", request_id: "q1" })).toBe("ok");
  });
  it("rien de connu : non configuré", () => {
    expect(uberApiAccessDisplay(undefined)).toBe("non_configure");
  });
});

describe("countAccessToFollow", () => {
  it("compte les accès à demander et les demandes en attente", () => {
    const rows = [base, { ...base, restaurant_id: "r2", request_id: "q" }, { ...base, restaurant_id: "r3", status: "ok" as const }];
    expect(countAccessToFollow(rows)).toEqual({ toRequest: 1, waiting: 1 });
  });
});

describe("daysSince", () => {
  it("compte les jours écoulés", () => {
    expect(daysSince("2026-11-01T08:00:00Z", new Date("2026-11-18T09:00:00Z"))).toBe(17);
    expect(daysSince(null)).toBeNull();
  });
});

describe("appels base", () => {
  it("lit l'état par enseigne, sans perdre le contexte du client", async () => {
    rpc.mockResolvedValue({ data: [base], error: null });
    const rows = await fetchUberApiAccess("c1");
    expect(rpc).toHaveBeenCalledWith("get_uber_api_access_status", { p_chain_id: "c1" });
    expect(rows).toHaveLength(1);
  });
  it("enregistre une demande d'accès", async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    from.mockReturnValue({ insert });
    await recordUberApiAccessRequest("r1");
    expect(from).toHaveBeenCalledWith("uber_api_access_requests");
    expect(insert).toHaveBeenCalledWith({ restaurant_id: "r1", note: null });
  });
});
