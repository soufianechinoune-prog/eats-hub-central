import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Euro, Gift, HandCoins, Percent, ShoppingBasket, TrendingUp, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import {
  useChataigneBasketSegments,
  useChataigneCohortRetention,
  useChataigneCustomerEvolution,
  useChataigneReferralEvolution,
  useChataigneReferralSummary,
  useChataigneRetentionByAcquisition,
  type GrowthGranularity,
} from "@/hooks/useChataigneGrowth";

import { cn } from "@/lib/utils";


const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const fmtEur = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)} %`;

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const cohortLabelFull = (cohorte: string) => {
  const [y, m] = cohorte.split("-");
  const monthName = MONTH_LABELS[Number(m) - 1] ?? cohorte;
  return `Arrivés en ${monthName.toLowerCase()} ${y}`;
};

const offsetLabel = (o: number) => {
  if (o === 1) return "Revenus le mois suivant";
  return `Revenus ${o} mois après`;
};

const periodLabel = (periode: string, granularity: GrowthGranularity) => {
  try {
    const d = parseISO(periode);
    if (granularity === "month") return format(d, "MMM yyyy", { locale: fr });
    if (granularity === "week") return `S${format(d, "II", { locale: fr })} · ${format(d, "dd/MM")}`;
    return format(d, "dd/MM");
  } catch {
    return periode;
  }
};

const SEGMENT_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(199 89% 48%)",
  "hsl(var(--muted-foreground))",
];


function retentionColor(pct: number) {
  if (pct <= 0) return "bg-muted text-muted-foreground";
  if (pct < 5) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (pct < 10) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (pct < 20) return "bg-emerald-500/35 text-emerald-900 dark:text-emerald-100";
  if (pct < 35) return "bg-emerald-500/55 text-emerald-950 dark:text-emerald-50";
  return "bg-emerald-600/75 text-emerald-50";
}

export default function ChataigneGrowth() {
  const [granularity, setGranularity] = useState<GrowthGranularity>("week");

  const {
    selectedRestaurants,
    selectedChainId,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    setPeriodMode,
    setDateRange,
  } = useAnalyticsContext();

  // Par défaut sur cette page : tout l'historique du canal (1er juin 2026 → aujourd'hui)
  const didInitPeriod = useRef(false);
  useEffect(() => {
    if (didInitPeriod.current) return;
    didInitPeriod.current = true;
    setDateRange({ from: new Date(2026, 5, 1), to: new Date() });
    setPeriodMode("range");
  }, [setDateRange, setPeriodMode]);

  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");


  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("id, name, city, is_pinned, is_active").order("name");
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
    if (!resolved) return null;
    if (resolved === EMPTY_BRAND_SCOPE_RESTAURANT_IDS) return EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
    return resolved;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const evolutionQ = useChataigneCustomerEvolution(start, end, granularity, restaurantFilter);
  const cohortQ = useChataigneCohortRetention(restaurantFilter);
  const basketQ = useChataigneBasketSegments(start, end, restaurantFilter);
  const basketSegments = basketQ.data ?? [];
  const retentionByAcquisitionQ = useChataigneRetentionByAcquisition(restaurantFilter);
  const retentionByAcquisition = retentionByAcquisitionQ.data ?? [];


  const referralSummaryQ = useChataigneReferralSummary(start, end, restaurantFilter);
  const referral = referralSummaryQ.data ?? {
    filleuls: 0,
    conversions: 0,
    cout_total: 0,
    panier_moyen_filleul: 0,
    filleuls_revenus: 0,
    taux_reachat: 0,
  };
  const referralEvolutionQ = useChataigneReferralEvolution(start, end, granularity, restaurantFilter);
  const referralChartData = useMemo(
    () =>
      (referralEvolutionQ.data ?? []).map((r) => ({
        label: periodLabel(r.periode, granularity),
        filleuls: r.filleuls,
        parrains_convertis: r.parrains_convertis,
      })),
    [referralEvolutionQ.data, granularity]
  );




  const rows = evolutionQ.data ?? [];

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        label: periodLabel(r.periode, granularity),
        nouveaux: r.nouveaux,
        recurrents: r.recurrents,
        actifs: r.actifs,
        ca_nouveaux: r.ca_nouveaux,
        ca_recurrents: r.ca_recurrents,
      })),
    [rows, granularity]
  );

  const kpis = useMemo(() => {
    const nouveaux = rows.reduce((s, r) => s + r.nouveaux, 0);
    const recurrents = rows.length ? Math.max(...rows.map((r) => r.recurrents)) : 0;
    const actifs = rows.reduce((s, r) => s + r.actifs, 0);
    const caN = rows.reduce((s, r) => s + r.ca_nouveaux, 0);
    const caR = rows.reduce((s, r) => s + r.ca_recurrents, 0);
    const partRec = caN + caR > 0 ? (caR / (caN + caR)) * 100 : 0;
    return { nouveaux, recurrents, actifs, caN, caR, partRec };
  }, [rows]);

  const globalBasket = useMemo(() => {
    const ca = rows.reduce((s, r) => s + r.ca_nouveaux + r.ca_recurrents, 0);
    const cmd = rows.reduce((s, r) => s + r.commandes, 0);
    return cmd > 0 ? ca / cmd : 0;
  }, [rows]);


  const cohortRows = cohortQ.data ?? [];
  const cohorts = useMemo(() => {
    const map = new Map<string, { cohorte: string; taille: number; cells: Map<number, number> }>();
    for (const r of cohortRows) {
      const entry = map.get(r.cohorte) ?? { cohorte: r.cohorte, taille: r.taille_cohorte, cells: new Map() };
      entry.taille = Math.max(entry.taille, r.taille_cohorte);
      entry.cells.set(r.mois_offset, r.taux_pct);
      map.set(r.cohorte, entry);
    }
    return [...map.values()].sort((a, b) => a.cohorte.localeCompare(b.cohorte));
  }, [cohortRows]);

  const maxOffset = useMemo(
    () => cohortRows.reduce((m, r) => Math.max(m, r.mois_offset), 0),
    [cohortRows]
  );
  // Exclude M0 (always 100%, confusing) — start from M1
  const offsets = useMemo(() => Array.from({ length: Math.max(0, maxOffset) }, (_, i) => i + 1), [maxOffset]);

  const isLoading = restaurantFilter === undefined || evolutionQ.isLoading;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Croissance &amp; Clients</h1>
              <p className="text-muted-foreground">
                Canal Chataigne · acquisition, récurrence et rétention · 100 % anonyme
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={granularity}
              onValueChange={(v) => v && setGranularity(v as GrowthGranularity)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="day">Jour</ToggleGroupItem>
              <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
              <ToggleGroupItem value="month">Mois</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <AnalyticsHeader />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Nouveaux clients" value={fmtInt(kpis.nouveaux)} icon={UserPlus} />
            <KPICard title="Clients récurrents (pic)" value={fmtInt(kpis.recurrents)} icon={Users} />
            <KPICard title="Total actifs (cumul périodes)" value={fmtInt(kpis.actifs)} icon={TrendingUp} />
            <KPICard title="Part du CA récurrents" value={fmtPct(kpis.partRec)} icon={Percent} />
          </div>
        )}

        {isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Aucune donnée client sur cette période</p>
              <p className="text-sm text-muted-foreground">
                Élargis la période ou vérifie la sélection de restaurants.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Évolution des clients</CardTitle>
                <CardDescription>
                  Nouveaux clients vs clients récurrents par {granularity === "day" ? "jour" : granularity === "week" ? "semaine" : "mois"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {evolutionQ.isLoading ? (
                  <Skeleton className="h-[320px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gradNouveaux" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="gradRecurrents" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} tickMargin={8} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <RTooltip
                        formatter={(v: number, name) => [fmtInt(Number(v)), name as string]}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          color: "hsl(var(--popover-foreground))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="nouveaux"
                        name="Nouveaux clients"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#gradNouveaux)"
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="recurrents"
                        name="Clients récurrents"
                        stroke="hsl(142 71% 45%)"
                        strokeWidth={2}
                        fill="url(#gradRecurrents)"
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CA nouveaux vs récurrents</CardTitle>
                <CardDescription>Répartition du chiffre d'affaires par type de client</CardDescription>
              </CardHeader>
              <CardContent>
                {evolutionQ.isLoading ? (
                  <Skeleton className="h-[320px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gradCaNouveaux" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradCaRecurrents" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} tickMargin={8} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtEur(Number(v))} />
                      <RTooltip
                        formatter={(v: number, name) => [fmtEur(Number(v), 2), name as string]}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          color: "hsl(var(--popover-foreground))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="ca_nouveaux"
                        name="CA nouveaux"
                        stackId="ca"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#gradCaNouveaux)"
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="ca_recurrents"
                        name="CA récurrents"
                        stackId="ca"
                        stroke="hsl(142 71% 45%)"
                        strokeWidth={2}
                        fill="url(#gradCaRecurrents)"
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBasket className="h-4 w-4 text-muted-foreground" />
                  Panier moyen par type de client
                </CardTitle>
                <CardDescription>
                  Panier moyen (€) et volume de commandes par segment sur la période sélectionnée
                </CardDescription>
              </CardHeader>
              <CardContent>
                {basketQ.isLoading ? (
                  <Skeleton className="h-[340px] w-full" />
                ) : basketSegments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucune donnée sur cette période.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                      data={basketSegments}
                      layout="vertical"
                      margin={{ top: 8, right: 56, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" opacity={0.5} />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => fmtEur(Number(v))} />
                      <YAxis type="category" dataKey="segment" width={140} tick={{ fontSize: 12 }} />
                      <RTooltip
                        formatter={(v: number, _n, item) => [
                          `${fmtEur(Number(v), 2)} · ${fmtInt((item?.payload as { commandes?: number })?.commandes ?? 0)} commandes`,
                          "Panier moyen",
                        ]}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          color: "hsl(var(--popover-foreground))",
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="panier_moyen" name="Panier moyen" radius={[0, 6, 6, 0]} barSize={22}>
                        {basketSegments.map((s, i) => (
                          <Cell key={s.segment} fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} />
                        ))}
                        <LabelList
                          dataKey="panier_moyen"
                          position="right"
                          formatter={(v: number) => fmtEur(Number(v), 2)}
                          className="fill-foreground"
                          style={{ fontSize: 12, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {basketSegments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {basketSegments.map((s) => (
                      <span key={s.segment}>
                        {s.segment} : {fmtInt(s.commandes)} cmdes
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>


            <Card>
              <CardHeader>
                <CardTitle>Est-ce que les clients reviennent ?</CardTitle>
                <CardDescription>
                  Pour chaque groupe de clients selon leur mois d'arrivée, part de ceux qui ont recommandé les mois suivants.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cohortQ.isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : cohorts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucune cohorte disponible.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Dynamic "How to read" example */}
                    {(() => {
                      const first = cohorts[0];
                      if (!first) return null;
                      const m1 = first.cells.get(1);
                      const m2 = first.cells.get(2);
                      return (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Comment lire :</span>{" "}
                          Exemple — sur {fmtInt(first.taille)} clients {cohortLabelFull(first.cohorte).toLowerCase()},
                          {m1 !== undefined ? ` ${m1.toFixed(0)}% sont revenus le mois suivant` : ""}
                          {m1 !== undefined && m2 !== undefined ? "," : ""}
                          {m2 !== undefined ? ` ${m2.toFixed(0)}% deux mois après` : ""}
                          .
                        </p>
                      );
                    })()}

                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-1 text-sm">
                        <thead>
                          <tr>
                            <th className="sticky left-0 z-10 bg-background text-left font-medium text-muted-foreground">
                              Arrivés
                            </th>
                            <th className="text-right font-medium text-muted-foreground">Nb clients</th>
                            {offsets.map((o) => (
                              <th key={o} className="min-w-[56px] text-center font-medium text-muted-foreground">
                                {offsetLabel(o)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cohorts.map((c) => (
                            <tr key={c.cohorte}>
                              <td className="sticky left-0 z-10 bg-background whitespace-nowrap font-medium">
                                {cohortLabelFull(c.cohorte)}
                              </td>
                              <td className="text-right tabular-nums text-muted-foreground">
                                {fmtInt(c.taille)}
                              </td>
                              {offsets.map((o) => {
                                const val = c.cells.get(o);
                                return (
                                  <td key={o} className="p-0">
                                    {val === undefined ? (
                                      <div className="rounded-md py-1.5 text-center text-xs text-muted-foreground">
                                        —
                                      </div>
                                    ) : (
                                      <div
                                        className={cn(
                                          "rounded-md py-1.5 text-center text-xs font-medium tabular-nums",
                                          retentionColor(val)
                                        )}
                                      >
                                        {val.toFixed(0)}%
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Color legend + note */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500/10" />
                        <span>faible</span>
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600/75" />
                        <span>fort</span>
                      </span>
                      <span>
                        Lancement officiel du canal ~7 juillet 2026. La cohorte de juin est un pilote pré-lancement (petit groupe, non représentatif). Les cohortes de juillet/août sont encore trop récentes pour juger la rétention — chiffres à réévaluer dans 1-2 mois.
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4 pt-2">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <Gift className="h-5 w-5 text-muted-foreground" />
                  Parrainage
                </h2>
                <p className="text-sm text-muted-foreground">
                  Clients acquis via le programme de parrainage — filleuls (-25%) et parrains
                  récompensés (-15%). 100% anonyme.
                </p>
              </div>

              {referralSummaryQ.isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <KPICard title="Filleuls acquis" value={fmtInt(referral.filleuls)} icon={UserPlus} />
                  <KPICard
                    title="Parrainages convertis"
                    value={fmtInt(referral.conversions)}
                    icon={HandCoins}
                  />
                  <KPICard
                    title="Coût du programme"
                    value={fmtEur(referral.cout_total, 2)}
                    icon={Euro}
                  />
                  <KPICard
                    title="Panier moyen filleul"
                    value={fmtEur(referral.panier_moyen_filleul, 2)}
                    icon={ShoppingBasket}
                  />
                  <div className="space-y-1">
                    <KPICard
                      title="Taux de réachat filleuls"
                      value={fmtPct(referral.taux_reachat)}
                      icon={Percent}
                    />
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Programme récent : la plupart des filleuls sont trop récents pour avoir eu le
                      temps de revenir — ce taux montera.
                    </p>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Évolution du parrainage</CardTitle>
                  <CardDescription>
                    Filleuls acquis et parrainages convertis par{" "}
                    {granularity === "day" ? "jour" : granularity === "week" ? "semaine" : "mois"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {referralEvolutionQ.isLoading ? (
                    <Skeleton className="h-[320px] w-full" />
                  ) : referralChartData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Aucune donnée de parrainage sur cette période.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={referralChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="gradFilleuls" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                          </linearGradient>
                          <linearGradient id="gradParrains" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} tickMargin={8} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <RTooltip
                          formatter={(v: number, name) => [fmtInt(Number(v)), name as string]}
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--popover-foreground))",
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="filleuls"
                          name="Filleuls acquis"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#gradFilleuls)"
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="parrains_convertis"
                          name="Parrainages convertis"
                          stroke="hsl(38 92% 50%)"
                          strokeWidth={2}
                          fill="url(#gradParrains)"
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                  {referral.panier_moyen_filleul > 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Panier moyen filleul {fmtEur(referral.panier_moyen_filleul, 2)} vs panier global
                      du canal {fmtEur(globalBasket, 2)} —{" "}
                      {referral.panier_moyen_filleul >= globalBasket
                        ? "les filleuls commandent plus gros."
                        : "les filleuls commandent un peu moins gros."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">
              <Euro className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              Analyse basée sur un identifiant client pseudonymisé (hash irréversible) : aucune donnée
              personnelle n'est stockée ni affichée.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
