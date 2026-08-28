import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  Euro,
  MessageCircle,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import { ChataigneOrdersAnalysis } from "@/components/chataigne/ChataigneOrdersAnalysis";
import { ChataigneOrdersTable } from "@/components/chataigne/ChataigneOrdersTable";
import { ChataigneHourlySection } from "@/components/chataigne/ChataigneHourlySection";
import { DailyComparisonCharts } from "@/components/analytics/DailyComparisonCharts";
import { fetchDailyChataigne } from "@/lib/dailyChannelFetchers";

import {
  useChataigneByRestaurant,
  useChataigneMonthly,
  useChataigneOverview,
  type ChataigneRestaurant,
} from "@/hooks/useChataigne";

const fmtEur = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));

const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

const FULL_MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const monthLabel = (mois: string) => {
  const [y, m] = mois.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_LABELS[idx] ?? mois} ${y?.slice(2) ?? ""}`;
};

function FreshnessBadge({ value, isLoading }: { value: string | null; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-6 w-48" />;
  if (!value) {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
        Aucune synchronisation enregistrée
      </Badge>
    );
  }
  const hours = (Date.now() - new Date(value).getTime()) / 3_600_000;
  const fresh = hours < 48;
  const label =
    hours < 1
      ? "il y a moins d'une heure"
      : hours < 24
        ? `il y a ${Math.round(hours)} h`
        : `il y a ${Math.round(hours / 24)} j`;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        fresh
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", fresh ? "bg-emerald-500" : "bg-amber-500")} />
      {fresh ? "Données à jour" : "Données à rafraîchir"} · dernière synchro {label}
    </Badge>
  );
}

type SortKey = "restaurant_name" | "city" | "commandes" | "ca_brut" | "panier_moyen";

export default function Chataigne() {
  const [sortKey, setSortKey] = useState<SortKey>("ca_brut");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab =
    tabParam === "details" || tabParam === "orders" || tabParam === "daily" ? tabParam : "overview";
  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  const {
    selectedRestaurants,
    selectedChainId,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
  } = useAnalyticsContext();

  const { startDate, endDate } = useDataGranularity({
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  });

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, city, is_pinned, is_active")
        .order("name");
      if (selectedChainId) query = query.eq("chain_id", selectedChainId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const chainRestaurantIds = useMemo(() => restaurants?.map((r) => r.id) ?? [], [restaurants]);

  // undefined = scope pas encore résolu → requêtes en attente
  const restaurantFilter = useMemo<string[] | null | undefined>(() => {
    if (!restaurants) return undefined;
    const resolved = resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    });
    if (!resolved) return null; // toutes marques accessibles
    if (resolved === EMPTY_BRAND_SCOPE_RESTAURANT_IDS) return EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
    return resolved;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const overviewQ = useChataigneOverview(start, end, restaurantFilter);
  const monthlyQ = useChataigneMonthly(start, end, restaurantFilter);
  const restaurantsQ = useChataigneByRestaurant(start, end, restaurantFilter);

  const chartData = useMemo(
    () =>
      (monthlyQ.data ?? []).map((m) => ({
        label: monthLabel(m.mois),
        ca: m.ca_brut,
        commandes: m.commandes,
      })),
    [monthlyQ.data]
  );

  const sorted = useMemo(() => {
    const rows: ChataigneRestaurant[] = [...(restaurantsQ.data ?? [])];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av).localeCompare(String(bv), "fr")
        : String(bv).localeCompare(String(av), "fr");
    });
    return rows;
  }, [restaurantsQ.data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((s) => !s);
    else {
      setSortKey(key);
      setSortAsc(key === "restaurant_name" || key === "city");
    }
  };

  const SortHead = ({
    keyName,
    label,
    align = "left",
  }: {
    keyName: SortKey;
    label: string;
    align?: "left" | "right";
  }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(keyName)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          sortKey === keyName ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {sortKey === keyName &&
          (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
      </button>
    </TableHead>
  );

  const o = overviewQ.data;
  const isLoading =
    restaurantFilter === undefined ||
    overviewQ.isLoading ||
    monthlyQ.isLoading ||
    restaurantsQ.isLoading;
  const isEmpty =
    !isLoading &&
    (!o || (o.commandes === 0 && o.ca_brut === 0)) &&
    (restaurantsQ.data ?? []).length === 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Chataigne</h1>
              <p className="text-muted-foreground">
                Canal propre WhatsApp &amp; Instagram · démarré en juin 2026
              </p>
            </div>
            <FreshnessBadge value={o?.derniere_sync ?? null} isLoading={overviewQ.isLoading} />
          </div>
          <AnalyticsHeader />
        </div>

        {/* KPI */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Chiffre d'affaires brut" value={fmtEur(o?.ca_brut ?? 0)} icon={Euro} />
            <KPICard title="Commandes" value={fmtInt(o?.commandes ?? 0)} icon={ShoppingBag} />
            <KPICard title="Panier moyen" value={fmtEur(o?.panier_moyen ?? 0, 2)} icon={Wallet} />
            <KPICard title="Restaurants actifs" value={fmtInt(o?.restos_actifs ?? 0)} icon={Store} />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <MessageCircle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          CA brut = valeur des commandes passées via WhatsApp &amp; Instagram. Canal propre de la
          marque : quasiment aucune commission n'est prélevée, le CA brut est donc très proche du CA
          encaissé. Comparaison N vs N-1 indisponible (—) : le canal a démarré en juin 2026.
        </p>

        {isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Aucune donnée sur cette période</p>
              <p className="text-sm text-muted-foreground">
                Élargis la période, vérifie la sélection de restaurants ou la synchronisation du
                canal Chataigne.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="details">Analyse détaillée</TabsTrigger>
              <TabsTrigger value="orders">Commandes (détail)</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Évolution mensuelle */}
              <Card>
                <CardHeader>
                  <CardTitle>Évolution mensuelle</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyQ.isLoading ? (
                    <Skeleton className="h-[340px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis
                          yAxisId="left"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(v) => fmtEur(Number(v))}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(v) => fmtInt(Number(v))}
                        />
                        <RTooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            color: "hsl(var(--popover-foreground))",
                          }}
                          formatter={(value: number, name: string) =>
                            name === "CA brut" ? fmtEur(Number(value)) : fmtInt(Number(value))
                          }
                        />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="ca"
                          name="CA brut"
                          fill="hsl(var(--primary))"
                          radius={[6, 6, 0, 0]}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="commandes"
                          name="Commandes"
                          stroke="hsl(var(--accent-foreground))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Tableau par restaurant */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance par restaurant</CardTitle>
                </CardHeader>
                <CardContent>
                  {restaurantsQ.isLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : sorted.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Aucun restaurant actif sur cette période.
                    </p>
                  ) : (
                    <div className="max-h-[520px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortHead keyName="restaurant_name" label="Restaurant" />
                            <SortHead keyName="city" label="Ville" />
                            <SortHead keyName="commandes" label="Commandes" align="right" />
                            <SortHead keyName="ca_brut" label="CA brut" align="right" />
                            <SortHead keyName="panier_moyen" label="Panier moyen" align="right" />
                            <TableHead className="text-right">vs N-1</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sorted.map((r) => (
                            <TableRow key={r.restaurant_id}>
                              <TableCell className="font-medium">
                                {r.restaurant_name ?? "—"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                              <TableCell className="text-right">{fmtInt(r.commandes)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {fmtEur(r.ca_brut)}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtEur(r.panier_moyen, 2)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">—</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Horaires de commande */}
              <ChataigneHourlySection
                start={start}
                end={end}
                restaurantIds={restaurantFilter}
              />
            </TabsContent>


            <TabsContent value="details">
              <ChataigneOrdersAnalysis
                start={start}
                end={end}
                totalOrders={o?.commandes ?? 0}
                restaurantIds={restaurantFilter ?? null}
              />
            </TabsContent>

            <TabsContent value="orders">
              <ChataigneOrdersTable start={start} end={end} restaurantIds={restaurantFilter} />
            </TabsContent>

            <TabsContent value="daily" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Comparaison jour par jour du mois de {FULL_MONTHS[dailyMonth - 1]} {dailyYear} avec{" "}
                {FULL_MONTHS[prevMonthIndex]} {prevMonthYear}.
              </p>
              <DailyComparisonCharts
                cacheKey="chataigne"
                fetcher={fetchDailyChataigne}
                year={dailyYear}
                month={dailyMonth}
                restaurantIds={restaurantFilter}
                comparisonMode="previous_month"
                currentLabel={FULL_MONTHS[dailyMonth - 1]}
                prevLabel={FULL_MONTHS[prevMonthIndex]}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
