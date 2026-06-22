import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const MEAL_VOUCHER_PROVIDERS = [
  "Edenred",
  "Swile",
  "Sodexo",
  "UpDejeuner",
  "Bimpli (ex Apetiz)",
  "Pluxee",
] as const;

export type MealVoucherProvider = (typeof MEAL_VOUCHER_PROVIDERS)[number];

export interface MealVoucherRestaurantRow {
  restaurantId: string;
  uberRevenueTTC: number;
  uberOrderCount: number;
  trAmount: number;
  trOrderCount: number;
  trShareOfUber: number; // % du CA Uber payé en TR
  byProvider: Record<MealVoucherProvider, { amount: number; orderCount: number; share: number }>;
  missingProviders: MealVoucherProvider[];
}

interface Params {
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
}

const SENTINEL = "00000000-0000-0000-0000-000000000000";

export function useMealVoucherBreakdown({ restaurantIds, startDate, endDate }: Params) {
  const enabled =
    restaurantIds.length > 0 && !restaurantIds.includes(SENTINEL);
  const dateFrom = format(startDate, "yyyy-MM-dd");
  const dateTo = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["meal-voucher-breakdown", restaurantIds, dateFrom, dateTo],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MealVoucherRestaurantRow[]> => {
      const [breakdownRes, totalsRes] = await Promise.all([
        supabase.rpc("get_meal_voucher_breakdown", {
          p_restaurant_ids: restaurantIds,
          p_date_from: dateFrom,
          p_date_to: dateTo,
        }),
        supabase.rpc("get_meal_voucher_totals", {
          p_restaurant_ids: restaurantIds,
          p_date_from: dateFrom,
          p_date_to: dateTo,
        }),
      ]);

      if (breakdownRes.error) throw breakdownRes.error;
      if (totalsRes.error) throw totalsRes.error;

      const totalsMap = new Map<string, { uber: number; uberCount: number; tr: number; trCount: number }>();
      for (const row of (totalsRes.data ?? []) as Array<{
        restaurant_id: string;
        uber_revenue_ttc: number | string;
        uber_order_count: number | string;
        tr_amount: number | string;
        tr_order_count: number | string;
      }>) {
        totalsMap.set(row.restaurant_id, {
          uber: Number(row.uber_revenue_ttc) || 0,
          uberCount: Number(row.uber_order_count) || 0,
          tr: Number(row.tr_amount) || 0,
          trCount: Number(row.tr_order_count) || 0,
        });
      }

      const breakdownMap = new Map<string, Map<MealVoucherProvider, { amount: number; count: number }>>();
      for (const row of (breakdownRes.data ?? []) as Array<{
        restaurant_id: string;
        provider: MealVoucherProvider;
        amount: number | string;
        order_count: number | string;
      }>) {
        if (!breakdownMap.has(row.restaurant_id)) {
          breakdownMap.set(row.restaurant_id, new Map());
        }
        breakdownMap.get(row.restaurant_id)!.set(row.provider, {
          amount: Number(row.amount) || 0,
          count: Number(row.order_count) || 0,
        });
      }

      const rows: MealVoucherRestaurantRow[] = restaurantIds.map((id) => {
        const totals = totalsMap.get(id);
        const providers = breakdownMap.get(id) ?? new Map();
        const trAmount = totals?.tr ?? 0;
        const uberRev = totals?.uber ?? 0;

        const byProvider = {} as MealVoucherRestaurantRow["byProvider"];
        const missing: MealVoucherProvider[] = [];
        for (const p of MEAL_VOUCHER_PROVIDERS) {
          const entry = providers.get(p);
          const amount = entry?.amount ?? 0;
          const count = entry?.count ?? 0;
          byProvider[p] = {
            amount,
            orderCount: count,
            share: trAmount > 0 ? (amount / trAmount) * 100 : 0,
          };
          if (amount <= 0) missing.push(p);
        }

        return {
          restaurantId: id,
          uberRevenueTTC: uberRev,
          uberOrderCount: totals?.uberCount ?? 0,
          trAmount,
          trOrderCount: totals?.trCount ?? 0,
          trShareOfUber: uberRev > 0 ? (trAmount / uberRev) * 100 : 0,
          byProvider,
          missingProviders: missing,
        };
      });

      return rows;
    },
  });
}
