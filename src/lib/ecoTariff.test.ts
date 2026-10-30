import { describe, it, expect } from "vitest";
import { matchEcoMultiple } from "./ecoTariff";

describe("matchEcoMultiple", () => {
  it("238 commandes × 0,1130 € = 26,89 € (2024) est validé", () => {
    const m = matchEcoMultiple(26.89, 2024);
    expect(m.valid).toBe(true);
    expect(m.orders).toBe(238);
    expect(m.rate).toBe(0.113);
  });
  it("barème 2026 0,1829 € : 100 commandes = 18,29 €", () => {
    const m = matchEcoMultiple(-18.29, 2026);
    expect(m.valid).toBe(true);
    expect(m.orders).toBe(100);
  });
  it("barème 2025 0,1363 € : 50 commandes = 6,82 €", () => {
    expect(matchEcoMultiple(6.82, 2025).orders).toBe(50);
  });
  it("un montant hors multiple est rejeté", () => {
    expect(matchEcoMultiple(0.5, 2026).valid).toBe(false);
  });
});
