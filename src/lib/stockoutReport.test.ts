import { describe, expect, it } from "vitest";
import { buildStockoutReport, parisMidnight, stockoutReportDefaults, stockoutProductSections, stockoutRestaurantSections, type ReportStockout } from "./stockoutReport";
const scope = [{ id: "a", name: "Juvisy" }, { id: "b", name: "Le Mans" }, { id: "c", name: "Autre" }];
const row = (overrides: Partial<ReportStockout> = {}): ReportStockout => ({ restaurant_id: "a", restaurant_name: "Juvisy", item_id: "prd1", product_name: "Dessert", category: null, started_at: "2026-10-27T22:00:00Z", ended_at: "2026-10-29T00:00:00Z", duration_minutes: 1560, is_ongoing: false, ...overrides });
const now = Date.parse("2026-10-30T12:00:00Z");
describe("rapport ruptures", () => {
  it("ouvre le mois en cours sur tout le réseau et tous les produits", () => {
    expect(stockoutReportDefaults(Date.parse("2026-10-29T11:58:00Z"))).toEqual({ start: "2026-10-01", end: "2026-10-29", mode: "month", restaurant: "all", product: "all" });
  });
  it("détermine le mois courant selon le calendrier Paris", () => {
    expect(stockoutReportDefaults(Date.parse("2026-10-31T23:30:00Z")).start).toBe("2026-11-01");
  });
  it("sépare le détail de chaque restaurant sans inventer des absences de rupture", () => {
    const report = buildStockoutReport([row(), row({ restaurant_id: "b", restaurant_name: "Le Mans" }), row({ restaurant_id: "outside" })], scope, "2026-10-28", "2026-10-28", null, null, now);
    const sections = stockoutRestaurantSections(report);
    expect(sections.map(s => s.id).sort()).toEqual(["a", "b"]);
    expect(sections.find(s => s.id === "a")?.rows.map(r => r.restaurant_id)).toEqual(["a"]);
    expect(sections.find(s => s.id === "b")?.rows.map(r => r.restaurant_id)).toEqual(["b"]);
  });
  it("limite les fiches au restaurant choisi quand le rapport est ciblé", () => {
    const report = buildStockoutReport([row(), row({ restaurant_id: "b" })], scope, "2026-10-28", "2026-10-28", "a", null, now);
    expect(stockoutRestaurantSections(report).map(s => s.id)).toEqual(["a"]);
  });
  it("borne une rupture aux jours Paris de la période", () => {
    const r = buildStockoutReport([row()], scope, "2026-10-28", "2026-10-28", null, null, now);
    expect(r.total.minutes).toBe(1440);
    expect(r.days[0].minutes).toBe(1440);
  });
  it("respecte la journée de 25 heures du passage à l’heure d’hiver", () => {
    expect(parisMidnight("2026-10-26") - parisMidnight("2026-10-25")).toBe(25 * 3600000);
  });
  it("ne compte pas le futur pour une rupture ouverte", () => {
    const r = buildStockoutReport([row({ ended_at: null, is_ongoing: true, started_at: "2026-10-29T09:00:00Z" })], scope, "2026-10-29", "2026-10-31", null, null, Date.parse("2026-10-29T12:00:00Z"));
    expect(r.total.minutes).toBe(180);
    expect(r.resolvedCount).toBe(0);
  });
  it("croise restaurant et produit sans perdre le comparatif réseau", () => {
    const r = buildStockoutReport([row(), row({ restaurant_id: "b" }), row({ product_name: "Burger" }), row({ restaurant_id: "outside" })], scope, "2026-10-28", "2026-10-28", "a", "Dessert", now);
    expect(r.rows).toHaveLength(1);
    expect(r.products[0].networkRestaurants).toBe(2);
    expect(r.products[0].networkShare).toBeCloseTo(66.6667);
    expect(r.observedCount).toBe(2);
    expect(r.restaurants.find(r => r.id === "c")?.observed).toBe(false);
  });
  it("exclut les ingrédients et somme les produits simultanés sans les appeler heures de fermeture", () => {
    const r = buildStockoutReport([row(), row({ item_id: "prd2", product_name: "Burger" }), row({ item_id: "ing1" })], scope, "2026-10-28", "2026-10-28", null, null, now);
    expect(r.total.minutes).toBe(2880);
    expect(r.total.products).toBe(2);
  });
});describe("rapport par produit", () => {
  it("liste par produit les restaurants en rupture avec nombre et durée", () => {
    const report = buildStockoutReport([row(), row({ started_at: "2026-10-28T10:00:00Z", ended_at: "2026-10-28T12:00:00Z" }), row({ restaurant_id: "b", restaurant_name: "Le Mans" })], scope, "2026-10-28", "2026-10-28", null, null, now);
    const [dessert] = stockoutProductSections(report);
    expect(dessert.name).toBe("Dessert");
    expect(dessert.restaurantRows.map(r => [r.id, r.events, r.minutes])).toEqual([["a", 2, 1560], ["b", 1, 1440]]);
  });
});
