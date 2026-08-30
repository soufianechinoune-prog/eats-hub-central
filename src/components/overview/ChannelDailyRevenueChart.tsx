import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CHANNEL_META, type ChannelId } from "@/components/overview/ChannelBreakdownPanel";

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";

type Row = { date: string; revenue_ttc: number | string; restaurant_id: string };

async function fetchDaily(
  fn: string,
  start: string,
  end: string,
  restaurantId: string,
): Promise<Row[]> {
  const { data, error } = await (supabase.rpc as any)(fn, {
    p_start_date: start,
    p_end_date: end,
    p_restaurant_ids: [restaurantId],
  });
  if (error) throw error;
  return (data ?? []) as Row[];
}

export interface ChannelDailyRevenueChartProps {
  restaurantId: string;
  startDate: string;
  endDate: string;
  /** Canaux à afficher (ceux qui ont du CA sur la période). */
  channels: ChannelId[];
}

export function ChannelDailyRevenueChart({
  restaurantId,
  startDate,
  endDate,
  channels,
}: ChannelDailyRevenueChartProps) {
  const [mode, setMode] = useState<"eur" | "pct">("eur");
  const [hidden, setHidden] = useState<Set<ChannelId>>(new Set());

  const enabled = !!restaurantId && !!startDate && !!endDate;

  const platforms = useQuery({
    queryKey: ["channel-daily", "platforms", restaurantId, startDate, endDate],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_daily_revenue_from_orders", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_restaurant_ids: [restaurantId],
      });
      if (error) throw error;
      return (data ?? []) as (Row & { platform: string | null })[];
    },
  });

  const cash = useQuery({
    queryKey: ["channel-daily", "cash", restaurantId, startDate, endDate],
    enabled: enabled && channels.includes("cash"),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchDaily("get_daily_onsite_from_splash", startDate, endDate, restaurantId),
  });

  const chataigne = useQuery({
    queryKey: ["channel-daily", "chataigne", restaurantId, startDate, endDate],
    enabled: enabled && channels.includes("chataigne"),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchDaily("get_daily_chataigne", startDate, endDate, restaurantId),
  });

  const isLoading = platforms.isLoading || cash.isLoading || chataigne.isLoading;

  const { data, totals, grandTotal, activeChannels } = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    const add = (date: string, key: ChannelId, value: number) => {
      const d = date.slice(0, 10);
      const row = byDate.get(d) ?? { uber: 0, deliveroo: 0, cash: 0, chataigne: 0 };
      row[key] = (row[key] ?? 0) + value;
      byDate.set(d, row);
    };

    for (const r of platforms.data ?? []) {
      const p = (r.platform ?? "").toLowerCase();
      const key: ChannelId | null =
        p.includes("deliveroo") ? "deliveroo" : p.includes("uber") || p === "" ? "uber" : null;
      if (key) add(r.date, key, Number(r.revenue_ttc) || 0);
    }
    for (const r of cash.data ?? []) add(r.date, "cash", Number(r.revenue_ttc) || 0);
    for (const r of chataigne.data ?? []) add(r.date, "chataigne", Number(r.revenue_ttc) || 0);

    const dates = [...byDate.keys()].sort();
    const totals: Record<string, number> = { uber: 0, deliveroo: 0, cash: 0, chataigne: 0 };
    const rows = dates.map((d) => {
      const r = byDate.get(d)!;
      const total = (r.uber ?? 0) + (r.deliveroo ?? 0) + (r.cash ?? 0) + (r.chataigne ?? 0);
      for (const k of Object.keys(totals)) totals[k] += r[k] ?? 0;
      return { date: d, ...r, __total: total };
    });

    const active = (["uber", "deliveroo", "cash", "chataigne"] as ChannelId[]).filter(
      (c) => totals[c] > 0,
    );
    const grand = active.reduce((s, c) => s + totals[c], 0);
    return { data: rows, totals, grandTotal: grand, activeChannels: active };
  }, [platforms.data, cash.data, chataigne.data]);

  const visible = activeChannels.filter((c) => !hidden.has(c));

  const chartData = useMemo(() => {
    if (mode === "eur") return data;
    return data.map((row) => {
      const total = visible.reduce((s, c) => s + ((row as any)[c] ?? 0), 0);
      const out: any = { date: row.date, __total: total };
      for (const c of visible) out[c] = total > 0 ? (((row as any)[c] ?? 0) / total) * 100 : 0;
      return out;
    });
  }, [data, mode, visible]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    );
  }

  if (activeChannels.length === 0 || data.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Aucune donnée quotidienne sur cette période.
      </div>
    );
  }

  const toggle = (c: ChannelId) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      if (next.size === activeChannels.length) return prev; // au moins un canal visible
      return next;
    });

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 backdrop-blur p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Évolution du CA par canal</div>
          <div className="text-[11px] text-muted-foreground">
            Vue jour · total {fmtEur(grandTotal)} sur la période
          </div>
        </div>
        <div className="inline-flex rounded-md border border-border/60 overflow-hidden">
          {(["eur", "pct"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {m === "eur" ? "€" : "%"}
            </button>
          ))}
        </div>
      </div>

      {/* Récap par canal / légende interactive */}
      <div className="flex flex-wrap gap-2">
        {activeChannels.map((c) => {
          const meta = CHANNEL_META[c];
          const Icon = meta.icon;
          const isHidden = hidden.has(c);
          const share = grandTotal > 0 ? (totals[c] / grandTotal) * 100 : 0;
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all",
                isHidden ? "opacity-40 border-border/40" : "border-border hover:shadow-sm",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.barColor }} />
              <Icon className={cn("h-3 w-3", meta.textClass)} />
              <span className={cn("font-medium", meta.textClass)}>{meta.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {fmtEur(totals[c])} · {share.toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {visible.map((c) => (
                <linearGradient key={c} id={`grad-${c}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHANNEL_META[c].barColor} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={CHANNEL_META[c].barColor} stopOpacity={0.25} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickFormatter={(d: string) => format(parseISO(d), "dd/MM", { locale: fr })}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={mode === "pct" ? [0, 100] : undefined}
              tickFormatter={(v: number) => (mode === "pct" ? `${Math.round(v)}%` : fmtEur(v))}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                const raw = data.find((d) => d.date === label);
                const rawTotal = visible.reduce((s, c) => s + ((raw as any)?.[c] ?? 0), 0);
                return (
                  <div className="rounded-lg border border-border bg-popover p-3 shadow-lg text-xs space-y-1">
                    <div className="font-semibold mb-1">
                      {format(parseISO(String(label)), "EEEE d MMMM", { locale: fr })}
                    </div>
                    {[...payload].reverse().map((p) => {
                      const c = p.dataKey as ChannelId;
                      const meta = CHANNEL_META[c];
                      const value = (raw as any)?.[c] ?? 0;
                      const pct = rawTotal > 0 ? (value / rawTotal) * 100 : 0;
                      return (
                        <div key={c} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: meta.barColor }}
                            />
                            {meta.label}
                          </span>
                          <span className="tabular-nums font-medium">
                            {fmtEur(value)} · {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                    <div className="mt-1 border-t border-border/50 pt-1 flex items-center justify-between gap-4 font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {mode === "pct" ? fmtEur(rawTotal) : fmtEur(total)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            {visible.map((c) => (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                stackId="1"
                stroke={CHANNEL_META[c].barColor}
                strokeWidth={1.5}
                fill={`url(#grad-${c})`}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
