import { describe, it, expect } from "vitest";
import { bucketKey, isPartialBucket, defaultGranularity } from "./performanceBuckets";

describe("semaines partielles", () => {
  it("première semaine incomplète si la période commence un mercredi", () => {
    // 2026-10-07 est un mercredi → semaine du lundi 05/10
    const key = bucketKey("2026-10-07", "week");
    expect(key).toBe("2026-10-05");
    expect(isPartialBucket(key, "week", "2026-10-07", "2026-11-30")).toBe(true);
  });
  it("semaine complète lundi→dimanche non signalée", () => {
    expect(isPartialBucket("2026-10-12", "week", "2026-10-07", "2026-11-30")).toBe(false);
  });
  it("dernière semaine incomplète si la période finit avant dimanche", () => {
    expect(isPartialBucket("2026-10-19", "week", "2026-10-01", "2026-10-20")).toBe(true);
  });
  it("granularité auto : jour ≤ 31 j, semaine ≤ 120 j, sinon mois", () => {
    expect(defaultGranularity("2026-10-01", "2026-10-31")).toBe("day");
    expect(defaultGranularity("2026-07-01", "2026-10-20")).toBe("week");
    expect(defaultGranularity("2026-01-01", "2026-10-20")).toBe("month");
  });
});
