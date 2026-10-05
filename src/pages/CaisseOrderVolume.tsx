import { Switch } from "@/components/ui/switch";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfISOWeek, getISOWeek, subYears, subDays } from "date-fns";
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
import { getEffectiveOpeningDate, isActiveForPeriod, type RestaurantWithDates } from "@/lib/restaurantActivityFilter";
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
type SortKey = "tickets" | "prev" | "var" | "diff";
type SortDir = "asc" | "desc";

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
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [constantScopeRaw, setConstantScope] = useState(false);
  const [comparableOnlyRaw, setComparableOnly] = useState(false);
  const [excludeZeroRaw, setExcludeZero] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(true);
  const [compareW4, setCompareW4] = useState(false);
  const [excludeOpeningMonthRaw, setExcludeOpeningMonth] = useState(false);
  const isTargeted = (selectedRestaurants?.length ?? 0) > 0;
  const comparableOnly = isTargeted && comparableOnlyRaw;
  const excludeOpeningMonth = !isTargeted && comparisonMode && constantScopeRaw && excludeOpeningMonthRaw;
  const excludeZero = !isTargeted && comparisonMode && excludeZeroRaw;
  const effGran: Gran = gran ?? (granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month");

  const { data: restaurants } = useQuery({
    queryKey: ["caisse-volume-restaurants-dates", selectedChainId],
    queryFn: async () => {
      let q = supabase.from("restaurants").select("id, name, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date, first_activity_date, first_activity_source").order("name");
      if (selectedChainId) q = q.eq("chain_id", selectedChainId);
      const { data, error } = await q;
      if (error) throw error;
      return data as (RestaurantWithDates & { id: string; name: string })[];
    },
  });
  const allIds = useMemo<string[] | undefined>(() => {
    if (!restaurants) return undefined;
    const all = restaurants.map((r) => r.id);
    return resolveBrandScopedRestaurantIds({ selectedRestaurantIds: selectedRestaurants, selectedChainId, chainRestaurantIds: all }) ?? all;
  }, [restaurants, selectedRestaurants, selectedChainId]);
  // Périmètre constant strict : ouvert (1er jour de caisse) dès le premier jour de N-1, et actif sur N
  const prevStartDate = subYears(startDate, 1);
  const prevEndDate = subYears(endDate, 1);
  const constantIds = useMemo(() => {
    if (!restaurants || !allIds) return undefined;
    const set = new Set(allIds);
    const prevStartStr = format(prevStartDate, "yyyy-MM-dd");
    const prevEndStr = format(prevEndDate, "yyyy-MM-dd");
    return restaurants
      .filter((r) => {
        if (!set.has(r.id)) return false;
        const open = getEffectiveOpeningDate(r).date;
        // Ouvert au plus tard pendant N-1 (même logique que la Vue réseau)
        if (!open || open > prevEndStr) return false;
        // Option : écarter les restos dont le mois d'ouverture tombe dans N-1 (mois partiel)
        if (excludeOpeningMonth && open >= prevStartStr.slice(0, 7) + "-01") return false;
        return isActiveForPeriod(r, startDate, endDate) && isActiveForPeriod(r, prevStartDate, prevEndDate);
      })
      .map((r) => r.id);
  }, [restaurants, allIds, startDate, endDate, excludeOpeningMonth]);
  const constantScope = !isTargeted && comparisonMode && constantScopeRaw;
  const ids = constantScope ? constantIds : allIds;
  const enabled = !!ids && ids.length > 0;
  const params = { p_restaurant_ids: ids ?? [], p_start: start, p_end: end };

  const dailyRestoRaw = useQuery({
    queryKey: ["caisse-tickets-daily-resto", start, end, ids], enabled, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_tickets_daily_by_restaurant", params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((x) => ({ id: x.restaurant_id as string, date: String(x.date), t: Number(x.tickets) || 0, pt: Number(x.prev_tickets) || 0 }));
    },
  });
  // Comparaison S-4 : même jour de semaine, 28 jours avant
  const shiftStart = format(subDays(startDate, 28), "yyyy-MM-dd");
  const shiftEnd = format(subDays(endDate, 28), "yyyy-MM-dd");
  const w4 = useQuery({
    queryKey: ["caisse-tickets-daily-resto", shiftStart, shiftEnd, ids], enabled: enabled && compareW4, retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_tickets_daily_by_restaurant", { p_restaurant_ids: ids ?? [], p_start: shiftStart, p_end: shiftEnd });
      if (error) throw error;
      const m = new Map<string, number>();
      ((data ?? []) as any[]).forEach((x) => m.set(`${x.restaurant_id}|${String(x.date)}`, Number(x.tickets) || 0));
      return m;
    },
  });
  const dailyResto = useMemo(() => {
    if (!compareW4) return dailyRestoRaw;
    const data = dailyRestoRaw.data && w4.data
      ? dailyRestoRaw.data.map((x) => ({ ...x, pt: w4.data!.get(`${x.id}|${format(subDays(new Date(x.date + "T12:00:00"), 28), "yyyy-MM-dd")}`) ?? 0 }))
      : undefined;
    return { data, isLoading: dailyRestoRaw.isLoading || w4.isLoading };
  }, [compareW4, dailyRestoRaw, w4.data, w4.isLoading]);
  const prevLbl = compareW4 ? "S-4" : "N-1";

  const openDateById = useMemo(() => {
    const m = new Map<string, string | null>();
    (restaurants ?? []).forEach((r) => m.set(r.id, getEffectiveOpeningDate(r).date));
    return m;
  }, [restaurants]);

  // Jours comparables : on ne garde que les jours où le restaurant était ouvert à la fois en N et en N-1
  const zeroIds = useMemo(() => {
    if (isTargeted || !ids || !dailyResto.data) return new Set<string>();
    const withSales = new Set(dailyResto.data.filter((x) => x.t > 0).map((x) => x.id));
    return new Set(ids.filter((id) => !withSales.has(id)));
  }, [isTargeted, ids, dailyResto.data]);
  const rows = useMemo(() => {
    let all = dailyResto.data ?? [];
    if (excludeZero && zeroIds.size > 0) all = all.filter((x) => !zeroIds.has(x.id));
    if (!comparableOnly) return all;
    return all.filter((x) => {
      const open = openDateById.get(x.id);
      if (!open) return true;
      const prev = format(subYears(new Date(x.date + "T12:00:00"), 1), "yyyy-MM-dd");
      return x.date >= open && prev >= open;
    });
  }, [dailyResto.data, comparableOnly, openDateById, excludeZero, zeroIds]);

  const daily = useMemo(() => {
    const m = new Map<string, { date: string; t: number; pt: number }>();
    for (const x of rows) {
      const b = m.get(x.date) ?? { date: x.date, t: 0, pt: 0 };
      b.t += x.t; b.pt += x.pt; m.set(x.date, b);
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const byResto = useMemo(() => {
    const nameById = new Map((restaurants ?? []).map((r) => [r.id, r.name]));
    const m = new Map<string, { id: string; name: string; t: number; pt: number }>();
    for (const x of rows) {
      const b = m.get(x.id) ?? { id: x.id, name: nameById.get(x.id) ?? "", t: 0, pt: 0 };
      b.t += x.t; b.pt += x.pt; m.set(x.id, b);
    }
    return [...m.values()];
  }, [rows, restaurants]);
  const totals = useMemo(() => {
    const t = daily.reduce((a, x) => a + x.t, 0), pt = daily.reduce((a, x) => a + x.pt, 0);
    const days = daily.filter((x) => x.t > 0).length;
    const best = daily.reduce<{ date: string; t: number } | null>((b, x) => (!b || x.t > b.t ? x : b), null);
    return { t, pt, v: varPct(t, pt), diff: t - pt, perDay: days ? t / days : 0, best };
  }, [daily]);

  const chart = useMemo(() => {
    const m = new Map<string, { label: string; N: number; "N-1": number }>();
    for (const x of daily) {
      const { key, label } = bucketOf(x.date, effGran);
      const b = m.get(key) ?? { label, N: 0, "N-1": 0 };
      b.N += x.t; b["N-1"] += x.pt; m.set(key, b);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [daily, effGran]);

  const ranked = useMemo(() => {
    const list = byResto.filter((r) => r.t > 0 || r.pt > 0).map((r) => ({ ...r, v: varPct(r.t, r.pt), diff: r.t - r.pt }));
    const rank = new Map([...list].sort((a, b) => b.t - a.t).map((r, i) => [r.id, i + 1]));
    const key = (r: (typeof list)[number]) =>
      sort === "tickets" ? r.t : sort === "prev" ? r.pt : sort === "var" ? (r.v ?? (sortDir === "desc" ? -Infinity : Infinity)) : r.diff;
    const q = search.trim().toLowerCase();
    const rows = list
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => (sortDir === "desc" ? key(b) - key(a) : key(a) - key(b)));
    return { total: list.length, rank, rows };
  }, [byResto, search, sort, sortDir]);

  const granLabel = effGran === "day" ? "jour" : effGran === "week" ? "semaine" : "mois";
  const sortHead = (k: SortKey, label: string) => (
    <TableHead
      className="text-right cursor-pointer select-none hover:text-foreground"
      onClick={() => (sort === k ? setSortDir((d) => (d === "desc" ? "asc" : "desc")) : (setSort(k), setSortDir("desc")))}
    >
      {label}
      {sort === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </TableHead>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Volume de commandes</h1>
              <p className="text-muted-foreground">Tickets caisse (hors Châtaigne) sur la période, comparés aux mêmes dates N-1.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            {isTargeted && (<div
              role="group"
              aria-label="Jours comparables"
              title="Jours comparables : la comparaison N vs N-1 ne retient que les jours où chaque restaurant était ouvert sur les deux années (évite de comparer des mois où le restaurant n'existait pas encore)."
              className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5"
            >
              {([
                { key: false, label: "Période complète" },
                { key: true, label: "Jours comparables" },
              ] as const).map((o) => (
                <button
                  key={String(o.key)}
                  type="button"
                  aria-pressed={comparableOnly === o.key}
                  onClick={() => setComparableOnly(o.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    comparableOnly === o.key
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>)}
            {!isTargeted && comparisonMode && zeroIds.size > 0 && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground" title="Écarte les restaurants sans aucune commande sur la période (travaux, fermeture).">
                <Switch checked={excludeZeroRaw} onCheckedChange={setExcludeZero} />
                Exclure les restaurants à 0 ({zeroIds.size})
              </label>
            )}
            {!isTargeted && comparisonMode && constantScope && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground" title="Écarte les restaurants dont le mois d'ouverture tombe dans la période N-1 : un mois partiel fausse la comparaison.">
                <Switch checked={excludeOpeningMonthRaw} onCheckedChange={setExcludeOpeningMonth} />
                Exclure le mois d'ouverture
              </label>
            )}
            {!isTargeted && comparisonMode && (<div
              role="group"
              aria-label="Périmètre de comparaison"
              title="Périmètre constant : la comparaison VS N-1 n'est calculée que sur les restaurants ouverts sur les deux périodes."
              className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5"
            >
              {([
                { key: false, label: "Réseau complet" },
                { key: true, label: "Périmètre constant" },
              ] as const).map((o) => (
                <button
                  key={String(o.key)}
                  type="button"
                  aria-pressed={constantScope === o.key}
                  onClick={() => setConstantScope(o.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    constantScope === o.key
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                  {o.key && constantScope && constantIds && allIds && (
                    <span className="tabular-nums opacity-70">{constantIds.length}/{allIds.length}</span>
                  )}
                </button>
              ))}
            </div>)}
            {!isTargeted && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground" title="Affiche les réglages de comparaison N-1 (périmètre constant, exclusions).">
                <Switch checked={comparisonMode} onCheckedChange={setComparisonMode} />
                Comparaison N-1
              </label>
            )}
            </div>
          </div>
          <AnalyticsHeader />

          {dailyResto.isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Commandes</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{int(totals.t)}</p>
                <p className="mt-1 text-xs text-muted-foreground">vs {int(totals.pt)} {prevLbl} · <Delta value={totals.v} /></p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Écart vs {prevLbl}</p>
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
                <CardDescription>Par {granLabel} · N en plein, {compareW4 ? "4 semaines avant (même jour)" : "N-1"} en pointillés</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={compareW4 ? "default" : "outline"} title="Comparer avec 4 semaines avant (même jour de semaine)" onClick={() => setCompareW4((v) => !v)}>
                  ⇆ 4 sem.
                </Button>
                {(["day", "week", "month"] as Gran[]).map((g) => (
                  <Button key={g} size="sm" variant={effGran === g ? "default" : "outline"} onClick={() => setGran(g)}>
                    {g === "day" ? "Jour" : g === "week" ? "Semaine" : "Mois"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              {dailyResto.isLoading ? <Skeleton className="h-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => int(Number(v))} width={60} />
                    <ReTooltip formatter={(v: any, n: any) => [int(Number(v)), n]} />
                    <Legend />
                    <Area type="monotone" dataKey="N" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="hsl(var(--chart-1))" fillOpacity={0.08} />
                    <Area type="monotone" dataKey="N-1" name={prevLbl} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 4" strokeWidth={1.5} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
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
              {dailyResto.isLoading ? <Skeleton className="h-40" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Restaurant</TableHead>
                      {sortHead("tickets", "Commandes")}
                      {sortHead("prev", prevLbl)}
                      {sortHead("diff", "Écart")}
                      {sortHead("var", "Var.")}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{ranked.rank.get(r.id)}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
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
