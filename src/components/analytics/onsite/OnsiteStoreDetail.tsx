import { useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RestaurantAggregate, avgBasket, deltaPct } from "@/hooks/useSplashOnsiteMonthly";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtEur2 = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const fmtShort = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k€` : `${Math.round(v)} €`);

function Delta({ current, previous }: { current: number; previous: number }) {
  const d = deltaPct(current, previous);
  if (d === null) return <span className="text-muted-foreground">--</span>;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        neutral ? "text-muted-foreground" : d > 0 ? "text-emerald-600" : "text-destructive"
      )}
    >
      {neutral ? <Minus className="h-3.5 w-3.5" /> : d > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {d > 0 ? "+" : ""}
      {d.toFixed(1)}%
    </span>
  );
}

export function OnsiteStoreDetail({
  restaurants,
  year,
}: {
  restaurants: RestaurantAggregate[];
  year: number;
}) {
  const prev = year - 1;
  const sorted = useMemo(
    () => [...restaurants].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [restaurants]
  );
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (sorted.length > 0 && !sorted.some((r) => r.restaurantId === selected)) {
      setSelected(sorted[0].restaurantId);
    }
  }, [sorted, selected]);

  const resto = sorted.find((r) => r.restaurantId === selected) ?? null;

  const data = useMemo(() => {
    if (!resto) return [];
    return resto.months.map((m) => ({
      label: MONTHS[m.month - 1] + (m.isPartial ? " *" : ""),
      current: m.current,
      previous: m.previous,
      ordersCurrent: m.ordersCurrent,
      ordersPrevious: m.ordersPrevious,
      basketCurrent: avgBasket(m.current, m.ordersCurrent),
      basketPrevious: avgBasket(m.previous, m.ordersPrevious),
    }));
  }, [resto]);

  if (!resto) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Aucun restaurant avec du CA sur place sur la période sélectionnée.
        </CardContent>
      </Card>
    );
  }

  const basketCur = avgBasket(resto.current, resto.ordersCurrent);
  const basketPrev = avgBasket(resto.previous, resto.ordersPrevious);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Analyse store par store</CardTitle>
            <p className="text-sm text-muted-foreground">
              CA sur place, volume de commandes et panier moyen, {year} vs {prev}.
            </p>
          </div>
          <Select value={selected ?? undefined} onValueChange={setSelected}>
            <SelectTrigger className="w-[320px]"><SelectValue placeholder="Choisir un restaurant" /></SelectTrigger>
            <SelectContent className="max-h-80">
              {sorted.map((r) => (
                <SelectItem key={r.restaurantId} value={r.restaurantId}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">CA sur place</p>
              <p className="text-2xl font-bold">{fmtEur(resto.current)}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Delta current={resto.current} previous={resto.previous} /> vs {fmtEur(resto.previous)} en {prev}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Commandes</p>
              <p className="text-2xl font-bold">{fmtInt(resto.ordersCurrent)}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Delta current={resto.ordersCurrent} previous={resto.ordersPrevious} /> vs {fmtInt(resto.ordersPrevious)} en {prev}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Panier moyen</p>
              <p className="text-2xl font-bold">{resto.ordersCurrent > 0 ? fmtEur2(basketCur) : "--"}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Delta current={basketCur} previous={basketPrev} /> vs {resto.ordersPrevious > 0 ? fmtEur2(basketPrev) : "--"} en {prev}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CA et commandes par mois — {resto.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="ca" tickFormatter={fmtShort} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="cmd" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value: number, name: string) =>
                  name.startsWith("CA") ? [fmtEur(value), name] : [fmtInt(value), name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="ca" dataKey="previous" name={`CA ${prev}`} fill="hsl(var(--muted-foreground))" opacity={0.45} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="ca" dataKey="current" name={`CA ${year}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Line yAxisId="cmd" type="monotone" dataKey="ordersPrevious" name={`Cmd ${prev}`} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              <Line yAxisId="cmd" type="monotone" dataKey="ordersCurrent" name={`Cmd ${year}`} stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Panier moyen par mois — {resto.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)} €`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value: number, name: string) => [fmtEur2(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="basketPrevious" name={`Panier ${prev}`} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="basketCurrent" name={`Panier ${year}`} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Détail mensuel — {resto.name}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">CA {year}</TableHead>
                <TableHead className="text-right">CA {prev}</TableHead>
                <TableHead className="text-right">Évol. CA</TableHead>
                <TableHead className="text-right">Cmd {year}</TableHead>
                <TableHead className="text-right">Cmd {prev}</TableHead>
                <TableHead className="text-right">Évol. cmd</TableHead>
                <TableHead className="text-right">Panier {year}</TableHead>
                <TableHead className="text-right">Panier {prev}</TableHead>
                <TableHead className="text-right">Évol. panier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resto.months.map((m) => {
                const bc = avgBasket(m.current, m.ordersCurrent);
                const bp = avgBasket(m.previous, m.ordersPrevious);
                return (
                  <TableRow key={m.month} className={cn(m.isPartial && "opacity-70")}>
                    <TableCell className="font-medium">{MONTHS[m.month - 1]}{m.isPartial ? " *" : ""}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtEur(m.current)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtEur(m.previous)}</TableCell>
                    <TableCell className="text-right"><Delta current={m.current} previous={m.previous} /></TableCell>
                    <TableCell className="text-right">{fmtInt(m.ordersCurrent)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtInt(m.ordersPrevious)}</TableCell>
                    <TableCell className="text-right"><Delta current={m.ordersCurrent} previous={m.ordersPrevious} /></TableCell>
                    <TableCell className="text-right">{m.ordersCurrent > 0 ? fmtEur2(bc) : "--"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.ordersPrevious > 0 ? fmtEur2(bp) : "--"}</TableCell>
                    <TableCell className="text-right"><Delta current={bc} previous={bp} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
