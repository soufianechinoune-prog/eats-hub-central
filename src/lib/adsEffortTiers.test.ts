import { describe, it, expect } from "vitest";
import { getAdsEffortTier, median, quarterRange } from "./adsEffortTiers";

describe("getAdsEffortTier", () => {
  it("0 € de pub = 0 %", () => expect(getAdsEffortTier(0, 0)).toBe("none"));
  it("0,8 % = < 1 %", () => expect(getAdsEffortTier(50, 0.8)).toBe("t1"));
  it("1 % = 1 – 2,5 %", () => expect(getAdsEffortTier(50, 1)).toBe("t2"));
  it("2,5 % = 2,5 – 5 %", () => expect(getAdsEffortTier(50, 2.5)).toBe("t3"));
  it("5 % = 2,5 – 5 %", () => expect(getAdsEffortTier(50, 5)).toBe("t3"));
  it("5,1 % = > 5 %", () => expect(getAdsEffortTier(50, 5.1)).toBe("t4"));
});

describe("quarterRange", () => {
  it("Q2 = avril à juin", () => {
    const r = quarterRange(2025, 2, new Date(2026, 0, 1));
    expect([r.start.getMonth(), r.end.getMonth(), r.end.getDate()]).toEqual([3, 5, 30]);
  });
});

describe("median", () => {
  it("pair", () => expect(median([1, 3, 2, 4])).toBe(2.5));
});
