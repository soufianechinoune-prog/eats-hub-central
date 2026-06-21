import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface UseDishopRestaurantBreakdownParams {
  chainId: string | null;
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
}

export interface DishopRestaurantRow {
  restaurantId: string;
  caTTC: number;
  orderCount: number;
  averageBasket: number;
  commissionAmount: number;
  commissionRate: number;
  profitability: number;
  promoShare: number;
}

export function useDishopRestaurantBreakdown({
  chainId,
  restaurantIds,
  startDate,
  endDate,
}: UseDishopRestaurantBreakdownParams) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");
  const validRestaurants = restaurantIds.filter(
    (id) => id && id !== "00000000-0000-0000-0000-000000000000"
  );

  return useQuery<DishopRestaurantRow[]>({
    queryKey: [
      "dishop-restaurant-breakdown",
      chainId,
      validRestaurants.sort().join(","),
      startStr,
      endStr,
    ],
    enabled: !!chainId && validRestaurants.length > 0,
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const rows: Array<{
        restaurant_id: string;
        price_total: number | null;
        commission_dishop_amount: number | null;
        commission_ordertype_amount: number | null;
        marketing_promo_used: boolean | null;
      }> = [];

      const startInclusive = `${startStr}T00:00:00+02:00`;
      const endInclusive = `${endStr}T23:59:59+02:00`;

      while (true) {
        const { data, error } = await supabase
          .from("dishop_orders")
          .select(
            "restaurant_id, price_total, commission_dishop_amount, commission_ordertype_amount, marketing_promo_used"
          )
          .eq("chain_id", chainId as string)
          .in("restaurant_id", validRestaurants)
          .gte("order_date", startInclusive)
          .lte("order_date", endInclusive)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...(data as typeof rows));
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const byRestaurant = new Map<
        string,
        { caTTC: number; orderCount: number; commissionAmount: number; promoCount: number }
      >();

      for (const r of rows) {
        const agg = byRestaurant.get(r.restaurant_id) ?? {
          caTTC: 0,
          orderCount: 0,
          commissionAmount: 0,
          promoCount: 0,
        };
        agg.caTTC += Number(r.price_total) || 0;
        agg.orderCount += 1;
        agg.commissionAmount +=
          (Number(r.commission_dishop_amount) || 0) +
          (Number(r.commission_ordertype_amount) || 0);
        if (r.marketing_promo_used) agg.promoCount += 1;
        byRestaurant.set(r.restaurant_id, agg);
      }

      return Array.from(byRestaurant.entries()).map(([restaurantId, agg]) => ({
        restaurantId,
        caTTC: agg.caTTC,
        orderCount: agg.orderCount,
        averageBasket: agg.orderCount > 0 ? agg.caTTC / agg.orderCount : 0,
        commissionAmount: agg.commissionAmount,
        commissionRate: agg.caTTC > 0 ? (agg.commissionAmount / agg.caTTC) * 100 : 0,
        profitability:
          agg.caTTC > 0 ? ((agg.caTTC - agg.commissionAmount) / agg.caTTC) * 100 : 0,
        promoShare: agg.orderCount > 0 ? (agg.promoCount / agg.orderCount) * 100 : 0,
      }));
    },
    staleTime: 5 * 60_000,
  });
}
