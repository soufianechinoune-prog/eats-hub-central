import { describe, expect, it } from "vitest";
import { consolidationFrom, consolidationRange, detectConsolidation, replaceMonthWithPartial, type ConsolidationRow } from "./dataConsolidation";

const day = (date: string, restos: number): ConsolidationRow[] =>
  Array.from({ length: restos }, (_, i) => ({ date, restaurant_id: `r${i}`, order_count: 10 }));

describe("detectConsolidation", () => {
  // Chicken Street, novembre 2026 consulté le 20/11 : 103 restaurants jusqu'au 17, 34 le 18, rien le 19.
  const rows = [
    ...day("2026-11-14", 103), ...day("2026-11-15", 103), ...day("2026-11-16", 103),
    ...day("2026-11-17", 103), ...day("2026-11-18", 34),
  ];

  it("repère le 18 comme jour en cours de remontée, et le 19 manquant", () => {
    expect(detectConsolidation(rows, "2026-11-20", "2026-11-30")).toEqual({
      start: "2026-11-18", lastDataDate: "2026-11-18", missingDays: 1,
    });
  });

  it("mois passé complet : rien à signaler", () => {
    const oct = [...day("2026-10-30", 103), ...day("2026-10-31", 102)];
    expect(detectConsolidation(oct, "2026-11-20", "2026-10-31")).toEqual({
      start: null, lastDataDate: "2026-10-31", missingDays: 0,
    });
  });

  it("un seul restaurant à jour : pas de zone, mais les jours manquants sont comptés", () => {
    const one = [...day("2026-11-16", 1), ...day("2026-11-17", 1)];
    expect(detectConsolidation(one, "2026-11-20", "2026-11-30")).toEqual({
      start: null, lastDataDate: "2026-11-17", missingDays: 2,
    });
  });

  it("un creux ancien n'est pas pris pour une remontée", () => {
    const old = [...day("2026-11-01", 103), ...day("2026-11-02", 40), ...day("2026-11-03", 103)];
    expect(detectConsolidation(old, "2026-11-20", "2026-11-30").start).toBeNull();
  });

  it("les lignes sans commande ne comptent pas", () => {
    const zero = [...day("2026-11-17", 103), ...day("2026-11-18", 103).map((r, i) => (i < 60 ? { ...r, order_count: 0 } : r))];
    expect(detectConsolidation(zero, "2026-11-20", "2026-11-30").start).toBe("2026-11-18");
  });
});

describe("consolidationFrom / consolidationRange", () => {
  it("jour incomplet, sinon lendemain du dernier jour reçu", () => {
    expect(consolidationFrom({ start: "2026-11-18", lastDataDate: "2026-11-18", missingDays: 1 })).toBe("2026-11-18");
    expect(consolidationFrom({ start: null, lastDataDate: "2026-11-17", missingDays: 2 })).toBe("2026-11-18");
    expect(consolidationFrom({ start: null, lastDataDate: "2026-10-31", missingDays: 0 })).toBeNull();
  });
  it("vue année : grise d'octobre à novembre", () => {
    const rows = [{ m: "2026-09", l: "Sep" }, { m: "2026-10", l: "Oct" }, { m: "2026-11", l: "Nov" }];
    expect(consolidationRange(rows, "2026-11-18", (r) => r.m, (r) => r.l)).toEqual({ x1: "Oct", x2: "Nov" });
  });
  it("vue mois : grise du 17 au 18", () => {
    const rows = [{ d: "2026-11-16" }, { d: "2026-11-17" }, { d: "2026-11-18" }];
    expect(consolidationRange(rows, "2026-11-18", (r) => r.d, (r) => r.d.slice(8))).toEqual({ x1: "17", x2: "18" });
  });
  it("rien à griser", () => {
    expect(consolidationRange([{ d: "2026-10-31" }], null, (r) => r.d, (r) => r.d)).toBeNull();
  });
});

describe("replaceMonthWithPartial", () => {
  it("novembre 2025 ramené aux mêmes jours que 2026, décembre intact", () => {
    const monthly = [
      { restaurant_id: "a", year: 2025, month: 11, revenue_ttc: 3000, order_count: 120 },
      { restaurant_id: "a", year: 2025, month: 12, revenue_ttc: 3100, order_count: 125 },
    ];
    const daily = [
      { restaurant_id: "a", revenue_ttc: 100, order_count: 4 },
      { restaurant_id: "a", revenue_ttc: 50.5, order_count: 2 },
    ];
    expect(replaceMonthWithPartial(monthly, daily, 2025, 11)).toEqual([
      { restaurant_id: "a", year: 2025, month: 12, revenue_ttc: 3100, order_count: 125 },
      { restaurant_id: "a", year: 2025, month: 11, platform: "uber_eats", revenue_ttc: 150.5, order_count: 6, average_basket: 25.08 },
    ]);
  });
});
