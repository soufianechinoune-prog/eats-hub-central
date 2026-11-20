import { describe, expect, it } from "vitest";
import { detectConsolidation, type ConsolidationRow } from "./dataConsolidation";

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
