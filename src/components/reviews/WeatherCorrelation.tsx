import { useMemo, useEffect } from "react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Cloud, Droplets, Thermometer, RefreshCw } from "lucide-react";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useWeatherData, useSyncWeatherData, getWeatherEmoji, weatherCodeLabels } from "@/hooks/useWeatherData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CorrelationKPI } from "./CorrelationKPI";
import { WeatherOverlayChart } from "./WeatherOverlayChart";
import { CorrelationScatterPlot } from "./CorrelationScatterPlot";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface WeatherCorrelationProps {
  startDate: Date;
  endDate: Date;
}

export function WeatherCorrelation({ startDate, endDate }: WeatherCorrelationProps) {
  const { selectedRestaurants, selectedPlatform } = useAnalyticsContext();
  const syncWeather = useSyncWeatherData();

  const restaurantIds = selectedRestaurants.length > 0 ? selectedRestaurants : [];

  // Fetch weather data
  const { data: weatherData, isLoading: isLoadingWeather, refetch: refetchWeather } = useWeatherData(
    restaurantIds,
    startDate,
    endDate,
    restaurantIds.length > 0
  );

  // Fetch sales data
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ["sales-for-weather-correlation", restaurantIds, selectedPlatform, startDate, endDate],
    queryFn: async () => {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      let query = supabase
        .from("daily_sales_uber")
        .select("date, revenue_ttc, order_count, restaurant_id, platform")
        .gte("date", startStr)
        .lte("date", endStr);

      if (restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch restaurants for sync
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-for-weather", restaurantIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, latitude, longitude")
        .in("id", restaurantIds);
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Auto-sync weather data if missing
  const handleSyncWeather = async () => {
    if (!restaurants || restaurants.length === 0) return;

    toast.info("Synchronisation des données météo...");

    try {
      for (const restaurant of restaurants) {
        await syncWeather.mutateAsync({
          restaurantId: restaurant.id,
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
        });
      }
      toast.success("Données météo synchronisées");
      refetchWeather();
    } catch (error) {
      toast.error("Erreur lors de la synchronisation");
      console.error(error);
    }
  };

  // Combine weather and sales data
  const correlationData = useMemo(() => {
    if (!weatherData || !salesData) return [];

    // Aggregate weather by date (average across restaurants)
    const weatherByDate = new Map<string, { tempAvg: number; precipitation: number; weatherCode: number; count: number }>();
    weatherData.forEach((w) => {
      const current = weatherByDate.get(w.date) || { tempAvg: 0, precipitation: 0, weatherCode: 0, count: 0 };
      weatherByDate.set(w.date, {
        tempAvg: current.tempAvg + (w.temperature_avg || 0),
        precipitation: current.precipitation + (w.precipitation_mm || 0),
        weatherCode: w.weather_code || current.weatherCode,
        count: current.count + 1,
      });
    });

    // Aggregate sales by date
    const salesByDate = new Map<string, { revenue: number; orders: number }>();
    salesData.forEach((s) => {
      const current = salesByDate.get(s.date) || { revenue: 0, orders: 0 };
      salesByDate.set(s.date, {
        revenue: current.revenue + (s.revenue_ttc || 0),
        orders: current.orders + (s.order_count || 0),
      });
    });

    // Combine
    const combined: {
      date: string;
      temperature: number;
      precipitation: number;
      weatherCode: number;
      revenue: number;
      orders: number;
    }[] = [];

    weatherByDate.forEach((weather, date) => {
      const sales = salesByDate.get(date);
      if (sales) {
        combined.push({
          date,
          temperature: weather.count > 0 ? weather.tempAvg / weather.count : 0,
          precipitation: weather.precipitation / (weather.count || 1),
          weatherCode: weather.weatherCode,
          revenue: sales.revenue,
          orders: sales.orders,
        });
      }
    });

    return combined.sort((a, b) => a.date.localeCompare(b.date));
  }, [weatherData, salesData]);

  // Data for scatter plots
  const temperatures = correlationData.map((d) => d.temperature);
  const precipitations = correlationData.map((d) => d.precipitation);
  const revenues = correlationData.map((d) => d.revenue);
  const orders = correlationData.map((d) => d.orders);

  const scatterTempRevenueData = correlationData.map((d) => ({
    avgRating: d.temperature,
    value: d.revenue,
    date: format(new Date(d.date), "d MMM yyyy", { locale: fr }),
  }));

  const scatterPrecipOrdersData = correlationData.map((d) => ({
    avgRating: d.precipitation,
    value: d.orders,
    date: format(new Date(d.date), "d MMM yyyy", { locale: fr }),
  }));

  // Weather stats
  const weatherStats = useMemo(() => {
    if (correlationData.length === 0) return null;

    const avgTemp = correlationData.reduce((sum, d) => sum + d.temperature, 0) / correlationData.length;
    const totalPrecip = correlationData.reduce((sum, d) => sum + d.precipitation, 0);
    const rainyDays = correlationData.filter((d) => d.precipitation > 1).length;

    // Group by temperature ranges
    const coldDays = correlationData.filter((d) => d.temperature < 10);
    const mildDays = correlationData.filter((d) => d.temperature >= 10 && d.temperature < 20);
    const warmDays = correlationData.filter((d) => d.temperature >= 20);

    const avgRevenueByTemp = {
      cold: coldDays.length > 0 ? coldDays.reduce((s, d) => s + d.revenue, 0) / coldDays.length : 0,
      mild: mildDays.length > 0 ? mildDays.reduce((s, d) => s + d.revenue, 0) / mildDays.length : 0,
      warm: warmDays.length > 0 ? warmDays.reduce((s, d) => s + d.revenue, 0) / warmDays.length : 0,
    };

    return { avgTemp, totalPrecip, rainyDays, avgRevenueByTemp, coldDays: coldDays.length, mildDays: mildDays.length, warmDays: warmDays.length };
  }, [correlationData]);

  const isLoading = isLoadingWeather || isLoadingSales;

  if (restaurantIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-muted-foreground">Sélectionnez au moins un restaurant</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground text-sm">Chargement des données météo...</p>
        </div>
      </div>
    );
  }

  if (!weatherData || weatherData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] gap-4">
        <Cloud className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Aucune donnée météo disponible</p>
        <Button onClick={handleSyncWeather} disabled={syncWeather.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncWeather.isPending ? "animate-spin" : ""}`} />
          Synchroniser les données météo
        </Button>
      </div>
    );
  }

  if (correlationData.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] gap-4">
        <p className="text-muted-foreground">Pas assez de données pour la corrélation (min. 3 jours)</p>
        <Button onClick={handleSyncWeather} disabled={syncWeather.isPending} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncWeather.isPending ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weather Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {weatherStats && (
            <>
              <Badge variant="secondary" className="gap-1">
                <Thermometer className="h-3 w-3" />
                Moy. {weatherStats.avgTemp.toFixed(1)}°C
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Droplets className="h-3 w-3" />
                {weatherStats.rainyDays} jours de pluie
              </Badge>
            </>
          )}
        </div>
        <Button onClick={handleSyncWeather} disabled={syncWeather.isPending} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncWeather.isPending ? "animate-spin" : ""}`} />
          Actualiser météo
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CorrelationKPI ratings={temperatures} values={revenues} label="CA" xLabel="Température (°C)" />
        <CorrelationKPI ratings={precipitations} values={orders} label="Commandes" xLabel="Précipitations (mm)" />
      </div>

      {/* Combined Chart */}
      <WeatherOverlayChart data={correlationData} />

      {/* Temperature breakdown */}
      {weatherStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              CA moyen par tranche de température
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="text-2xl mb-1">❄️</div>
                <div className="text-xs text-muted-foreground mb-1">&lt; 10°C ({weatherStats.coldDays} jours)</div>
                <div className="font-semibold">{weatherStats.avgRevenueByTemp.cold.toFixed(0)}€</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="text-2xl mb-1">🌤️</div>
                <div className="text-xs text-muted-foreground mb-1">10-20°C ({weatherStats.mildDays} jours)</div>
                <div className="font-semibold">{weatherStats.avgRevenueByTemp.mild.toFixed(0)}€</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <div className="text-2xl mb-1">☀️</div>
                <div className="text-xs text-muted-foreground mb-1">&gt; 20°C ({weatherStats.warmDays} jours)</div>
                <div className="font-semibold">{weatherStats.avgRevenueByTemp.warm.toFixed(0)}€</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scatter Plots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CorrelationScatterPlot
          data={scatterTempRevenueData}
          valueLabel="CA (€)"
          valueFormatter={(v) => `${(v / 1000).toFixed(1)}k€`}
        />
        <CorrelationScatterPlot
          data={scatterPrecipOrdersData}
          valueLabel="Commandes"
          valueFormatter={(v) => v.toString()}
        />
      </div>
    </div>
  );
}
