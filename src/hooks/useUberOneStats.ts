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
  [restaurantId: string]: number | string | null; // restaurantId -> uberOnePercent (null if no data)
}

export interface UberOneByRestaurant {
  restaurantId: string;
  restaurantName: string;
  uberOnePercent: number;
  uberOneCount: number;
  nonUberOneCount: number;
  totalOrders: number;
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

// Formater une date en YYYY-MM-DD selon le fuseau Europe/Paris
const formatDateParis = (date: Date): string => {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

// Formater une date en YYYY-MM selon le fuseau Europe/Paris
const formatMonthParis = (date: Date): string => {
  const formatted = formatDateParis(date);
  return formatted.slice(0, 7); // YYYY-MM
};

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

  // Use pinned restaurants as fallback when no selection
  const effectiveRestaurantIds = useMemo(() => {
    if (restaurantIds.length > 0) return restaurantIds;
    return pinnedRestaurants || [];
  }, [restaurantIds, pinnedRestaurants]);

  // Fetch all order_history data with uber_one info
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["uber-one-stats", effectiveRestaurantIds, startDate.toISOString(), endDate.toISOString(), platform],
    queryFn: async () => {
      if (effectiveRestaurantIds.length === 0) return [];

      // Fetch in batches to handle 1000 row limit
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("order_history")
          .select(
            "restaurant_id, order_datetime, uber_one, order_amount, initial_prep_time_minutes, platform"
          )
          .in("restaurant_id", effectiveRestaurantIds)
          .gte("order_datetime", startDate.toISOString())
          .lte("order_datetime", endDate.toISOString())
          .order("order_datetime", { ascending: true })
          .range(from, from + batchSize - 1);

        // Apply platform filter if not global
        if (platform !== "global") {
          query = query.eq("platform", platform);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching uber one stats:", error);
          break;
        }

        if (data && data.length > 0) {
          allData.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
    enabled: effectiveRestaurantIds.length > 0,
  });

  // Fetch restaurant names for mapping
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

  // Calculate global stats
  const globalStats = useMemo<UberOneGlobalStats | null>(() => {
    if (!rawData || rawData.length === 0) return null;

    const uberOneCount = rawData.filter((d) => d.uber_one === true).length;
    const nonUberOneCount = rawData.filter((d) => d.uber_one === false).length;
    const totalOrders = rawData.length;

    return {
      uberOneCount,
      nonUberOneCount,
      totalOrders,
      uberOnePercent: totalOrders > 0 ? (uberOneCount / totalOrders) * 100 : 0,
      nonUberOnePercent: totalOrders > 0 ? (nonUberOneCount / totalOrders) * 100 : 0,
    };
  }, [rawData]);

  // Calculate evolution with adaptive granularity
  const monthLabels = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
  ];

  // Use daily granularity for short periods, monthly for year view
  const useDaily = ["month", "7d", "30d", "previous_week", "current_month", "range"].includes(periodMode);

