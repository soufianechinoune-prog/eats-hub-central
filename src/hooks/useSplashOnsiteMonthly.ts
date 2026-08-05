import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

const SENTINEL = "00000000-0000-0000-0000-000000000000";

export interface OnsiteRow {
  restaurant_id: string;
  restaurant_name: string;
  year_bucket: number;
  month_num: number;
  revenue_onsite_ttc: number;
  revenue_onsite_ht: number;
  orders_onsite: number;
  days_count: number;
}

export interface MonthAggregate {
  month: number;
  current: number;
  previous: number;
  lflCurrent: number;
  lflPrevious: number;
  lflRestaurants: number;
  isPartial: boolean;
}

export interface RestaurantAggregate {
  restaurantId: string;
  name: string;
  current: number;
  previous: number;
  lflCurrent: number;
  lflPrevious: number;
  lflMonths: number;
  months: MonthAggregate[];
}

interface Options {
  year: number;
  includePartialMonth: boolean;
}

export function useSplashOnsiteMonthly({ year, includePartialMonth }: Options) {
  const { selectedChainId, selectedRestaurants } = useAnalyticsContext();

  const enabled = !!selectedChainId && selectedChainId !== SENTINEL;

  const query = useQuery({
    queryKey: ["splash-onsite-monthly", selectedChainId, year, selectedRestaurants],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_splash_onsite_monthly", {
        p_chain_id: selectedChainId,
        p_restaurant_ids: selectedRestaurants.length > 0 ? selectedRestaurants : null,
        p_year: year,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        revenue_onsite_ttc: Number(r.revenue_onsite_ttc) || 0,
        revenue_onsite_ht: Number(r.revenue_onsite_ht) || 0,
        orders_onsite: Number(r.orders_onsite) || 0,
        days_count: Number(r.days_count) || 0,
      })) as OnsiteRow[];
    },
  });

  const computed = useMemo(() => {
    const rows = query.data ?? [];
    const now = new Date();
    const currentMonthPartial = year === now.getFullYear() ? now.getMonth() + 1 : 0;

    const byRestaurant = new Map<string, RestaurantAggregate>();
    const key = (m: number, y: number) => `${y}-${m}`;
    const valueMap = new Map<string, Map<string, number>>();

    for (const row of rows) {
      if (!byRestaurant.has(row.restaurant_id)) {
        byRestaurant.set(row.restaurant_id, {
          restaurantId: row.restaurant_id,
          name: row.restaurant_name,
          current: 0,
          previous: 0,
          lflCurrent: 0,
          lflPrevious: 0,
          lflMonths: 0,
          months: [],
        });
        valueMap.set(row.restaurant_id, new Map());
      }
      const map = valueMap.get(row.restaurant_id)!;
      map.set(key(row.month_num, row.year_bucket), (map.get(key(row.month_num, row.year_bucket)) ?? 0) + row.revenue_onsite_ttc);
    }

    const networkMonths: MonthAggregate[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      current: 0,
      previous: 0,
      lflCurrent: 0,
      lflPrevious: 0,
      lflRestaurants: 0,
      isPartial: i + 1 === currentMonthPartial,
    }));

    for (const [rid, agg] of byRestaurant) {
      const map = valueMap.get(rid)!;
      for (let m = 1; m <= 12; m++) {
        const cur = map.get(key(m, year)) ?? 0;
        const prev = map.get(key(m, year - 1)) ?? 0;
        if (cur === 0 && prev === 0) continue;
        const partial = m === currentMonthPartial;
        const countable = (includePartialMonth || !partial) && cur > 0;
        const isLfl = cur > 0 && prev > 0;

        const monthRow: MonthAggregate = {
          month: m,
          current: cur,
          previous: prev,
          lflCurrent: isLfl ? cur : 0,
          lflPrevious: isLfl ? prev : 0,
          lflRestaurants: isLfl ? 1 : 0,
          isPartial: partial,
        };
        agg.months.push(monthRow);

        if (countable) {
          agg.current += cur;
          agg.previous += prev;
          if (isLfl) {
            agg.lflCurrent += cur;
            agg.lflPrevious += prev;
            agg.lflMonths += 1;
          }
          const nm = networkMonths[m - 1];
          nm.current += cur;
          nm.previous += prev;
          if (isLfl) {
            nm.lflCurrent += cur;
            nm.lflPrevious += prev;
            nm.lflRestaurants += 1;
          }
        } else {
          const nm = networkMonths[m - 1];
          nm.current += cur;
          nm.previous += prev;
          if (isLfl) {
            nm.lflCurrent += cur;
            nm.lflPrevious += prev;
            nm.lflRestaurants += 1;
          }
        }
      }
      agg.months.sort((a, b) => a.month - b.month);
    }

    const restaurants = Array.from(byRestaurant.values()).sort((a, b) => b.current - a.current);

    const countedMonths = networkMonths.filter(
      (m) => m.current > 0 && (includePartialMonth || !m.isPartial)
    );
    const totals = {
      current: countedMonths.reduce((s, m) => s + m.current, 0),
      previous: countedMonths.reduce((s, m) => s + m.previous, 0),
      lflCurrent: countedMonths.reduce((s, m) => s + m.lflCurrent, 0),
      lflPrevious: countedMonths.reduce((s, m) => s + m.lflPrevious, 0),
      lflRestaurants: new Set(
        restaurants.filter((r) => r.lflMonths > 0).map((r) => r.restaurantId)
      ).size,
    };

    return { networkMonths: networkMonths.filter((m) => m.current > 0 || m.previous > 0), restaurants, totals };
  }, [query.data, year, includePartialMonth]);

  return { ...computed, isLoading: query.isLoading, error: query.error, enabled };
}

export const deltaPct = (current: number, previous: number): number | null => {
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};
