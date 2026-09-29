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

export interface NetworkChannelComparison {
  current: number;
  previous: number | null;
  variation: number | null;
}

export type NetworkChannelComparisons = Record<
  "cash" | "uber" | "deliveroo" | "chataigne",
  NetworkChannelComparison
>;

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
  // 1 ligne par restaurant et par jour : l'API tronque à 1000 lignes → pagination.
  const PAGE_SIZE = 1000;
  const all: DailyRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await (supabase.rpc as any)(fn, {
      p_start_date: start,
      p_end_date: end,
      p_restaurant_ids: restaurantIds,
    }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as DailyRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

export function useNetworkDailyRevenue(
  restaurantIds: string[],
  startDate: string,
  endDate: string,
  comparisonRestaurantIds: string[] = restaurantIds,
  previousStartDate?: string,
  previousEndDate?: string,
) {
  const enabled = restaurantIds.length > 0 && !!startDate && !!endDate;
  const comparisonEnabled =
    comparisonRestaurantIds.length > 0 && !!previousStartDate && !!previousEndDate;

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

  const previousPlatforms = useQuery({
    queryKey: ["network-daily", "platforms", "n-1", previousStartDate, previousEndDate, comparisonRestaurantIds],
    enabled: comparisonEnabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc(
      "get_daily_revenue_from_orders",
      previousStartDate ?? "",
      previousEndDate ?? "",
      comparisonRestaurantIds,
    ),
  });

  const previousCash = useQuery({
    queryKey: ["network-daily", "cash", "n-1", previousStartDate, previousEndDate, comparisonRestaurantIds],
    enabled: comparisonEnabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc(
      "get_daily_onsite_from_splash",
      previousStartDate ?? "",
      previousEndDate ?? "",
      comparisonRestaurantIds,
    ),
  });

  const previousChataigne = useQuery({
    queryKey: ["network-daily", "chataigne", "n-1", previousStartDate, previousEndDate, comparisonRestaurantIds],
    enabled: comparisonEnabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc(
      "get_daily_chataigne",
      previousStartDate ?? "",
      previousEndDate ?? "",
      comparisonRestaurantIds,
    ),
  });

  // Source de vérité Vue d'ensemble = caisse Splash, y compris pour Uber Eats / Deliveroo
  // (lignes platform=uber_eats/deliveroo). Repli sur les API pour les restaurants sans caisse.
  const splashPlatforms = useQuery({
    queryKey: ["network-daily", "splash-platforms", startDate, endDate, restaurantIds],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc("get_daily_platforms_from_splash", startDate, endDate, restaurantIds),
  });
  const previousSplashPlatforms = useQuery({
    queryKey: ["network-daily", "splash-platforms", "n-1", previousStartDate, previousEndDate, comparisonRestaurantIds],
    enabled: comparisonEnabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => callDailyRpc("get_daily_platforms_from_splash", previousStartDate ?? "", previousEndDate ?? "", comparisonRestaurantIds),
  });
  const mergePlatforms = (
    apiRows: DailyRow[] | undefined,
    splashRows: DailyRow[] | undefined,
    cashRows: DailyRow[] | undefined,
  ): DailyRow[] | undefined => {
    if (!apiRows && !splashRows) return undefined;
    const withCash = new Set<string>();
    for (const r of cashRows ?? []) if ((Number(r.revenue_ttc) || 0) > 0) withCash.add(r.restaurant_id);
    for (const r of splashRows ?? []) if ((Number(r.revenue_ttc) || 0) > 0) withCash.add(r.restaurant_id);
    return [
      ...(splashRows ?? []).filter((r) => withCash.has(r.restaurant_id)),
      ...(apiRows ?? []).filter((r) => !withCash.has(r.restaurant_id)),
    ];
  };
  const mergedPlatforms = useMemo(
    () => mergePlatforms(platforms.data, splashPlatforms.data, cash.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platforms.data, splashPlatforms.data, cash.data],
  );
  const mergedPreviousPlatforms = useMemo(
    () => mergePlatforms(previousPlatforms.data, previousSplashPlatforms.data, previousCash.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previousPlatforms.data, previousSplashPlatforms.data, previousCash.data],
  );

  const isLoading = platforms.isLoading || cash.isLoading || chataigne.isLoading || splashPlatforms.isLoading;

  // Série journalière agrégée (graphique « Évolution du CA »), optionnellement restreinte à un périmètre
  const buildDaily = (scope: Set<string> | null): NetworkDailyPoint[] => {
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
    const inScope = (r: DailyRow) => !scope || scope.has(r.restaurant_id);

    for (const r of platforms.data ?? []) {
      if (!inScope(r)) continue;
      const p = (r.platform ?? "").toLowerCase();
      const row = ensure(r.date);
      const v = Number(r.revenue_ttc) || 0;
      if (p.includes("deliveroo")) row.deliveroo += v;
      else row.uber += v;
    }
    for (const r of cash.data ?? []) if (inScope(r)) ensure(r.date).cash += Number(r.revenue_ttc) || 0;
    for (const r of chataigne.data ?? []) if (inScope(r)) ensure(r.date).chataigne += Number(r.revenue_ttc) || 0;
    // La caisse Splash englobe les commandes Châtaigne (pas de tag distinct côté Splash) :
    // on soustrait Châtaigne du CA caisse pour isoler les ventes comptoir/bornes.
    for (const row of byDate.values()) row.cash = Math.max(0, row.cash - row.chataigne);

    const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    for (const r of rows) r.total = r.uber + r.deliveroo + r.cash + r.chataigne;
    return rows;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const daily = useMemo(() => buildDaily(null), [platforms.data, cash.data, chataigne.data]);
  const scopedDaily = useMemo(
    () => buildDaily(new Set(comparisonRestaurantIds)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platforms.data, cash.data, chataigne.data, comparisonRestaurantIds],
  );

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
    // Caisse Splash nette de Châtaigne (Splash ne tague pas les commandes Châtaigne)
    const chataigneByKey = new Map<string, number>();
    for (const r of chataigne.data ?? []) {
      const k = `${r.restaurant_id}|${r.date.slice(0, 10)}`;
      chataigneByKey.set(k, (chataigneByKey.get(k) ?? 0) + (Number(r.revenue_ttc) || 0));
    }
    for (const r of cash.data ?? []) {
      const k = `${r.restaurant_id}|${r.date.slice(0, 10)}`;
      const net = Math.max(0, (Number(r.revenue_ttc) || 0) - (chataigneByKey.get(k) ?? 0));
      add(r.restaurant_id, r.date, net);
    }
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

  const comparisons = useMemo<NetworkChannelComparisons>(() => {
    const scope = new Set(comparisonRestaurantIds);
    const sum = (rows: DailyRow[] | undefined, predicate?: (row: DailyRow) => boolean) => {
      const matching = (rows ?? []).filter(
        (row) => scope.has(row.restaurant_id) && (!predicate || predicate(row)),
      );
      return {
        hasData: matching.length > 0,
        total: matching.reduce((total, row) => total + (Number(row.revenue_ttc) || 0), 0),
      };
    };
    const isDeliveroo = (row: DailyRow) => (row.platform ?? "").toLowerCase().includes("deliveroo");
    const isUber = (row: DailyRow) => !isDeliveroo(row);
    const makeComparison = (
      currentRows: DailyRow[] | undefined,
      previousRows: DailyRow[] | undefined,
      predicate?: (row: DailyRow) => boolean,
    ): NetworkChannelComparison => {
      const current = sum(currentRows, predicate).total;
      const previousResult = sum(previousRows, predicate);
      const previous = previousResult.hasData ? previousResult.total : null;
      return {
        current,
        previous,
        variation: previous != null && previous > 0 ? ((current - previous) / previous) * 100 : null,
      };
    };

    // Caisse nette de Châtaigne : on soustrait les ventes Châtaigne jour par jour
    // (même restaurant + même date) avant de comparer N vs N-1.
    const netCashRows = (cashRows: DailyRow[] | undefined, chataigneRows: DailyRow[] | undefined) => {
      const byKey = new Map<string, number>();
      for (const r of chataigneRows ?? []) {
        const k = `${r.restaurant_id}|${r.date.slice(0, 10)}`;
        byKey.set(k, (byKey.get(k) ?? 0) + (Number(r.revenue_ttc) || 0));
      }
      return (cashRows ?? []).map((r) => {
        const k = `${r.restaurant_id}|${r.date.slice(0, 10)}`;
        return { ...r, revenue_ttc: Math.max(0, (Number(r.revenue_ttc) || 0) - (byKey.get(k) ?? 0)) };
      });
    };

    return {
      uber: makeComparison(platforms.data, previousPlatforms.data, isUber),
      deliveroo: makeComparison(platforms.data, previousPlatforms.data, isDeliveroo),
      cash: makeComparison(netCashRows(cash.data, chataigne.data), netCashRows(previousCash.data, previousChataigne.data)),
      chataigne: makeComparison(chataigne.data, previousChataigne.data),
    };
  }, [
    comparisonRestaurantIds,
    platforms.data,
    cash.data,
    chataigne.data,
    previousPlatforms.data,
    previousCash.data,
    previousChataigne.data,
  ]);

  const comparisonLoading =
    comparisonEnabled &&
    (previousPlatforms.isLoading || previousCash.isLoading || previousChataigne.isLoading);

  return { daily, scopedDaily, byRestaurant, comparisons, comparisonLoading, isLoading };
}
