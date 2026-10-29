import { describe, it, expect } from "vitest";
import { summarizeUberRatings, uberRatingWindow } from "./uberRatings";

describe("Uber two rating periods", () => {
  it("uses exactly 90 inclusive Paris calendar days independent of selected month", () => {
    expect(uberRatingWindow(new Date("2026-10-29T21:25:00Z"))).toEqual({ start: "2026-08-01", end: "2026-10-29" });
  });
  it("switches dates at Paris midnight rather than UTC midnight", () => {
    expect(uberRatingWindow(new Date("2026-10-29T23:30:00Z"))).toEqual({ start: "2026-08-02", end: "2026-10-30" });
  });
  it("weights the network rating by the number of reviews and keeps the Uber scope", () => {
    expect(summarizeUberRatings([
      { restaurant_id: "a", platform: "uber_eats", avg_rating: 4, review_count: 90 },
      { restaurant_id: "b", platform: "uber_eats", avg_rating: 5, review_count: 10 },
      { restaurant_id: "c", platform: "deliveroo", avg_rating: 1, review_count: 100 },
    ])).toEqual({ rating: 4.1, count: 100 });
  });
  it("keeps the selected restaurant scope and never substitutes an empty period", () => {
    const rows = [{ restaurant_id: "a", platform: "uber_eats", avg_rating: 4.4, review_count: 20 }];
    expect(summarizeUberRatings(rows, ["a"])).toEqual({ rating: 4.4, count: 20 });
    expect(summarizeUberRatings(rows, [])).toEqual({ rating: null, count: 0 });
    expect(summarizeUberRatings([])).toEqual({ rating: null, count: 0 });
  });
});