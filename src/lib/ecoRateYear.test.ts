import { describe, expect, it } from "vitest";
import { ecoRateYear, priorYearOf, priorYearShare } from "./ecoRateYear";

// Relevé Uber du Kremlin-Bicêtre (Tasty Crousty), vérifié le 18/11/2026.
describe("ecoRateYear", () => {
  it("taux 0,1363 → 2025", () => {
    expect(ecoRateYear(-346.61)).toBe(2025); // 2543 commandes du 22 au 28/12/2025
    expect(ecoRateYear(-116.26)).toBe(2025); // 853 commandes du 29 au 31/12/2025
    expect(ecoRateYear(-235.66)).toBe(2025); // 1729 commandes
  });
  it("taux 0,1829 → 2026", () => {
    expect(ecoRateYear(-269.23)).toBe(2026); // 1472 commandes du 01 au 04/01/2026
    expect(ecoRateYear(370.37)).toBe(2026);
    expect(ecoRateYear(4.39)).toBe(2026); // Ivry, 24 commandes
  });
  it("ni l'un ni l'autre, ou les deux : pas d'année", () => {
    expect(ecoRateYear(0)).toBeNull();
    expect(ecoRateYear(-7.37)).toBeNull();
    // 0,1829 × 3 = 0,5487 et 0,1363 × 4 = 0,5452 : 0,55 colle aux deux.
    expect(ecoRateYear(0.55)).toBeNull();
  });
});

describe("priorYearOf", () => {
  it("une semaine de 2025 versée en janvier 2026 concerne 2025", () => {
    expect(priorYearOf({ amount: -346.61, payout_date: "2026-01-12" })).toBe(2025);
  });
  it("une semaine de 2026 versée en 2026, ou de 2025 versée en 2025 : rien à signaler", () => {
    expect(priorYearOf({ amount: -269.23, payout_date: "2026-01-12" })).toBeNull();
    expect(priorYearOf({ amount: -55.88, payout_date: "2025-12-22" })).toBeNull();
    expect(priorYearOf({ amount: -346.61, payout_date: null })).toBeNull();
  });
});

describe("priorYearShare", () => {
  it("additionne les prélèvements et remboursements de l'année précédente", () => {
    const share = priorYearShare([
      { amount: -235.66, payout_date: "2026-01-05" },
      { amount: -346.61, payout_date: "2026-01-12" },
      { amount: -116.26, payout_date: "2026-01-12" },
      { amount: -269.23, payout_date: "2026-01-12" },
      { amount: 269.23, payout_date: "2026-05-11" },
    ]);
    expect(share).toEqual({ year: 2025, charge: 698.53, refund: 0 });
  });
  it("aucune ligne concernée", () => {
    expect(priorYearShare([{ amount: -370.37, payout_date: "2026-03-16" }])).toEqual({ year: null, charge: 0, refund: 0 });
  });
});
