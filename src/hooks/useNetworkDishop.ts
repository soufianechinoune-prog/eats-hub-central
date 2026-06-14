import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface DishopByRestaurant {
  restaurantId: string;
  revenue: number;
  orders: number;
}

export interface NetworkDishopData {
  totalRevenue: number;
  totalOrders: number;
  avgBasket: number;
  daysWithData: number;
  previousRevenue: number | null;
  previousOrders: number | null;
  revenueVariation: number | null;
  ordersVariation: number | null;
  byRestaurant: Map<string, DishopByRestaurant>;
}

interface Params {
  startDate: Date;
  endDate: Date;
  chainId: string | null;
  restaurantIds?: string[];
}

const EMPTY: NetworkDishopData = {
  totalRevenue: 0,
  totalOrders: 0,
  avgBasket: 0,
  daysWithData: 0,
  previousRevenue: null,
  previousOrders: null,
  revenueVariation: null,
  ordersVariation: null,
  byRestaurant: new Map(),
};

/**
 * Aggregated Dishop (in-restaurant ordering) revenue for the active brand.
 */
export function useNetworkDishop({
  startDate,
  endDate,
  chainId,
  restaurantIds = [],
}: Params) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");
  const hasScope = !!chainId || restaurantIds.length > 0;

  return useQuery({
    queryKey: ["network-dishop", chainId ?? "all", restaurantIds, startStr, endStr],
    staleTime: 5 * 60 * 1000,
    enabled: hasScope,
    queryFn: async (): Promise<NetworkDishopData> => {
      const { data, error } = await (supabase as any).rpc("get_network_dishop_summary", {
        p_chain_id: chainId,
        p_restaurant_ids: restaurantIds,
        p_start_date: startStr,
        p_end_date: endStr,
      });
      if (error) throw error;
      const row = (data?.[0] ?? null) as any;
      if (!row) return EMPTY;

      const totalRevenue = Number(row.total_revenue) || 0;
      const totalOrders = Number(row.total_orders) || 0;
      const avgBasket = Number(row.avg_basket) || 0;
      const daysWithData = Number(row.days_with_data) || 0;

      const prevRev = Number(row.prev_total_revenue) || 0;
      const prevOrd = Number(row.prev_total_orders) || 0;
      const prevDays = Number(row.prev_days_with_data) || 0;

      const previousRevenue = prevDays > 0 ? prevRev : null;
      const previousOrders = prevDays > 0 ? prevOrd : null;
      const revenueVariation =
        previousRevenue != null && previousRevenue > 0
          ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
          : null;
      const ordersVariation =
        previousOrders != null && previousOrders > 0
          ? ((totalOrders - previousOrders) / previousOrders) * 100
          : null;

      const byRestaurant = new Map<string, DishopByRestaurant>();
      const arr = Array.isArray(row.by_restaurant) ? row.by_restaurant : [];
      for (const r of arr) {
        if (!r?.restaurant_id) continue;
        byRestaurant.set(r.restaurant_id, {
          restaurantId: r.restaurant_id,
          revenue: Number(r.revenue) || 0,
          orders: Number(r.orders) || 0,
        });
      }

      return {
        totalRevenue,
        totalOrders,
        avgBasket,
        daysWithData,
        previousRevenue,
        previousOrders,
        revenueVariation,
        ordersVariation,
        byRestaurant,
      };
    },
  });
}
