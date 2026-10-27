import { describe, it, expect } from "vitest";
import { getAdsEffortTier, median } from "./adsEffortTiers";

describe("getAdsEffortTier", () => {
  it("0 € de pub = aucune pub", () => expect(getAdsEffortTier(0, 0)).toBe("none"));
  it("0,8 % = maîtrisé", () => expect(getAdsEffortTier(50, 0.8)).toBe("controlled"));
  it("2,5 % = modéré", () => expect(getAdsEffortTier(50, 2.5)).toBe("moderate"));
  it("2,6 % = sur-dépense", () => expect(getAdsEffortTier(50, 2.6)).toBe("over"));
});

describe("median", () => {
  it("pair", () => expect(median([1, 3, 2, 4])).toBe(2.5));
});
