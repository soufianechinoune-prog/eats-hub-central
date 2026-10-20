import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, startOfYear, subDays } from "date-fns";
import { ArrowLeft, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PERF_CHANNELS, useRestaurantPerformance, type PerfChannel } from "@/hooks/useRestaurantPerformance";
import { defaultGranularity, type Granularity } from "@/lib/performanceBuckets";
import { PerformanceKpiRow } from "@/components/restaurant-performance/PerformanceKpiRow";
import { ChannelRevenueEvolution } from "@/components/restaurant-performance/ChannelRevenueEvolution";
import { ChannelMixBar } from "@/components/restaurant-performance/ChannelMixBar";
import { ChannelBreakdownTable } from "@/components/restaurant-performance/ChannelBreakdownTable";
import { CHANNEL_META } from "@/components/restaurant-performance/channelMeta";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const MIN_DATE = "2024-01-01";

export default function RestaurantPerformance() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const ctx = useAnalyticsContext();
  const today = iso(new Date());
  const yesterday = iso(subDays(new Date(), 1));

  const clamp = (s: string, e: string) => {
    const end = e > today ? today : e;
    const start = s < MIN_DATE ? MIN_DATE : s > end ? end : s;
    return { start, end };
  };
  const { start, end } = clamp(params.get("from") || iso(subDays(new Date(), 30)), params.get("to") || yesterday);

  const setPeriod = (s: string, e: string) => {
    const c = clamp(s, e);
    const next = new URLSearchParams(params);
    next.set("from", c.start);
    next.set("to", c.end);
    setParams(next, { replace: true });
  };

  const [granularity, setGranularity] = useState<Granularity>(() => defaultGranularity(start, end));
  useEffect(() => setGranularity(defaultGranularity(start, end)), [start, end]);

  const { data: resto } = useQuery({
    queryKey: ["resto-perf-info", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("id, name, city, chain_id").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const chainId = resto?.chain_id ?? ctx.selectedChainId;
  const { kpis, daily, monthly } = useRestaurantPerformance(chainId, id, start, end, granularity);

  const byChannel = useMemo(
    () =>
      PERF_CHANNELS.map((c) => {
        const r = kpis.data?.find((k) => k.canal === c);
        return { canal: c, ca: r?.ca ?? 0, commandes: r?.commandes ?? 0, rentabilite: r?.rentabilite_pct ?? null };
      }),
    [kpis.data],
  );
  const total = kpis.data?.find((k) => k.canal === "total");
  const totalCa = total?.ca ?? 0;
  const totalOrders = total?.commandes ?? 0;
  const uberRent = byChannel.find((c) => c.canal === "uber_eats")?.rentabilite ?? null;
  const activeChannels = byChannel.filter((c) => c.ca > 0 || c.commandes > 0);

  const chartRows = useMemo(() => {
    if (granularity === "month")
      return (monthly.data ?? [])
        .filter((r) => (PERF_CHANNELS as readonly string[]).includes(r.canal))
        .map((r) => ({ key: r.mois.length === 7 ? `${r.mois}-01` : r.mois, canal: r.canal, ca: r.ca }));
    return (daily.data ?? [])
      .filter((r) => (PERF_CHANNELS as readonly string[]).includes(r.canal))
      .map((r) => ({ key: r.day, canal: r.canal, ca: r.ca }));
  }, [granularity, daily.data, monthly.data]);

  const goBack = () => {
    const ret = params.get("return");
    if (window.history.length > 1 && ret) navigate(-1);
    else navigate(ret || "/overview");
  };

  const openChannel = (c: PerfChannel) => {
    if (!id) return;
    ctx.setVisibleRestaurants([id]);
    ctx.setSelectedRestaurants([id]);
    if (c === "uber_eats") ctx.setSelectedPlatform("uber_eats");
    const dest: Record<PerfChannel, string> = {
      caisse: "/overview?channel=cash",
      uber_eats: "/analytics/finances",
      deliveroo: "/overview?channel=deliveroo",
      chataigne: "/chataigne?tab=overview",
    };
    navigate(dest[c]);
  };

  const presets: { label: string; s: string; e: string }[] = [
    { label: "7 j", s: iso(subDays(new Date(), 7)), e: yesterday },
    { label: "30 j", s: iso(subDays(new Date(), 30)), e: yesterday },
    { label: "90 j", s: iso(subDays(new Date(), 90)), e: yesterday },
    { label: "Mois en cours", s: iso(startOfMonth(new Date())), e: today },
    { label: "Année", s: iso(startOfYear(new Date())), e: today },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{resto?.name ?? "Restaurant"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {resto?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {resto.city}
                </span>
              )}
              {activeChannels.map((c) => (
                <Badge key={c.canal} variant="outline" className="gap-1.5 font-normal">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_META[c.canal].color }} />
                  {CHANNEL_META[c.canal].label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={p.s === start && p.e === end ? "secondary" : "outline"}
              className="h-8"
              onClick={() => setPeriod(p.s, p.e)}
            >
              {p.label}
            </Button>
          ))}
          <Input type="date" className="h-8 w-[140px]" value={start} min={MIN_DATE} max={end} onChange={(e) => e.target.value && setPeriod(e.target.value, end)} />
          <span className="text-muted-foreground">→</span>
          <Input type="date" className="h-8 w-[140px]" value={end} min={start} max={today} onChange={(e) => e.target.value && setPeriod(start, e.target.value)} />
        </div>
      </div>

      {kpis.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Impossible de charger les données de ce restaurant.
        </div>
      )}

      <PerformanceKpiRow isLoading={kpis.isLoading} totalCa={totalCa} totalOrders={totalOrders} uberRentabilite={uberRent} />

      <ChannelRevenueEvolution
        rows={chartRows}
        start={start}
        end={end}
        granularity={granularity}
        onGranularityChange={setGranularity}
        isLoading={granularity === "month" ? monthly.isLoading : daily.isLoading}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <ChannelMixBar byChannel={byChannel} total={totalCa} />
        <div className="lg:col-span-2">
          <ChannelBreakdownTable rows={byChannel} onOpenChannel={openChannel} />
        </div>
      </div>
    </div>
  );
}
