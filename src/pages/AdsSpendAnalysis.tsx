import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, differenceInCalendarDays, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Megaphone, TrendingDown, TrendingUp, Users, Wallet, Search, ArrowUpDown } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from "recharts";
import type { DateRange } from "react-day-picker";
import { fetchAdsRatio, sumAdsRows, type AdsRatioRow } from "@/lib/adsRatioFetch";
import { AdsQuarterCards, type QuarterStat } from "@/components/ads/AdsQuarterCards";
import { AdsConsolidationBadge } from "@/components/ads/AdsConsolidationBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";
import { ADS_RATIO_MODES, computeAdsRatio, type AdsRatioMode } from "@/lib/adsRatioModes";
import { ADS_EFFORT_TIERS, getAdsEffortTier, median, quarterRange, type AdsEffortTier } from "@/lib/adsEffortTiers";
import { UberEatsLogo } from "@/components/icons/PlatformIcons";

type Row = AdsRatioRow;
const fetchRatio = fetchAdsRatio;
const sumRows = sumAdsRows;
const SENTINEL = "00000000-0000-0000-0000-000000000000";
const eur = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
const pctFmt = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d).replace(".", ",") + " %");

type SortKey = "pct" | "ads" | "revenue" | "delta" | "name";

export default function AdsSpendAnalysis() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>("previous_week");
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [mode, setMode] = useState<AdsRatioMode>("uber");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<AdsEffortTier | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [sortDesc, setSortDesc] = useState(true);
  const [quarterYear, setQuarterYear] = useState(today.getFullYear());
  const [activeQ, setActiveQ] = useState<number | null>(null);

  const range = useMemo(() => {
    const lastWeek = subWeeks(today, 1);
    const pw = { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    switch (periodMode) {
      case "yesterday": return { start: subDays(today, 1), end: subDays(today, 1) };
      case "7d": return { start: subDays(today, 6), end: today };
      case "30d": return { start: subDays(today, 29), end: today };
      case "current_month": return { start: startOfMonth(today), end: today };
      case "year": return { start: new Date(selectedYear, 0, 1), end: selectedYear === today.getFullYear() ? today : new Date(selectedYear, 11, 31) };
      case "custom_month": {
        const s = startOfMonth(new Date(selectedYear, selectedMonth - 1));
        const e = endOfMonth(s);
        return { start: s, end: e > today ? today : e };
      }
      case "custom_range": return customRange?.from && customRange?.to ? { start: customRange.from, end: customRange.to } : pw;
      default: return pw;
    }
  }, [periodMode, selectedYear, selectedMonth, customRange, today]);

  const prevRange = useMemo(() => {
    const len = differenceInCalendarDays(range.end, range.start) + 1;
    return { start: subDays(range.start, len), end: subDays(range.start, 1) };
  }, [range]);

  const { data: restaurantsRaw } = useActiveRestaurants();
  const restaurants = useMemo(() => filterActiveRestaurants(restaurantsRaw ?? [], range.start, range.end), [restaurantsRaw, range]);
  const ids = useMemo(() => restaurants.map((r: { id: string }) => r.id), [restaurants]);
  const ready = ids.length > 0 && !ids.includes(SENTINEL);

  // 12 semaines glissantes se terminant à la fin de la période
  const weeks = useMemo(() => {
    const lastStart = startOfWeek(range.end, { weekStartsOn: 1 });
    return Array.from({ length: 12 }, (_, i) => {
      const s = subWeeks(lastStart, 11 - i);
      const e = addDays(s, 6);
      return { start: s, end: e > today ? today : e };
    });
  }, [range.end, today]);

  const key = (s: Date, e: Date) => [format(s, "yyyy-MM-dd"), format(e, "yyyy-MM-dd")];
  const results = useQueries({
    queries: [
      { queryKey: ["ads-page", ...key(range.start, range.end), ids], queryFn: () => fetchRatio(range.start, range.end, ids), enabled: ready, staleTime: 300000, retry: false },
      { queryKey: ["ads-page", ...key(prevRange.start, prevRange.end), ids], queryFn: () => fetchRatio(prevRange.start, prevRange.end, ids), enabled: ready, staleTime: 300000, retry: false },
      ...weeks.map((w) => ({ queryKey: ["ads-page", ...key(w.start, w.end), ids], queryFn: () => fetchRatio(w.start, w.end, ids), enabled: ready, staleTime: 300000, retry: false })),
    ],
  });
  const [cur, prev, ...weekly] = results;

  const quarters = useMemo(() => [
    quarterRange(quarterYear - 1, 4, today),
    ...[1, 2, 3, 4].map((q) => quarterRange(quarterYear, q, today)),
  ], [quarterYear, today]);
  const qRes = useQuery({
    queryKey: ["ads-quarters", quarterYear, ids],
    queryFn: () => fetchAdsQuarters(quarterYear, ids),
    placeholderData: () => cachedAdsQuarters(quarterYear, ids),
    enabled: ready, staleTime: 600000, retry: false,
  });
  const qStats: QuarterStat[] = quarters.map((r, i) => {
    const y = i === 0 ? quarterYear - 1 : quarterYear;
    const q = i === 0 ? 4 : i;
    const s = sumRows((qRes.data ?? []).filter((x) => x.q_year === y && x.quarter === q), mode);
    return { q, ads: s.ads, revenue: s.revenue, pct: s.pct, future: r.future, loading: !ready || (qRes.isLoading && !qRes.data) };
  });
  const selectQuarter = (q: number) => {
    const r = quarterRange(quarterYear, q, today);
    setActiveQ(q);
    setCustomRange({ from: r.start, to: r.end });
    setPeriodMode("custom_range");
  };
  const loading = !ready || cur.isLoading;

  const nameById = useMemo(() => new Map(restaurants.map((r: { id: string; name: string; city?: string | null }) => [r.id, r])), [restaurants]);

  const rows = useMemo(() => {
    const prevMap = new Map((prev.data ?? []).map((r) => [r.restaurant_id, r]));
    const curMap = new Map((cur.data ?? []).map((r) => [r.restaurant_id, r]));
    return ids.map((id) => {
      const r = curMap.get(id);
      const c = computeAdsRatio(mode, { adsHt: Number(r?.ads_spend_ht) || 0, revenueTtc: Number(r?.revenue_net_ttc) || 0, revenueHt: Number(r?.revenue_net_ht) || 0 });
      const p0 = prevMap.get(id);
      const p = p0 ? computeAdsRatio(mode, { adsHt: Number(p0.ads_spend_ht) || 0, revenueTtc: Number(p0.revenue_net_ttc) || 0, revenueHt: Number(p0.revenue_net_ht) || 0 }) : null;
      const info = nameById.get(id);
      return {
        id, name: info?.name ?? "—", city: info?.city ?? "",
        ads: c.ads, revenue: c.revenue, pct: c.pct,
        delta: c.pct != null && p?.pct != null ? c.pct - p.pct : null,
        tier: getAdsEffortTier(c.ads, c.pct),
      };
    }).filter((r) => r.revenue > 0 || r.ads > 0);
  }, [ids, cur.data, prev.data, mode, nameById]);

  const net = useMemo(() => sumRows(cur.data ?? [], mode), [cur.data, mode]);
  const netPrev = useMemo(() => sumRows(prev.data ?? [], mode), [prev.data, mode]);
  const advertisers = rows.filter((r) => r.ads > 0);
  const medianPct = median(advertisers.map((r) => r.pct ?? 0));
  const medianSpend = median(advertisers.map((r) => r.ads));

  const tierCounts = useMemo(() => {
    const c: Record<AdsEffortTier, number> = { none: 0, t1: 0, t2: 0, t3: 0, t4: 0 };
    rows.forEach((r) => c[r.tier]++);
    return c;
  }, [rows]);

  const chartData = weeks.map((w, i) => {
    const s = sumRows(weekly[i]?.data ?? [], mode);
    return { label: format(w.start, "d MMM", { locale: fr }), ads: Math.round(s.ads), revenue: Math.round(s.revenue), pct: s.pct != null ? Number(s.pct.toFixed(2)) : null };
  });
  const chartLoading = weekly.some((q) => q.isLoading);

  const maxPct = Math.max(1, ...rows.map((r) => r.pct ?? 0));
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => (tierFilter === "all" || r.tier === tierFilter) && (!q || r.name.toLowerCase().includes(q)));
    const val = (r: typeof rows[number]) => sortKey === "name" ? r.name : sortKey === "ads" ? r.ads : sortKey === "revenue" ? r.revenue : sortKey === "delta" ? (r.delta ?? -999) : (r.pct ?? -1);
    return list.sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDesc ? -cmp : cmp;
    });
  }, [rows, search, tierFilter, sortKey, sortDesc]);

  const toggleSort = (k: SortKey) => { if (k === sortKey) setSortDesc(!sortDesc); else { setSortKey(k); setSortDesc(k !== "name"); } };
  const deltaPts = net.pct != null && netPrev.pct != null ? net.pct - netPrev.pct : null;
  const revLabel = mode === "comptable" ? "Ventes HT" : "CA net TTC";
  const periodLabel = `${format(range.start, "d MMM", { locale: fr })} – ${format(range.end, "d MMM yyyy", { locale: fr })}`;

  const SortHead = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}<ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </th>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/overview?channel=uber")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="h-11 w-11 rounded-xl bg-uber/10 flex items-center justify-center"><Megaphone className="h-5 w-5 text-uber" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dépenses pub / CA</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5"><UberEatsLogo size={12} /> Uber Eats · {periodLabel} · {rows.length} restaurants</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as AdsRatioMode)} size="sm" className="gap-1">
            {(Object.keys(ADS_RATIO_MODES) as AdsRatioMode[]).map((k) => (
              <ToggleGroupItem key={k} value={k} className="h-8 px-3 text-xs data-[state=on]:bg-uber/15 data-[state=on]:text-uber">{ADS_RATIO_MODES[k].label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <OverviewPeriodSelector periodMode={periodMode} onPeriodModeChange={(m) => { setActiveQ(null); setPeriodMode(m); }} selectedYear={selectedYear} onYearChange={setSelectedYear} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} dateRange={customRange} onDateRangeChange={setCustomRange} />
        </div>
      </div>

      <AdsQuarterCards year={quarterYear} onYearChange={(y) => { setQuarterYear(y); setActiveQ(null); }} stats={qStats.slice(1)} prevQ4={qStats[0]} activeQ={activeQ} onSelect={selectQuarter} maxYear={today.getFullYear()} />

      {/* KPIs */}
      <AdsConsolidationBadge endDate={range.end} />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-uber/30 bg-gradient-to-br from-card to-uber/5">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Ratio pub / CA réseau</p>
            {loading ? <Skeleton className="h-9 w-24 mt-2" /> : <p className="text-3xl font-bold text-uber mt-1">{pctFmt(net.pct)}</p>}
            {deltaPts != null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${deltaPts > 0 ? "text-destructive" : "text-success"}`}>
                {deltaPts > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {deltaPts > 0 ? "+" : ""}{deltaPts.toFixed(2).replace(".", ",")} pt vs période précédente
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">{ADS_RATIO_MODES[mode].formula}</p>
          </CardContent>
        </Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Budget pub investi (HT)</p>
          {loading ? <Skeleton className="h-9 w-24 mt-2" /> : <p className="text-3xl font-bold mt-1">{eur(net.ads)}</p>}
          <p className="text-xs text-muted-foreground mt-1">sur {eur(net.revenue)} de {revLabel}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Restaurants qui font de la pub</p>
          {loading ? <Skeleton className="h-9 w-24 mt-2" /> : <p className="text-3xl font-bold mt-1">{advertisers.length}<span className="text-base text-muted-foreground font-medium"> / {rows.length}</span></p>}
          <p className="text-xs text-muted-foreground mt-1">{tierCounts.none} sans aucune pub</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Médiane des annonceurs</p>
          {loading ? <Skeleton className="h-9 w-24 mt-2" /> : <p className="text-3xl font-bold mt-1">{pctFmt(medianPct)}</p>}
          <p className="text-xs text-muted-foreground mt-1">soit {medianSpend != null ? eur(medianSpend) : "—"} par restaurant</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution sur 12 semaines</CardTitle>
            <p className="text-xs text-muted-foreground">Barres : pub HT par semaine · Courbe : ratio pub / CA</p>
          </CardHeader>
          <CardContent className="h-72">
            {chartLoading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="ads" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k€`} width={45} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={40} />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, n: string) => n === "pct" ? [pctFmt(v), "Pub / CA"] : [eur(v), "Pub HT"]}
                  />
                  <Bar yAxisId="ads" dataKey="ads" fill="hsl(var(--uber) / 0.35)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" dataKey="pct" stroke="hsl(var(--uber))" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition par ratio pub / CA</CardTitle>
            <p className="text-xs text-muted-foreground">Cliquez une tranche pour filtrer le classement</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(ADS_EFFORT_TIERS) as AdsEffortTier[]).map((t) => {
              const n = tierCounts[t];
              const share = rows.length ? (n / rows.length) * 100 : 0;
              const active = tierFilter === t;
              return (
                <button key={t} onClick={() => setTierFilter(active ? "all" : t)} className={`w-full text-left rounded-lg border p-3 transition-colors ${active ? "border-uber bg-uber/5" : "border-border hover:bg-muted/50"}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{ADS_EFFORT_TIERS[t].label} <span className="text-xs text-muted-foreground">· {ADS_EFFORT_TIERS[t].range}</span></span>
                    <span className="font-semibold">{n}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${ADS_EFFORT_TIERS[t].barClass}`} style={{ width: `${share}%` }} />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Classement des restaurants</CardTitle>
            <p className="text-xs text-muted-foreground">Repère : médiane des annonceurs à {pctFmt(medianPct)}</p>
          </div>
          <div className="flex items-center gap-2">
            {tierFilter !== "all" && <Button variant="outline" size="sm" onClick={() => setTierFilter("all")}>Toutes les tranches</Button>}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-8 h-9 w-52" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? <div className="p-4"><Skeleton className="h-64 w-full" /></div> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-y bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-10">#</th>
                  <SortHead k="name">Restaurant</SortHead>
                  <th className="px-3 py-2 text-left font-medium">Tranche</th>
                  <SortHead k="ads" right>Pub HT</SortHead>
                  <SortHead k="revenue" right>{revLabel}</SortHead>
                  <SortHead k="pct">Pub / CA</SortHead>
                  <SortHead k="delta" right>Évol.</SortHead>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={r.id} onClick={() => navigate(`/analytics/ads-spend/${r.id}`)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                    <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5"><div className="font-medium">{r.name}</div>{r.city && <div className="text-xs text-muted-foreground">{r.city}</div>}</td>
                    <td className="px-3 py-2.5"><Badge variant="outline" className={ADS_EFFORT_TIERS[r.tier].className}>{ADS_EFFORT_TIERS[r.tier].label}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{eur(r.ads)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{eur(r.revenue)}</td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <div className="relative h-2 flex-1 rounded-full bg-muted">
                          <div className={`absolute inset-y-0 left-0 rounded-full ${ADS_EFFORT_TIERS[r.tier].barClass}`} style={{ width: `${((r.pct ?? 0) / maxPct) * 100}%` }} />
                          {medianPct != null && <div className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/60" style={{ left: `${(medianPct / maxPct) * 100}%` }} title="Médiane" />}
                        </div>
                        <span className="w-16 text-right font-semibold tabular-nums">{pctFmt(r.pct)}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums text-xs ${r.delta == null ? "text-muted-foreground" : r.delta > 0 ? "text-destructive" : r.delta < 0 ? "text-success" : "text-muted-foreground"}`}>
                      {r.delta == null ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(2).replace(".", ",")} pt`}
                    </td>
                  </tr>
                ))}
                {!tableRows.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun restaurant</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
