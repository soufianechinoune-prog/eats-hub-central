import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, startOfWeek, addMonths, isBefore, subYears, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  RotateCcw, TrendingUp, TrendingDown, Users, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, Percent, Euro as EuroIcon,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ReferenceLine,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SENTINEL = "00000000-0000-0000-0000-000000000000";

type Mode = "amount" | "percent";
type Granularity = "day" | "week" | "month";

interface FinanceDetailRow {
  restaurant_id: string;
  payout_date: string;
  sales_incl_vat: number;
  order_count: number;
  refund_to_customer: number;
  refund_uber_cancellation: number;
  refund_net: number;
  refund_incl_vat: number;
}

const fmtEur = (v: number) =>
  `${(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
const fmtPct = (v: number) =>
  `${(v || 0).toFixed(2).replace(".", ",")}%`;
const fmtInt = (v: number) =>
  (v || 0).toLocaleString("fr-FR");

function getMonthsInRange(start: Date, end: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let cursor = startOfMonth(start);
  const last = startOfMonth(end);
  while (!isBefore(last, cursor)) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor = addMonths(cursor, 1);
  }
  return months;
}

async function fetchFinanceMonths(
  months: { year: number; month: number }[],
  restaurantIds: string[],
): Promise<FinanceDetailRow[]> {
  if (months.length === 0 || restaurantIds.length === 0) return [];
  const chunks = await Promise.all(
    months.map(async ({ year, month }) => {
      const { data, error } = await supabase.rpc("get_orders_finance_detail", {
        p_year: year,
        p_month: month,
        p_restaurant_ids: restaurantIds,
      });
      if (error) {
        console.error("[RefundsSection] get_orders_finance_detail error:", error);
        return [];
      }
      return (data as any[]) || [];
    }),
  );
  return chunks.flat() as FinanceDetailRow[];
}

interface AggregatedTotals {
  refundToCustomer: number;
  refundUberCancellation: number;
  refundNet: number;
  sales: number;
  orderCount: number;
}

function aggregateTotals(rows: FinanceDetailRow[], startDate: Date, endDate: Date): AggregatedTotals {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");
  return rows.reduce<AggregatedTotals>(
    (acc, r) => {
      if (r.payout_date < startStr || r.payout_date > endStr) return acc;
      // Backend already returns positive values for to_customer/uber_cancellation
      acc.refundToCustomer += Math.abs(Number(r.refund_to_customer) || 0);
      acc.refundUberCancellation += Math.abs(Number(r.refund_uber_cancellation) || 0);
      acc.refundNet += Number(r.refund_net) || 0;
      acc.sales += Math.abs(Number(r.sales_incl_vat) || 0);
      acc.orderCount += Number(r.order_count) || 0;
      return acc;
    },
    { refundToCustomer: 0, refundUberCancellation: 0, refundNet: 0, sales: 0, orderCount: 0 },
  );
}

function bucketKey(dateStr: string, gran: Granularity): string {
  const d = parseISO(dateStr);
  if (gran === "day") return dateStr;
  if (gran === "week") {
    const ws = startOfWeek(d, { weekStartsOn: 1 });
    return format(ws, "yyyy-'W'II");
  }
  return format(d, "yyyy-MM");
}

function bucketLabel(key: string, gran: Granularity): string {
  if (gran === "day") {
    return format(parseISO(key), "d MMM", { locale: fr });
  }
  if (gran === "week") {
    // key like 2026-W12
    const [y, w] = key.split("-W");
    return `S${w} ${y}`;
  }
  // month key 2026-04
  const [y, m] = key.split("-");
  return format(new Date(Number(y), Number(m) - 1, 1), "MMM yy", { locale: fr });
}

interface RefundsSectionProps {
  // Allow Analytics.tsx to pass the platform so we can show a Deliveroo notice
  platform?: "uber_eats" | "deliveroo" | "global";
}

export function RefundsSection({ platform: platformProp }: RefundsSectionProps) {
  const {
    selectedRestaurants,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    selectedChainId,
    selectedPlatform: ctxPlatform,
  } = useAnalyticsContext();

  const platform = platformProp ?? ctxPlatform ?? "uber_eats";

  const [mode, setMode] = useState<Mode>("amount");
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [search, setSearch] = useState("");
  const [expandedRestaurant, setExpandedRestaurant] = useState<string | null>(null);

  const { data: activeRestaurants = [], isLoading: restaurantsLoading } = useActiveRestaurants();

  const chainRestaurantIds = useMemo(
    () => activeRestaurants.map((r) => r.id),
    [activeRestaurants],
  );

  // Resolve current period
  const { startDate, endDate } = useMemo(() => {
    if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      return { startDate: dateRange.from, endDate: dateRange.to };
    }
    if (periodMode === "month" && selectedMonth > 0) {
      const s = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      return { startDate: s, endDate: endOfMonth(s) };
    }
    const s = startOfYear(new Date(selectedYear, 0));
    const e = new Date() < endOfYear(s) ? new Date() : endOfYear(s);
    return { startDate: s, endDate: e };
  }, [selectedYear, selectedMonth, periodMode, dateRange]);

  // Previous period (N-1 same window)
  const { prevStartDate, prevEndDate } = useMemo(() => ({
    prevStartDate: subYears(startDate, 1),
    prevEndDate: subYears(endDate, 1),
  }), [startDate, endDate]);

  const resolvedIds = useMemo(
    () =>
      resolveBrandScopedRestaurantIds({
        selectedRestaurantIds: selectedRestaurants,
        selectedChainId,
        chainRestaurantIds,
      }) ?? [],
    [selectedRestaurants, selectedChainId, chainRestaurantIds],
  );

  const hasSentinel = resolvedIds.length === 1 && resolvedIds[0] === SENTINEL;
  const isScopeReady = resolvedIds.length > 0 && !hasSentinel;
  const restaurantIds = isScopeReady ? resolvedIds : [];

  const monthsCurrent = useMemo(() => getMonthsInRange(startDate, endDate), [startDate, endDate]);
  const monthsPrev = useMemo(() => getMonthsInRange(prevStartDate, prevEndDate), [prevStartDate, prevEndDate]);

  const isDeliveroo = platform === "deliveroo";

  // ============ Fetch current period ============
  const { data: currentRows = [], isLoading: loadingCurrent, isError: errorCurrent } = useQuery({
    queryKey: [
      "refunds-finance-detail",
      restaurantIds.slice().sort().join(","),
      monthsCurrent.map((m) => `${m.year}-${m.month}`).join(","),
    ],
    queryFn: () => fetchFinanceMonths(monthsCurrent, restaurantIds),
    enabled: isScopeReady && !isDeliveroo && monthsCurrent.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // ============ Fetch previous period ============
  const { data: prevRows = [], isLoading: loadingPrev } = useQuery({
    queryKey: [
      "refunds-finance-detail-prev",
      restaurantIds.slice().sort().join(","),
      monthsPrev.map((m) => `${m.year}-${m.month}`).join(","),
    ],
    queryFn: () => fetchFinanceMonths(monthsPrev, restaurantIds),
    enabled: isScopeReady && !isDeliveroo && monthsPrev.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // ============ Fetch real refunded order counts (per-order, not per-day) ============
  const { data: refundedCounts = [] } = useQuery({
    queryKey: [
      "refunded-orders-count",
      restaurantIds.slice().sort().join(","),
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_refunded_orders_count", {
        p_restaurant_ids: restaurantIds,
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
      });
      if (error) {
        console.error("[RefundsSection] get_refunded_orders_count error:", error);
        return [];
      }
      return (data as { restaurant_id: string; refunded_orders: number; total_orders: number }[]) || [];
    },
    enabled: isScopeReady && !isDeliveroo,
    staleTime: 2 * 60 * 1000,
  });

  const { data: refundedCountsPrev = [] } = useQuery({
    queryKey: [
      "refunded-orders-count-prev",
      restaurantIds.slice().sort().join(","),
      format(prevStartDate, "yyyy-MM-dd"),
      format(prevEndDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_refunded_orders_count", {
        p_restaurant_ids: restaurantIds,
        p_start_date: format(prevStartDate, "yyyy-MM-dd"),
        p_end_date: format(prevEndDate, "yyyy-MM-dd"),
      });
      if (error) return [];
      return (data as { restaurant_id: string; refunded_orders: number; total_orders: number }[]) || [];
    },
    enabled: isScopeReady && !isDeliveroo,
    staleTime: 2 * 60 * 1000,
  });

  const refundedCountsByRestaurant = useMemo(() => {
    const m = new Map<string, { refunded: number; total: number }>();
    for (const r of refundedCounts) {
      m.set(r.restaurant_id, { refunded: Number(r.refunded_orders) || 0, total: Number(r.total_orders) || 0 });
    }
    return m;
  }, [refundedCounts]);

  const refundedOrdersTotal = useMemo(
    () => refundedCounts.reduce((s, r) => s + (Number(r.refunded_orders) || 0), 0),
    [refundedCounts],
  );
  const totalOrdersReal = useMemo(
    () => refundedCounts.reduce((s, r) => s + (Number(r.total_orders) || 0), 0),
    [refundedCounts],
  );
  const refundedOrdersTotalPrev = useMemo(
    () => refundedCountsPrev.reduce((s, r) => s + (Number(r.refunded_orders) || 0), 0),
    [refundedCountsPrev],
  );

  // ============ Aggregations ============
  const totals = useMemo(() => aggregateTotals(currentRows, startDate, endDate), [currentRows, startDate, endDate]);
  const prevTotals = useMemo(() => aggregateTotals(prevRows, prevStartDate, prevEndDate), [prevRows, prevStartDate, prevEndDate]);

  // ============ Time series ============
  const timeSeries = useMemo(() => {
    const map = new Map<string, { key: string; label: string; refundClient: number; uberCancel: number; refundNet: number; sales: number; orderCount: number }>();
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    for (const r of currentRows) {
      if (r.payout_date < startStr || r.payout_date > endStr) continue;
      const key = bucketKey(r.payout_date, granularity);
      const entry = map.get(key) || {
        key,
        label: bucketLabel(key, granularity),
        refundClient: 0,
        uberCancel: 0,
        refundNet: 0,
        sales: 0,
        orderCount: 0,
      };
      entry.refundClient += Math.abs(Number(r.refund_to_customer) || 0);
      entry.uberCancel += Math.abs(Number(r.refund_uber_cancellation) || 0);
      entry.refundNet += Number(r.refund_net) || 0;
      entry.sales += Math.abs(Number(r.sales_incl_vat) || 0);
      entry.orderCount += Number(r.order_count) || 0;
      map.set(key, entry);
    }
    const arr = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
    if (mode === "percent") {
      return arr.map((e) => ({
        ...e,
        refundClient: e.sales > 0 ? (e.refundClient / e.sales) * 100 : 0,
        uberCancel: e.sales > 0 ? (e.uberCancel / e.sales) * 100 : 0,
        refundNet: e.sales > 0 ? (e.refundNet / e.sales) * 100 : 0,
      }));
    }
    // For stacked bars we want Uber cancellation to display as negative
    return arr.map((e) => ({
      ...e,
      uberCancel: -e.uberCancel,
    }));
  }, [currentRows, startDate, endDate, granularity, mode]);

  // ============ Per-restaurant table ============
  const perRestaurant = useMemo(() => {
    const map = new Map<string, {
      restaurantId: string;
      name: string;
      city: string | null;
      refundClient: number;
      uberCancel: number;
      refundNet: number;
      sales: number;
      orderCount: number;
      refundedOrders: number;
    }>();
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    const nameMap = new Map(activeRestaurants.map((r) => [r.id, { name: r.name, city: (r as any).city ?? null }]));
    for (const r of currentRows) {
      if (r.payout_date < startStr || r.payout_date > endStr) continue;
      const info = nameMap.get(r.restaurant_id);
      const entry = map.get(r.restaurant_id) || {
        restaurantId: r.restaurant_id,
        name: info?.name || r.restaurant_id.slice(0, 8),
        city: info?.city || null,
        refundClient: 0,
        uberCancel: 0,
        refundNet: 0,
        sales: 0,
        orderCount: 0,
        refundedOrders: 0,
      };
      const rc = Math.abs(Number(r.refund_to_customer) || 0);
      entry.refundClient += rc;
      entry.uberCancel += Math.abs(Number(r.refund_uber_cancellation) || 0);
      entry.refundNet += Number(r.refund_net) || 0;
      entry.sales += Math.abs(Number(r.sales_incl_vat) || 0);
      entry.orderCount += Number(r.order_count) || 0;
      if (rc > 0) entry.refundedOrders += Number(r.order_count) || 0;
      map.set(r.restaurant_id, entry);
    }
    let arr = Array.from(map.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((r) => r.name.toLowerCase().includes(q));
    }
    arr.sort((a, b) => b.refundNet - a.refundNet);
    return arr;
  }, [currentRows, startDate, endDate, activeRestaurants, search]);

  // ============ Per-restaurant monthly series (for drilldown) ============
  const restaurantMonthly = useMemo(() => {
    const map = new Map<string, Map<string, { month: string; refundClient: number; uberCancel: number; refundNet: number; sales: number }>>();
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    for (const r of currentRows) {
      if (r.payout_date < startStr || r.payout_date > endStr) continue;
      const monthKey = r.payout_date.slice(0, 7);
      let inner = map.get(r.restaurant_id);
      if (!inner) {
        inner = new Map();
        map.set(r.restaurant_id, inner);
      }
      const entry = inner.get(monthKey) || { month: monthKey, refundClient: 0, uberCancel: 0, refundNet: 0, sales: 0 };
      entry.refundClient += Math.abs(Number(r.refund_to_customer) || 0);
      entry.uberCancel += Math.abs(Number(r.refund_uber_cancellation) || 0);
      entry.refundNet += Number(r.refund_net) || 0;
      entry.sales += Math.abs(Number(r.sales_incl_vat) || 0);
      inner.set(monthKey, entry);
    }
    return map;
  }, [currentRows, startDate, endDate]);

  // ============ Render ============
  if (isDeliveroo) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">Données non disponibles pour Deliveroo</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Le détail des remboursements (clients, reprises plateforme, net à charge) n'est exposé
            que par Uber Eats. Sélectionnez « Uber Eats » ou « Global » pour consulter cet onglet.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (restaurantsLoading || !isScopeReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (errorCurrent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Erreur lors du chargement des remboursements.</p>
      </div>
    );
  }

  const isLoading = loadingCurrent || loadingPrev;

  // ===== KPI helpers =====
  const recoveryRate = totals.refundToCustomer > 0
    ? (totals.refundUberCancellation / totals.refundToCustomer) * 100
    : 0;
  const refundClientShare = totals.sales > 0 ? (totals.refundToCustomer / totals.sales) * 100 : 0;
  const refundNetShare = totals.sales > 0 ? (totals.refundNet / totals.sales) * 100 : 0;
  const refundedOrdersRate = totalOrdersReal > 0 ? (refundedOrdersTotal / totalOrdersReal) * 100 : 0;
  const prevRefundedOrdersRate = refundedCountsPrev.reduce((s, r) => s + (Number(r.total_orders) || 0), 0) > 0
    ? (refundedOrdersTotalPrev / refundedCountsPrev.reduce((s, r) => s + (Number(r.total_orders) || 0), 0)) * 100
    : 0;
  const deltaRefundedOrders = refundedOrdersTotal - refundedOrdersTotalPrev;

  const prevRefundClientShare = prevTotals.sales > 0 ? (prevTotals.refundToCustomer / prevTotals.sales) * 100 : 0;
  const prevRefundNetShare = prevTotals.sales > 0 ? (prevTotals.refundNet / prevTotals.sales) * 100 : 0;
  const prevRecoveryRate = prevTotals.refundToCustomer > 0
    ? (prevTotals.refundUberCancellation / prevTotals.refundToCustomer) * 100
    : 0;

  const deltaRefundClient = totals.refundToCustomer - prevTotals.refundToCustomer;
  const deltaRefundNet = totals.refundNet - prevTotals.refundNet;
  const deltaUberCancel = totals.refundUberCancellation - prevTotals.refundUberCancellation;

  const periodLabel = `${format(startDate, "d MMM yyyy", { locale: fr })} → ${format(endDate, "d MMM yyyy", { locale: fr })}`;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Info bandeau */}
        <div className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2">
          🔁 <strong>Remboursements Uber Eats</strong> — analyse de l'argent envoyé aux clients,
          des reprises Uber (annulations) et du net réellement à votre charge. Période :{" "}
          <strong>{periodLabel}</strong>. Comparé à N-1.
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Unité</span>
            <ToggleGroup type="single" size="sm" value={mode} onValueChange={(v) => v && setMode(v as Mode)}>
              <ToggleGroupItem value="amount" aria-label="Euros">
                <EuroIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="percent" aria-label="Pourcent">
                <Percent className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Granularité</span>
            <ToggleGroup type="single" size="sm" value={granularity} onValueChange={(v) => v && setGranularity(v as Granularity)}>
              <ToggleGroupItem value="day">Jour</ToggleGroupItem>
              <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
              <ToggleGroupItem value="month">Mois</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Remb. clients"
            tooltip="Argent envoyé aux clients (remboursements bruts)"
            value={mode === "amount" ? fmtEur(totals.refundToCustomer) : fmtPct(refundClientShare)}
            subValue={mode === "amount" ? `${fmtPct(refundClientShare)} du CA TTC` : fmtEur(totals.refundToCustomer)}
            delta={mode === "amount" ? deltaRefundClient : refundClientShare - prevRefundClientShare}
            deltaIsPercent={mode === "percent"}
            negativeIsBad
            icon={<RotateCcw className="h-4 w-4 text-orange-500" />}
            loading={isLoading}
          />
          <KpiCard
            title="Reprises Uber"
            tooltip="Annulations Uber : reprises qui annulent un remboursement client"
            value={mode === "amount" ? fmtEur(totals.refundUberCancellation) : fmtPct(recoveryRate)}
            subValue={mode === "amount" ? `${fmtPct(recoveryRate)} de récupération` : `${fmtEur(totals.refundUberCancellation)} récupérés`}
            delta={mode === "amount" ? deltaUberCancel : recoveryRate - prevRecoveryRate}
            deltaIsPercent={mode === "percent"}
            positiveIsGood
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            loading={isLoading}
          />
          <KpiCard
            title="Net à ma charge"
            tooltip="Clients − Annulations = impact réel sur votre rentabilité"
            value={mode === "amount" ? fmtEur(totals.refundNet) : fmtPct(refundNetShare)}
            subValue={mode === "amount" ? `${fmtPct(refundNetShare)} du CA TTC` : fmtEur(totals.refundNet)}
            delta={mode === "amount" ? deltaRefundNet : refundNetShare - prevRefundNetShare}
            deltaIsPercent={mode === "percent"}
            negativeIsBad
            icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
            highlight
            loading={isLoading}
          />
          <KpiCard
            title="Commandes impactées"
            tooltip="Approximation : commandes des jours comportant au moins un remboursement client"
            value={fmtInt(refundedOrdersApprox)}
            subValue={`${fmtPct(refundedOrdersRate)} des commandes`}
            icon={<Users className="h-4 w-4 text-violet-500" />}
            loading={isLoading}
          />
        </div>

        {/* Time series chart */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Évolution des remboursements</h3>
                <p className="text-xs text-muted-foreground">
                  Barres = remb. clients (orange) et reprises Uber (vert, négatif). Ligne = net à charge.
                </p>
              </div>
              <Badge variant="outline">{timeSeries.length} {granularity === "day" ? "jours" : granularity === "week" ? "semaines" : "mois"}</Badge>
            </div>
            {isLoading ? (
              <div className="h-[320px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : timeSeries.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                Aucune donnée sur la période
              </div>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} stackOffset="sign">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={timeSeries.length > 14 ? Math.floor(timeSeries.length / 10) : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (mode === "percent" ? `${v.toFixed(1)}%` : `${Math.round(v as number)}€`)}
                    />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => {
                        const abs = Math.abs(value);
                        return [mode === "percent" ? fmtPct(abs) : fmtEur(abs), name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="refundClient" name="Remb. clients" stackId="a" fill="hsl(24 95% 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="uberCancel" name="Reprises Uber" stackId="a" fill="hsl(142 70% 50%)" radius={[0, 0, 4, 4]} />
                    <Line
                      type="monotone"
                      dataKey="refundNet"
                      name="Net à ma charge"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-restaurant table */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold">Classement par restaurant</h3>
                <p className="text-xs text-muted-foreground">Trié par net à charge décroissant. Cliquez sur une ligne pour voir l'évolution mensuelle.</p>
              </div>
              <Input
                placeholder="Rechercher un restaurant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : perRestaurant.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Aucune donnée</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead className="text-right">Remb. clients</TableHead>
                    <TableHead className="text-right">Reprises Uber</TableHead>
                    <TableHead className="text-right">Net à charge</TableHead>
                    <TableHead className="text-right">% du CA</TableHead>
                    <TableHead className="text-right">Commandes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perRestaurant.map((row) => {
                    const pctOfSales = row.sales > 0 ? (row.refundNet / row.sales) * 100 : 0;
                    const colorClass = pctOfSales < 1
                      ? "text-emerald-600"
                      : pctOfSales < 3
                      ? "text-orange-500"
                      : "text-rose-600";
                    const isOpen = expandedRestaurant === row.restaurantId;
                    const monthlySeries = restaurantMonthly.get(row.restaurantId);
                    const monthlyArr = monthlySeries
                      ? Array.from(monthlySeries.values()).sort((a, b) => a.month.localeCompare(b.month))
                      : [];

                    return (
                      <>
                        <TableRow
                          key={row.restaurantId}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedRestaurant(isOpen ? null : row.restaurantId)}
                        >
                          <TableCell>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>{row.name}</div>
                            {row.city && <div className="text-xs text-muted-foreground">{row.city}</div>}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">{fmtEur(row.refundClient)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{fmtEur(row.uberCancel)}</TableCell>
                          <TableCell className={cn("text-right font-semibold", colorClass)}>{fmtEur(row.refundNet)}</TableCell>
                          <TableCell className={cn("text-right font-medium", colorClass)}>{fmtPct(pctOfSales)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmtInt(row.orderCount)}</TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={7} className="p-4">
                              {monthlyArr.length === 0 ? (
                                <div className="text-sm text-muted-foreground">Aucun détail mensuel.</div>
                              ) : (
                                <div className="h-[220px] w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart
                                      data={monthlyArr.map((m) => ({
                                        ...m,
                                        label: bucketLabel(m.month, "month"),
                                        uberCancel: -m.uberCancel,
                                      }))}
                                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                                      stackOffset="sign"
                                    >
                                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v as number)}€`} />
                                      <RTooltip
                                        formatter={(value: number, name: string) => [fmtEur(Math.abs(value)), name]}
                                        contentStyle={{ fontSize: "12px" }}
                                      />
                                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                                      <Bar dataKey="refundClient" name="Remb. clients" stackId="b" fill="hsl(24 95% 60%)" />
                                      <Bar dataKey="uberCancel" name="Reprises Uber" stackId="b" fill="hsl(142 70% 50%)" />
                                      <Line type="monotone" dataKey="refundNet" name="Net" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                    </ComposedChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

