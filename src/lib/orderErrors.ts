import { supabase } from "@/integrations/supabase/client";

/**
 * Commandes incorrectes, comptées côté base (get_order_errors_summary).
 * order_errors contient une ligne par article en erreur : on compte les commandes distinctes.
 */
export interface OrderErrorSummaryRow {
  restaurant_id: string;
  level: "total" | "weekday" | "category";
  weekday: number | null;
  category: string | null;
  error_orders: number;
  error_lines: number;
  financial_impact: number;
}

export async function fetchOrderErrorsSummary(
  restaurantIds: string[],
  startDate: string,
  endDate: string,
): Promise<OrderErrorSummaryRow[]> {
  if (restaurantIds.length === 0) return [];
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown[] | null; error: Error | null }>)("get_order_errors_summary", {
    p_restaurant_ids: restaurantIds,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    restaurant_id: String(r.restaurant_id),
    level: r.level as OrderErrorSummaryRow["level"],
    weekday: r.weekday == null ? null : Number(r.weekday),
    category: r.category == null ? null : String(r.category),
    error_orders: Number(r.error_orders) || 0,
    error_lines: Number(r.error_lines) || 0,
    financial_impact: Number(r.financial_impact) || 0,
  }));
}

/** Commandes en erreur et impact par restaurant (lignes « total » uniquement). */
export function errorTotalsByRestaurant(rows: OrderErrorSummaryRow[]) {
  const map = new Map<string, { orders: number; impact: number }>();
  for (const r of rows) {
    if (r.level !== "total") continue;
    map.set(r.restaurant_id, { orders: r.error_orders, impact: r.financial_impact });
  }
  return map;
}
