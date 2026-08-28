import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Euro, Minus, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CHART_ANIMATION_DURATION = 500;
const CHART_ANIMATION_EASING = "ease-out";

export interface DailyRow {
  date: string;
  revenue_ttc: number;
  order_count: number;
  average_basket?: number;
}

interface LegendItem {
  key: string;
  label: string;
  color: string;
}

function InteractiveLegend({
  items,
  hiddenKeys,
  onToggle,
  onReset,
}: {
  items: LegendItem[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((item, index) => {
        const isHidden = hiddenKeys.has(item.key);
        return (
          <motion.button
            key={item.key}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            onClick={() => onToggle(item.key)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
              isHidden
                ? "bg-muted/50 text-muted-foreground border-transparent opacity-50"
                : "bg-background shadow-sm border-border hover:shadow-md"
            )}
          >
            <motion.span
              animate={{ opacity: isHidden ? 0.3 : 1, scale: isHidden ? 0.8 : 1 }}
              transition={{ duration: 0.2 }}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className={cn("transition-all duration-200", isHidden && "line-through")}>
              {item.label}
            </span>
          </motion.button>
        );
      })}
      <AnimatePresence>
        {hiddenKeys.size > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-2 transition-colors"
          >
            Tout afficher
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function KpiPill({
  icon,
  currentLabel,
  currentValue,
  prevLabel,
  prevValue,
  variation,
  hasPrev,
}: {
  icon: React.ReactNode;
  currentLabel: string;
  currentValue: string;
  prevLabel: string;
  prevValue: string;
  variation: number;
  hasPrev: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 rounded-xl mt-1"
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <div className="text-right">
          <p className="text-xs text-muted-foreground leading-tight">{currentLabel}</p>
          <p className="text-base font-bold leading-tight">{currentValue}</p>
        </div>
      </div>
      {hasPrev && (
        <>
          <div className="h-10 w-px bg-border" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground leading-tight">{prevLabel}</p>
            <p className="text-sm text-muted-foreground leading-tight">{prevValue}</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div
            className={cn(
              "flex items-center gap-1 font-semibold text-base",
              variation > 0 && "text-emerald-500",
              variation < 0 && "text-red-500",
              variation === 0 && "text-muted-foreground"
            )}
          >
            {variation > 0 ? (
              <ArrowUp className="h-4 w-4" />
            ) : variation < 0 ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span>
              {variation > 0 ? "+" : ""}
              {variation.toFixed(1)}%
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

const calcVariation = (current: number, prev: number) =>
  prev > 0 ? ((current - prev) / prev) * 100 : current > 0 ? 100 : 0;

const pad = (n: number) => String(n).padStart(2, "0");
const monthRange = (year: number, month: number) => {
  const last = new Date(year, month, 0).getDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` };
};

export interface DailyComparisonChartsProps {
  /** Récupère les lignes quotidiennes pour une plage de dates */
  fetcher: (start: string, end: string, restaurantIds: string[] | null) => Promise<DailyRow[]>;
  /** Clé de cache (canal) */
  cacheKey: string;
  year: number;
  month: number;
  restaurantIds: string[] | null | undefined;
  /** 'year' = même mois année précédente · 'previous_month' = mois calendaire précédent */
  comparisonMode: "year" | "previous_month";
  currentLabel: string;
  prevLabel: string;
  /** Suffixe du titre, ex: "(2026 vs 2025)" */
  comparisonSuffix?: string;
  enabled?: boolean;
}

export function DailyComparisonCharts({
  fetcher,
  cacheKey,
  year,
  month,
  restaurantIds,
  comparisonMode,
  currentLabel,
  prevLabel,
  comparisonSuffix,
  enabled = true,
}: DailyComparisonChartsProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const toggleKey = (key: string) =>
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const current = useMemo(() => monthRange(year, month), [year, month]);
  const previous = useMemo(() => {
    if (comparisonMode === "year") return monthRange(year - 1, month);
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    return monthRange(y, m);
  }, [comparisonMode, year, month]);

  const ids = restaurantIds === undefined ? undefined : restaurantIds;
  const isEnabled = enabled && ids !== undefined;

  const { data, isLoading } = useQuery({
    queryKey: [
      "daily-comparison",
      cacheKey,
      current.start,
      previous.start,
      ids ? [...ids].sort().join(",") : "all",
    ],
    enabled: isEnabled,
    queryFn: async () => {
      const [cur, prev] = await Promise.all([
        fetcher(current.start, current.end, ids ?? null),
        fetcher(previous.start, previous.end, ids ?? null),
      ]);
      return { cur, prev };
    },
  });

  const chartData = useMemo(() => {
    const byDay: Record<
      number,
      { revenue: number; orders: number; prevRevenue: number; prevOrders: number }
    > = {};
    const ensure = (d: number) =>
      (byDay[d] ??= { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 });

    (data?.cur ?? []).forEach((r) => {
      const d = Number(r.date.slice(8, 10));
      const e = ensure(d);
      e.revenue += Number(r.revenue_ttc) || 0;
      e.orders += Number(r.order_count) || 0;
    });
    (data?.prev ?? []).forEach((r) => {
      const d = Number(r.date.slice(8, 10));
      const e = ensure(d);
      e.prevRevenue += Number(r.revenue_ttc) || 0;
      e.prevOrders += Number(r.order_count) || 0;
    });

    const lastDay = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => {
      const d = i + 1;
      const e = byDay[d] ?? { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 };
      return {
        month: String(d),
        revenue: e.revenue,
        orders: e.orders,
        prevRevenue: e.prevRevenue,
        prevOrders: e.prevOrders,
        avgBasket: e.orders > 0 ? e.revenue / e.orders : 0,
        avgBasketN1: e.prevOrders > 0 ? e.prevRevenue / e.prevOrders : 0,
      };
    });
  }, [data, year, month]);

  const hasPrevData = useMemo(
    () => chartData.some((d) => d.prevRevenue > 0 || d.prevOrders > 0),
    [chartData]
  );

  const totals = useMemo(() => {
    const revenue = chartData.reduce((s, d) => s + d.revenue, 0);
    const prevRevenue = chartData.reduce((s, d) => s + d.prevRevenue, 0);
    const orders = chartData.reduce((s, d) => s + d.orders, 0);
    const prevOrders = chartData.reduce((s, d) => s + d.prevOrders, 0);
    return {
      revenue,
      prevRevenue,
      orders,
      prevOrders,
      avgBasket: orders > 0 ? revenue / orders : 0,
      avgPrevBasket: prevOrders > 0 ? prevRevenue / prevOrders : 0,
    };
  }, [chartData]);

  const suffix = comparisonSuffix ?? `(${currentLabel} vs ${prevLabel})`;

  const avgBasketDomain = useMemo<[number, number] | undefined>(() => {
    const values = chartData
      .flatMap((d) => [d.avgBasket, d.avgBasketN1])
      .filter((v) => v > 0);
    if (values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.15, 1);
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
  }, [chartData]);

  if (isLoading || !isEnabled) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <span>Évolution du Chiffre d'Affaires</span>
            {hasPrevData && (
              <span className="text-sm font-normal text-muted-foreground ml-2">{suffix}</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            <KpiPill
              icon={<Euro className="h-5 w-5 text-primary" />}
              currentLabel={currentLabel}
              currentValue={`${totals.revenue.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
              prevLabel={prevLabel}
              prevValue={`${totals.prevRevenue.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
              variation={calcVariation(totals.revenue, totals.prevRevenue)}
              hasPrev={hasPrevData}
            />
          </div>
        </CardHeader>
        <CardContent>
          <InteractiveLegend
            items={[
              { key: "revenue", label: `CA ${currentLabel}`, color: "hsl(var(--primary))" },
              ...(hasPrevData
                ? [
                    {
                      key: "prevRevenue",
                      label: `CA ${prevLabel}`,
                      color: "hsl(var(--muted-foreground))",
                    },
                  ]
                : []),
            ]}
            hiddenKeys={hiddenKeys}
            onToggle={toggleKey}
            onReset={() => setHiddenKeys(new Set())}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    const variation = calcVariation(d.revenue, d.prevRevenue);
                    const variationColor =
                      variation > 0
                        ? "text-green-600"
                        : variation < 0
                          ? "text-red-600"
                          : "text-muted-foreground";
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium mb-1">Jour {label}</p>
                        <p className="text-sm">
                          CA {currentLabel}: {(d.revenue || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                        </p>
                        {hasPrevData && (
                          <>
                            <p className="text-sm text-muted-foreground">
                              CA {prevLabel}: {(d.prevRevenue || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                            </p>
                            <p className={`text-sm font-medium mt-1 ${variationColor}`}>
                              {variation > 0 ? "+" : ""}
                              {variation.toFixed(1)}%
                            </p>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                {hasPrevData && !hiddenKeys.has("prevRevenue") && (
                  <Line
                    type="monotone"
                    dataKey="prevRevenue"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--muted-foreground))", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5 }}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {!hiddenKeys.has("revenue") && (
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5 }}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Évolution des Commandes
            {hasPrevData && (
              <span className="text-sm font-normal text-muted-foreground ml-2">{suffix}</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            <KpiPill
              icon={<ShoppingCart className="h-5 w-5 text-chart-2" />}
              currentLabel={currentLabel}
              currentValue={totals.orders.toLocaleString("fr-FR")}
              prevLabel={prevLabel}
              prevValue={totals.prevOrders.toLocaleString("fr-FR")}
              variation={calcVariation(totals.orders, totals.prevOrders)}
              hasPrev={hasPrevData}
            />
          </div>
        </CardHeader>
        <CardContent>
          <InteractiveLegend
            items={[
              { key: "orders", label: `Commandes ${currentLabel}`, color: "hsl(var(--chart-2))" },
              ...(hasPrevData
                ? [
                    {
                      key: "prevOrders",
                      label: `Commandes ${prevLabel}`,
                      color: "hsl(var(--muted-foreground))",
                    },
                  ]
                : []),
            ]}
            hiddenKeys={hiddenKeys}
            onToggle={toggleKey}
            onReset={() => setHiddenKeys(new Set())}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [value.toLocaleString("fr-FR"), "Commandes"]}
                />
                {hasPrevData && !hiddenKeys.has("prevOrders") && (
                  <Line
                    type="monotone"
                    dataKey="prevOrders"
                    name={`Commandes ${prevLabel}`}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(var(--muted-foreground))", r: 3 }}
                    opacity={0.6}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {!hiddenKeys.has("orders") && (
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name={`Commandes ${currentLabel}`}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Average basket */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Évolution du Panier Moyen
            {hasPrevData && (
              <span className="text-sm font-normal text-muted-foreground ml-2">{suffix}</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            <KpiPill
              icon={<Euro className="h-5 w-5 text-chart-1" />}
              currentLabel={currentLabel}
              currentValue={`${totals.avgBasket.toFixed(2)} €`}
              prevLabel={prevLabel}
              prevValue={`${totals.avgPrevBasket.toFixed(2)} €`}
              variation={calcVariation(totals.avgBasket, totals.avgPrevBasket)}
              hasPrev={hasPrevData && totals.avgPrevBasket > 0}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis
                  className="text-xs"
                  domain={avgBasketDomain}
                  tickFormatter={(value) => `${value}€`}
                  allowDataOverflow={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string, props: any) => {
                    const item = props.payload;
                    if (name.includes(currentLabel)) {
                      return [
                        `${value.toFixed(2)} €`,
                        `Panier moyen ${currentLabel} (${item?.orders?.toLocaleString("fr-FR") || 0} commandes)`,
                      ];
                    }
                    return [
                      `${value.toFixed(2)} €`,
                      `Panier moyen ${prevLabel} (${item?.prevOrders?.toLocaleString("fr-FR") || 0} commandes)`,
                    ];
                  }}
                  labelFormatter={(label) => `Jour ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="avgBasket"
                  name={`Panier moyen ${currentLabel}`}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
                {hasPrevData && (
                  <Line
                    type="monotone"
                    dataKey="avgBasketN1"
                    name={`Panier moyen ${prevLabel}`}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(var(--muted-foreground))", r: 3 }}
                    opacity={0.6}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
