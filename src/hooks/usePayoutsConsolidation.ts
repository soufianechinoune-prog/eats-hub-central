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
 * Retourne la liste des mois de la période sélectionnée dont la couverture
 * `payout_date` est < 100 % (mois sans aucune commande ignorés).
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
      const startYear = Number(startDateStr.slice(0, 4));
      const endYear = Number(endDateStr.slice(0, 4));
      const years: number[] = [];
      for (let y = startYear; y <= endYear; y++) years.push(y);

      const results = await Promise.all(
        years.map((year) =>
          supabase.rpc("get_payouts_consolidation_status", {
            p_year: year,
            p_restaurant_ids: restaurantIds,
          }),
        ),
      );

      const startYm = Number(startDateStr.slice(0, 4)) * 100 + Number(startDateStr.slice(5, 7));
      const endYm = Number(endDateStr.slice(0, 4)) * 100 + Number(endDateStr.slice(5, 7));

      const incomplete: MonthConsolidation[] = [];
      results.forEach(({ data, error }, i) => {
        if (error) throw error;
        const year = years[i];
        for (const row of (data as any[]) || []) {
          const month = Number(row.month);
          const ym = year * 100 + month;
          if (ym < startYm || ym > endYm) continue;
          const total = Number(row.orders_total) || 0;
          const coverage = Number(row.coverage_pct) || 0;
          if (total > 0 && coverage < 100) {
            incomplete.push({
              year,
              month,
              ordersTotal: total,
              ordersWithPayoutDate: Number(row.orders_with_payout_date) || 0,
              coveragePct: coverage,
            });
          }
        }
      });
      return incomplete.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
    },
    enabled: enabled && !!restaurantIds && restaurantIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
