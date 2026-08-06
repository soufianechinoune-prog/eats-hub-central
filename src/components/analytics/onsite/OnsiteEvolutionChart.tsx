import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthAggregate, deltaPct } from "@/hooks/useSplashOnsiteMonthly";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const fmtShort = (v: number) => `${(v / 1_000_000).toFixed(1)} M€`;

type Mode = "brut" | "lfl";

export function OnsiteEvolutionChart({ months, year }: { months: MonthAggregate[]; year: number }) {
  const [mode, setMode] = useState<Mode>("lfl");
  const prev = year - 1;

  const data = useMemo(
    () =>
      months.map((m) => {
        const cur = mode === "lfl" ? m.lflCurrent : m.current;
        const old = mode === "lfl" ? m.lflPrevious : m.previous;
        return {
          label: MONTHS[m.month - 1] + (m.isPartial ? " *" : ""),
          current: cur,
          previous: old,
          delta: deltaPct(cur, old),
          restaurants: m.lflRestaurants,
        };
      }),
    [months, mode]
  );

  const totals = useMemo(() => {
    const cur = data.reduce((s, d) => s + (d.current || 0), 0);
    const old = data.reduce((s, d) => s + (d.previous || 0), 0);
    return { cur, old, delta: deltaPct(cur, old) };
  }, [data]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Évolution du CA sur place{" "}
            <span className="text-sm font-normal text-muted-foreground">({year} vs {prev})</span>
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "lfl"
              ? "Périmètre constant : uniquement les restaurants ouverts sur les deux années, mois par mois."
              : "Vue brute : tout le réseau, y compris les ouvertures et fermetures."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-5 rounded-xl bg-muted/30 px-4 py-2.5">
            <div className="text-right">
              <p className="text-xs leading-tight text-muted-foreground">{year}</p>
              <p className="text-lg font-bold leading-tight">{fmtEur(totals.cur)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs leading-tight text-muted-foreground">{prev}</p>
              <p className="text-lg font-semibold leading-tight text-muted-foreground">{fmtEur(totals.old)}</p>
            </div>
            <p
              className={
                totals.delta === null
                  ? "text-sm text-muted-foreground"
                  : totals.delta >= 0
                    ? "text-sm font-semibold text-emerald-600"
                    : "text-sm font-semibold text-destructive"
              }
            >
              {totals.delta === null ? "--" : `${totals.delta > 0 ? "+" : ""}${totals.delta.toFixed(1)}%`}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as Mode)}
            variant="outline"
            size="sm"
            className="rounded-xl"
          >
            <ToggleGroupItem className="rounded-lg" value="brut">Brut</ToggleGroupItem>
            <ToggleGroupItem className="rounded-lg" value="lfl">Périmètre constant</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              yAxisId="ca"
              tickFormatter={fmtShort}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tickFormatter={(v) => `${Math.round(v)}%`}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value: number, name: string) =>
                name === "Évolution"
                  ? [value === null ? "--" : `${value.toFixed(1)}%`, name]
                  : [fmtEur(value), name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="ca" dataKey="previous" name={`CA ${prev}`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.45} />
            <Bar yAxisId="ca" dataKey="current" name={`CA ${year}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="delta"
              name="Évolution"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function OnsiteScopeChart({ months, year }: { months: MonthAggregate[]; year: number }) {
  const data = useMemo(
    () =>
      months.map((m) => ({
        label: MONTHS[m.month - 1] + (m.isPartial ? " *" : ""),
        restaurants: m.lflRestaurants,
      })),
    [months]
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Taille du périmètre constant par mois</CardTitle>
        <p className="text-sm text-muted-foreground">
          Nombre de restaurants ayant du CA caisse à la fois en {year} et en {year - 1} sur le mois.
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--popover-foreground))",
              }}
            />
            <Bar dataKey="restaurants" name="Restaurants comparables" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
