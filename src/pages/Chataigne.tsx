import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format, parseISO, startOfWeek, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Area } from "recharts";

type Bucket = "day" | "week" | "month";
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
  Bike,
  Euro,
  MessageCircle,
  ShoppingBag,
  Store,
  Wallet,
  Percent,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Users as UsersIcon, Repeat as RepeatIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import { ChataigneOrdersAnalysis } from "@/components/chataigne/ChataigneOrdersAnalysis";
import { ChataigneOrdersTable } from "@/components/chataigne/ChataigneOrdersTable";
import { ChataigneHourlySection } from "@/components/chataigne/ChataigneHourlySection";
import { ChataigneServiceComparison } from "@/components/chataigne/ChataigneServiceComparison";
import { ChataigneServiceRecurrence } from "@/components/chataigne/ChataigneServiceRecurrence";
import { DailyComparisonCharts } from "@/components/analytics/DailyComparisonCharts";
import { fetchDailyChataigne } from "@/lib/dailyChannelFetchers";
import { ChataigneWeekdaySection } from "@/components/chataigne/ChataigneWeekdaySection";

import {
  useChataigneByRestaurant,
  useChataigneMonthly,
  useChataigneOverview,
  useChataigneServiceComparison,
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

const fmtPct = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function CardShell({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card className="h-full min-w-0 rounded-lg shadow-elegant">
      <CardContent className="flex h-full flex-col gap-1.5 p-4">
        <div className="flex min-h-8 items-start justify-between gap-2">
          <p className="text-xs font-medium leading-4 text-muted-foreground">{title}</p>
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function CompareCard({
  title, icon, value, cur, prev, periodDays, sub,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  cur: number | null | undefined;
  prev: number | null | undefined;
  periodDays: number;
  sub?: string;
}) {
  const c = Number(cur ?? 0);
  const p = Number(prev ?? 0);
  const delta = prev !== undefined && prev !== null && p > 0 ? ((c - p) / p) * 100 : null;
  return (
    <CardShell title={title} icon={icon}>
      <p className="text-2xl font-semibold tabular-nums leading-8">{value}</p>
      <p className="text-[11px] leading-4 text-muted-foreground">
        {delta === null ? (
          <span>— vs les {periodDays} j précédents</span>
        ) : (
          <>
            <span className={cn("font-semibold", Math.abs(delta) < 0.05 ? "text-foreground" : delta > 0 ? "text-success" : "text-destructive")}>
              {delta > 0 ? "+" : ""}
              {delta.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
            </span>{" "}
            vs les {periodDays} j précédents
          </>
        )}
      </p>
      {sub && <p className="mt-auto pt-1 text-[11px] leading-4 text-muted-foreground">{sub}</p>}
    </CardShell>
  );
}

function RateCard({
  title, icon, loading, rate, prev, sub, lowerIsBetter, neutral, periodDays,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  rate: number | null;
  prev: number | null;
  sub: string;
  lowerIsBetter?: boolean;
  neutral?: boolean;
  periodDays: number;
}) {
  const delta = rate !== null && prev !== null ? rate - prev : null;
  const good = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0);
  return (
    <CardShell title={title} icon={icon}>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-2xl font-semibold tabular-nums leading-8">{rate === null ? "—" : fmtPct(rate)}</p>
      )}
      {!loading && (
        <p className="text-[11px] leading-4 text-muted-foreground">
          {delta === null ? (
            <span>— vs les {periodDays} j précédents</span>
          ) : (
            <>
              <span className={cn("font-semibold", Math.abs(delta) < 0.05 || neutral ? "text-foreground" : good ? "text-success" : "text-destructive")}>
                {delta > 0 ? "+" : ""}
                {delta.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pt
              </span>{" "}
              vs les {periodDays} j précédents
            </>
          )}
        </p>
      )}
      {!loading && sub && <p className="mt-auto pt-1 text-[11px] leading-4 text-muted-foreground">{sub}</p>}
    </CardShell>
  );
}

type SortKey = "restaurant_name" | "city" | "commandes" | "ca_brut" | "panier_moyen";

export default function Chataigne() {
  const [sortKey, setSortKey] = useState<SortKey>("ca_brut");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab =
    tabParam === "details" ||
    tabParam === "orders" ||
    tabParam === "daily" ||
    tabParam === "weekday" ||
    tabParam === "service"
      ? tabParam
      : "overview";
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
    setDateRange,
    setPeriodMode,
  } = useAnalyticsContext();

  const { startDate, endDate, periodDays } = useDataGranularity({
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  });

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");
  // Période précédente de même durée
  const prevEndDate = subDays(startDate, 1);
  const prevStartDate = subDays(prevEndDate, Math.max(periodDays, 1) - 1);
  const prevStart = format(prevStartDate, "yyyy-MM-dd");
  const prevEnd = format(prevEndDate, "yyyy-MM-dd");

  // Raccourcis 7 / 30 / 90 jours (jusqu'à hier inclus)
  const yesterdayKey = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const activeQuick = end === yesterdayKey && [7, 30, 90].includes(periodDays) ? periodDays : null;
  const applyQuick = (n: number) => {
    const to = subDays(new Date(), 1);
    setDateRange({ from: subDays(to, n - 1), to });
    setPeriodMode("range");
  };

  // Mois affiché pour la vue quotidienne (dérivé de la fin de période sélectionnée)
  const dailyYear = endDate.getFullYear();
  const dailyMonth = endDate.getMonth() + 1;
  const prevMonthIndex = dailyMonth === 1 ? 11 : dailyMonth - 2;
  const prevMonthYear = dailyMonth === 1 ? dailyYear - 1 : dailyYear;

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
  const prevOverviewQ = useChataigneOverview(prevStart, prevEnd, restaurantFilter);
  const monthlyQ = useChataigneMonthly(start, end, restaurantFilter);
  const restaurantsQ = useChataigneByRestaurant(start, end, restaurantFilter);
  const serviceQ = useChataigneServiceComparison(start, end, restaurantFilter);
  const prevServiceQ = useChataigneServiceComparison(prevStart, prevEnd, restaurantFilter);

  const computeBaskets = (rows: { service_type: string | null; orders: number; revenue: number }[] | undefined) => {
    const totals = (rows ?? []).reduce(
      (acc, row) => {
        const key = row.service_type === "delivery" ? "delivery" : row.service_type === "collection" ? "collection" : null;
        if (!key) return acc;
        acc[key].orders += Number(row.orders) || 0;
        acc[key].revenue += Number(row.revenue) || 0;
        return acc;
      },
      { delivery: { orders: 0, revenue: 0 }, collection: { orders: 0, revenue: 0 } }
    );
    const all = totals.delivery.orders + totals.collection.orders;
    return {
      delivery: totals.delivery.orders > 0 ? totals.delivery.revenue / totals.delivery.orders : 0,
      collection: totals.collection.orders > 0 ? totals.collection.revenue / totals.collection.orders : 0,
      deliveryShare: all > 0 ? (totals.delivery.orders / all) * 100 : null,
    };
  };
  const serviceBaskets = useMemo(() => computeBaskets(serviceQ.data as any), [serviceQ.data]);
  const prevBaskets = useMemo(() => computeBaskets(prevServiceQ.data as any), [prevServiceQ.data]);
  const deliveryShare = serviceBaskets.deliveryShare;

  // Clients uniques & réguliers (≥2 commandes complétées sur la période, jours Paris)
  const scopeKey = restaurantFilter === undefined ? "pending" : restaurantFilter === null ? "all" : [...restaurantFilter].sort().join(",");
  const fetchClients = async (s: string, e: string) => {
    const fromIso = new Date(`${s}T00:00:00`).toISOString();
    const toIso = new Date(new Date(`${e}T00:00:00`).getTime() + 86400000).toISOString();
    const counts = new Map<string, number>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from("chataigne_orders")
        .select("code_client")
        .eq("status", "completed")
        .gte("order_datetime", fromIso)
        .lt("order_datetime", toIso)
        .not("code_client", "is", null)
        .order("id")
        .range(from, from + PAGE - 1);
      if (restaurantFilter) q = q.in("restaurant_id", restaurantFilter);
      const { data, error } = await q;
      if (error) throw error;
      for (const r of data ?? []) {
        const k = r.code_client as string;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      if (!data || data.length < PAGE) break;
    }
    let reguliers = 0;
    counts.forEach((n) => { if (n >= 2) reguliers++; });
    return { clients: counts.size, reguliers };
  };
  const clientsQ = useQuery({
    queryKey: ["chataigne-clients-kpi", start, end, scopeKey],
    enabled: restaurantFilter !== undefined,
    queryFn: () => fetchClients(start, end),
  });
  const prevClientsQ = useQuery({
    queryKey: ["chataigne-clients-kpi", prevStart, prevEnd, scopeKey],
    enabled: restaurantFilter !== undefined,
    queryFn: () => fetchClients(prevStart, prevEnd),
  });

  const ratesQ = useQuery({
    queryKey: ["chataigne-rates", start, end, restaurantFilter === undefined ? "pending" : restaurantFilter === null ? "all" : [...restaurantFilter].sort().join(",")],
    enabled: restaurantFilter !== undefined,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_chataigne_rates", {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantFilter && restaurantFilter.length > 0 ? restaurantFilter : null,
      });
      if (error) throw error;
      return (data ?? []) as { period: string; total_orders: number; cancelled: number; discounts: number; gross_before_discount: number }[];
    },
  });
  const rates = useMemo(() => {
    const rows = ratesQ.data;
    if (!rows) return null;
    const cur = rows.find((r) => r.period === "current");
    const prev = rows.find((r) => r.period === "previous");
    const cancel = (r?: typeof cur) => (r && Number(r.total_orders) > 0 ? (Number(r.cancelled) / Number(r.total_orders)) * 100 : null);
    const disc = (r?: typeof cur) => (r && Number(r.gross_before_discount) > 0 ? (Number(r.discounts) / Number(r.gross_before_discount)) * 100 : null);
    return {
      cancelRate: cancel(cur),
      prevCancelRate: cancel(prev),
      discountRate: disc(cur),
      prevDiscountRate: disc(prev),
      cancelled: Number(cur?.cancelled ?? 0),
      discounts: Number(cur?.discounts ?? 0),
    };
  }, [ratesQ.data]);

  // Granularité du graphique d'évolution : auto selon la période, surchargeable
  const autoBucket: Bucket = periodDays <= 31 ? "day" : periodDays <= 93 ? "week" : "month";
  const [bucketOverride, setBucketOverride] = useState<Bucket | null>(null);
  const bucket = bucketOverride ?? autoBucket;
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  const dailyQ = useQuery({
    queryKey: ["chataigne-daily-totals", start, end, restaurantFilter === undefined ? "pending" : restaurantFilter === null ? "all" : [...restaurantFilter].sort().join(",")],
    queryFn: async () => {
      const ids = restaurantFilter ?? null;
      const { data, error } = await (supabase.rpc as any)("get_chataigne_daily_totals", {
        p_start_date: start,
        p_end_date: end,
        p_restaurant_ids: ids && ids.length > 0 ? ids : null,
      });
      if (error) throw error;
      return (data ?? []) as { date: string; revenue_ttc: number; order_count: number }[];
    },
    enabled: restaurantFilter !== undefined && bucket !== "month",
    retry: false,
  });

  // Détection d'un « plongeon » : hier vs médiane des 7 jours précédents
  const dropQ = useQuery({
    queryKey: ["chataigne-drop-check", restaurantFilter === undefined ? "pending" : restaurantFilter === null ? "all" : [...restaurantFilter].sort().join(",")],
    enabled: restaurantFilter !== undefined,
    retry: false,
    queryFn: async () => {
      const y = new Date(Date.now() - 86400000);
      const s = new Date(Date.now() - 8 * 86400000);
      const rows = await fetchDailyChataigne(format(s, "yyyy-MM-dd"), format(y, "yyyy-MM-dd"), restaurantFilter ?? null);
      const byDay = new Map<string, number>();
      for (const r of rows as unknown as { date: string; order_count?: number; commandes?: number }[]) {
        byDay.set(r.date, (byDay.get(r.date) ?? 0) + (Number(r.order_count ?? r.commandes) || 0));
      }
      const yKey = format(y, "yyyy-MM-dd");
      const prev = [...byDay.entries()].filter(([d]) => d < yKey).map(([, v]) => v).sort((a, b) => a - b);
      if (prev.length < 3) return null;
      const median = prev[Math.floor(prev.length / 2)];
      const orders = byDay.get(yKey) ?? 0;
      if (median < 20 || orders >= median * 0.5) return null;
      return { date: yKey, orders, median, pct: Math.round((orders / median) * 100) };
    },
  });

  const chartData = useMemo(() => {
    if (bucket === "month") {
      return (monthlyQ.data ?? []).map((m) => ({
        label: monthLabel(m.mois),
        ca: m.ca_brut,
        commandes: m.commandes,
      }));
    }
    const rows = dailyQ.data ?? [];
    const agg = new Map<string, { label: string; ca: number; commandes: number }>();
    for (const r of rows) {
      if (!r.date) continue;
      const d = parseISO(r.date);
      const key =
        bucket === "day" ? r.date.slice(0, 10) : format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const label =
        bucket === "day"
          ? format(d, "d MMM", { locale: fr })
          : `S${format(startOfWeek(d, { weekStartsOn: 1 }), "w")} · ${format(startOfWeek(d, { weekStartsOn: 1 }), "d MMM", { locale: fr })}`;
      const cur = agg.get(key) ?? { label, ca: 0, commandes: 0 };
      cur.ca += Number(r.revenue_ttc) || 0;
      cur.commandes += Number(r.order_count) || 0;
      agg.set(key, cur);
    }
    return [...agg.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [bucket, monthlyQ.data, dailyQ.data]);

  const chartLoading = bucket === "month" ? monthlyQ.isLoading : dailyQ.isLoading;
  const chartTitle =
    bucket === "day" ? "Évolution quotidienne" : bucket === "week" ? "Évolution hebdomadaire" : "Évolution mensuelle";

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
  const po = prevOverviewQ.data;
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
      <ChannelNavShell>
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

        {/* Raccourcis de période */}
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={activeQuick ? String(activeQuick) : ""}
            onValueChange={(v) => v && applyQuick(Number(v))}
            className="rounded-lg border bg-card p-1"
          >
            {[7, 30, 90].map((n) => (
              <ToggleGroupItem key={n} value={String(n)} className="h-8 px-4 text-sm">
                {n} jours
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="text-xs text-muted-foreground">
            Comparé aux {periodDays} j précédents ({format(prevStartDate, "d MMM", { locale: fr })} – {format(prevEndDate, "d MMM", { locale: fr })})
          </span>
        </div>

        {/* KPI */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(20,minmax(0,1fr))] xl:[&>*]:col-span-4 xl:[&>*:nth-child(n+6)]:col-span-5" aria-label="Indicateurs Châtaigne">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(20,minmax(0,1fr))] xl:[&>*]:col-span-4 xl:[&>*:nth-child(n+6)]:col-span-5" aria-label="Indicateurs Châtaigne">
            <CompareCard title="Chiffre d'affaires brut" icon={Euro} value={fmtEur(o?.ca_brut ?? 0)}
              cur={o?.ca_brut} prev={po?.ca_brut} periodDays={periodDays} sub="Commandes WhatsApp & Instagram" />
            <CompareCard title="Commandes" icon={ShoppingBag} value={fmtInt(o?.commandes ?? 0)}
              cur={o?.commandes} prev={po?.commandes} periodDays={periodDays}
              sub={deliveryShare !== null ? `${Math.round(deliveryShare)} % en livraison` : ""} />
            <CompareCard title="Panier moyen · Livraison" icon={Bike}
              value={serviceQ.isLoading ? "…" : fmtEur(serviceBaskets.delivery, 2)}
              cur={serviceBaskets.delivery} prev={prevBaskets.delivery} periodDays={periodDays} sub="CA livraison ÷ commandes" />
            <CompareCard title="Panier moyen · Emport" icon={Wallet}
              value={serviceQ.isLoading ? "…" : fmtEur(serviceBaskets.collection, 2)}
              cur={serviceBaskets.collection} prev={prevBaskets.collection} periodDays={periodDays} sub="CA emport ÷ commandes" />
            <CompareCard title="Restaurants actifs" icon={Store} value={fmtInt(o?.restos_actifs ?? 0)}
              cur={o?.restos_actifs} prev={po?.restos_actifs} periodDays={periodDays} sub="Au moins une commande" />
            <CompareCard title="Clients uniques" icon={UsersIcon}
              value={clientsQ.data ? fmtInt(clientsQ.data.clients) : "…"}
              cur={clientsQ.data?.clients} prev={prevClientsQ.data?.clients} periodDays={periodDays} sub="Acheteurs distincts" />
            <CompareCard title="Clients réguliers (2+ commandes)" icon={RepeatIcon}
              value={clientsQ.data ? fmtInt(clientsQ.data.reguliers) : "…"}
              cur={clientsQ.data?.reguliers} prev={prevClientsQ.data?.reguliers} periodDays={periodDays}
              sub={clientsQ.data ? `${clientsQ.data.clients ? Math.round((clientsQ.data.reguliers / clientsQ.data.clients) * 100) : 0} % des clients` : ""} />
            <RateCard
              title="Taux de remise"
              icon={Percent}
              loading={ratesQ.isLoading}
              rate={rates?.discountRate ?? null}
              prev={rates?.prevDiscountRate ?? null}
              periodDays={periodDays}
              lowerIsBetter
              neutral
              sub={rates ? `${fmtEur(rates.discounts)} de remises accordées` : ""}
            />
            <RateCard
              title="Taux d'annulation"
              icon={XCircle}
              loading={ratesQ.isLoading}
              rate={rates?.cancelRate ?? null}
              prev={rates?.prevCancelRate ?? null}
              periodDays={periodDays}
              lowerIsBetter
              sub={rates ? `${fmtInt(rates.cancelled)} annulées ou non livrées` : ""}
            />
          </div>
        )}


        {dropQ.data && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-destructive animate-pulse" />
            <div>
              <p className="font-semibold text-destructive">
                Chute anormale le {format(parseISO(dropQ.data.date), "EEEE d MMMM", { locale: fr })}
              </p>
              <p className="text-muted-foreground">
                {fmtInt(dropQ.data.orders)} commandes contre {fmtInt(dropQ.data.median)} en moyenne sur les 7 jours
                précédents ({dropQ.data.pct} %). Il s'agit probablement de données pas encore synchronisées plutôt que
                d'une vraie baisse d'activité.
              </p>
            </div>
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
              <TabsTrigger value="daily">Vue quotidienne</TabsTrigger>
              <TabsTrigger value="weekday">Jours de la semaine</TabsTrigger>
              <TabsTrigger value="service">Emport vs Livraison</TabsTrigger>
            </TabsList>

            <TabsContent value="service" className="space-y-6">
              <ChataigneServiceComparison
                start={start}
                end={end}
                restaurantIds={restaurantFilter}
              />
              <ChataigneServiceRecurrence start={start} end={end} restaurantIds={restaurantFilter} />
            </TabsContent>


            <TabsContent value="overview" className="space-y-6">
              {/* Évolution */}
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <CardTitle>{chartTitle}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleGroup
                      type="single"
                      value={bucket}
                      onValueChange={(v) => v && setBucketOverride(v as Bucket)}
                      size="sm"
                    >
                      <ToggleGroupItem value="day">Jour</ToggleGroupItem>
                      <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
                      <ToggleGroupItem value="month">Mois</ToggleGroupItem>
                    </ToggleGroup>
                    <ToggleGroup
                      type="single"
                      value={chartType}
                      onValueChange={(v) => v && setChartType(v as "line" | "bar")}
                      size="sm"
                    >
                      <ToggleGroupItem value="line">Courbes</ToggleGroupItem>
                      <ToggleGroupItem value="bar">Barres</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartLoading ? (
                    <Skeleton className="h-[380px] w-full" />
                  ) : chartData.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      Aucune donnée sur cette période.
                    </p>
                  ) : chartType === "line" ? (
                    <ResponsiveContainer width="100%" height={380}>
                      <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="chataigneCaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="label"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          minTickGap={16}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => fmtEur(Number(v))}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => fmtInt(Number(v))}
                        />
                        <RTooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            color: "hsl(var(--popover-foreground))",
                            boxShadow: "0 10px 30px -12px rgba(0,0,0,0.35)",
                          }}
                          formatter={(value: number, name: string) =>
                            name === "CA brut" ? fmtEur(Number(value)) : fmtInt(Number(value))
                          }
                        />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="ca"
                          name="CA brut"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          fill="url(#chataigneCaGradient)"
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="commandes"
                          name="Commandes"
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth={1.75}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={380}>
                      <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="label"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          minTickGap={16}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => fmtEur(Number(v))}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
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

            <TabsContent value="weekday" className="space-y-6">
              <ChataigneWeekdaySection
                start={start}
                end={end}
                restaurantIds={restaurantFilter}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