  const evolution = useMemo<UberOneEvolutionData[]>(() => {
    if (!rawData || rawData.length === 0) return [];

    const dataMap: Record<string, { uberOne: number; nonUberOne: number }> = {};

    rawData.forEach((order) => {
      const date = new Date(order.order_datetime);
      const key = useDaily 
        ? formatDateParis(date)  // YYYY-MM-DD en heure Paris
        : formatMonthParis(date);  // YYYY-MM en heure Paris

      if (!dataMap[key]) {
        dataMap[key] = { uberOne: 0, nonUberOne: 0 };
      }

      if (order.uber_one === true) {
        dataMap[key].uberOne++;
      } else {
        dataMap[key].nonUberOne++;
      }
    });

    return Object.entries(dataMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        let label: string;
        if (useDaily) {
          // Ajouter T12:00:00 pour éviter les décalages de timezone lors du parsing
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
  }, [rawData, useDaily]);

  // Calculate evolution by restaurant with adaptive granularity
  const evolutionByRestaurant = useMemo<UberOneEvolutionByRestaurant[]>(() => {
    if (!rawData || rawData.length === 0) return [];

    // Get all unique restaurant IDs in the data
    const uniqueRestaurantIds = [...new Set(rawData.map(o => o.restaurant_id))];

    // Map: key (date or month) -> restaurantId -> { uberOne, total }
    const dataRestaurantMap: Record<string, Record<string, { uberOne: number; total: number }>> = {};

    rawData.forEach((order) => {
      const date = new Date(order.order_datetime);
      const key = useDaily 
        ? formatDateParis(date)  // YYYY-MM-DD en heure Paris
        : formatMonthParis(date);  // YYYY-MM en heure Paris
      const rid = order.restaurant_id;

      if (!dataRestaurantMap[key]) {
        dataRestaurantMap[key] = {};
      }
      if (!dataRestaurantMap[key][rid]) {
        dataRestaurantMap[key][rid] = { uberOne: 0, total: 0 };
      }

      dataRestaurantMap[key][rid].total++;
      if (order.uber_one === true) {
        dataRestaurantMap[key][rid].uberOne++;
      }
    });

    return Object.entries(dataRestaurantMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, restaurantData]) => {
        let label: string;
        if (useDaily) {
          // Ajouter T12:00:00 pour éviter les décalages de timezone lors du parsing
          const d = new Date(key + "T12:00:00");
          label = `${d.getDate()} ${monthLabels[d.getMonth()].toLowerCase()}`;
        } else {
          const [year, monthNum] = key.split("-");
          label = `${monthLabels[parseInt(monthNum) - 1]} ${year.slice(2)}`;
        }

        const result: UberOneEvolutionByRestaurant = {
          month: key,
          monthLabel: label,
        };

        // Normalize: include ALL restaurant IDs for each period (null if no data)
        uniqueRestaurantIds.forEach((rid) => {
          const data = restaurantData[rid];
          result[rid] = data && data.total > 0 ? (data.uberOne / data.total) * 100 : null;
        });

        return result;
      });
  }, [rawData, useDaily]);

  // Calculate stats by restaurant
  const byRestaurant = useMemo<UberOneByRestaurant[]>(() => {
    if (!rawData || rawData.length === 0) return [];

    const restaurantStats: Record<string, { uberOne: number; nonUberOne: number }> = {};

    rawData.forEach((order) => {
      const rid = order.restaurant_id;
      if (!restaurantStats[rid]) {
        restaurantStats[rid] = { uberOne: 0, nonUberOne: 0 };
      }

      if (order.uber_one === true) {
        restaurantStats[rid].uberOne++;
      } else {
        restaurantStats[rid].nonUberOne++;
      }
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
        };
      })
      .sort((a, b) => b.uberOnePercent - a.uberOnePercent);
  }, [rawData, restaurantMap]);

  // Calculate comparison metrics (basket, prep time, volume)
  const comparison = useMemo<UberOneComparison[]>(() => {
    if (!rawData || rawData.length === 0) return [];

    const uberOneOrders = rawData.filter((d) => d.uber_one === true);
    const nonUberOneOrders = rawData.filter((d) => d.uber_one === false);

    const calcAvg = (orders: any[], field: string) => {
      const validOrders = orders.filter((o) => o[field] !== null && o[field] !== undefined);
      if (validOrders.length === 0) return 0;
      return validOrders.reduce((sum, o) => sum + (o[field] || 0), 0) / validOrders.length;
    };

    const uberOneBasket = calcAvg(uberOneOrders, "order_amount");
    const nonUberOneBasket = calcAvg(nonUberOneOrders, "order_amount");
    const basketDiff = uberOneBasket - nonUberOneBasket;
    const basketDiffPercent = nonUberOneBasket > 0 ? (basketDiff / nonUberOneBasket) * 100 : 0;

    const uberOnePrepTime = calcAvg(uberOneOrders, "initial_prep_time_minutes");
    const nonUberOnePrepTime = calcAvg(nonUberOneOrders, "initial_prep_time_minutes");
    const prepDiff = uberOnePrepTime - nonUberOnePrepTime;
    const prepDiffPercent = nonUberOnePrepTime > 0 ? (prepDiff / nonUberOnePrepTime) * 100 : 0;

    const volumeDiff = uberOneOrders.length - nonUberOneOrders.length;
    const volumeDiffPercent = nonUberOneOrders.length > 0 ? (volumeDiff / nonUberOneOrders.length) * 100 : 0;

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
        uberOneValue: uberOneOrders.length,
        nonUberOneValue: nonUberOneOrders.length,
        difference: volumeDiff,
        differencePercent: volumeDiffPercent,
        unit: "",
      },
    ];
  }, [rawData]);

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
