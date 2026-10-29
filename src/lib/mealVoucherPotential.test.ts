import { describe, expect, it } from "vitest";
import { providerMedianShares, restaurantPotential } from "./mealVoucherPotential";

const r = (id: string, uber: number, sodexo: number, swile = 100) => ({
  restaurantId: id,
  uberRevenueTTC: uber,
  byProvider: { Sodexo: { amount: sodexo }, Swile: { amount: swile } },
});

describe("meal voucher missed revenue", () => {
  const rows = [r("a", 10000, 1000), r("b", 10000, 2000), r("c", 10000, 3000), r("montrouge", 20000, 0)];

  it("uses the median Sodexo share of restaurants that accept it", () => {
    expect(providerMedianShares(rows, ["Sodexo"]).Sodexo).toBeCloseTo(0.2);
  });

  it("estimates the missing Sodexo amount from the restaurant's Uber revenue", () => {
    const shares = providerMedianShares(rows, ["Sodexo", "Swile"]);
    const p = restaurantPotential(rows[3], shares);
    expect(p.byProvider.Sodexo).toBeCloseTo(4000);
    expect(p.byProvider.Swile).toBeUndefined();
    expect(p.total).toBeCloseTo(4000);
  });

  it("does not estimate with fewer than 3 accepting restaurants", () => {
    expect(providerMedianShares([r("a", 1000, 100), r("b", 1000, 0)], ["Sodexo"]).Sodexo).toBe(0);
  });
});
