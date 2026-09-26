import { useMemo } from "react";
import { CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { NetworkDailyPoint } from "@/hooks/useNetworkDailyRevenue";

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v)) + " €";

const fmtCompact = (v: number) =>
  v >= 1000 ? `${Math.round(v / 1000)} k` : `${Math.round(v)}`;

const fmtDate = (iso: string) => format(parseISO(iso), "d MMM yyyy", { locale: fr });

/** Même date un an plus tôt (période N-1 comparée par useNetworkStats) */
const fmtDatePrevYear = (iso: string) => {
  const d = parseISO(iso);
  d.setFullYear(d.getFullYear() - 1);
  return format(d, "d MMM yyyy", { locale: fr });
};

interface ChannelSlice {
  key: string;
  label: string;
  value: number | null; // null = non provisionné
  color: string; // css color for dot + bar segment
  note?: string;
}

export interface NetworkRevenueHeroProps {
  isLoading: boolean;
  /** Variation du CA total vs N-1 (même période), null si indisponible */
  variation: number | null;
  cash: number | null;
  uber: number;
  deliveroo: number;
  dishop: number | null;
  chataigne: number;
  daily: NetworkDailyPoint[];
  /** Période sélectionnée, yyyy-MM-dd */
  startDateStr: string;
  endDateStr: string;
}

export function NetworkRevenueHero({
  isLoading,
  variation,
  cash,
  uber,
  deliveroo,
  dishop,
  chataigne,
  daily,
  startDateStr,
  endDateStr,
}: NetworkRevenueHeroProps) {
  const slices: ChannelSlice[] = [
    { key: "cash", label: "Caisse", value: cash, color: "hsl(var(--cash))" },
    { key: "uber", label: "Uber Eats", value: uber, color: "hsl(var(--uber))" },
    { key: "deliveroo", label: "Deliveroo", value: deliveroo, color: "hsl(var(--deliveroo))" },
    { key: "dishop", label: "Dishop", value: dishop, color: "hsl(25 95% 53%)", note: dishop == null ? "Non provisionné" : undefined },
    { key: "chataigne", label: "Chataigne", value: chataigne, color: "hsl(215 16% 47%)" },
  ];

  const total = slices.reduce((s, c) => s + Math.max(0, c.value ?? 0), 0);

  const chartData = useMemo(
    () => daily.map((d) => ({ date: d.date, total: d.total })),
    [daily],
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
            <div className="space-y-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-56 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          {/* GAUCHE — total + barre empilée + légende */}
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Chiffre d'affaires total</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-bold tracking-tight tabular-nums">
                {fmtEur(total)}
              </span>
              {variation != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    variation >= 0
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                  )}
                >
                  {variation >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {variation > 0 ? "+" : ""}
                  {variation.toFixed(1).replace(".", ",")} %
                </span>
              )}
            </div>
            {variation != null && (
              <p className="mt-1 text-xs text-muted-foreground">vs N-1 (même période)</p>
            )}

            {/* Barre empilée */}
            <div className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full bg-muted">
              {slices.map((s) => {
                const v = Math.max(0, s.value ?? 0);
                if (v <= 0 || total <= 0) return null;
                return (
                  <div
                    key={s.key}
                    className="h-full"
                    style={{ width: `${(v / total) * 100}%`, backgroundColor: s.color }}
                    title={`${s.label} · ${fmtEur(v)}`}
                  />
                );
              })}
            </div>

            {/* Légende */}
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {slices.map((s) => {
                const v = s.value;
                const pct = v != null && total > 0 ? (Math.max(0, v) / total) * 100 : null;
                return (
                  <div key={s.key} className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate font-medium">{s.label}</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        {pct != null ? `${pct.toFixed(1).replace(".", ",")} %` : "—"}
                      </span>
                    </div>
                    <p className="mt-1 pl-3.5 text-sm font-semibold tabular-nums">
                      {v != null ? fmtEur(v) : (
                        <span className="text-xs font-normal text-muted-foreground">
                          {s.note ?? "Non provisionné"}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DROITE — évolution quotidienne */}
          <div className="min-w-0 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Évolution du CA</p>
              <p className="text-xs text-muted-foreground">
                Total : <span className="font-semibold text-foreground tabular-nums">{fmtEur(total)}</span>
              </p>
            </div>
            <div className="mt-3 h-48 w-full">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Aucune donnée quotidienne sur la période.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="heroBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(262 83% 68%)" />
                        <stop offset="100%" stopColor="hsl(262 83% 58%)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={20}
                      tickFormatter={(d: string) => format(parseISO(d), "d MMM", { locale: fr })}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v: number) => fmtCompact(v)}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                            <div className="font-medium">
                              {format(parseISO(String(label)), "EEEE d MMMM", { locale: fr })}
                            </div>
                            <div className="mt-0.5 font-semibold tabular-nums">
                              {fmtEur(Number(payload[0].value) || 0)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="total" fill="url(#heroBarGrad)" radius={[5, 5, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
