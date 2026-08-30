import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonthConsolidation {
  year: number;
  month: number; // 1-12
  ordersTotal: number;
  ordersWithPayoutDate: number;
  coveragePct: number; // 0-100
}

/**
 * Option B — les versements sont recalculés depuis `orders.payout_date`.
 * Tant que la file de backfill Uber n'a pas rattaché 100 % des commandes d'un
 * mois à un cycle de versement, ce mois est « en consolidation » et les totaux
 * de versements sont sous-estimés.
 *
 * La RPC ne balaye que les mois couverts par la période sélectionnée et ne
 * renvoie que les mois dont la couverture `payout_date` est < 100 %.
 */
export function usePayoutsConsolidation(
  restaurantIds: string[] | undefined,
  startDateStr: string,
  endDateStr: string,
  enabled: boolean = true,
) {
  const idsKey = (restaurantIds || []).join(",");
  return useQuery({
    queryKey: ["payouts-consolidation", idsKey, startDateStr, endDateStr],
    queryFn: async (): Promise<MonthConsolidation[]> => {
      if (!restaurantIds || restaurantIds.length === 0) return [];

      const { data, error } = await supabase.rpc(
        "get_payouts_consolidation_status",
        {
          p_start: startDateStr,
          p_end: endDateStr,
          p_restaurant_ids: restaurantIds,
        },
      );

      if (error) {
        console.error("[PayoutsConsolidation] RPC error:", error);
        throw error;
      }

      return ((data as any[]) || [])
        .map((row) => ({
          year: Number(row.year),
          month: Number(row.month),
          ordersTotal: Number(row.orders_total) || 0,
          ordersWithPayoutDate: Number(row.orders_with_payout_date) || 0,
          coveragePct: Number(row.coverage_pct) || 0,
        }))
        .filter((m) => m.ordersTotal > 0 && m.coveragePct < 100)
        .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
    },
    enabled: enabled && !!restaurantIds && restaurantIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
