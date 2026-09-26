import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * CA journalier réseau par canal (Uber Eats, Deliveroo, Caisse, Chataigne).
 * Réutilise les RPC existantes (mêmes données que le drill-down restaurant),
 * appelées une seule fois avec la liste complète des restaurants actifs.
 * Sert uniquement à l'affichage (graphique d'évolution + sparklines).
 */

export interface NetworkDailyPoint {
  date: string; // yyyy-MM-dd
  uber: number;
  deliveroo: number;
  cash: number;
  chataigne: number;
  total: number;
}

interface DailyRow {
  date: string;
  revenue_ttc: number | string;
  restaurant_id: string;
  platform?: string | null;
}

async function callDailyRpc(
  fn: string,
  start: string,
  end: string,
  restaurantIds: string[],
): Promise<DailyRow[]> {
  const { data, error } = await (supabase.rpc as any)(fn, {
    p_start_date: start,
    p_end_date: end,
    p_restaurant_ids: restaurantIds,
  });
  if (error) throw error;
  return (data ?? []) as DailyRow[];
}

export function useNetworkDailyRevenue(
  restaurantIds: string[],
  startDate: string,
  endDate: string,
) {
  const enabled = restaurantIds.length > 0 && !!startDate && !!endDate;

  const platforms = useQuery({
    queryKey: ["network-daily", "platforms", startDate, endDate, restaurantIds],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc("get_daily_revenue_from_orders", startDate, endDate, restaurantIds),
  });

  const cash = useQuery({
    queryKey: ["network-daily", "cash", startDate, endDate, restaurantIds],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc("get_daily_onsite_from_splash", startDate, endDate, restaurantIds),
  });

  const chataigne = useQuery({
    queryKey: ["network-daily", "chataigne", startDate, endDate, restaurantIds],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc("get_daily_chataigne", startDate, endDate, restaurantIds),
  });

  const isLoading = platforms.isLoading || cash.isLoading || chataigne.isLoading;

  // Série journalière agrégée tous restaurants (pour le graphique « Évolution du CA »)
  const daily = useMemo<NetworkDailyPoint[]>(() => {
    const byDate = new Map<string, NetworkDailyPoint>();
    const ensure = (d: string) => {
      const key = d.slice(0, 10);
      let row = byDate.get(key);
      if (!row) {
        row = { date: key, uber: 0, deliveroo: 0, cash: 0, chataigne: 0, total: 0 };
        byDate.set(key, row);
      }
      return row;
    };

    for (const r of platforms.data ?? []) {
      const p = (r.platform ?? "").toLowerCase();
      const row = ensure(r.date);
      const v = Number(r.revenue_ttc) || 0;
      if (p.includes("deliveroo")) row.deliveroo += v;
      else row.uber += v;
    }
    for (const r of cash.data ?? []) ensure(r.date).cash += Number(r.revenue_ttc) || 0;
    for (const r of chataigne.data ?? []) ensure(r.date).chataigne += Number(r.revenue_ttc) || 0;

    const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    for (const r of rows) r.total = r.uber + r.deliveroo + r.cash + r.chataigne;
    return rows;
  }, [platforms.data, cash.data, chataigne.data]);

  // Série journalière par restaurant (tous canaux confondus) — sparklines du tableau
  const byRestaurant = useMemo<Map<string, { date: string; total: number }[]>>(() => {
    const map = new Map<string, Map<string, number>>();
    const add = (restaurantId: string, date: string, value: number) => {
      if (!restaurantId) return;
      const d = date.slice(0, 10);
      let m = map.get(restaurantId);
      if (!m) {
        m = new Map();
        map.set(restaurantId, m);
      }
      m.set(d, (m.get(d) ?? 0) + value);
    };

    for (const r of platforms.data ?? []) add(r.restaurant_id, r.date, Number(r.revenue_ttc) || 0);
    for (const r of cash.data ?? []) add(r.restaurant_id, r.date, Number(r.revenue_ttc) || 0);
    for (const r of chataigne.data ?? []) add(r.restaurant_id, r.date, Number(r.revenue_ttc) || 0);

    const out = new Map<string, { date: string; total: number }[]>();
    for (const [id, m] of map) {
      out.set(
        id,
        [...m.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, total]) => ({ date, total })),
      );
    }
    return out;
  }, [platforms.data, cash.data, chataigne.data]);

  return { daily, byRestaurant, isLoading };
}
