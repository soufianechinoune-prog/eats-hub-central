import { describe, expect, it } from "vitest";
import { errorTotalsByRestaurant, type OrderErrorSummaryRow } from "./orderErrors";

describe("errorTotalsByRestaurant", () => {
  it("ne garde que les lignes total (pas de double comptage jour / catégorie)", () => {
    const rows: OrderErrorSummaryRow[] = [
      { restaurant_id: "a", level: "total", weekday: null, category: null, error_orders: 12, error_lines: 18, financial_impact: 150.5 },
      { restaurant_id: "a", level: "weekday", weekday: 5, category: null, error_orders: 12, error_lines: 18, financial_impact: 150.5 },
      { restaurant_id: "a", level: "category", weekday: null, category: "Article manquant", error_orders: 12, error_lines: 18, financial_impact: 150.5 },
    ];
    expect(errorTotalsByRestaurant(rows).get("a")).toEqual({ orders: 12, impact: 150.5 });
    expect(errorTotalsByRestaurant(rows).size).toBe(1);
  });
});
