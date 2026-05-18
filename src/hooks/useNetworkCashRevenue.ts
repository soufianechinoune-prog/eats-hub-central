import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface NetworkCashRevenueData {
  totalCash: number;
  totalCashHT: number;
  totalCashVAT: number;
  totalCashOrders: number;
  cashAvgBasket: number;
  totalGlobal: number;
  totalUber: number;
  totalDeliveroo: number;
  totalGlobalOrders: number;
  totalUberOrders: number;
  totalDeliverooOrders: number;
  cashShare: number;
  daysWithData: number;
  previousPeriodCash: number | null;
  previousPeriodCashOrders: number | null;
  cashVariation: number | null;
  ordersVariation: number | null;
}

interface Params {
  startDate: Date;
  endDate: Date;
  chainId: string | null;
}

/**
 * Charge le KPI Caisse réseau via la RPC serveur get_network_cash_revenue
 * (agrégation côté Postgres → 1 ligne renvoyée, affichage instantané).
 */
export function useNetworkCashRevenue({ startDate, endDate, chainId }: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["network-cash-revenue", "rpc-v1", chainId ?? "all", startStr, endStr],
    staleTime: 5 * 60 * 1000,
    enabled: !!chainId,
    queryFn: async (): Promise<NetworkCashRevenueData | null> => {
      const { data, error } = await supabase.rpc("get_network_cash_revenue", {
        p_chain_id: chainId!,
        p_start_date: startStr,
        p_end_date: endStr,
      });
      if (error) throw error;
      const row = (data?.[0] ?? null) as any;
      if (!row) {
        return {
          totalCash: 0, totalCashHT: 0, totalCashVAT: 0, totalCashOrders: 0,
          cashAvgBasket: 0,
          totalGlobal: 0, totalUber: 0, totalDeliveroo: 0,
          totalGlobalOrders: 0, totalUberOrders: 0, totalDeliverooOrders: 0,
          cashShare: 0, daysWithData: 0,
          previousPeriodCash: null, previousPeriodCashOrders: null,
          cashVariation: null, ordersVariation: null,
        };
      }
      const totalGlobal = Number(row.total_global) || 0;
      const totalUber = Number(row.total_uber) || 0;
      const totalDeliveroo = Number(row.total_deliveroo) || 0;
      const totalCash = totalGlobal; // ligne "global" Splash = caisse
      const totalCashHT = Number(row.total_cash_ht) || 0;
      const totalCashVAT = Number(row.total_cash_vat) || 0;
      const totalCashOrders = Number(row.total_global_orders) || 0;
      const totalGlobalOrders = totalCashOrders;
      const totalUberOrders = Number(row.total_uber_orders) || 0;
      const totalDeliverooOrders = Number(row.total_deliveroo_orders) || 0;
      const daysWithData = Number(row.days_with_data) || 0;

      const prevCash = Number(row.prev_total_cash) || 0;
      const prevCashOrders = Number(row.prev_total_cash_orders) || 0;
      const prevDays = Number(row.prev_days_with_data) || 0;

      const previousPeriodCash = prevDays > 0 ? prevCash : null;
      const previousPeriodCashOrders = prevDays > 0 ? prevCashOrders : null;
      const cashVariation = previousPeriodCash != null && previousPeriodCash > 0
        ? ((totalCash - previousPeriodCash) / previousPeriodCash) * 100
        : null;
      const ordersVariation = previousPeriodCashOrders != null && previousPeriodCashOrders > 0
        ? ((totalCashOrders - previousPeriodCashOrders) / previousPeriodCashOrders) * 100
        : null;

      const totalAll = totalGlobal + totalUber + totalDeliveroo;
      const cashShare = totalAll > 0 ? (totalCash / totalAll) * 100 : 0;
      const cashAvgBasket = totalCashOrders > 0 ? totalCash / totalCashOrders : 0;

      return {
        totalCash, totalCashHT, totalCashVAT, totalCashOrders,
        cashAvgBasket,
        totalGlobal, totalUber, totalDeliveroo,
        totalGlobalOrders, totalUberOrders, totalDeliverooOrders,
        cashShare, daysWithData,
        previousPeriodCash, previousPeriodCashOrders,
        cashVariation, ordersVariation,
      };
    },
  });
}
