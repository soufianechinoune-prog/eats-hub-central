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
  days_zero: number;
}

export interface MonthAggregate {
  month: number;
  current: number;
  previous: number;
  lflCurrent: number;
  lflPrevious: number;
  lflRestaurants: number;
  ordersCurrent: number;
  ordersPrevious: number;
  daysZeroCurrent: number;
  daysActiveCurrent: number;
  daysActivePrevious: number;
  isPartial: boolean;
}

/** Statut d'un restaurant sur un mois donné, vis-à-vis du périmètre constant. */
export type ScopeStatus = "lfl" | "opened" | "closed";

export interface ScopeRestaurant {
  restaurantId: string;
  name: string;
  status: ScopeStatus;
  current: number;
  previous: number;
  daysActiveCurrent: number;
  daysActivePrevious: number;
  daysZeroCurrent: number;
}

export interface ScopeMonth {
  month: number;
  isPartial: boolean;
  lfl: ScopeRestaurant[];
  opened: ScopeRestaurant[];
  closed: ScopeRestaurant[];
  lflCurrent: number;
  lflPrevious: number;
  openedCurrent: number;
  closedPrevious: number;
}

export interface RestaurantAggregate {
  restaurantId: string;
  name: string;
  current: number;
  previous: number;
  lflCurrent: number;
  lflPrevious: number;
  lflMonths: number;
  ordersCurrent: number;
  ordersPrevious: number;
  daysZeroCurrent: number;
  months: MonthAggregate[];
}

interface Options {
  year: number;
  includePartialMonth: boolean;
}

interface Bucket {
  ttc: number;
  orders: number;
  daysZero: number;
}

const emptyBucket = (): Bucket => ({ ttc: 0, orders: 0, daysZero: 0 });

export function useSplashOnsiteMonthly({ year, includePartialMonth }: Options) {
  const { selectedChainId } = useAnalyticsContext();

  const enabled = !!selectedChainId && selectedChainId !== SENTINEL;

  const query = useQuery({
    // Rapport direction : toujours sur le réseau complet de la marque,
    // indépendamment de la sélection de restaurants du header.
    queryKey: ["splash-onsite-monthly-v2", selectedChainId, year],
    enabled,
    retry: false,
    queryFn: async () => {
      // v2 renvoie un seul objet JSON agrégé : évite la troncature à 1000 lignes
      // de l'API (2000+ lignes resto x mois sur 2 ans).
      const { data, error } = await (supabase.rpc as any)("get_splash_onsite_monthly_v2", {
        p_chain_id: selectedChainId,
        p_restaurant_ids: null,
        p_year: year,
      });
      if (error) throw error;

      const payload = (data ?? {}) as any;
      const rows: OnsiteRow[] = [];
      for (const r of payload.restaurants ?? []) {
        for (const m of r.months ?? []) {
          rows.push({
            restaurant_id: r.restaurant_id,
            restaurant_name: r.name,
            year_bucket: Number(m.y),
            month_num: Number(m.m),
            revenue_onsite_ttc: Number(m.ttc) || 0,
            revenue_onsite_ht: Number(m.ht) || 0,
            orders_onsite: Number(m.orders) || 0,
            days_count: Number(m.days_count) || 0,
            days_zero: Number(m.days_zero) || 0,
          });
        }
      }

      const cov = payload.coverage ?? {};
      return {
        rows,
        coverage: {
          daysZeroCurrent: Number(cov.days_zero_current) || 0,
          unmappedSplashIds: Number(cov.unmapped_splash_ids) || 0,
          unmappedRevenueTtc: Number(cov.unmapped_revenue_ttc) || 0,
        },
      };
    },
  });

  const coverage = query.data?.coverage ?? {
    daysZeroCurrent: 0,
    unmappedSplashIds: 0,
    unmappedRevenueTtc: 0,
  };

  const computed = useMemo(() => {
    const rows = query.data?.rows ?? [];
    const now = new Date();
    const currentMonthPartial = year === now.getFullYear() ? now.getMonth() + 1 : 0;


    const byRestaurant = new Map<string, RestaurantAggregate>();
    const key = (m: number, y: number) => `${y}-${m}`;
    const valueMap = new Map<string, Map<string, Bucket>>();

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
          ordersCurrent: 0,
          ordersPrevious: 0,
          daysZeroCurrent: 0,
          months: [],
        });
        valueMap.set(row.restaurant_id, new Map());
      }
      const map = valueMap.get(row.restaurant_id)!;
      const k = key(row.month_num, row.year_bucket);
      const b = map.get(k) ?? emptyBucket();
      b.ttc += row.revenue_onsite_ttc;
      b.orders += row.orders_onsite;
      b.daysZero += row.days_zero;
      map.set(k, b);
    }

    const networkMonths: MonthAggregate[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      current: 0,
      previous: 0,
      lflCurrent: 0,
      lflPrevious: 0,
      lflRestaurants: 0,
      ordersCurrent: 0,
      ordersPrevious: 0,
      daysZeroCurrent: 0,
      isPartial: i + 1 === currentMonthPartial,
    }));

    for (const [rid, agg] of byRestaurant) {
      const map = valueMap.get(rid)!;
      for (let m = 1; m <= 12; m++) {
        const curB = map.get(key(m, year)) ?? emptyBucket();
        const prevB = map.get(key(m, year - 1)) ?? emptyBucket();
        const cur = curB.ttc;
        const prev = prevB.ttc;
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
          ordersCurrent: curB.orders,
          ordersPrevious: prevB.orders,
          daysZeroCurrent: curB.daysZero,
          isPartial: partial,
        };
        agg.months.push(monthRow);

        if (countable) {
          agg.current += cur;
          agg.previous += prev;
          agg.ordersCurrent += curB.orders;
          agg.ordersPrevious += prevB.orders;
          agg.daysZeroCurrent += curB.daysZero;
          if (isLfl) {
            agg.lflCurrent += cur;
            agg.lflPrevious += prev;
            agg.lflMonths += 1;
          }
        }

        const nm = networkMonths[m - 1];
        nm.current += cur;
        nm.previous += prev;
        nm.ordersCurrent += curB.orders;
        nm.ordersPrevious += prevB.orders;
        nm.daysZeroCurrent += curB.daysZero;
        if (isLfl) {
          nm.lflCurrent += cur;
          nm.lflPrevious += prev;
          nm.lflRestaurants += 1;
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
      ordersCurrent: countedMonths.reduce((s, m) => s + m.ordersCurrent, 0),
      ordersPrevious: countedMonths.reduce((s, m) => s + m.ordersPrevious, 0),
      lflRestaurants: new Set(
        restaurants.filter((r) => r.lflMonths > 0).map((r) => r.restaurantId)
      ).size,
    };

    const inScope = (m: { month: number; current: number; previous: number }) =>
      (m.current > 0 || m.previous > 0) && (currentMonthPartial === 0 || m.month <= currentMonthPartial);

    for (const r of restaurants) r.months = r.months.filter(inScope);

    return { networkMonths: networkMonths.filter(inScope), restaurants, totals };
  }, [query.data, year, includePartialMonth]);

  return { ...computed, coverage, isLoading: query.isLoading, error: query.error, enabled };

}

export const deltaPct = (current: number, previous: number): number | null => {
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

export const avgBasket = (revenue: number, orders: number): number =>
  orders > 0 ? revenue / orders : 0;
