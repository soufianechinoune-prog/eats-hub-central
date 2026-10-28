import { describe, expect, it } from "vitest";
import { aggregateEfficiency, cohortOf, groupByCohort, lastClosedQuarters } from "./adsEfficiency";

describe("adsEfficiency", () => {
  it("cohort thresholds 1 / 2.5 / 4 %", () => {
    expect(cohortOf(0.9)).toBe("c0");
    expect(cohortOf(1)).toBe("c1");
    expect(cohortOf(2.5)).toBe("c2");
    expect(cohortOf(4)).toBe("c3");
  });
  it("net in bank = payout minus ads, over revenue", () => {
    const s = aggregateEfficiency([{ restaurant_id: "a", ads_ht: 300, rev_ttc: 10000, rev_prev_ttc: 8000, payout: 7000, payout_prev: 5600 }]);
    expect(s.netMargin).toBeCloseTo(67);
    expect(s.growth).toBeCloseTo(25);
    expect(s.gainPerEuro).toBeCloseTo(2000 / 300);
  });
  it("excludes restaurants not active on both periods", () => {
    const g = groupByCohort([{ restaurant_id: "a", ads_ht: 0, rev_ttc: 100, rev_prev_ttc: 0, payout: 60, payout_prev: 0 }]);
    expect(g.reduce((n, c) => n + c.count, 0)).toBe(0);
  });
  it("last closed quarter on Oct 28 2026 is Q3 vs Q2", () => {
    const { cur, prev } = lastClosedQuarters(new Date(2026, 9, 28));
    expect(cur.label).toBe("T3 2026");
    expect(prev.label).toBe("T2 2026");
    expect(lastClosedQuarters(new Date(2026, 1, 1)).cur.label).toBe("T4 2025");
  });
});
