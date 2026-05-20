import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface ProfitabilityRow {
  day: string;
  restaurant_id: string;
  sales: number;
  item_promo_incl_vat: number;
  net_payout: number;
  meal_voucher: number;
}

export interface CorrelationMonthPoint {
  monthKey: string;
  label: string;
  fees: number;
  caHt: number; // approx: (sales - item_promo) / 1.1 (TVA restauration 10%)
  versement: number; // net_payout + meal_voucher
  feesRatioCa: number; // fees / caHt * 100
  rentabilite: number; // versement / caHt * 100
}

const SENTINEL = "00000000-0000-0000-0000-000000000000";

export function useOfferFeesCorrelation(
  restaurantIds: string[],
  startDate: string,
  endDate: string,
  monthlyFees: { monthKey: string; totalFees: number }[]
) {
  const ready =
    !!startDate &&
    !!endDate &&
    restaurantIds.length > 0 &&
    !restaurantIds.includes(SENTINEL);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["offers-fees-correlation", restaurantIds, startDate, endDate],
    staleTime: 5 * 60 * 1000,
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profitability_monthly", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return (data || []) as ProfitabilityRow[];
    },
  });

  return useMemo(() => {
    const rows = data || [];

    // Aggregate per month
    const map = new Map<
      string,
      { sales: number; promo: number; payout: number; meal: number }
    >();

    rows.forEach((r) => {
      // r.day is YYYY-MM-DD; month_key = YYYY-MM
      const monthKey = r.day.slice(0, 7);
      const cur = map.get(monthKey) || { sales: 0, promo: 0, payout: 0, meal: 0 };
      cur.sales += Number(r.sales) || 0;
      cur.promo += Number(r.item_promo_incl_vat) || 0;
      cur.payout += Number(r.net_payout) || 0;
      cur.meal += Number(r.meal_voucher) || 0;
      map.set(monthKey, cur);
    });

    const feesMap = new Map(monthlyFees.map((m) => [m.monthKey, m.totalFees]));

    const allMonths = Array.from(
      new Set([...map.keys(), ...monthlyFees.map((m) => m.monthKey)])
    ).sort();

    const points: CorrelationMonthPoint[] = allMonths.map((monthKey) => {
      const p = map.get(monthKey) || { sales: 0, promo: 0, payout: 0, meal: 0 };
      // Approx HT (TVA restauration 10%) — sales is TTC in this RPC
      const caHt = Math.max(0, (p.sales - p.promo) / 1.1);
      const versement = p.payout + p.meal;
      const fees = feesMap.get(monthKey) || 0;
      const [y, m] = monthKey.split("-");
      const label = `${m}/${y.slice(2)}`;
      return {
        monthKey,
        label,
        fees: Math.round(fees * 100) / 100,
        caHt: Math.round(caHt),
        versement: Math.round(versement),
        feesRatioCa: caHt > 0 ? +((fees / caHt) * 100).toFixed(3) : 0,
        rentabilite: caHt > 0 ? +((versement / caHt) * 100).toFixed(2) : 0,
      };
    });

    return { points, isLoading, isError };
  }, [data, monthlyFees, isLoading, isError]);
}
