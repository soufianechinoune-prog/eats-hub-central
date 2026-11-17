import { describe, expect, it } from "vitest";
import { daysSinceDeclaration, formatDeclarationDate } from "./ecoUberDeclaration";

describe("trace de déclaration Uber", () => {
  it("affiche la date et l'heure de Paris", () => {
    expect(formatDeclarationDate("2026-11-17T11:30:00Z")).toBe("le 17/11/2026 à 12:30");
  });
  it("compte les jours d'attente", () => {
    expect(daysSinceDeclaration("2026-11-17T11:30:00Z", new Date("2026-11-27T12:00:00Z"))).toBe(10);
    expect(daysSinceDeclaration("2026-11-17T11:30:00Z", new Date("2026-11-17T18:00:00Z"))).toBe(0);
  });
});
