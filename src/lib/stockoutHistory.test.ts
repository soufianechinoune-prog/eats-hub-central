import { describe, expect, it } from "vitest";
import { rankStockoutRestaurants, selectStockoutHistory } from "./stockoutHistory";

const rows = [
  { restaurant_id: "a", restaurant_name: "A", item_id: "p1", product_name: "Poulet", category: "Plats", started_at: "2026-10-28T10:00:00Z", duration_minutes: 60, is_ongoing: false },
  { restaurant_id: "b", restaurant_name: "B", item_id: "p2", product_name: "Frites", category: "Plats", started_at: "2026-10-28T11:00:00Z", duration_minutes: 120, is_ongoing: true },
  { restaurant_id: "a", restaurant_name: "A", item_id: "p1", product_name: "Poulet", category: "Plats", started_at: "2026-10-29T10:00:00Z", duration_minutes: 30, is_ongoing: false },
  { restaurant_id: "b", restaurant_name: "B", item_id: "p3", product_name: "Glace", category: "Desserts", started_at: "2026-10-29T11:00:00Z", duration_minutes: 15, is_ongoing: false },
];
describe("historique des ruptures", () => {
  it("limite le détail au restaurant sélectionné", () => {
    expect(selectStockoutHistory(rows, "a", "all", "recent").map(r => r.restaurant_id)).toEqual(["a", "a"]);
  });
  it("classe les restaurants par produits distincts, sans compter deux fois un produit", () => {
    expect(rankStockoutRestaurants(rows, "products").map(r => [r.id, r.productCount])).toEqual([["b", 2], ["a", 1]]);
  });
  it("trie les ruptures par durée décroissante ou croissante", () => {
    expect(selectStockoutHistory(rows, null, "all", "longest").map(r => r.duration_minutes)).toEqual([120, 60, 30, 15]);
    expect(selectStockoutHistory(rows, null, "all", "shortest").map(r => r.duration_minutes)).toEqual([15, 30, 60, 120]);
  });
  it("filtre les catégories dans le restaurant choisi", () => {
    expect(selectStockoutHistory(rows, "b", "Desserts", "recent").map(r => r.item_id)).toEqual(["p3"]);
  });
});