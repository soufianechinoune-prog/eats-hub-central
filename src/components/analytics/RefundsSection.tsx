import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, isBefore, subYears, parseISO, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  RotateCcw, TrendingUp, TrendingDown, Users, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, Percent, Euro as EuroIcon, ArrowUp, ArrowDown, ArrowUpDown, Info,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ReferenceLine, Cell,
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

// Crédits Uber are reconciled in Uber's weekly payouts with a 1-3 week lag
// vs the order date. Buckets whose end date is within this window are flagged
// as "partial" so we can dim the bars and warn the user.
const PARTIAL_LAG_DAYS = 21;

function bucketEndDate(key: string, gran: Granularity): Date {
  if (gran === "day") return parseISO(key);
  if (gran === "week") {
    // parseISO handles "2026-W20" → Monday of that ISO week
    const monday = parseISO(key);
    return endOfWeek(monday, { weekStartsOn: 1 });
  }
  const [y, m] = key.split("-");
  return endOfMonth(new Date(Number(y), Number(m) - 1, 1));
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
  type SortKey = "name" | "refundClient" | "uberCancel" | "refundNet" | "pctOfSales" | "refundedOrders" | "refundedRate";
  const [sortKey, setSortKey] = useState<SortKey>("refundNet");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };
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
    const map = new Map<string, { key: string; label: string; refundClient: number; uberCancel: number; refundNet: number; sales: number; orderCount: number; partial: boolean }>();
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    const today = new Date();
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
        partial: false,
      };
      entry.refundClient += Math.abs(Number(r.refund_to_customer) || 0);
      entry.uberCancel += Math.abs(Number(r.refund_uber_cancellation) || 0);
      entry.refundNet += Number(r.refund_net) || 0;
      entry.sales += Math.abs(Number(r.sales_incl_vat) || 0);
      entry.orderCount += Number(r.order_count) || 0;
      map.set(key, entry);
    }
    // Flag partial buckets (Uber credits not yet fully reconciled)
    for (const entry of map.values()) {
      const end = bucketEndDate(entry.key, granularity);
      entry.partial = differenceInCalendarDays(today, end) < PARTIAL_LAG_DAYS;
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
    // Stacked bars: client refunds = money OUT (negative, below zero),
    // Uber credits = money IN (positive, above zero). Net line keeps its real sign.
    return arr.map((e) => ({
      ...e,
      refundClient: -e.refundClient,
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
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      const counts = (rid: string) => refundedCountsByRestaurant.get(rid);
      const getVal = (r: typeof a): number => {
        switch (sortKey) {
          case "refundClient": return r.refundClient;
          case "uberCancel": return r.uberCancel;
          case "refundNet": return r.refundNet;
          case "pctOfSales": return r.sales > 0 ? (r.refundNet / r.sales) * 100 : 0;
          case "refundedOrders": return counts(r.restaurantId)?.refunded ?? 0;
          case "refundedRate": {
            const c = counts(r.restaurantId);
            const total = c?.total ?? r.orderCount;
            const refunded = c?.refunded ?? 0;
            return total > 0 ? (refunded / total) * 100 : 0;
          }
          default: return 0;
        }
      };
      return (getVal(a) - getVal(b)) * dir;
    });
    return arr;
  }, [currentRows, startDate, endDate, activeRestaurants, search, sortKey, sortDir, refundedCountsByRestaurant]);

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
          🔁 <strong>Remboursements Uber Eats</strong> — argent envoyé aux clients,
          crédits Uber qui reviennent dans votre payout (annulations, gestes commerciaux)
          et solde net réel. Période : <strong>{periodLabel}</strong>. Comparé à N-1.
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
            title="Crédits Uber"
            tooltip="Argent qu'Uber vous re-crédite (annulations de commandes, gestes commerciaux, contestations gagnées). C'est en faveur du restaurant."
            value={mode === "amount" ? fmtEur(totals.refundUberCancellation) : fmtPct(recoveryRate)}
            subValue={mode === "amount" ? `${fmtPct(recoveryRate)} de récupération` : `${fmtEur(totals.refundUberCancellation)} récupérés`}
            delta={mode === "amount" ? deltaUberCancel : recoveryRate - prevRecoveryRate}
            deltaIsPercent={mode === "percent"}
            positiveIsGood
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            loading={isLoading}
          />
          <KpiCard
            title="Solde net"
            tooltip="Remb. clients − Crédits Uber. Positif = vous payez. Négatif = Uber vous a recrédité plus qu'il ne vous a débité (gain net pour vous)."
            value={mode === "amount" ? fmtEur(totals.refundNet) : fmtPct(refundNetShare)}
            subValue={mode === "amount"
              ? (totals.refundNet > 0 ? "à votre charge" : totals.refundNet < 0 ? "en votre faveur" : "équilibré")
              : fmtEur(totals.refundNet)}
            delta={mode === "amount" ? deltaRefundNet : refundNetShare - prevRefundNetShare}
            deltaIsPercent={mode === "percent"}
            negativeIsBad
            icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
            highlight
            loading={isLoading}
          />
          <KpiCard
            title="Commandes remboursées"
            tooltip="Nombre de commandes ayant fait l'objet d'au moins un remboursement client (compté commande par commande)."
            value={fmtInt(refundedOrdersTotal)}
            subValue={`${fmtPct(refundedOrdersRate)} des ${fmtInt(totalOrdersReal)} commandes`}
            delta={deltaRefundedOrders}
            negativeIsBad
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
                  Barres oranges (sous 0) = remb. clients (argent qui sort). Barres vertes (au-dessus de 0) = crédits Uber (argent qui rentre). Ligne = solde net.
                </p>
              </div>
              <Badge variant="outline">{timeSeries.length} {granularity === "day" ? "jours" : granularity === "week" ? "semaines" : "mois"}</Badge>
            </div>
            {timeSeries.some((d) => d.partial) && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Les <strong>crédits Uber</strong> (annulations, gestes commerciaux, contestations gagnées) sont versés dans les <strong>payouts hebdomadaires</strong> avec un décalage de <strong>1 à 3 semaines</strong> par rapport à la date de commande. Les barres pâles correspondent à des périodes dont les crédits n'ont pas encore été tous reçus — leur solde net se rééquilibrera dans les prochains jours.
                </span>
              </div>
            )}
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
                      labelFormatter={(label: string, payload: any[]) => {
                        const isPartial = payload?.[0]?.payload?.partial;
                        return isPartial ? `${label} • données partielles (crédits Uber en cours de réconciliation)` : label;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="refundClient" name="Remb. clients" stackId="a" fill="hsl(24 95% 60%)" radius={[0, 0, 4, 4]}>
                      {timeSeries.map((d, i) => (
                        <Cell key={`rc-${i}`} fillOpacity={d.partial ? 0.4 : 1} stroke={d.partial ? "hsl(24 95% 60%)" : undefined} strokeDasharray={d.partial ? "3 2" : undefined} strokeWidth={d.partial ? 1 : 0} />
                      ))}
                    </Bar>
                    <Bar dataKey="uberCancel" name="Crédits Uber" stackId="a" fill="hsl(142 70% 50%)" radius={[4, 4, 0, 0]}>
                      {timeSeries.map((d, i) => (
                        <Cell key={`uc-${i}`} fillOpacity={d.partial ? 0.4 : 1} stroke={d.partial ? "hsl(142 70% 50%)" : undefined} strokeDasharray={d.partial ? "3 2" : undefined} strokeWidth={d.partial ? 1 : 0} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="refundNet"
                      name="Solde net"
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
                <p className="text-xs text-muted-foreground">Cliquez sur une colonne pour trier. Cliquez sur une ligne pour voir l'évolution mensuelle.</p>
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
                    <SortableHead label="Restaurant" sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHead label="Remb. clients" sortKey="refundClient" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="Crédits Uber" sortKey="uberCancel" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="Solde net" sortKey="refundNet" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="% du CA" sortKey="pctOfSales" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="Cmd. remboursées" sortKey="refundedOrders" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" altKey="refundedRate" altLabel="Trier par taux" />
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
                          <TableCell className="text-right text-muted-foreground">
                            {(() => {
                              const c = refundedCountsByRestaurant.get(row.restaurantId);
                              const refunded = c?.refunded ?? 0;
                              const total = c?.total ?? row.orderCount;
                              const rate = total > 0 ? (refunded / total) * 100 : 0;
                              return (
                                <div>
                                  <div className="font-medium text-foreground">{fmtInt(refunded)} / {fmtInt(total)}</div>
                                  <div className="text-xs">{fmtPct(rate)}</div>
                                </div>
                              );
                            })()}
                          </TableCell>
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
                                        refundClient: -m.refundClient,
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
                                      <Bar dataKey="uberCancel" name="Crédits Uber" stackId="b" fill="hsl(142 70% 50%)" />
                                      <Line type="monotone" dataKey="refundNet" name="Solde net" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
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

interface SortableHeadProps {
  label: string;
  sortKey: string;
  current: string;
  dir: "asc" | "desc";
  onClick: (k: any) => void;
  align?: "left" | "right";
  altKey?: string;
  altLabel?: string;
}

function SortableHead({ label, sortKey, current, dir, onClick, align = "left", altKey, altLabel }: SortableHeadProps) {
  const isActive = current === sortKey || current === altKey;
  const showAlt = altKey && current === altKey;
  const Icon = !isActive ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === "right" && "text-right", "select-none")}>
      <div className={cn("inline-flex items-center gap-1", align === "right" && "justify-end w-full")}>
        <button
          type="button"
          onClick={() => onClick(sortKey)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors",
            isActive ? "text-foreground font-semibold" : "text-muted-foreground"
          )}
        >
          <span>{label}</span>
          <Icon className="h-3 w-3 opacity-70" />
        </button>
        {altKey && (
          <button
            type="button"
            onClick={() => onClick(altKey)}
            title={altLabel || "Trier par taux"}
            className={cn(
              "ml-1 text-[10px] rounded px-1 py-0.5 border transition-colors",
              showAlt ? "border-primary/40 text-primary bg-primary/5" : "border-muted text-muted-foreground hover:text-foreground"
            )}
          >
            %
          </button>
        )}
      </div>
    </TableHead>
  );
}
