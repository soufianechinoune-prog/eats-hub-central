import { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import {
  useLiveUber,
  useLiveDishop,
  useLiveSplash,
  useLiveTopRestaurants,
  todayParisISO,
} from "@/hooks/useLiveOverview";
import { LiveKpiCard } from "@/components/live/LiveKpiCard";
import { LiveHourlyChart } from "@/components/live/LiveHourlyChart";
import { LiveTopRestaurants } from "@/components/live/LiveTopRestaurants";

function eur(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Live() {
  const { data: restaurants = [] } = useActiveRestaurants();
  const restaurantIds = useMemo(() => restaurants.map((r) => r.id), [restaurants]);

  const day = todayParisISO();
  const uber = useLiveUber(restaurantIds, day);
  const dishop = useLiveDishop(restaurantIds, day);
  const splash = useLiveSplash(restaurantIds, day);
  const top = useLiveTopRestaurants(restaurantIds, day, 10);

  // Horloge live affichée dans le header
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const totalRevenue =
    (uber.data?.revenue ?? 0) +
    (dishop.data?.revenue ?? 0) +
    (splash.data?.revenue ?? 0);
  const totalOrders =
    (uber.data?.orders ?? 0) +
    (dishop.data?.orders ?? 0) +
    (splash.data?.orders ?? 0);
  const totalYesterday =
    (uber.data?.yesterday_revenue ?? 0) +
    (dishop.data?.yesterday_revenue ?? 0) +
    (splash.data?.yesterday_revenue ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio className="h-6 w-6 text-emerald-500" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Pilotage Live</h1>
            <p className="text-xs text-muted-foreground">
              {now.toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              · {restaurantIds.length} restaurants
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Auto-refresh 30s
        </Badge>
      </div>

      {/* KPI Total */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LiveKpiCard
          title="TOTAL JOUR"
          revenue={totalRevenue}
          orders={totalOrders}
          yesterdayRevenue={totalYesterday}
          freshness="near-live"
          freshnessLabel="Consolidé"
          lastEventAt={uber.data?.last_event_at ?? null}
          isLoading={uber.isLoading || dishop.isLoading || splash.isLoading}
          accentClassName="bg-foreground"
        />
        <LiveKpiCard
          title="UBER EATS"
          revenue={uber.data?.revenue ?? 0}
          orders={uber.data?.orders ?? 0}
          yesterdayRevenue={uber.data?.yesterday_revenue ?? 0}
          freshness="live"
          freshnessLabel="Live"
          lastEventAt={uber.data?.last_event_at ?? null}
          isLoading={uber.isLoading}
          accentClassName="bg-black dark:bg-white"
        />
        <LiveKpiCard
          title="DISHOP"
          revenue={dishop.data?.revenue ?? 0}
          orders={dishop.data?.orders ?? 0}
          yesterdayRevenue={dishop.data?.yesterday_revenue ?? 0}
          freshness="near-live"
          freshnessLabel="~15 min"
          lastEventAt={dishop.data?.last_event_at ?? null}
          isLoading={dishop.isLoading}
          accentClassName="bg-emerald-500"
        />
        <LiveKpiCard
          title="CAISSE"
          revenue={splash.data?.revenue ?? 0}
          orders={splash.data?.orders ?? 0}
          yesterdayRevenue={splash.data?.yesterday_revenue ?? 0}
          freshness="near-live"
          freshnessLabel="~30 min"
          lastEventAt={splash.data?.last_event_at ?? null}
          isLoading={splash.isLoading}
          accentClassName="bg-amber-500"
        />
      </div>

      {/* Graphique horaire */}
      <LiveHourlyChart
        uberHourly={uber.data?.hourly ?? []}
        dishopHourly={dishop.data?.hourly ?? []}
      />

      {/* Top restaurants */}
      <LiveTopRestaurants rows={top.data ?? []} isLoading={top.isLoading} />

      <p className="text-[11px] text-muted-foreground text-center">
        Total cumulé live : {eur(totalRevenue)} · {totalOrders.toLocaleString("fr-FR")} commandes
      </p>
    </div>
  );
}