// ============ Sub-components ============

interface KpiCardProps {
  title: string;
  tooltip?: string;
  value: string;
  subValue?: string;
  delta?: number;
  deltaIsPercent?: boolean;
  positiveIsGood?: boolean;
  negativeIsBad?: boolean;
  icon?: React.ReactNode;
  highlight?: boolean;
  loading?: boolean;
}

function KpiCard({
  title, tooltip, value, subValue, delta, deltaIsPercent, positiveIsGood, negativeIsBad, icon, highlight, loading,
}: KpiCardProps) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta) && Math.abs(delta) > 0.0001;
  const isPositive = showDelta && (delta as number) > 0;
  // For "bad if positive" metrics (refund client/net), invert color
  const goodColor = "text-emerald-600";
  const badColor = "text-rose-600";
  let deltaColor = "text-muted-foreground";
  if (showDelta) {
    if (positiveIsGood) deltaColor = isPositive ? goodColor : badColor;
    else if (negativeIsBad) deltaColor = isPositive ? badColor : goodColor;
  }
  const deltaStr = showDelta
    ? `${isPositive ? "+" : ""}${deltaIsPercent ? `${(delta as number).toFixed(2)} pts` : fmtEur(delta as number)}`
    : null;

  return (
    <Card className={cn(highlight && "border-primary/40 shadow-sm")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  {icon}
                  <span className="text-xs font-medium text-muted-foreground">{title}</span>
                </div>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </UITooltip>
          </TooltipProvider>
        </div>
        <div className="mt-2">
          {loading ? (
            <div className="h-8 w-24 bg-muted/50 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold">{value}</div>
          )}
          {subValue && !loading && (
            <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
          )}
          {deltaStr && (
            <div className={cn("text-xs mt-1 font-medium", deltaColor)}>
              {deltaStr} vs N-1
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
