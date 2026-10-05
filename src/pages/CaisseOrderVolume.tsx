import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { format, startOfISOWeek, getISOWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { X, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { cn } from "@/lib/utils";

const int = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
const varPct = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null);
const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--primary))"];
const MAX_SEL = 6;

function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return <span className={cn(value >= 0 ? "text-success" : "text-destructive", className)}>{value >= 0 ? "+" : ""}{value.toFixed(1)} %</span>;
}

type Gran = "day" | "week" | "month";
type SortKey = "tickets" | "var" | "diff";

function bucketOf(date: string, g: Gran) {
  const d = new Date(date + "T12:00:00");
  if (g === "day") return { key: date, label: format(d, "dd MMM", { locale: fr }) };
  if (g === "week") { const s = startOfISOWeek(d); return { key: format(s, "yyyy-MM-dd"), label: `S${getISOWeek(d)}` }; }
  return { key: format(d, "yyyy-MM"), label: format(d, "MMM yy", { locale: fr }) };
}

export default function CaisseOrderVolume() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } = useAnalyticsContext();
  const { startDate, endDate, granularity } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");
  const [gran, setGran] = useState<Gran | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("tickets");
  const [prodSearch, setProdSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const effGran: Gran = gran ?? (granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let q = supabase.from("restaurants").select("id, name").order("name");
      if (selectedChainId) q = q.eq("chain_id", selectedChainId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const ids = useMemo<string[] | undefined>(() => {
    if (!restaurants) return undefined;
    const all = restaurants.map((r) => r.id);
    return resolveBrandScopedRestaurantIds({ selectedRestaurantIds: selectedRestaurants, selectedChainId, chainRestaurantIds: all }) ?? all;
  }, [restaurants, selectedRestaurants, selectedChainId]);
  const enabled = !!ids && ids.length > 0;
  const params = { p_restaurant_ids: ids ?? [], p_start: start, p_end: end };

  const daily = useQuery({
    queryKey: ["caisse-basket-daily", start, end, ids], enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_avg_basket_daily", params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((x) => ({ date: String(x.date), t: Number(x.tickets) || 0, pt: Number(x.prev_tickets) || 0 }));
    },
  });
  const byResto = useQuery({
    queryKey: ["caisse-basket-resto", start, end, ids], enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_avg_basket_by_restaurant", params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ id: r.restaurant_id as string, name: r.restaurant_name as string, t: Number(r.tickets) || 0, pt: Number(r.prev_tickets) || 0 }));
    },
  });
  const products = useQuery({
    queryKey: ["caisse-product-volume-list", start, end, ids], enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_product_volume_list", params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ product: r.product as string, q: Number(r.qty) || 0, pq: Number(r.prev_qty) || 0 }));
    },
  });
  const series = useQueries({
    queries: selected.map((p) => ({
      queryKey: ["caisse-product-volume-daily", start, end, ids, p], enabled, retry: false,
      queryFn: async () => {
        const { data, error } = await (supabase as any).rpc("get_caisse_product_volume_daily", { ...params, p_product: p });
        if (error) throw error;
        return ((data ?? []) as any[]).map((x) => ({ date: String(x.date), q: Number(x.qty) || 0, pq: Number(x.prev_qty) || 0 }));
      },
    })),
  });

  const totals = useMemo(() => {
    const d = daily.data ?? [];
    const t = d.reduce((a, x) => a + x.t, 0), pt = d.reduce((a, x) => a + x.pt, 0);
    const days = d.filter((x) => x.t > 0).length;
    const best = d.reduce<{ date: string; t: number } | null>((b, x) => (!b || x.t > b.t ? x : b), null);
    return { t, pt, v: varPct(t, pt), diff: t - pt, perDay: days ? t / days : 0, best };
  }, [daily.data]);

  const chart = useMemo(() => {
    const m = new Map<string, { label: string; N: number; "N-1": number }>();
    for (const x of daily.data ?? []) {
      const { key, label } = bucketOf(x.date, effGran);
      const b = m.get(key) ?? { label, N: 0, "N-1": 0 };
      b.N += x.t; b["N-1"] += x.pt; m.set(key, b);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [daily.data, effGran]);

  const prodChart = useMemo(() => {
    const m = new Map<string, any>();
    series.forEach((s, i) => (s.data ?? []).forEach((x) => {
      const { key, label } = bucketOf(x.date, effGran);
      const row = m.get(key) ?? { key, label };
      row[`p${i}`] = (row[`p${i}`] ?? 0) + x.q;
      row[`p${i}_prev`] = (row[`p${i}_prev`] ?? 0) + x.pq;
      m.set(key, row);
    }));
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [series, effGran]);

  const ranked = useMemo(() => {
    const rows = (byResto.data ?? []).filter((r) => r.t > 0 || r.pt > 0).map((r) => ({ ...r, v: varPct(r.t, r.pt), diff: r.t - r.pt }));
    const rank = new Map([...rows].sort((a, b) => b.t - a.t).map((r, i) => [r.id, i + 1]));
    const max = Math.max(1, ...rows.map((r) => r.t));
    const key = (r: (typeof rows)[number]) => (sort === "tickets" ? r.t : sort === "var" ? r.v ?? -Infinity : r.diff);
    const q = search.trim().toLowerCase();
    return { total: rows.length, rank, max, rows: rows.sort((a, b) => key(b) - key(a)).filter((r) => !q || r.name.toLowerCase().includes(q)) };
  }, [byResto.data, search, sort]);

  const prodList = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return (products.data ?? []).filter((p) => !q || p.product.toLowerCase().includes(q)).slice(0, 40);
  }, [products.data, prodSearch]);
  const toggle = (p: string) => setSelected((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : xs.length >= MAX_SEL ? xs : [...xs, p]));
  const prodInfo = (p: string) => (products.data ?? []).find((x) => x.product === p);

  const granLabel = effGran === "day" ? "jour" : effGran === "week" ? "semaine" : "mois";
  const sortHead = (k: SortKey, label: string) => (
    <TableHead className="text-right cursor-pointer select-none" onClick={() => setSort(k)}>{label}{sort === k ? " ↓" : ""}</TableHead>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Volume de commandes</h1>
            <p className="text-muted-foreground">Tickets caisse (hors Châtaigne) sur la période, comparés aux mêmes dates N-1.</p>
          </div>
          <AnalyticsHeader />

          {daily.isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Commandes</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{int(totals.t)}</p>
                <p className="mt-1 text-xs text-muted-foreground">vs {int(totals.pt)} N-1 · <Delta value={totals.v} /></p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Écart vs N-1</p>
                <p className={cn("mt-1 text-3xl font-semibold tabular-nums", totals.diff >= 0 ? "text-success" : "text-destructive")}>
                  {totals.diff >= 0 ? "+" : ""}{int(totals.diff)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">commandes</p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Moyenne par jour</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{int(totals.perDay)}</p>
                <p className="mt-1 text-xs text-muted-foreground">jours avec ventes</p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Meilleur jour</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{totals.best ? int(totals.best.t) : "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{totals.best ? format(new Date(totals.best.date + "T12:00:00"), "EEEE d MMMM", { locale: fr }) : ""}</p>
              </CardContent></Card>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Évolution des commandes</CardTitle>
                <CardDescription>Par {granLabel} · N en plein, N-1 en pointillés</CardDescription>
              </div>
              <div className="flex gap-1">
                {(["day", "week", "month"] as Gran[]).map((g) => (
                  <Button key={g} size="sm" variant={effGran === g ? "default" : "outline"} onClick={() => setGran(g)}>
                    {g === "day" ? "Jour" : g === "week" ? "Semaine" : "Mois"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              {daily.isLoading ? <Skeleton className="h-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="volN" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => int(Number(v))} width={60} />
                    <ReTooltip formatter={(v: any, n: any) => [int(Number(v)), n]} />
                    <Legend />
                    <Area type="monotone" dataKey="N" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#volN)" />
                    <Area type="monotone" dataKey="N-1" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 4" strokeWidth={1.5} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendance par produit</CardTitle>
              <CardDescription>Choisissez jusqu'à {MAX_SEL} produits : articles vendus par {granLabel}, N vs N-1 (pointillés).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher un produit" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} className="pl-8" />
                </div>
                <div className="max-h-[320px] space-y-0.5 overflow-y-auto pr-1">
                  {products.isLoading ? <Skeleton className="h-40" /> : prodList.map((p) => {
                    const i = selected.indexOf(p.product);
                    return (
                      <button key={p.product} onClick={() => toggle(p.product)}
                        className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                          i >= 0 && "bg-muted font-medium")}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: i >= 0 ? COLORS[i] : "hsl(var(--border))" }} />
                          <span className="truncate">{p.product}</span>
                        </span>
                        <Delta value={varPct(p.q, p.pq)} className="shrink-0 text-xs" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="min-w-0 space-y-4">
                {selected.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    Sélectionnez un produit dans la liste pour afficher sa courbe.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {selected.map((p, i) => {
                        const info = prodInfo(p);
                        return (
                          <Badge key={p} variant="outline" className="gap-2 py-1 pl-2 pr-1 font-normal">
                            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                            {p}
                            {info && <span className="tabular-nums text-muted-foreground">{int(info.q)}</span>}
                            {info && <Delta value={varPct(info.q, info.pq)} className="text-xs" />}
                            <button onClick={() => toggle(p)} className="rounded p-0.5 hover:bg-muted" aria-label={`Retirer ${p}`}><X className="h-3 w-3" /></button>
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="h-[280px]">
                      {series.some((s) => s.isLoading) ? <Skeleton className="h-full" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={prodChart}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => int(Number(v))} width={55} />
                            <ReTooltip formatter={(v: any, n: any) => [int(Number(v)), n]} />
                            {selected.map((p, i) => (
                              <Line key={p} type="monotone" dataKey={`p${i}`} name={p} stroke={COLORS[i]} strokeWidth={2} dot={false} />
                            ))}
                            {selected.map((p, i) => (
                              <Line key={p + "prev"} type="monotone" dataKey={`p${i}_prev`} name={`${p} (N-1)`} stroke={COLORS[i]} strokeOpacity={0.45} strokeDasharray="4 4" strokeWidth={1.5} dot={false} legendType="none" />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Par restaurant</CardTitle>
                <CardDescription>Rang sur le volume de tout le périmètre ({ranked.total} restaurants)</CardDescription>
              </div>
              <Input placeholder="Rechercher un restaurant" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {byResto.isLoading ? <Skeleton className="h-40" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Restaurant</TableHead>
                      {sortHead("tickets", "Commandes")}
                      <TableHead className="text-right">N-1</TableHead>
                      {sortHead("diff", "Écart")}
                      {sortHead("var", "Var.")}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{ranked.rank.get(r.id)}</TableCell>
                        <TableCell className="font-medium">
                          {r.name}
                          <div className="mt-1 h-1 w-full max-w-[220px] rounded-full bg-muted">
                            <div className="h-1 rounded-full bg-chart-1" style={{ width: `${(r.t / ranked.max) * 100}%` }} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{int(r.t)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.pt > 0 ? int(r.pt) : "—"}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", r.pt > 0 ? (r.diff >= 0 ? "text-success" : "text-destructive") : "text-muted-foreground")}>
                          {r.pt > 0 ? `${r.diff >= 0 ? "+" : ""}${int(r.diff)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right"><Delta value={r.v} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
