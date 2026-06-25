import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LiveChannelStats {
  revenue: number;
  orders: number;
  yesterday_revenue: number;
  yesterday_orders: number;
  hourly: Array<{ hour: number; revenue: number; orders: number }>;
  last_event_at: string | null;
}

export interface LiveTopRestaurant {
  restaurant_id: string;
  name: string;
  uber_revenue: number;
  dishop_revenue: number;
  splash_revenue: number;
  total_orders: number;
  total_revenue: number;
}

function todayParisISO(): string {
  // YYYY-MM-DD en heure de Paris
  const fmt = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // fr-CA renvoie YYYY-MM-DD
}

const EMPTY: LiveChannelStats = {
  revenue: 0,
  orders: 0,
  yesterday_revenue: 0,
  yesterday_orders: 0,
  hourly: [],
  last_event_at: null,
};

export function useLiveUber(restaurantIds: string[], day?: string) {
  const p_day = day ?? todayParisISO();
  return useQuery({
    queryKey: ["live-uber", p_day, restaurantIds.slice().sort()],
    enabled: restaurantIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async (): Promise<LiveChannelStats> => {
      const { data, error } = await supabase.rpc("get_live_uber_today", {
        p_restaurant_ids: restaurantIds,
        p_day,
      });
      if (error) throw error;
      return (data as unknown as LiveChannelStats) ?? EMPTY;
    },
  });
}

export function useLiveDishop(restaurantIds: string[], day?: string) {
  const p_day = day ?? todayParisISO();
  return useQuery({
    queryKey: ["live-dishop", p_day, restaurantIds.slice().sort()],
    enabled: restaurantIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async (): Promise<LiveChannelStats> => {
      const { data, error } = await supabase.rpc("get_live_dishop_today", {
        p_restaurant_ids: restaurantIds,
        p_day,
      });
      if (error) throw error;
      return (data as unknown as LiveChannelStats) ?? EMPTY;
    },
  });
}

export function useLiveSplash(restaurantIds: string[], day?: string) {
  const p_day = day ?? todayParisISO();
  return useQuery({
    queryKey: ["live-splash", p_day, restaurantIds.slice().sort()],
    enabled: restaurantIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async (): Promise<LiveChannelStats> => {
      const { data, error } = await supabase.rpc("get_live_splash_today", {
        p_restaurant_ids: restaurantIds,
        p_day,
      });
      if (error) throw error;
      return (data as unknown as LiveChannelStats) ?? EMPTY;
    },
  });
}

export function useLiveTopRestaurants(
  restaurantIds: string[],
  day?: string,
  limit = 10,
) {
  const p_day = day ?? todayParisISO();
  return useQuery({
    queryKey: ["live-top", p_day, limit, restaurantIds.slice().sort()],
    enabled: restaurantIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<LiveTopRestaurant[]> => {
      const { data, error } = await supabase.rpc("get_live_top_restaurants", {
        p_restaurant_ids: restaurantIds,
        p_day,
        p_limit: limit,
      });
      if (error) throw error;
      return (data as unknown as LiveTopRestaurant[]) ?? [];
    },
  });
}

export { todayParisISO };
