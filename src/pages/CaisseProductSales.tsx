import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Cuboid,
  Package,
  Search,
  ShoppingCart,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";


import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";

interface TrendRow {
  product_ref: string;
  product_name: string | null;
  bucket: string;
  revenue: number;
  quantity: number;
  rank: number;
  share: number;
}

interface MoverRow {
  product_ref: string;
  product_name: string | null;
  first_rank: number | null;
  last_rank: number | null;
  rank_delta: number | null;
  first_share: number;
  last_share: number;
  share_delta: number;
  first_revenue: number;
  last_revenue: number;
}

interface SeasonRow {
  month_of_year: number;
  years_covered: number;
  avg_revenue: number;
  total_revenue: number;
  total_quantity: number;
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const num = (v: unknown) => Number(v) || 0;
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const ordinal = (r: number | null) => (r == null ? "—" : r === 1 ? "1er" : `${r}e`);

const EMPHASIS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const MUTED = "hsl(var(--muted-foreground) / 0.35)";

export default function CaisseProductSales() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } =
    useAnalyticsContext();
  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const [topN, setTopN] = useState(10);
  const [bucket, setBucket] = useState<"month" | "week">("month");
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [colorCount, setColorCount] = useState(5);

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("id, name").order("name");
      if (selectedChainId) query = query.eq("chain_id", selectedChainId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const chainRestaurantIds = useMemo(() => restaurants?.map((r) => r.id) ?? [], [restaurants]);

  const restaurantFilter = useMemo<string[] | null | undefined>(() => {
    if (!restaurants) return undefined;
    const resolved = resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    });
    return resolved ?? null;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const enabled = restaurantFilter !== undefined;
  const baseParams = { p_start: start, p_end: end, p_restaurant_ids: restaurantFilter ?? null };

  const trends = useQuery<TrendRow[], Error>({
    queryKey: ["caisse-product-trends", start, end, restaurantFilter, topN, bucket],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_product_trends", {
        ...baseParams,
        p_top_n: topN,
        p_bucket: bucket,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        product_ref: r.product_ref,
        product_name: r.product_name,
        bucket: r.bucket,
        revenue: num(r.revenue),
        quantity: num(r.quantity),
        rank: num(r.rank),
        share: num(r.share),
      }));
    },
  });

  const movers = useQuery<MoverRow[], Error>({
    queryKey: ["caisse-product-movers", start, end, restaurantFilter, topN, bucket],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_product_movers", {
        ...baseParams,
        p_top_n: topN,
        p_bucket: bucket,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        product_ref: r.product_ref,
        product_name: r.product_name,
        first_rank: r.first_rank == null ? null : num(r.first_rank),
        last_rank: r.last_rank == null ? null : num(r.last_rank),
        rank_delta: r.rank_delta == null ? null : num(r.rank_delta),
        first_share: num(r.first_share),
        last_share: num(r.last_share),
        share_delta: num(r.share_delta),
        first_revenue: num(r.first_revenue),
        last_revenue: num(r.last_revenue),
      }));
    },
  });

  // Détail produit : on interroge un périmètre large puis on isole la référence cliquée.
  const detail = useQuery<TrendRow[], Error>({
    queryKey: ["caisse-product-detail", start, end, restaurantFilter, bucket, selectedRef],
    enabled: enabled && !!selectedRef,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_product_trends", {
        ...baseParams,
        p_top_n: 400,
        p_bucket: bucket,
      });
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.product_ref === selectedRef)
        .map((r: any) => ({
          product_ref: r.product_ref,
          product_name: r.product_name,
          bucket: r.bucket,
          revenue: num(r.revenue),
          quantity: num(r.quantity),
          rank: num(r.rank),
          share: num(r.share),
        }));
    },
  });

  const seasonality = useQuery<SeasonRow[], Error>({
    queryKey: ["caisse-product-seasonality", restaurantFilter, selectedRef],
    enabled: enabled && !!selectedRef,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_product_seasonality", {
        p_product_ref: selectedRef,
        p_restaurant_ids: restaurantFilter ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        month_of_year: num(r.month_of_year),
        years_covered: num(r.years_covered),
        avg_revenue: num(r.avg_revenue),
        total_revenue: num(r.total_revenue),
        total_quantity: num(r.total_quantity),
      }));
    },
  });

  const rows = trends.data ?? [];

  const buckets = useMemo(
    () => Array.from(new Set(rows.map((r) => r.bucket))).sort(),
    [rows],
  );

  const products = useMemo(() => {
    const map = new Map<string, { ref: string; name: string; totalRevenue: number; firstRank: number | null; lastRank: number | null }>();
    for (const r of rows) {
      const cur = map.get(r.product_ref) ?? {
        ref: r.product_ref,
        name: r.product_name ?? r.product_ref,
        totalRevenue: 0,
        firstRank: null,
        lastRank: null,
      };
      cur.totalRevenue += r.revenue;
      if (buckets.length && r.bucket === buckets[0]) cur.firstRank = r.rank;
      if (buckets.length && r.bucket === buckets[buckets.length - 1]) cur.lastRank = r.rank;
      map.set(r.product_ref, cur);
    }
    return [...map.values()].sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [rows, buckets]);

  // Emphase : leader + plus gros grimpeur/décrocheur en couleur, le reste en gris.
  const emphasised = useMemo(() => {
    const withDelta = products.filter((p) => p.firstRank != null && p.lastRank != null);
    const sorted = [...withDelta].sort((a, b) => (b.firstRank! - b.lastRank!) - (a.firstRank! - a.lastRank!));
    const refs: string[] = [];
    if (products[0]) refs.push(products[0].ref);
    for (const p of [sorted[0], sorted[1], sorted[sorted.length - 1], sorted[sorted.length - 2]]) {
      if (p && !refs.includes(p.ref)) refs.push(p.ref);
    }
    return refs.slice(0, colorCount);
  }, [products, colorCount]);

  // Rang LOCAL (parmi les produits suivis) pour garder une échelle stable et lisible.
  // Le rang catalogue réel reste disponible au survol.
  const chartData = useMemo(
    () =>
      buckets.map((b) => {
        const point: Record<string, any> = {
          label:
            bucket === "week"
              ? `sem. ${format(new Date(b), "dd MMM", { locale: fr })}`
              : format(new Date(b), "MMM yyyy", { locale: fr }),
        };
        const present = products
          .map((p) => ({ ref: p.ref, row: rows.find((r) => r.bucket === b && r.product_ref === p.ref) }))
          .filter((x) => x.row)
          .sort((a, b2) => (b2.row!.revenue - a.row!.revenue));
        present.forEach((x, i) => {
          point[x.ref] = i + 1;
          point[`${x.ref}__ca`] = x.row!.revenue;
          point[`${x.ref}__globalRank`] = x.row!.rank;
        });
        for (const p of products) {
          if (!(p.ref in point)) {
            point[p.ref] = null;
            point[`${p.ref}__ca`] = null;
            point[`${p.ref}__globalRank`] = null;
          }
        }
        return point;
      }),
    [buckets, products, rows, bucket],
  );

  const maxRank = useMemo(() => Math.max(1, products.length), [products]);
  const rankTicks = useMemo(
    () =>
      Array.from({ length: maxRank }, (_, i) => i + 1).filter((v) =>
        maxRank > 15 ? v % 2 === 1 || v === maxRank : true,
      ),
    [maxRank],
  );
  const separators = useMemo(
    () => Array.from({ length: Math.floor(maxRank / 5) }, (_, i) => (i + 1) * 5).filter((v) => v < maxRank),
    [maxRank],
  );
  const xInterval = chartData.length > 12 ? 1 : 0;
  const nameOf = (ref: string) => products.find((p) => p.ref === ref)?.name ?? ref;


  const up = useMemo(
    () =>
      (movers.data ?? [])
        .filter((m) => (m.rank_delta ?? 0) > 0 || (m.first_rank == null && m.last_rank != null))
        .sort((a, b) => (b.rank_delta ?? 99) - (a.rank_delta ?? 99) || b.share_delta - a.share_delta)
        .slice(0, 8),
    [movers.data],
  );
  const down = useMemo(
    () =>
      (movers.data ?? [])
        .filter((m) => (m.rank_delta ?? 0) < 0 || (m.last_rank == null && m.first_rank != null))
        .sort((a, b) => (a.rank_delta ?? -99) - (b.rank_delta ?? -99) || a.share_delta - b.share_delta)
        .slice(0, 8),
    [movers.data],
  );

  const selectedName = selectedRef ? nameOf(selectedRef) : "";
  const detailData = (detail.data ?? []).map((r) => ({
    label:
      bucket === "week"
        ? `sem. ${format(new Date(r.bucket), "dd MMM", { locale: fr })}`
        : format(new Date(r.bucket), "MMM yyyy", { locale: fr }),
    rang: r.rank,
    ca: r.revenue,
    part: r.share,
  }));
  const detailTrend =
    detailData.length >= 2 ? detailData[0].rang - detailData[detailData.length - 1].rang : null;

  const latestBucket = buckets[buckets.length - 1];
  const firstBucket = buckets[0];
  const moverByRef = useMemo(
    () => new Map((movers.data ?? []).map((row) => [row.product_ref, row])),
    [movers.data],
  );
  const currentRanking = useMemo(
    () =>
      rows
        .filter((row) => row.bucket === latestBucket)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, topN),
    [rows, latestBucket, topN],
  );
  const totalRevenue = useMemo(() => rows.reduce((sum, row) => sum + row.revenue, 0), [rows]);
  const totalQuantity = useMemo(() => rows.reduce((sum, row) => sum + row.quantity, 0), [rows]);
  const leader = currentRanking[0];
  const topThreeStability = useMemo(() => {
    const first = new Set(
      rows.filter((row) => row.bucket === firstBucket && row.rank <= 3).map((row) => row.product_ref),
    );
    const last = rows.filter((row) => row.bucket === latestBucket && row.rank <= 3);
    if (!last.length) return 0;
    return Math.round((last.filter((row) => first.has(row.product_ref)).length / last.length) * 100);
  }, [rows, firstBucket, latestBucket]);
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const matchesSearch = (name: string | null, ref: string) =>
    !normalizedSearch || `${name ?? ""} ${ref}`.toLocaleLowerCase("fr").includes(normalizedSearch);
  const visibleRanking = currentRanking.filter((row) => matchesSearch(row.product_name, row.product_ref));

  const getSparkData = (ref: string) =>
    buckets.map((period) => ({
      value: rows.find((row) => row.bucket === period && row.product_ref === ref)?.rank ?? null,
    }));

  const Sparkline = ({ productRef, color = "hsl(var(--muted-foreground))" }: { productRef: string; color?: string }) => (
    <div className="h-7 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={getSparkData(productRef)}>
          <Line
            dataKey="value"
            type="monotone"
            stroke={color}
            strokeWidth={1.8}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const MoverList = ({ items, positive }: { items: MoverRow[]; positive: boolean }) => (
    <div className="divide-y divide-border/70">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun mouvement notable sur la période.
        </p>
      ) : (
        items.filter((m) => matchesSearch(m.product_name, m.product_ref)).slice(0, 4).map((m, index) => (
          <Button
            key={m.product_ref}
            variant="ghost"
            onClick={() => setSelectedRef(m.product_ref)}
            className="h-auto w-full justify-start rounded-none px-0 py-3 text-left hover:bg-transparent"
          >
            <span className="w-6 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
            <span className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <Package className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{m.product_name ?? m.product_ref}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {ordinal(m.first_rank)} → {ordinal(m.last_rank)}
              </span>
            </span>
            <span className={`mx-4 text-sm font-semibold ${positive ? "text-success" : "text-destructive"}`}>
              {m.rank_delta == null ? (positive ? "Nouveau" : "Sorti") : `${m.rank_delta > 0 ? "+" : ""}${m.rank_delta}`}
            </span>
            <span className="hidden w-24 justify-end sm:flex"><Sparkline productRef={m.product_ref} color={positive ? "hsl(var(--success))" : "hsl(var(--destructive))"} /></span>
          </Button>
        ))
      )}
    </div>
  );

  const MetricCard = ({
    icon: Icon,
    label,
    value,
    caption,
    tone,
  }: {
    icon: typeof Cuboid;
    label: string;
    value: string;
    caption: string;
    tone: "primary" | "success" | "warning";
  }) => (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex min-h-28 items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold text-foreground">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Ventes par produit</h1>
            <p className="text-muted-foreground">
              Suivez les produits qui gagnent du terrain et ceux qui décrochent.
            </p>
          </div>

          <AnalyticsHeader />

          <div className="flex flex-col gap-4 rounded-md border border-border/70 bg-card p-3 shadow-sm xl:flex-row xl:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Produits suivis</span>
              <ToggleGroup
                type="single"
                value={String(topN)}
                onValueChange={(v) => v && setTopN(Number(v))}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="10">10</ToggleGroupItem>
                <ToggleGroupItem value="15">15</ToggleGroupItem>
                <ToggleGroupItem value="20">20</ToggleGroupItem>
              </ToggleGroup>
              <div className="mx-1 hidden h-7 w-px bg-border sm:block" />
              <span className="text-xs font-medium text-muted-foreground">Période</span>
              <ToggleGroup
                type="single"
                value={bucket}
                onValueChange={(v) => v && setBucket(v as "month" | "week")}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
                <ToggleGroupItem value="month">Mois</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="relative ml-auto w-full xl:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un produit…" className="pl-9" />
            </div>
          </div>

          {trends.isLoading ? (
            <Skeleton className="h-[420px]" />
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Aucun détail produit de caisse disponible sur la période et le périmètre sélectionnés.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                <MetricCard icon={Cuboid} label="Produits suivis" value={String(products.length)} caption={`Top ${topN} par chiffre d'affaires`} tone="primary" />
                <MetricCard icon={ShoppingCart} label="CA produits (période)" value={eur(totalRevenue)} caption={`${Math.round(totalQuantity).toLocaleString("fr-FR")} unités vendues`} tone="success" />
                <MetricCard icon={TrendingUp} label="Produit n°1" value={leader?.product_name ?? "—"} caption={leader ? `${eur(leader.revenue)} sur la dernière période` : "Aucune donnée"} tone="primary" />
                <MetricCard icon={CalendarDays} label="Stabilité du top 3" value={`${topThreeStability} %`} caption="inchangé entre début et fin" tone="primary" />
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(390px,1fr)]">
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Classement dans le temps</CardTitle>
                      <CardDescription>Rang parmi les {products.length} produits suivis (1 en haut). Rang catalogue et CA au survol.</CardDescription>
                    </div>
                    <Select value={String(colorCount)} onValueChange={(value) => setColorCount(Number(value))}>
                      <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Top 3 en couleur</SelectItem>
                        <SelectItem value="5">Top 5 en couleur</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="h-[520px] pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: 12, right: 112, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval={xInterval}
                        tickMargin={8}
                      />
                      <YAxis
                        reversed
                        domain={[1, maxRank]}
                        ticks={rankTicks}
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `#${v}`}
                        width={78}
                      >
                        <Label
                          value={`rang parmi le top ${products.length} suivi`}
                          angle={-90}
                          position="insideLeft"
                          style={{ fontSize: 11, textAnchor: "middle", fill: "hsl(var(--muted-foreground))" }}
                        />
                      </YAxis>
                      {separators.map((s) => (
                        <ReferenceLine
                          key={s}
                          y={s}
                          stroke="hsl(var(--border))"
                          strokeDasharray="2 6"
                        />
                      ))}
                      <ReTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0].payload as Record<string, any>;
                          return (
                            <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                              <p className="mb-1 font-medium">{label}</p>
                              {payload
                                .filter((p) => p.value != null)
                                .sort((a, b) => Number(a.value) - Number(b.value))
                                .map((p) => {
                                  const ref = String(p.dataKey);
                                  const global = point[`${ref}__globalRank`];
                                  return (
                                    <p key={ref} style={{ color: p.color as string }}>
                                      #{p.value}
                                      {global ? ` (catalogue #${global})` : ""} · {nameOf(ref)} ·{" "}
                                      {eur(num(point[`${ref}__ca`]))}
                                    </p>
                                  );
                                })}
                            </div>
                          );
                        }}
                      />
                      {products.map((p) => {
                        const idx = emphasised.indexOf(p.ref);
                        const isEmph = idx >= 0;
                        const color = isEmph ? EMPHASIS[idx % EMPHASIS.length] : MUTED;
                        return (
                          <Line
                            key={p.ref}
                            type="monotone"
                            dataKey={p.ref}
                            name={p.name}
                            stroke={color}
                            strokeWidth={isEmph ? 2.5 : 1.25}
                            dot={{ r: isEmph ? 2.5 : 1.5 }}
                            activeDot={{
                              r: 5,
                              onClick: () => setSelectedRef(p.ref),
                              style: { cursor: "pointer" },
                            }}
                            label={
                              isEmph
                                ? (props: any) => {
                                    if (props.index !== chartData.length - 1) return null;
                                    if (chartData[props.index]?.[p.ref] == null) return null;
                                    return (
                                      <text
                                        x={props.x + 8}
                                        y={props.y + 4}
                                        fill={color}
                                        fontSize={11}
                                      >
                                        {p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name}
                                      </text>
                                    );
                                  }
                                : false
                            }
                          />
                        );
                      })}

                    </LineChart>
                  </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-warning" /> Classement actuel</CardTitle>
                    <Badge variant="secondary" className="font-normal">{latestBucket ? (bucket === "week" ? `Semaine du ${format(new Date(latestBucket), "dd MMM yyyy", { locale: fr })}` : format(new Date(latestBucket), "MMMM yyyy", { locale: fr })) : "—"}</Badge>
                  </CardHeader>
                  <CardContent className="px-4">
                    <div className="grid grid-cols-[28px_minmax(0,1fr)_46px_54px_74px] gap-2 border-b pb-2 text-[10px] font-medium uppercase text-muted-foreground">
                      <span>#</span><span>Produit</span><span>Rang</span><span>Var.</span><span className="text-right">Tendance</span>
                    </div>
                    <div className="divide-y divide-border/70">
                      {visibleRanking.map((row, index) => {
                        const movement = moverByRef.get(row.product_ref)?.rank_delta ?? 0;
                        const colorIndex = emphasised.indexOf(row.product_ref);
                        return (
                          <Button key={row.product_ref} variant="ghost" onClick={() => setSelectedRef(row.product_ref)} className="grid h-11 w-full grid-cols-[28px_minmax(0,1fr)_46px_54px_74px] gap-2 rounded-none px-0 font-normal hover:bg-muted/40">
                            <span className="text-xs text-muted-foreground">{index + 1}</span>
                            <span className="flex min-w-0 items-center gap-2 text-left"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted"><Package className="h-3.5 w-3.5" /></span><span className="truncate text-xs font-medium">{row.product_name ?? row.product_ref}</span></span>
                            <Badge variant="secondary" className="w-7 justify-center px-0">{row.rank}</Badge>
                            <span className={`text-xs font-semibold ${movement > 0 ? "text-success" : movement < 0 ? "text-destructive" : "text-muted-foreground"}`}>{movement > 0 ? `▲ +${movement}` : movement < 0 ? `▼ ${movement}` : "—"}</span>
                            <span className="flex justify-end"><Sparkline productRef={row.product_ref} color={colorIndex >= 0 ? EMPHASIS[colorIndex] : MUTED} /></span>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 2xl:grid-cols-2">
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
                    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success"><ArrowUpRight className="h-5 w-5" /></span><div><CardTitle className="text-base">Plus fortes progressions de rang</CardTitle><CardDescription>Produits ayant gagné le plus de places</CardDescription></div></div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {movers.isLoading ? <Skeleton className="h-40" /> : <MoverList items={up} positive />}
                  </CardContent>
                </Card>
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
                    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive"><ArrowDownRight className="h-5 w-5" /></span><div><CardTitle className="text-base">Plus fortes baisses de rang</CardTitle><CardDescription>Produits ayant perdu le plus de places</CardDescription></div></div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {movers.isLoading ? (
                      <Skeleton className="h-40" />
                    ) : (
                      <MoverList items={down} positive={false} />
                    )}
                  </CardContent>
                </Card>
              </div>

            </>
          )}

          <Sheet open={!!selectedRef} onOpenChange={(o) => !o && setSelectedRef(null)}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedName}
                  {detailTrend != null && (
                    <Badge variant={detailTrend >= 0 ? "default" : "destructive"} className="gap-1">
                      {detailTrend >= 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {detailTrend > 0 ? "+" : ""}
                      {detailTrend} place{Math.abs(detailTrend) > 1 ? "s" : ""}
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>Rang, chiffre d'affaires et part du CA caisse dans le temps</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {detail.isLoading ? (
                  <Skeleton className="h-64" />
                ) : (
                  <>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detailData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis
                            reversed
                            allowDecimals={false}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => `#${v}`}
                          />
                          <ReTooltip formatter={(v: any) => `#${v}`} />
                          <Line type="monotone" dataKey="rang" name="Rang" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detailData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => eur(Number(v))} />
                          <ReTooltip formatter={(v: any) => eur(Number(v))} />
                          <Line type="monotone" dataKey="ca" name="CA" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detailData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} %`} />
                          <ReTooltip formatter={(v: any) => `${Number(v).toFixed(2)} %`} />
                          <Line
                            type="monotone"
                            dataKey="part"
                            name="% du CA"
                            stroke="hsl(var(--chart-3))"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium">Saisonnalité</p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        CA moyen par mois de l'année, moyenné sur les années disponibles.
                      </p>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={(seasonality.data ?? []).map((s) => ({
                              label: MONTHS[s.month_of_year - 1],
                              ca: s.avg_revenue,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => eur(Number(v))} />
                            <ReTooltip formatter={(v: any) => eur(Number(v))} />
                            <Bar dataKey="ca" name="CA moyen" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
