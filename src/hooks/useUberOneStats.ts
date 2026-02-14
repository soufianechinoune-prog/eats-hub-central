import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface UberOneGlobalStats {
  uberOneCount: number;
  nonUberOneCount: number;
  totalOrders: number;
  uberOnePercent: number;
  nonUberOnePercent: number;
}

export interface UberOneEvolutionData {
  month: string;
  monthLabel: string;
  uberOnePercent: number;
  uberOneCount: number;
  nonUberOneCount: number;
  totalOrders: number;
}

export interface UberOneEvolutionByRestaurant {
  month: string;
  monthLabel: string;
  [restaurantId: string]: number | string | null;
}

// Minimum orders threshold for statistical significance
export const SIGNIFICANCE_THRESHOLD = 10;

export interface UberOneByRestaurant {
  restaurantId: string;
  restaurantName: string;
  uberOnePercent: number;
  uberOneCount: number;
  nonUberOneCount: number;
  totalOrders: number;
  isSignificant: boolean;
}

export interface UberOneComparison {
  metric: string;
  uberOneValue: number;
  nonUberOneValue: number;
  difference: number;
  differencePercent: number;
  unit: string;
}

export interface UseUberOneStatsParams {
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
  periodMode: string;
  platform: "uber_eats" | "deliveroo" | "global";
}

const monthLabels = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

