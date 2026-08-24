import { useMemo, useState } from "react";
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
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Euro, Percent, TrendingUp, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import {
  useChataigneCohortRetention,
  useChataigneCustomerEvolution,
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

const cohortLabel = (cohorte: string) => {
  const [y, m] = cohorte.split("-");
  return `${MONTH_LABELS[Number(m) - 1] ?? cohorte} ${y?.slice(2) ?? ""}`;
};

const periodLabel = (periode: string, granularity: GrowthGranularity) => {
  try {
    const d = parseISO(periode);
    if (granularity === "month") return format(d, "MMM yy", { locale: fr });
    if (granularity === "week") return `S${format(d, "II", { locale: fr })} · ${format(d, "dd/MM")}`;
    return format(d, "dd/MM");
  } catch {
    return periode;
  }
};

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

  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } =
    useAnalyticsContext();

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
  const offsets = useMemo(() => Array.from({ length: maxOffset + 1 }, (_, i) => i), [maxOffset]);

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
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <RTooltip
                        formatter={(v: number, name) => [fmtInt(v), name as string]}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          color: "hsl(var(--popover-foreground))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="nouveaux"
                        name="Nouveaux clients"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="recurrents"
                        name="Clients récurrents"
                        stroke="hsl(var(--chart-2, var(--accent)))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
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
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
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
                        fill="hsl(var(--primary))"
                        fillOpacity={0.35}
                      />
                      <Area
                        type="monotone"
                        dataKey="ca_recurrents"
                        name="CA récurrents"
                        stackId="ca"
                        stroke="hsl(var(--chart-2, var(--accent)))"
                        fill="hsl(var(--chart-2, var(--accent)))"
                        fillOpacity={0.35}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Rétention par cohorte — % des clients acquis un mois donné qui recommandent les mois
                  suivants
                </CardTitle>
                <CardDescription>
                  Le canal a démarré en juin 2026 ; les cohortes récentes ont eu moins de temps pour
                  revenir.
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
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-1 text-sm">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-background text-left font-medium text-muted-foreground">
                            Cohorte
                          </th>
                          <th className="text-right font-medium text-muted-foreground">Taille</th>
                          {offsets.map((o) => (
                            <th key={o} className="min-w-[56px] text-center font-medium text-muted-foreground">
                              M{o}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cohorts.map((c) => (
                          <tr key={c.cohorte}>
                            <td className="sticky left-0 z-10 bg-background whitespace-nowrap font-medium">
                              {cohortLabel(c.cohorte)}
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
                )}
              </CardContent>
            </Card>

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
