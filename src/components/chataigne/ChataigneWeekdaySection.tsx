import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfWeek, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { fetchDailyChataigne } from "@/lib/dailyChannelFetchers";

type Metric = "revenue" | "orders" | "basket";

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const METRIC_LABEL: Record<Metric, string> = {
  revenue: "CA brut",
  orders: "Commandes",
  basket: "Panier moyen",
};

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
const fmtEur2 = (v: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) +
  " €";
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

const formatMetric = (metric: Metric, v: number) =>
  metric === "orders" ? fmtInt(v) : metric === "basket" ? fmtEur2(v) : fmtEur(v);

/** Index 0 = lundi */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

interface Props {
  start: string;
  end: string;
  restaurantIds: string[] | null | undefined;
}

export function ChataigneWeekdaySection({ start, end, restaurantIds }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const enabled = !!start && !!end && restaurantIds !== undefined;

  const { data: rows, isLoading } = useQuery({
    queryKey: [
      "chataigne-weekday",
      start,
      end,
      restaurantIds === undefined ? "pending" : restaurantIds === null ? "all" : [...restaurantIds].sort().join(","),
    ],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchDailyChataigne(start, end, restaurantIds ?? null),
  });

  /** Agrégation : une entrée par date (tous restaurants confondus), journée en cours exclue. */
  const byDate = useMemo(() => {
    const today = startOfDay(new Date());
    const map = new Map<string, { revenue: number; orders: number }>();
    for (const r of rows ?? []) {
      const d = String(r.date).slice(0, 10);
      const parsed = parseISO(d);
      if (isSameDay(parsed, today) || parsed > today) continue;
      const cur = map.get(d) ?? { revenue: 0, orders: 0 };
      cur.revenue += Number(r.revenue_ttc) || 0;
      cur.orders += Number(r.order_count) || 0;
      map.set(d, cur);
    }
    return [...map.entries()]
      .map(([date, v]) => ({ date, parsed: parseISO(date), ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const value = (revenue: number, orders: number): number =>
    metric === "revenue" ? revenue : metric === "orders" ? orders : orders > 0 ? revenue / orders : 0;

  /** Bloc 1 : profil de semaine (moyenne par jour de semaine) */
  const weekProfile = useMemo(() => {
    const acc = WEEKDAYS.map(() => ({ revenue: 0, orders: 0, days: 0 }));
    for (const d of byDate) {
      const i = mondayIndex(d.parsed);
      acc[i].revenue += d.revenue;
      acc[i].orders += d.orders;
      acc[i].days += 1;
    }
    return acc.map((a, i) => ({
      day: WEEKDAYS_SHORT[i],
      fullDay: WEEKDAYS[i],
      days: a.days,
      avgRevenue: a.days > 0 ? a.revenue / a.days : 0,
      avgOrders: a.days > 0 ? a.orders / a.days : 0,
      basket: a.orders > 0 ? a.revenue / a.orders : 0,
      value:
        a.days === 0
          ? 0
          : metric === "revenue"
            ? a.revenue / a.days
            : metric === "orders"
              ? a.orders / a.days
              : a.orders > 0
                ? a.revenue / a.orders
                : 0,
    }));
  }, [byDate, metric]);

  const bestDayIndex = useMemo(() => {
    let best = 0;
    weekProfile.forEach((d, i) => {
      if (d.value > weekProfile[best].value) best = i;
    });
    return best;
  }, [weekProfile]);

  /** Semaines présentes (lundi de chaque semaine) */
  const weeks = useMemo(() => {
    const set = new Set<string>();
    for (const d of byDate) set.add(format(startOfWeek(d.parsed, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    return [...set].sort();
  }, [byDate]);

  /** Matrice jour × semaine */
  const matrix = useMemo(() => {
    const m = new Map<string, { revenue: number; orders: number }>();
    for (const d of byDate) {
      const wk = format(startOfWeek(d.parsed, { weekStartsOn: 1 }), "yyyy-MM-dd");
      m.set(`${wk}|${mondayIndex(d.parsed)}`, { revenue: d.revenue, orders: d.orders });
    }
    return m;
  }, [byDate]);

  /** Bloc 2 : un jour, semaine après semaine */
  const daySeries = useMemo(() => {
    return weeks
      .map((wk) => {
        const cell = matrix.get(`${wk}|${selectedDay}`);
        if (!cell) return null;
        return {
          week: wk,
          label: format(parseISO(wk), "dd MMM", { locale: fr }),
          value: value(cell.revenue, cell.orders),
        };
      })
      .filter(Boolean) as { week: string; label: string; value: number }[];
  }, [weeks, matrix, selectedDay, metric]);

  const dayStats = useMemo(() => {
    if (daySeries.length === 0) return null;
    const last = daySeries[daySeries.length - 1];
    const prev = daySeries.length > 1 ? daySeries[daySeries.length - 2] : null;
    const avg = daySeries.reduce((s, d) => s + d.value, 0) / daySeries.length;
    return {
      last,
      wow: prev && prev.value > 0 ? ((last.value - prev.value) / prev.value) * 100 : null,
      vsAvg: avg > 0 ? ((last.value - avg) / avg) * 100 : null,
      avg,
    };
  }, [daySeries]);

  /** Bornes pour la carte de chaleur */
  const heatBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const [, v] of matrix) {
      const val = value(v.revenue, v.orders);
      if (val < min) min = val;
      if (val > max) max = val;
    }
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
  }, [matrix, metric]);

  const heatStyle = (val: number | null) => {
    if (val === null) return { background: "hsl(var(--muted) / 0.3)" };
    const { min, max } = heatBounds;
    const ratio = max > min ? (val - min) / (max - min) : 1;
    return {
      background: `hsl(var(--primary) / ${0.1 + ratio * 0.75})`,
      color: ratio > 0.55 ? "hsl(var(--primary-foreground))" : undefined,
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[420px] w-full" />
        <Skeleton className="h-[380px] w-full" />
      </div>
    );
  }

  if (byDate.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Aucune donnée sur cette période.
        </CardContent>
      </Card>
    );
  }

  const metricToggle = (
    <ToggleGroup
      type="single"
      size="sm"
      value={metric}
      onValueChange={(v) => v && setMetric(v as Metric)}
    >
      <ToggleGroupItem value="revenue">€</ToggleGroupItem>
      <ToggleGroupItem value="orders">Commandes</ToggleGroupItem>
      <ToggleGroupItem value="basket">Panier moyen</ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Comparaison des jours de la semaine sur la période sélectionnée. La journée en cours est
        exclue (jour incomplet).
      </p>

      {/* 1. Profil de semaine */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Profil de semaine</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {metric === "basket" ? "Panier moyen" : "Moyenne"} par jour de semaine ·{" "}
              {METRIC_LABEL[metric]} · meilleur jour : {weekProfile[bestDayIndex].fullDay}
            </p>
          </div>
          {metricToggle}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={weekProfile} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                width={70}
                tickFormatter={(v: number) => formatMetric(metric, v)}
              />
              <RTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof weekProfile)[number];
                  return (
                    <div className="space-y-1 rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
                      <div className="font-semibold">{d.fullDay}</div>
                      <div>CA moyen : {fmtEur(d.avgRevenue)}</div>
                      <div>Commandes moyennes : {fmtInt(d.avgOrders)}</div>
                      <div>Panier moyen : {fmtEur2(d.basket)}</div>
                      <div className="text-muted-foreground">{d.days} jour(s) sur la période</div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                fill="hsl(var(--primary))"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. Un jour, semaine après semaine */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Tous les {WEEKDAYS[selectedDay].toLowerCase()}s</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {METRIC_LABEL[metric]} · {daySeries.length} semaine(s) sur la période
            </p>
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            value={String(selectedDay)}
            onValueChange={(v) => v && setSelectedDay(Number(v))}
          >
            {WEEKDAYS_SHORT.map((d, i) => (
              <ToggleGroupItem key={d} value={String(i)}>
                {d}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent className="space-y-4">
          {dayStats && (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label={`Dernier ${WEEKDAYS[selectedDay].toLowerCase()}`}
                value={formatMetric(metric, dayStats.last.value)}
                sub={dayStats.last.label}
              />
              <StatTile
                label="vs semaine précédente"
                value={dayStats.wow === null ? "—" : `${dayStats.wow > 0 ? "+" : ""}${dayStats.wow.toFixed(1)} %`}
                trend={dayStats.wow}
              />
              <StatTile
                label={`vs moyenne des ${WEEKDAYS[selectedDay].toLowerCase()}s`}
                value={dayStats.vsAvg === null ? "—" : `${dayStats.vsAvg > 0 ? "+" : ""}${dayStats.vsAvg.toFixed(1)} %`}
                sub={`moyenne ${formatMetric(metric, dayStats.avg)}`}
                trend={dayStats.vsAvg}
              />
            </div>
          )}
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={daySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                width={70}
                tickFormatter={(v: number) => formatMetric(metric, v)}
              />
              <RTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
                      <div className="font-semibold">
                        {WEEKDAYS[selectedDay]} · semaine du {String(label)}
                      </div>
                      <div>
                        {METRIC_LABEL[metric]} : {formatMetric(metric, Number(payload[0].value) || 0)}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Tableau croisé jours × semaines */}
      <Card>
        <CardHeader>
          <CardTitle>Jours × semaines</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {METRIC_LABEL[metric]} — plus la case est foncée, plus la valeur est élevée.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="w-20 text-left font-medium text-muted-foreground">Jour</th>
                  {weeks.map((wk) => (
                    <th key={wk} className="text-center font-medium text-muted-foreground">
                      {format(parseISO(wk), "dd/MM", { locale: fr })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <tr key={d}>
                    <td className="font-medium">{d}</td>
                    {weeks.map((wk) => {
                      const cell = matrix.get(`${wk}|${i}`);
                      const val = cell ? value(cell.revenue, cell.orders) : null;
                      return (
                        <td key={wk} className="p-0">
                          <div
                            className="flex h-9 items-center justify-center rounded-md tabular-nums"
                            style={heatStyle(val)}
                            title={`${WEEKDAYS[i]} · semaine du ${format(parseISO(wk), "dd/MM/yyyy")}`}
                          >
                            {val === null ? "—" : formatMetric(metric, val)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
}) {
  const Icon = trend == null ? Minus : trend > 0 ? ArrowUp : trend < 0 ? ArrowDown : Minus;
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
        {trend != null && (
          <Icon
            className={cn(
              "h-4 w-4",
              trend > 0 ? "text-emerald-500" : trend < 0 ? "text-destructive" : "text-muted-foreground",
            )}
          />
        )}
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
