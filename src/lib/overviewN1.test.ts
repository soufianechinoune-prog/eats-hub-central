import { describe, expect, it } from "vitest";
import { lastClosedParisDay, overviewN1Eligibility, revenueChange } from "./overviewN1";

const now = new Date("2026-10-29T19:51:00Z");
describe("Overview N-1 rules", () => {
  it("blocks Hier on 28 October", () => expect(overviewN1Eligibility("yesterday", "2026-10-28", "2026-10-28", now).allowed).toBe(false));
  it("blocks today", () => expect(overviewN1Eligibility("custom_range", "2026-10-29", "2026-10-29", now).allowed).toBe(false));
  it.each(["7d", "30d"])("blocks %s rolling periods", mode => expect(overviewN1Eligibility(mode, "2026-10-01", "2026-10-29", now).allowed).toBe(false));
  it("allows September closed month", () => expect(overviewN1Eligibility("custom_month", "2026-09-01", "2026-09-30", now).allowed).toBe(true));
  it("allows previous Monday-Sunday week", () => expect(overviewN1Eligibility("previous_week", "2026-10-19", "2026-10-25", now).allowed).toBe(true));
  it("ends October to date on 28 October", () => {
    expect(lastClosedParisDay(now)).toBe("2026-10-28");
    expect(overviewN1Eligibility("current_month", "2026-10-01", lastClosedParisDay(now), now).allowed).toBe(true);
  });
  it("allows year to date but not today's data", () => {
    expect(overviewN1Eligibility("year", "2026-01-01", "2026-10-28", now).allowed).toBe(true);
    expect(overviewN1Eligibility("year", "2026-01-01", "2026-10-29", now).allowed).toBe(false);
  });
  it("waits for the Paris 04:00 cutoff", () => {
    expect(lastClosedParisDay(new Date("2026-10-29T02:59:00Z"))).toBe("2026-10-27");
    expect(lastClosedParisDay(new Date("2026-10-29T03:00:00Z"))).toBe("2026-10-28");
  });
  it("compares the selected channel, not combined revenue", () => {
    expect(revenueChange(120, 100)).toBe(20);
    expect(revenueChange(60, 80)).toBe(-25);
    expect(revenueChange(120, 0)).toBeNull();
  });
});
import { isLaunchN1 as launch } from "./overviewN1";
describe("isLaunchN1", () => {
  it("flags opening inside N-1 period (Châtelet 09/10/2025 vs octobre 2026)", () => {
    expect(launch("2025-10-09", "2026-10-01", "2026-10-28")).toBe(true);
  });
  it("flags opening less than 3 months before N-1 start", () => {
    expect(launch("2025-08-15", "2026-10-01", "2026-10-28")).toBe(true);
  });
  it("ignores mature restaurants (Saint-Ouen 2020)", () => {
    expect(launch("2020-05-01", "2026-10-19", "2026-10-25")).toBe(false);
  });
  it("ignores openings after N-1 end", () => {
    expect(launch("2026-01-10", "2026-10-01", "2026-10-28")).toBe(false);
  });
});
