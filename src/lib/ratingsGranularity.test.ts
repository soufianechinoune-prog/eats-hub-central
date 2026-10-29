import { describe, it, expect } from "vitest";
import { pickGranularity, bucketRatings } from "./ratingsGranularity";

describe("pickGranularity", () => {
  it("mois → jour", () => expect(pickGranularity(new Date(2026, 7, 1), new Date(2026, 7, 31))).toBe("day"));
  it("trimestre → semaine", () => expect(pickGranularity(new Date(2026, 6, 1), new Date(2026, 8, 30))).toBe("week"));
  it("année → mois", () => expect(pickGranularity(new Date(2026, 0, 1), new Date(2026, 11, 31))).toBe("month"));
});

describe("bucketRatings", () => {
  it("année : 12 mois, moyenne pondérée par avis", () => {
    const b = bucketRatings(
      [
        { review_date: "2026-03-02", overall_rating: 5 },
        { review_date: "2026-03-20", overall_rating: 4 },
        { review_date: "2026-03-21", overall_rating: 3 },
      ],
      new Date(2026, 0, 1), new Date(2026, 11, 31), "month",
    );
    expect(b).toHaveLength(12);
    expect(b[2]).toMatchObject({ date: "2026-03-01", rating: 4, count: 3 });
  });
});
