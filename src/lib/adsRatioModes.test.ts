import { describe, it, expect } from "vitest";
import { computeAdsRatio } from "./adsRatioModes";

const q3 = { adsHt: 254472.42, revenueTtc: 7381091.11, revenueHt: 6710082.83 };

describe("ratio pub / CA", () => {
  it("Uber officiel = pub HT / CA TTC (3,45 % sur Q3)", () => {
    expect(computeAdsRatio("uber", q3).pct!.toFixed(2)).toBe("3.45");
  });
  it("Comptable = pub HT / CA HT", () => {
    expect(computeAdsRatio("comptable", q3).pct!.toFixed(2)).toBe("3.79");
  });
  it("Trésorerie = pub TTC (×1,2) / CA TTC", () => {
    expect(computeAdsRatio("tresorerie", q3).pct!.toFixed(2)).toBe("4.14");
  });
  it("pas de CA = pas de ratio", () => {
    expect(computeAdsRatio("uber", { adsHt: 10, revenueTtc: 0, revenueHt: 0 }).pct).toBeNull();
  });
});
