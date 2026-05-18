import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantCashStats {
  cashRevenue: number;
  cashRevenueHT: number;
  cashOrders: number;
  cashAvgBasket: number;
  globalRevenue: number;
  cashShare: number;
  prevCashRevenue: number | null;
  cashVariation: number | null;
  prevCashOrders: number | null;
  ordersVariation: number | null;
  daysWithData: number;
}

interface Params {
  startDate: Date;
  endDate: Date;
  chainId: string | null;
}

/**
 * Stats Caisse par restaurant via la RPC serveur get_restaurant_cash_revenue.
 * Renvoie 1 ligne par restaurant — bien plus rapide que la pagination client.
 */
export function useRestaurantCashRevenue({ startDate, endDate, chainId }: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["restaurant-cash-revenue", "rpc-v1", chainId ?? "all", startStr, endStr],
    staleTime: 5 * 60 * 1000,
    enabled: !!chainId,
    queryFn: async (): Promise<Map<string, RestaurantCashStats>> => {
      const { data, error } = await supabase.rpc("get_restaurant_cash_revenue", {
        p_chain_id: chainId!,
        p_start_date: startStr,
        p_end_date: endStr,
      });
      if (error) throw error;

      const result = new Map<string, RestaurantCashStats>();
      for (const row of (data ?? []) as any[]) {
        if (!row.restaurant_id) continue;
        const cash = Number(row.cash_revenue) || 0;
        const cashHT = Number(row.cash_revenue_ht) || 0;
        const cashOrders = Number(row.cash_orders) || 0;
        const globalRev = Number(row.global_revenue) || 0;
        const prevCash = Number(row.prev_cash_revenue) || 0;
        const prevCashOrders = Number(row.prev_cash_orders) || 0;
        const daysWithData = Number(row.days_with_data) || 0;

        const prevCashOrNull = prevCash > 0 ? prevCash : null;
        const prevOrdersOrNull = prevCashOrders > 0 ? prevCashOrders : null;

        result.set(row.restaurant_id as string, {
          cashRevenue: cash,
          cashRevenueHT: cashHT,
          cashOrders,
          cashAvgBasket: cashOrders > 0 ? cash / cashOrders : 0,
          globalRevenue: globalRev,
          cashShare: globalRev > 0 ? (cash / globalRev) * 100 : 0,
          prevCashRevenue: prevCashOrNull,
          cashVariation: prevCashOrNull != null
            ? ((cash - prevCashOrNull) / prevCashOrNull) * 100
            : null,
          prevCashOrders: prevOrdersOrNull,
          ordersVariation: prevOrdersOrNull != null
            ? ((cashOrders - prevOrdersOrNull) / prevOrdersOrNull) * 100
            : null,
          daysWithData,
        });
      }
      return result;
    },
  });
}
