import { describe, expect, it } from "vitest";
import { marginPerRevenue, optimalAdsWeekHt, simulateAdsBudget, type AdsSimInput } from "./adsBudgetSimulator";

const shops: AdsSimInput[] = [
  { id: "a", name: "Peu de pub", revenueWeek: 12000, adsWeekHt: 100, payoutRatio: 0.7 },
  { id: "b", name: "Beaucoup de pub", revenueWeek: 4000, adsWeekHt: 350, payoutRatio: 0.7 },
  { id: "c", name: "Moyen", revenueWeek: 8000, adsWeekHt: 220, payoutRatio: 0.7 },
];

describe("marge par euro de vente", () => {
  it("retire la commission Uber et les ingrédients, en HT", () => {
    // 1/1,1 − 0,3/1,2 − 0,3/1,1 = 0,909 − 0,25 − 0,273
    expect(marginPerRevenue(0.7, 0.3)).toBeCloseTo(0.3864, 3);
  });
  it("est plus faible quand le coût matière monte", () => {
    expect(marginPerRevenue(0.7, 0.4)).toBeLessThan(marginPerRevenue(0.7, 0.3));
  });
});

describe("pub idéale", () => {
  it("vaut effet × marge × CA", () => {
    expect(optimalAdsWeekHt(10000, 0.4, 0.045)).toBeCloseTo(180, 6);
  });
  it("n'est jamais négative", () => {
    expect(optimalAdsWeekHt(10000, -0.1, 0.045)).toBe(0);
  });
});

describe("dépenser pareil, mais mieux", () => {
  const res = simulateAdsBudget(shops, { foodCost: 0.3, elasticity: 0.045, strategy: "reallocate" });
  it("garde la même dépense totale", () => {
    expect(res.adsRecommendedWeek).toBeCloseTo(res.adsNowWeek, 6);
  });
  it("donne plus au restaurant qui fait peu de pub et moins à celui qui en fait beaucoup", () => {
    const a = res.rows.find((r) => r.id === "a")!;
    const b = res.rows.find((r) => r.id === "b")!;
    expect(a.decision).toBe("increase");
    expect(b.decision).toBe("reduce");
  });
  it("augmente les ventes et le gain net", () => {
    expect(res.extraRevenueYear).toBeGreaterThan(0);
    expect(res.extraProfitYear).toBeGreaterThan(0);
  });
  it("ne sort pas de la zone observée (÷2 à ×2)", () => {
    res.rows.forEach((r) => {
      expect(r.recommendedWeekHt).toBeGreaterThanOrEqual(r.adsWeekHt * 0.5 - 1e-9);
      expect(r.recommendedWeekHt).toBeLessThanOrEqual(r.adsWeekHt * 2 + 1e-9);
    });
  });
});

describe("dépenser le bon montant", () => {
  it("réduit la pub quand le coût matière est très élevé", () => {
    const res = simulateAdsBudget(shops, { foodCost: 0.5, elasticity: 0.045, strategy: "optimal" });
    expect(res.adsRecommendedWeek).toBeLessThan(res.adsNowWeek);
  });
  it("ne conseille jamais une pub négative pour un restaurant sans pub", () => {
    const res = simulateAdsBudget([{ id: "z", name: "Sans pub", revenueWeek: 3000, adsWeekHt: 0, payoutRatio: 0.7 }], { foodCost: 0.3, elasticity: 0.045, strategy: "optimal" });
    expect(res.rows[0].recommendedWeekHt).toBeGreaterThanOrEqual(0);
    expect(res.rows[0].recommendedWeekHt).toBeLessThanOrEqual(50);
  });
});
