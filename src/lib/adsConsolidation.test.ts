import { describe, expect, it } from "vitest";
import { isAdsConsolidating } from "./adsConsolidation";

describe("advertising recency warning", () => {
  const today = new Date("2026-10-28T08:14:00Z");
  it("marks the previous week ending October 25 as provisional on October 28", () => {
    expect(isAdsConsolidating(new Date(2026, 9, 25), today)).toBe(true);
  });
  it("warns for periods less than eight days old", () => {
    expect(isAdsConsolidating(new Date(2026, 9, 21), today)).toBe(true);
    expect(isAdsConsolidating(new Date(2026, 9, 20), today)).toBe(false);
  });
  it("uses the Paris calendar day at midnight", () => {
    expect(isAdsConsolidating(new Date(2026, 9, 20), new Date("2026-10-27T23:30:00Z"))).toBe(false);
  });
});