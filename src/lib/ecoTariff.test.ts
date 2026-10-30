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
  it("priorise l'année du versement quand plusieurs montants correspondent", () => {
    expect(matchEcoMultiple(18.29, 2026).rate).toBe(0.1829);
  });
  it("conserve la possibilité d'une régularisation d'une autre année", () => {
    const match = matchEcoMultiple(1.13, 2026);
    expect(match.valid).toBe(true);
    expect(match.rate).toBe(0.113);
    expect(match.orders).toBe(10);
  });
  it("accepte un écart d'arrondi de 1 centime mais pas au-delà", () => {
    expect(matchEcoMultiple(0.123, 2024).valid).toBe(true);
    expect(matchEcoMultiple(0.124, 2024).valid).toBe(false);
  });
  it("ne trouve aucun multiple pour zéro ou une valeur non finie", () => {
    expect(matchEcoMultiple(0, 2026).valid).toBe(false);
    expect(matchEcoMultiple(NaN, 2026).valid).toBe(false);
    expect(matchEcoMultiple(Infinity, 2026).valid).toBe(false);
  });
});

describe("barème fin 2025 (Angers)", () => {
  it("reconnaît 555 commandes à 0,1381 €", () => {
    const m = matchEcoMultiple(-76.65, 2025);
    expect(m.valid).toBe(true);
    expect(m.orders).toBe(555);
  });
});
