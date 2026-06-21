import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface UseDishopOverviewParams {
  chainId: string | null;
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
}

export interface DishopOverviewData {
  caTTC: number;
  orderCount: number;
  averageBasket: number;
  commissionAmount: number;
  commissionRate: number; // % of CA TTC
  profitability: number; // % = (CA - commission) / CA * 100
  promoShare: number; // % orders with marketing_promo_used
  hasData: boolean;
}

export function useDishopOverview({
  chainId,
  restaurantIds,
  startDate,
  endDate,
}: UseDishopOverviewParams) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");
  const validRestaurants = restaurantIds.filter(
    (id) => id && id !== "00000000-0000-0000-0000-000000000000"
  );

  return useQuery<DishopOverviewData>({
    queryKey: ["dishop-overview", chainId, validRestaurants.sort().join(","), startStr, endStr],
    enabled: !!chainId && validRestaurants.length > 0,
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const rows: Array<{
        price_total: number | null;
        commission_dishop_amount: number | null;
        commission_ordertype_amount: number | null;
        marketing_promo_used: boolean | null;
      }> = [];

      // Inclusive end day: append 23:59:59
      const endInclusive = `${endStr}T23:59:59+02:00`;
      const startInclusive = `${startStr}T00:00:00+02:00`;

      while (true) {
        const { data, error } = await supabase
          .from("dishop_orders")
          .select("price_total, commission_dishop_amount, commission_ordertype_amount, marketing_promo_used")
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

      const orderCount = rows.length;
      const caTTC = rows.reduce((s, r) => s + (Number(r.price_total) || 0), 0);
      const commissionAmount = rows.reduce(
        (s, r) =>
          s +
          (Number(r.commission_dishop_amount) || 0) +
          (Number(r.commission_ordertype_amount) || 0),
        0
      );
      const promoCount = rows.filter((r) => r.marketing_promo_used).length;

      return {
        caTTC,
        orderCount,
        averageBasket: orderCount > 0 ? caTTC / orderCount : 0,
        commissionAmount,
        commissionRate: caTTC > 0 ? (commissionAmount / caTTC) * 100 : 0,
        profitability: caTTC > 0 ? ((caTTC - commissionAmount) / caTTC) * 100 : 0,
        promoShare: orderCount > 0 ? (promoCount / orderCount) * 100 : 0,
        hasData: orderCount > 0,
      };
    },
    staleTime: 5 * 60_000,
  });
}
