import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export interface WeatherData {
  id: string;
  restaurant_id: string;
  date: string;
  temperature_max: number | null;
  temperature_min: number | null;
  temperature_avg: number | null;
  precipitation_mm: number | null;
  weather_code: number | null;
}

// Weather code descriptions (WMO codes)
export const weatherCodeLabels: Record<number, string> = {
  0: "Ciel dégagé",
  1: "Peu nuageux",
  2: "Partiellement nuageux",
  3: "Nuageux",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  53: "Bruine modérée",
  55: "Bruine dense",
  61: "Pluie légère",
  63: "Pluie modérée",
  65: "Pluie forte",
  71: "Neige légère",
  73: "Neige modérée",
  75: "Neige forte",
  80: "Averses légères",
  81: "Averses modérées",
  82: "Averses violentes",
  95: "Orage",
  96: "Orage avec grêle légère",
  99: "Orage avec grêle forte",
};

export const getWeatherEmoji = (code: number | null): string => {
  if (code === null) return "❓";
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 55) return "🌧️";
  if (code <= 65) return "🌧️";
  if (code <= 75) return "❄️";
  if (code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "❓";
};

export function useWeatherData(
  restaurantIds: string[],
  startDate: Date,
  endDate: Date,
  enabled = true
) {
  return useQuery({
    queryKey: ["weather-data", restaurantIds, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!restaurantIds.length) return [];

      const { data, error } = await supabase
        .from("weather_data")
        .select("*")
        .in("restaurant_id", restaurantIds)
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"))
        .order("date", { ascending: true });

      if (error) throw error;
      return data as WeatherData[];
    },
    enabled: enabled && restaurantIds.length > 0,
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });
}

export function useSyncWeatherData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      restaurantId,
      startDate,
      endDate,
    }: {
      restaurantId: string;
      startDate: string;
      endDate: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("fetch-weather-data", {
        body: {
          restaurant_id: restaurantId,
          start_date: startDate,
          end_date: endDate,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-data"] });
    },
  });
}

// Check if weather data needs syncing for a restaurant
export function useWeatherDataStatus(
  restaurantId: string,
  startDate: Date,
  endDate: Date,
  enabled = true
) {
  return useQuery({
    queryKey: ["weather-data-status", restaurantId, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("weather_data")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      // Calculate expected days
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const coverage = count ? (count / daysDiff) * 100 : 0;

      return {
        existingDays: count || 0,
        expectedDays: daysDiff,
        coverage,
        needsSync: coverage < 90, // Sync if less than 90% coverage
      };
    },
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
