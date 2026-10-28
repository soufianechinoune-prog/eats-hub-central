import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { format, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Megaphone } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { ADS_RATIO_MODES, type AdsRatioMode } from "@/lib/adsRatioModes";
import { ADS_EFFORT_TIERS, getAdsEffortTier, quarterRange } from "@/lib/adsEffortTiers";
import { fetchAdsRatio, sumAdsRows, type AdsRatioRow } from "@/lib/adsRatioFetch";
import { AdsQuarterCards, type QuarterStat } from "@/components/ads/AdsQuarterCards";
import { AdsConsolidationBadge } from "@/components/ads/AdsConsolidationBadge";
import { aggregateEfficiency, fetchAdsEfficiency, isComparable, lastClosedQuarters, SWEET_SPOT } from "@/lib/adsEfficiency";
import { computeIncremental } from "@/lib/adsIncremental";
import { UberEatsLogo } from "@/components/icons/PlatformIcons";

const SENTINEL = "00000000-0000-0000-0000-000000000000";
const eur = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
const pctFmt = (v: number | null) => (v == null ? "—" : v.toFixed(2).replace(".", ",") + " %");

export default function AdsSpendRestaurant() {
  const { restaurantId = "" } = useParams();
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [mode, setMode] = useState<AdsRatioMode>("uber");

  const { data: restaurantsRaw } = useActiveRestaurants();
  const restaurants = (restaurantsRaw ?? []) as { id: string; name: string; city?: string | null }[];
  const ids = useMemo(() => restaurants.map((r) => r.id), [restaurants]);
  const ready = ids.length > 0 && !ids.includes(SENTINEL) && ids.includes(restaurantId);
  const info = restaurants.find((r) => r.id === restaurantId);

  // Requêtes réseau (le restaurant est extrait des lignes) : 12 mois + Q4 de l'année précédente
  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    const start = new Date(year, m, 1);
    const e = endOfMonth(start);
    return { start, end: e > today ? today : e, future: start > today };
  }), [year, today]);
  const prevQ4 = useMemo(() => quarterRange(year - 1, 4, today), [year, today]);
  const periods = [prevQ4, ...months];
  const results = useQueries({
    queries: periods.map((p) => ({
      queryKey: ["ads-page", format(p.start, "yyyy-MM-dd"), format(p.end, "yyyy-MM-dd"), ids],
      queryFn: () => fetchAdsRatio(p.start, p.end, ids),
      enabled: ready && !p.future, staleTime: 300000, retry: false,
    })),
  });
  const [prevQ4Res, ...monthRes] = results;
  const own = (rows: AdsRatioRow[] | undefined) => (rows ?? []).filter((r) => r.restaurant_id === restaurantId);

  const monthly = months.map((m, i) => {
    const rows = monthRes[i]?.data;
    const r = sumAdsRows(own(rows), mode);
    const n = sumAdsRows(rows ?? [], mode);
    return { label: format(m.start, "MMM", { locale: fr }), future: m.future, loading: monthRes[i]?.isLoading, rows: own(rows), ads: r.ads, revenue: r.revenue, pct: r.pct, network: n.pct };
  });

  const qStats: QuarterStat[] = [1, 2, 3, 4].map((q) => {
    const slice = monthly.slice((q - 1) * 3, q * 3);
    const r = sumAdsRows(slice.flatMap((m) => m.rows), mode);
    return { q, ads: r.ads, revenue: r.revenue, pct: r.pct, future: slice[0].future, loading: !ready || slice.some((m) => m.loading) };
  });
  const p4 = sumAdsRows(own(prevQ4Res?.data), mode);
  const prevQ4Stat: QuarterStat = { q: 4, ads: p4.ads, revenue: p4.revenue, pct: p4.pct, future: prevQ4.future, loading: !!prevQ4Res?.isLoading };

  const yearTotal = sumAdsRows(monthly.flatMap((m) => m.rows), mode);
  const yearNet = sumAdsRows(monthRes.flatMap((q) => q.data ?? []), mode);
  const chartData = monthly.filter((m) => !m.future).map((m) => ({
    label: m.label, ads: Math.round(m.ads),
    pct: m.pct != null ? Number(m.pct.toFixed(2)) : null,
    network: m.network != null ? Number(m.network.toFixed(2)) : null,
  }));
  const tier = getAdsEffortTier(yearTotal.ads, yearTotal.pct);

  const effQ = useMemo(() => lastClosedQuarters(today), [today]);
  const effRes = useQuery({
    queryKey: ["ads-eff-q", format(effQ.cur.start, "yyyy-MM-dd"), ids],
    queryFn: () => fetchAdsEfficiency(effQ.cur, effQ.prev, ids), enabled: ready, staleTime: 600000, retry: false,
  });
  const effRows = effRes.data ?? [];
  const ownEff = aggregateEfficiency(effRows.filter((r) => r.restaurant_id === restaurantId));
  const netEff = aggregateEfficiency(effRows.filter((r) => isComparable(r) && r.restaurant_id !== restaurantId));
  const gap = ownEff.growth != null && netEff.growth != null ? ownEff.growth - netEff.growth : null;
  const GAUGE_MAX = 8;
  const pos = Math.min(100, ((ownEff.pct ?? 0) / GAUGE_MAX) * 100);
  const zone = ownEff.pct == null ? null : ownEff.pct < SWEET_SPOT.min ? "under" : ownEff.pct < SWEET_SPOT.max ? "in" : "over";
  const f1 = (v: number | null, sign = false) => (v == null ? "—" : `${sign && v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}`);
  const effLoading = !ready || effRes.isLoading;
  const inc = useMemo(() => computeIncremental(effRows, restaurantId), [effRows, restaurantId]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/analytics/ads-spend")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="h-11 w-11 rounded-xl bg-uber/10 flex items-center justify-center"><Megaphone className="h-5 w-5 text-uber" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{info?.name ?? "Restaurant"}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5"><UberEatsLogo size={12} /> Dépenses pub / CA · année {year}{info?.city ? ` · ${info.city}` : ""}</p>
          </div>
        </div>
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as AdsRatioMode)} size="sm" className="gap-1">
          {(Object.keys(ADS_RATIO_MODES) as AdsRatioMode[]).map((k) => (
            <ToggleGroupItem key={k} value={k} className="h-8 px-3 text-xs data-[state=on]:bg-uber/15 data-[state=on]:text-uber">{ADS_RATIO_MODES[k].label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {restaurantsRaw && !info ? (
        <Card><CardContent className="p-6 text-muted-foreground">Ce restaurant n'est pas accessible dans l'enseigne active.</CardContent></Card>
      ) : (
        <>
          <AdsConsolidationBadge endDate={year === today.getFullYear() ? today : new Date(year, 11, 31)} />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-2 border-uber/30 bg-gradient-to-br from-card to-uber/5"><CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Ratio pub / CA {year}</p>
              {!ready || monthly.some((m) => m.loading) ? <Skeleton className="h-9 w-24 mt-2" /> : <p className="text-3xl font-bold text-uber mt-1">{pctFmt(yearTotal.pct)}</p>}
              <Badge variant="outline" className={`mt-2 ${ADS_EFFORT_TIERS[tier].className}`}>{ADS_EFFORT_TIERS[tier].label}</Badge>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Budget pub investi (HT)</p>
              <p className="text-3xl font-bold mt-1">{eur(yearTotal.ads)}</p>
              <p className="text-xs text-muted-foreground mt-1">sur {eur(yearTotal.revenue)} de CA</p>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Réseau sur la même année</p>
              <p className="text-3xl font-bold mt-1">{pctFmt(yearNet.pct)}</p>
              <p className="text-xs text-muted-foreground mt-1">ratio pub / CA de l'ensemble des restaurants</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rendement de la pub · {effQ.cur.label} vs {effQ.prev.label}</CardTitle>
              <p className="text-xs text-muted-foreground">Dernier trimestre clos, comparé au reste du réseau à périmètre constant · constat observé, pas une preuve de cause à effet</p>
            </CardHeader>
            <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Écart de croissance vs réseau</p>
                {effLoading ? <Skeleton className="h-9 w-24 mt-2" /> : (<>
                  <p className={`text-3xl font-bold mt-1 ${gap == null ? "" : gap >= 0 ? "text-success" : "text-destructive"}`}>{gap == null ? "—" : `${f1(gap, true)} pt`}</p>
                  <p className="text-xs text-muted-foreground mt-1">Restaurant {f1(ownEff.growth, true)} % de CA avec {f1(ownEff.pct)} % de pub, réseau {f1(netEff.growth, true)} % avec {f1(netEff.pct)} %.</p>
                </>)}
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Position face au repère réseau ({String(SWEET_SPOT.min).replace(".", ",")} – {SWEET_SPOT.max} %)</p>
                {effLoading ? <Skeleton className="h-9 w-full mt-2" /> : (<>
                  <div className="relative mt-4 h-3 rounded-full bg-muted">
                    <div className="absolute inset-y-0 rounded-full bg-success/30" style={{ left: `${(SWEET_SPOT.min / GAUGE_MAX) * 100}%`, width: `${((SWEET_SPOT.max - SWEET_SPOT.min) / GAUGE_MAX) * 100}%` }} />
                    {ownEff.pct != null && <div className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-full bg-uber" style={{ left: `${pos}%` }} />}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>0 %</span><span>{GAUGE_MAX} %+</span></div>
                  <p className="text-xs mt-2">{zone == null ? "Pas de donnée" : zone === "in" ? "Dans la zone de rendement observée" : zone === "under" ? "En dessous du repère réseau" : "Au-dessus du repère réseau"} · {f1(ownEff.pct)} %</p>
                </>)}
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Net en banque (versement − pub)</p>
                {effLoading ? <Skeleton className="h-9 w-24 mt-2" /> : (<>
                  <p className="text-3xl font-bold mt-1">{eur(ownEff.payout - ownEff.ads)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{f1(ownEff.netMargin)} % du CA · réseau {f1(netEff.netMargin)} %</p>
                </>)}
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Impact incrémental vs jumeaux</p>
                {effLoading ? <Skeleton className="h-9 w-24 mt-2" /> : (<>
                  <p className={`text-3xl font-bold mt-1 ${inc.incremental == null ? "" : inc.incremental >= 0 ? "text-success" : "text-destructive"}`}>
                    {inc.incremental == null ? "—" : `${inc.incremental > 0 ? "+" : ""}${eur(inc.incremental)}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {inc.twinsGrowth == null
                      ? "Pas assez de restaurants comparables"
                      : `Versement au-delà du rythme médian des ${inc.twins.length} jumeaux (${f1(inc.twinsGrowth * 100, true)} %)`}
                  </p>
                </>)}
              </div>
            </CardContent>
          </Card>

          <AdsQuarterCards year={year} onYearChange={setYear} stats={qStats} prevQ4={prevQ4Stat} maxYear={today.getFullYear()} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Évolution mensuelle {year}</CardTitle>
              <p className="text-xs text-muted-foreground">Barres : pub HT · Courbe pleine : ratio du restaurant · Pointillés : ratio réseau</p>
            </CardHeader>
            <CardContent className="h-72">
              {!ready || monthly.some((m) => m.loading) ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="ads" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} width={50} />
                    <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={40} />
                    <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, n: string) => n === "ads" ? [eur(v), "Pub HT"] : [pctFmt(v), n === "pct" ? "Restaurant" : "Réseau"]} />
                    <Legend formatter={(n) => (n === "ads" ? "Pub HT" : n === "pct" ? "Restaurant" : "Réseau")} wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="ads" dataKey="ads" fill="hsl(var(--uber) / 0.35)" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="pct" dataKey="pct" stroke="hsl(var(--uber))" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line yAxisId="pct" dataKey="network" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Détail par mois</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-y bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Mois</th>
                    <th className="px-3 py-2 text-right font-medium">Pub HT</th>
                    <th className="px-3 py-2 text-right font-medium">CA</th>
                    <th className="px-3 py-2 text-right font-medium">Pub / CA</th>
                    <th className="px-3 py-2 text-right font-medium">Réseau</th>
                    <th className="px-3 py-2 text-left font-medium">Tranche</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.filter((m) => !m.future).map((m) => {
                    const t = getAdsEffortTier(m.ads, m.pct);
                    return (
                      <tr key={m.label} className="border-b last:border-0">
                        <td className="px-3 py-2.5 font-medium"><span className="capitalize">{m.label}</span><div className="mt-1"><AdsConsolidationBadge endDate={months[monthly.indexOf(m)].end} /></div></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{eur(m.ads)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{eur(m.revenue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{pctFmt(m.pct)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{pctFmt(m.network)}</td>
                        <td className="px-3 py-2.5"><Badge variant="outline" className={ADS_EFFORT_TIERS[t].className}>{ADS_EFFORT_TIERS[t].label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