export function useUberOneStats({
  restaurantIds,
  startDate,
  endDate,
  periodMode,
  platform,
}: UseUberOneStatsParams) {
  // Fetch pinned restaurants as fallback when no restaurants selected
  const { data: pinnedRestaurants } = useQuery({
    queryKey: ["pinned-restaurants-for-uber-one"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("is_active", true)
        .eq("is_pinned", true);
      return data?.map(r => r.id) || [];
    },
  });

  const effectiveRestaurantIds = useMemo(() => {
    if (restaurantIds.length > 0) return restaurantIds;
    return pinnedRestaurants || [];
  }, [restaurantIds, pinnedRestaurants]);

  const useDaily = ["month", "7d", "30d", "previous_week", "current_month", "range"].includes(periodMode);
  const platformFilter = platform !== "global" ? platform : null;

  // Fetch aggregated data via RPC
  const { data: rpcData, isLoading } = useQuery({
    queryKey: ["uber-one-stats-rpc", effectiveRestaurantIds, startDate.toISOString(), endDate.toISOString(), platformFilter, useDaily ? "daily" : "monthly"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_uber_one_stats", {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_restaurant_ids: effectiveRestaurantIds,
        p_platform: platformFilter,
        p_granularity: useDaily ? "daily" : "monthly",
      });
      if (error) {
        console.error("Error fetching uber one stats:", error);
        return [];
      }
      return data || [];
    },
    enabled: effectiveRestaurantIds.length > 0,
  });

  // Fetch restaurant names
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-for-uber-one"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("is_active", true);
      return data || [];
    },
  });

  const restaurantMap = useMemo(() => {
    const map: Record<string, string> = {};
    restaurants?.forEach((r) => {
      map[r.id] = r.name;
    });
    return map;
  }, [restaurants]);

  // Calculate global stats from RPC data
  const globalStats = useMemo<UberOneGlobalStats | null>(() => {
    if (!rpcData || rpcData.length === 0) return null;

    let uberOneCount = 0;
    let nonUberOneCount = 0;

    rpcData.forEach((row: any) => {
      uberOneCount += Number(row.uber_one_count) || 0;
      nonUberOneCount += Number(row.non_uber_one_count) || 0;
    });

    const totalOrders = uberOneCount + nonUberOneCount;
    return {
      uberOneCount,
      nonUberOneCount,
      totalOrders,
      uberOnePercent: totalOrders > 0 ? (uberOneCount / totalOrders) * 100 : 0,
      nonUberOnePercent: totalOrders > 0 ? (nonUberOneCount / totalOrders) * 100 : 0,
    };
  }, [rpcData]);

  // Calculate evolution (aggregate across restaurants per period)
  const evolution = useMemo<UberOneEvolutionData[]>(() => {
    if (!rpcData || rpcData.length === 0) return [];

    const periodMap: Record<string, { uberOne: number; nonUberOne: number }> = {};

    rpcData.forEach((row: any) => {
      const key = row.period_key;
      if (!periodMap[key]) periodMap[key] = { uberOne: 0, nonUberOne: 0 };
      periodMap[key].uberOne += Number(row.uber_one_count) || 0;
      periodMap[key].nonUberOne += Number(row.non_uber_one_count) || 0;
    });

    return Object.entries(periodMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        let label: string;
        if (useDaily) {
          const d = new Date(key + "T12:00:00");
          label = `${d.getDate()} ${monthLabels[d.getMonth()].toLowerCase()}`;
        } else {
          const [year, monthNum] = key.split("-");
          label = `${monthLabels[parseInt(monthNum) - 1]} ${year.slice(2)}`;
        }

        const total = data.uberOne + data.nonUberOne;
        return {
          month: key,
          monthLabel: label,
          uberOnePercent: total > 0 ? (data.uberOne / total) * 100 : 0,
          uberOneCount: data.uberOne,
          nonUberOneCount: data.nonUberOne,
          totalOrders: total,
        };
      });
  }, [rpcData, useDaily]);

  // Calculate evolution by restaurant
  const evolutionByRestaurant = useMemo<UberOneEvolutionByRestaurant[]>(() => {
    if (!rpcData || rpcData.length === 0) return [];

    const uniqueRestaurantIds = [...new Set(rpcData.map((r: any) => r.restaurant_id))];
    const periodRestaurantMap: Record<string, Record<string, { uberOne: number; total: number }>> = {};

    rpcData.forEach((row: any) => {
      const key = row.period_key;
      const rid = row.restaurant_id;
      if (!periodRestaurantMap[key]) periodRestaurantMap[key] = {};
      periodRestaurantMap[key][rid] = {
        uberOne: Number(row.uber_one_count) || 0,
        total: (Number(row.uber_one_count) || 0) + (Number(row.non_uber_one_count) || 0),
      };
    });

    return Object.entries(periodRestaurantMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, restaurantData]) => {
        let label: string;
        if (useDaily) {
          const d = new Date(key + "T12:00:00");
          label = `${d.getDate()} ${monthLabels[d.getMonth()].toLowerCase()}`;
        } else {
          const [year, monthNum] = key.split("-");
          label = `${monthLabels[parseInt(monthNum) - 1]} ${year.slice(2)}`;
        }

        const result: UberOneEvolutionByRestaurant = { month: key, monthLabel: label };
        uniqueRestaurantIds.forEach((rid: string) => {
          const data = restaurantData[rid];
          result[rid] = data && data.total > 0 ? (data.uberOne / data.total) * 100 : null;
        });

        return result;
      });
  }, [rpcData, useDaily]);

  // Stats by restaurant
  const byRestaurant = useMemo<UberOneByRestaurant[]>(() => {
    if (!rpcData || rpcData.length === 0) return [];

    const restaurantStats: Record<string, { uberOne: number; nonUberOne: number }> = {};

    rpcData.forEach((row: any) => {
      const rid = row.restaurant_id;
      if (!restaurantStats[rid]) restaurantStats[rid] = { uberOne: 0, nonUberOne: 0 };
      restaurantStats[rid].uberOne += Number(row.uber_one_count) || 0;
      restaurantStats[rid].nonUberOne += Number(row.non_uber_one_count) || 0;
    });

    return Object.entries(restaurantStats)
      .map(([restaurantId, data]) => {
        const total = data.uberOne + data.nonUberOne;
        return {
          restaurantId,
          restaurantName: restaurantMap[restaurantId] || "Inconnu",
          uberOnePercent: total > 0 ? (data.uberOne / total) * 100 : 0,
          uberOneCount: data.uberOne,
          nonUberOneCount: data.nonUberOne,
          totalOrders: total,
          isSignificant: total >= SIGNIFICANCE_THRESHOLD,
        };
      })
      .sort((a, b) => b.uberOnePercent - a.uberOnePercent);
  }, [rpcData, restaurantMap]);

  // Comparison metrics
  const comparison = useMemo<UberOneComparison[]>(() => {
    if (!rpcData || rpcData.length === 0) return [];

    let uberOneRevenue = 0, nonUberOneRevenue = 0;
    let uberOneCount = 0, nonUberOneCount = 0;

    rpcData.forEach((row: any) => {
      uberOneRevenue += Number(row.uber_one_revenue) || 0;
      nonUberOneRevenue += Number(row.non_uber_one_revenue) || 0;
      uberOneCount += Number(row.uber_one_count) || 0;
      nonUberOneCount += Number(row.non_uber_one_count) || 0;
    });

    const uberOneBasket = uberOneCount > 0 ? uberOneRevenue / uberOneCount : 0;
    const nonUberOneBasket = nonUberOneCount > 0 ? nonUberOneRevenue / nonUberOneCount : 0;
    const basketDiff = uberOneBasket - nonUberOneBasket;
    const basketDiffPercent = nonUberOneBasket > 0 ? (basketDiff / nonUberOneBasket) * 100 : 0;

    const volumeDiff = uberOneCount - nonUberOneCount;
    const volumeDiffPercent = nonUberOneCount > 0 ? (volumeDiff / nonUberOneCount) * 100 : 0;

    return [
      {
        metric: "Panier moyen",
        uberOneValue: uberOneBasket,
        nonUberOneValue: nonUberOneBasket,
        difference: basketDiff,
        differencePercent: basketDiffPercent,
        unit: "€",
      },
      {
        metric: "Volume",
        uberOneValue: uberOneCount,
        nonUberOneValue: nonUberOneCount,
        difference: volumeDiff,
        differencePercent: volumeDiffPercent,
        unit: "",
      },
    ];
  }, [rpcData]);

  return {
    globalStats,
    evolution,
    evolutionByRestaurant,
    byRestaurant,
    comparison,
    isLoading,
    restaurantMap,
    effectiveRestaurantIds,
  };
}
