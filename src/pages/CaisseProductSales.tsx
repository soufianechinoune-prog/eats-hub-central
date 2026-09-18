import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Info, Package, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    return refs.slice(0, 5);
  }, [products]);

  const chartData = useMemo(
    () =>
      buckets.map((b) => {
        const point: Record<string, any> = {
          label:
            bucket === "week"
              ? `sem. ${format(new Date(b), "dd MMM", { locale: fr })}`
              : format(new Date(b), "MMM yyyy", { locale: fr }),
        };
        for (const p of products) {
          const row = rows.find((r) => r.bucket === b && r.product_ref === p.ref);
          point[p.ref] = row ? row.rank : null;
          point[`${p.ref}__ca`] = row ? row.revenue : null;
        }
        return point;
      }),
    [buckets, products, rows, bucket],
  );

  const maxRank = useMemo(() => Math.max(1, ...rows.map((r) => r.rank)), [rows]);
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

  const MoverList = ({ items, positive }: { items: MoverRow[]; positive: boolean }) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun mouvement notable sur la période.
        </p>
      ) : (
        items.map((m) => (
          <button
            key={m.product_ref}
            onClick={() => setSelectedRef(m.product_ref)}
            className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.product_name ?? m.product_ref}</p>
              <p className="text-xs text-muted-foreground">
                {ordinal(m.first_rank)} → {ordinal(m.last_rank)} · {m.last_share.toFixed(1)} % du CA
              </p>
            </div>
            <Badge variant={positive ? "default" : "destructive"} className="shrink-0 gap-1">
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {m.rank_delta == null
                ? positive
                  ? "nouveau"
                  : "sorti"
                : `${m.rank_delta > 0 ? "+" : ""}${m.rank_delta} place${Math.abs(m.rank_delta) > 1 ? "s" : ""}`}
            </Badge>
          </button>
        ))
      )}
    </div>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Ventes par produit</h1>
            <p className="text-muted-foreground">
              Tendances produits : qui monte, qui descend dans le classement du chiffre d'affaires caisse.
            </p>
          </div>

          <AnalyticsHeader />

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Suivi par référence produit</AlertTitle>
            <AlertDescription className="text-sm">
              Chaque produit est suivi par sa référence de caisse : un renommage ne casse pas sa courbe. La
              saisonnalité devient pleinement lisible dès que l'historique dépasse une année.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Produits suivis</span>
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
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Pas de temps</span>
              <ToggleGroup
                type="single"
                value={bucket}
                onValueChange={(v) => v && setBucket(v as "month" | "week")}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="month">Mois</ToggleGroupItem>
                <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
              </ToggleGroup>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" /> Classement dans le temps
                  </CardTitle>
                  <CardDescription>
                    Rang par chiffre d'affaires (1 en haut). Les mouvements marquants sont mis en couleur.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[440px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: 8, right: 24, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        reversed
                        domain={[1, maxRank]}
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `#${v}`}
                      />
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
                                .map((p) => (
                                  <p key={String(p.dataKey)} style={{ color: p.color as string }}>
                                    #{p.value} · {nameOf(String(p.dataKey))} ·{" "}
                                    {eur(num(point[`${String(p.dataKey)}__ca`]))}
                                  </p>
                                ))}
                            </div>
                          );
                        }}
                      />
                      {products.map((p) => {
                        const idx = emphasised.indexOf(p.ref);
                        const isEmph = idx >= 0;
                        return (
                          <Line
                            key={p.ref}
                            type="monotone"
                            dataKey={p.ref}
                            name={p.name}
                            stroke={isEmph ? EMPHASIS[idx % EMPHASIS.length] : MUTED}
                            strokeWidth={isEmph ? 2.5 : 1.25}
                            dot={{ r: isEmph ? 3 : 2 }}
                            activeDot={{
                              r: 5,
                              onClick: () => setSelectedRef(p.ref),
                              style: { cursor: "pointer" },
                            }}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">En hausse</CardTitle>
                    <CardDescription>Plus fortes progressions de rang sur la période</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {movers.isLoading ? <Skeleton className="h-40" /> : <MoverList items={up} positive />}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">En baisse</CardTitle>
                    <CardDescription>Plus forts reculs de rang sur la période</CardDescription>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4" /> Produits suivis
                  </CardTitle>
                  <CardDescription>Cliquez un produit pour ouvrir sa fiche détaillée</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {products.map((p) => (
                    <Button
                      key={p.ref}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRef(p.ref)}
                      className="gap-2"
                    >
                      {p.name}
                      <span className="text-xs text-muted-foreground">{eur(p.totalRevenue)}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
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
