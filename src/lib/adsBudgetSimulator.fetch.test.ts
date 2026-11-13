import { describe, expect, it, vi } from "vitest";

// Client factice dont les méthodes dépendent de `this`, comme le vrai client Supabase.
const fake = {
  rest: { ok: true },
  rpc(this: { rest?: unknown }, _fn: string, _args: unknown) {
    if (!this?.rest) throw new TypeError("undefined is not an object (evaluating 'this.rest')");
    return Promise.resolve({ data: [{ restaurant_id: "r1", restaurant_name: "Test", revenue_week: 5000, ads_week_ht: 150, payout_ratio: 0.7, period_start: "2026-08-03", period_end: "2026-10-25" }], error: null });
  },
  from(this: { rest?: unknown }, _t: string) {
    if (!this?.rest) throw new TypeError("undefined is not an object (evaluating 'this.rest')");
    return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { label: "Contrat", min_ads_ratio: 0.03, hq_extra_rate: 0.001, growth_penalty_eur: 140000 }, error: null }) }) }) };
  },
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: fake }));

describe("chargement des données du simulateur", () => {
  it("appelle le client sans perdre son contexte", async () => {
    const { fetchAdsSimulatorData } = await import("./adsBudgetSimulator");
    const d = await fetchAdsSimulatorData("chain");
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0].adsWeekHt).toBe(150);
    expect(d.rule?.minAdsRatio).toBe(0.03);
    expect(d.periodEnd).toBe("2026-10-25");
  });
});
