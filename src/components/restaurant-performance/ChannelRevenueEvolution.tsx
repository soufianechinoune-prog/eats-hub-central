import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PERF_CHANNELS, type PerfChannel } from "@/hooks/useRestaurantPerformance";
import { bucketKey, isPartialBucket, type Granularity } from "@/lib/performanceBuckets";
import { CHANNEL_META, fmtEur } from "./channelMeta";

interface Props {
  rows: { key: string; canal: PerfChannel; ca: number }[]; // key = jour (ou 1er du mois en mensuel)
  start: string;
  end: string;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  isLoading: boolean;
}

type Point = { key: string; partial: boolean } & Partial<Record<PerfChannel, number>>;

export function ChannelRevenueEvolution({ rows, start, end, granularity, onGranularityChange, isLoading }: Props) {
  const [hidden, setHidden] = useState<Set<PerfChannel>>(new Set());

  const data = useMemo<Point[]>(() => {
    const map = new Map<string, Point>();
    for (const r of rows) {
      const k = bucketKey(r.key, granularity);
      const p = map.get(k) ?? { key: k, partial: isPartialBucket(k, granularity, start, end) };
      p[r.canal] = (p[r.canal] ?? 0) + r.ca;
      map.set(k, p);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, granularity, start, end]);

  const labelOf = (k: string) => {
    const d = parseISO(k);
    if (granularity === "month") return format(d, "MMM yy", { locale: fr });
    if (granularity === "week") return `S. ${format(d, "dd/MM")}`;
    return format(d, "dd/MM");
  };

  const partialLabel = granularity === "month" ? "mois partiel" : "semaine partielle";

  const toggle = (c: PerfChannel) =>
    setHidden((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Évolution du CA par canal</CardTitle>
        <div className="flex gap-1 rounded-md bg-muted p-0.5">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={granularity === g ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => onGranularityChange(g)}
            >
              {g === "day" ? "Jour" : g === "week" ? "Semaine" : "Mois"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="key" tickFormatter={labelOf} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11 }}
                width={44}
                className="fill-muted-foreground"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Point;
                  return (
                    <div className="rounded-md border bg-popover p-2.5 text-xs shadow-md">
                      <div className="mb-1 font-medium">
                        {labelOf(String(label))}
                        {p.partial && <span className="ml-1.5 text-muted-foreground">· {partialLabel}</span>}
                      </div>
                      {payload.map((e) => (
                        <div key={String(e.dataKey)} className="flex justify-between gap-4">
                          <span style={{ color: e.color }}>{CHANNEL_META[e.dataKey as PerfChannel].label}</span>
                          <span className="tabular-nums">{fmtEur(Number(e.value))}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {PERF_CHANNELS.filter((c) => !hidden.has(c)).map((c) => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={c}
                  stroke={CHANNEL_META[c].color}
                  strokeWidth={2}
                  connectNulls
                  dot={(props: { cx?: number; cy?: number; payload?: Point; index?: number }) => {
                    const { cx, cy, payload, index } = props;
                    if (cx == null || cy == null || !payload?.partial)
                      return <g key={`${c}-${index}`} />;
                    return (
                      <circle
                        key={`${c}-${index}`}
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="hsl(var(--card))"
                        stroke={CHANNEL_META[c].color}
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                      />
                    );
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PERF_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity",
                hidden.has(c) && "opacity-40 line-through",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_META[c].color }} />
              {CHANNEL_META[c].label}
            </button>
          ))}
          {granularity !== "day" && data.some((d) => d.partial) && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground" />
              {partialLabel === "semaine partielle" ? "Semaine partielle (période incomplète)" : "Mois partiel (période incomplète)"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
