import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Info, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { RestaurantAggregate, MonthAggregate, avgBasket, deltaPct } from "@/hooks/useSplashOnsiteMonthly";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtEur2 = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const fmtShort = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (a >= 1_000) return `${Math.round(v / 1_000)} k€`;
  return `${Math.round(v)} €`;
};
const signed = (v: number, f: (n: number) => string) => `${v > 0 ? "+" : ""}${f(v)}`;
const pct = (v: number | null) => (v === null ? "--" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

type Scope = "all" | "lfl";

/** Décomposition volume / panier de l'écart de CA : ΔCA = ΔQ·P₀ + ΔP·Q₀ + ΔQ·ΔP */
function decompose(revCur: number, ordCur: number, revPrev: number, ordPrev: number) {
  const p0 = avgBasket(revPrev, ordPrev);
  const p1 = avgBasket(revCur, ordCur);
  const dQ = ordCur - ordPrev;
  const dP = p1 - p0;
  const volume = dQ * p0;
  const basket = dP * ordPrev;
  const cross = dQ * dP;
  return { p0, p1, dQ, dP, volume, basket, cross, delta: revCur - revPrev };
}

function EffectCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: "neutral" | "pos" | "neg";
}) {
  return (
    <Card className="rounded-2xl border-none bg-muted/30 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-bold tracking-tight",
            tone === "pos" && "text-emerald-600",
            tone === "neg" && "text-destructive"
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function HelpPopover({ year }: { year: number }) {
  const prev = year - 1;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 text-sm" align="start">
        <p className="font-semibold">Comment lire l'analyse volume / panier</p>
        <p className="mt-2 text-muted-foreground">
          L'écart de CA entre {year} et {prev} se décompose en trois briques :
        </p>
        <ul className="mt-2 space-y-1.5 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Effet volume</span> = (Commandes {year} − Commandes {prev}) ×
            Panier moyen {prev}
          </li>
          <li>
            <span className="font-medium text-foreground">Effet panier</span> = (Panier {year} − Panier {prev}) ×
            Commandes {prev}
          </li>
          <li>
            <span className="font-medium text-foreground">Effet croisé</span> = ΔCommandes × ΔPanier (interaction des
            deux)
          </li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          La somme des trois est exactement égale à l'écart de CA. Un effet volume positif compensé par un effet panier
          négatif signifie : plus de clients, mais qui dépensent moins.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function OnsiteVolumeBasket({
  months,
  restaurants,
  year,
}: {
  months: MonthAggregate[];
  restaurants: RestaurantAggregate[];
  year: number;
}) {
  const [scope, setScope] = useState<Scope>("lfl");
  const prev = year - 1;

  /** Séries mensuelles, limitées aux restaurants comparables si scope = lfl */
  const monthly = useMemo(() => {
    if (scope === "all") {
      return months.map((m) => ({
        month: m.month,
        isPartial: m.isPartial,
        revCur: m.current,
        revPrev: m.previous,
        ordCur: m.ordersCurrent,
        ordPrev: m.ordersPrevious,
      }));
    }
    const acc = new Map<number, { revCur: number; revPrev: number; ordCur: number; ordPrev: number }>();
    for (const r of restaurants) {
      for (const m of r.months) {
        if (!(m.lflCurrent > 0 && m.lflPrevious > 0)) continue;
        const cur = acc.get(m.month) ?? { revCur: 0, revPrev: 0, ordCur: 0, ordPrev: 0 };
        cur.revCur += m.lflCurrent;
        cur.revPrev += m.lflPrevious;
        cur.ordCur += m.ordersCurrent;
        cur.ordPrev += m.ordersPrevious;
        acc.set(m.month, cur);
      }
    }
    return months
      .filter((m) => acc.has(m.month))
      .map((m) => ({ month: m.month, isPartial: m.isPartial, ...acc.get(m.month)! }));
  }, [months, restaurants, scope]);

  const totals = useMemo(() => {
    const revCur = monthly.reduce((s, m) => s + m.revCur, 0);
    const revPrev = monthly.reduce((s, m) => s + m.revPrev, 0);
    const ordCur = monthly.reduce((s, m) => s + m.ordCur, 0);
    const ordPrev = monthly.reduce((s, m) => s + m.ordPrev, 0);
    return { revCur, revPrev, ordCur, ordPrev, ...decompose(revCur, ordCur, revPrev, ordPrev) };
  }, [monthly]);

  /** Waterfall : CA N-1 → effets → CA N */
  const waterfall = useMemo(() => {
    const steps: { label: string; base: number; value: number; kind: string }[] = [];
    steps.push({ label: `CA ${prev}`, base: 0, value: totals.revPrev, kind: "anchor" });
    let running = totals.revPrev;
    const add = (label: string, v: number, kind: string) => {
      const base = v >= 0 ? running : running + v;
      steps.push({ label, base, value: Math.abs(v), kind: v >= 0 ? `${kind}-pos` : `${kind}-neg` });
      running += v;
    };
    add("Effet volume", totals.volume, "vol");
    add("Effet panier", totals.basket, "bask");
    add("Effet croisé", totals.cross, "cross");
    steps.push({ label: `CA ${year}`, base: 0, value: totals.revCur, kind: "anchor" });
    return steps;
  }, [totals, year, prev]);

  const monthlyEffects = useMemo(
    () =>
      monthly.map((m) => {
        const d = decompose(m.revCur, m.ordCur, m.revPrev, m.ordPrev);
        return {
          label: MONTHS[m.month - 1] + (m.isPartial ? " *" : ""),
          volume: d.volume,
          basket: d.basket + d.cross,
          delta: d.delta,
          deltaOrders: deltaPct(m.ordCur, m.ordPrev),
          deltaBasket: deltaPct(d.p1, d.p0),
          basketCur: d.p1,
          basketPrev: d.p0,
          ordCur: m.ordCur,
          ordPrev: m.ordPrev,
        };
      }),
    [monthly]
  );

  const basketSeries = useMemo(
    () =>
      monthly.map((m) => ({
        label: MONTHS[m.month - 1] + (m.isPartial ? " *" : ""),
        ordCur: m.ordCur,
        ordPrev: m.ordPrev,
        basketCur: avgBasket(m.revCur, m.ordCur),
        basketPrev: avgBasket(m.revPrev, m.ordPrev),
      })),
    [monthly]
  );

  /** Nuage restaurants : évolution commandes vs évolution panier */
  const scatter = useMemo(() => {
    return restaurants
      .filter((r) => (scope === "lfl" ? r.lflMonths > 0 : true))
      .map((r) => {
        const revCur = scope === "lfl" ? r.lflCurrent : r.current;
        const revPrev = scope === "lfl" ? r.lflPrevious : r.previous;
        const d = decompose(revCur, r.ordersCurrent, revPrev, r.ordersPrevious);
        return {
          id: r.restaurantId,
          name: r.name,
          x: deltaPct(r.ordersCurrent, r.ordersPrevious),
          y: deltaPct(d.p1, d.p0),
          revCur,
          revPrev,
          z: Math.max(revCur, 1),
          volume: d.volume,
          basket: d.basket + d.cross,
          delta: d.delta,
          basketCur: d.p1,
          basketPrev: d.p0,
          ordCur: r.ordersCurrent,
          ordPrev: r.ordersPrevious,
        };
      })
      .filter((r) => r.x !== null && r.y !== null && r.revPrev > 0) as Array<{
      id: string;
      name: string;
      x: number;
      y: number;
      revCur: number;
      revPrev: number;
      z: number;
      volume: number;
      basket: number;
      delta: number;
      basketCur: number;
      basketPrev: number;
      ordCur: number;
      ordPrev: number;
    }>;
  }, [restaurants, scope]);

  const quadrantColor = (x: number, y: number) =>
    x >= 0 && y >= 0
      ? "hsl(var(--primary))"
      : x >= 0 && y < 0
        ? "hsl(38 92% 50%)"
        : x < 0 && y >= 0
          ? "hsl(199 89% 48%)"
          : "hsl(var(--destructive))";

  /** Cas les plus parlants : volume en hausse mais panier en baisse (et inverse) */
  const traps = useMemo(
    () => scatter.filter((r) => r.x > 0 && r.y < 0).sort((a, b) => a.basket - b.basket).slice(0, 8),
    [scatter]
  );
  const savers = useMemo(
    () => scatter.filter((r) => r.x < 0 && r.y > 0).sort((a, b) => b.basket - a.basket).slice(0, 8),
    [scatter]
  );

  const diagnostic = (() => {
    const vol = totals.volume + (totals.cross > 0 ? 0 : 0);
    const bask = totals.basket;
    if (vol > 0 && bask < 0)
      return `Le trafic progresse (${signed(totals.dQ, fmtInt)} commandes, soit ${signed(totals.volume, fmtShort)}) mais le panier moyen recule de ${fmtEur2(Math.abs(totals.dP))} (${signed(totals.basket, fmtShort)}). La croissance est portée par le volume, pas par la valeur.`;
    if (vol < 0 && bask > 0)
      return `Moins de commandes (${signed(totals.dQ, fmtInt)}, soit ${signed(totals.volume, fmtShort)}) mais un panier moyen en hausse de ${fmtEur2(totals.dP)} (${signed(totals.basket, fmtShort)}) : la valeur compense partiellement la perte de trafic.`;
    if (vol >= 0 && bask >= 0)
      return `Croissance saine : le volume (${signed(totals.volume, fmtShort)}) et le panier moyen (${signed(totals.basket, fmtShort)}) progressent tous les deux.`;
    return `Double baisse : le trafic (${signed(totals.volume, fmtShort)}) et le panier moyen (${signed(totals.basket, fmtShort)}) reculent simultanément.`;
  })();

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--popover-foreground))",
  };

  return (
    <div className="space-y-4">
      {/* En-tête + scope */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 className="text-xl font-bold tracking-tight">Volume vs panier moyen</h2>
          <HelpPopover year={year} />
        </div>
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(v) => v && setScope(v as Scope)}
          variant="outline"
          size="sm"
          className="rounded-xl"
        >
          <ToggleGroupItem className="rounded-lg" value="all">Brut</ToggleGroupItem>
          <ToggleGroupItem className="rounded-lg" value="lfl">Périmètre constant</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Diagnostic */}
      <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
        <span className="font-medium">Lecture : </span>
        <span className="text-muted-foreground">{diagnostic}</span>
      </div>

      {/* KPI décomposition */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <EffectCard
          label={`Écart de CA`}
          value={signed(totals.delta, fmtShort)}
          hint={`${fmtEur(totals.revPrev)} → ${fmtEur(totals.revCur)} (${pct(deltaPct(totals.revCur, totals.revPrev))})`}
          icon={totals.delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          tone={totals.delta >= 0 ? "pos" : "neg"}
        />
        <EffectCard
          label="Effet volume"
          value={signed(totals.volume, fmtShort)}
          hint={`${signed(totals.dQ, fmtInt)} commandes (${pct(deltaPct(totals.ordCur, totals.ordPrev))})`}
          icon={<Users className="h-3.5 w-3.5" />}
          tone={totals.volume >= 0 ? "pos" : "neg"}
        />
        <EffectCard
          label="Effet panier"
          value={signed(totals.basket, fmtShort)}
          hint={`${fmtEur2(totals.p0)} → ${fmtEur2(totals.p1)} (${pct(deltaPct(totals.p1, totals.p0))})`}
          icon={<Wallet className="h-3.5 w-3.5" />}
          tone={totals.basket >= 0 ? "pos" : "neg"}
        />
        <EffectCard
          label="Effet croisé"
          value={signed(totals.cross, fmtShort)}
          hint="Interaction volume × panier"
          icon={<Info className="h-3.5 w-3.5" />}
          tone="neutral"
        />
        <EffectCard
          label="Contribution volume"
          value={
            totals.delta === 0
              ? "--"
              : `${Math.round((totals.volume / (Math.abs(totals.volume) + Math.abs(totals.basket) || 1)) * 100)}%`
          }
          hint="Part du volume dans l'explication de l'écart"
          icon={<Users className="h-3.5 w-3.5" />}
          tone="neutral"
        />
      </div>

      {/* Waterfall */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">D'où vient l'écart de CA ?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Passage du CA {prev} au CA {year}, décomposé en effet volume, effet panier et effet croisé.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={waterfall} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, n: string) => (n === "base" ? [null, null] : [fmtEur(v), "Montant"])}
              />
              <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]}>
                {waterfall.map((s, i) => (
                  <Cell
                    key={i}
                    fill={
                      s.kind === "anchor"
                        ? "hsl(var(--muted-foreground))"
                        : s.kind.endsWith("-pos")
                          ? "hsl(var(--primary))"
                          : "hsl(var(--destructive))"
                    }
                    opacity={s.kind === "anchor" ? 0.55 : 1}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Effets par mois */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Effet volume vs effet panier, mois par mois</CardTitle>
          <p className="text-sm text-muted-foreground">
            Barres empilées : contribution en euros de chaque effet à l'écart du mois. La ligne est l'écart total de CA.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={monthlyEffects} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtEur(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="volume" name="Effet volume" stackId="e" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="basket" name="Effet panier" stackId="e" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="delta"
                name="Écart de CA"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Commandes vs panier en niveau */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Commandes et panier moyen, {year} vs {prev}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Barres : nombre de commandes. Lignes : panier moyen sur place.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={basketSeries} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="q" tickFormatter={(v) => fmtInt(v)} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                yAxisId="p"
                orientation="right"
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${v.toFixed(1)} €`}
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, n: string) => [n.startsWith("Panier") ? fmtEur2(v) : fmtInt(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="q" dataKey="ordPrev" name={`Commandes ${prev}`} fill="hsl(var(--muted-foreground))" opacity={0.45} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="q" dataKey="ordCur" name={`Commandes ${year}`} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="basketPrev" name={`Panier ${prev}`} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              <Line yAxisId="p" type="monotone" dataKey="basketCur" name={`Panier ${year}`} stroke="hsl(38 92% 50%)" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Nuage de points restaurants */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Cartographie des restaurants</CardTitle>
          <p className="text-sm text-muted-foreground">
            Chaque bulle est un restaurant : horizontalement l'évolution du nombre de commandes, verticalement celle du
            panier moyen. La taille reflète le CA {year}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Volume + / panier + : croissance saine</Badge>
            <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(38 92% 50%)" }} />Volume + / panier − : trafic dilué</Badge>
            <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(199 89% 48%)" }} />Volume − / panier + : moins de clients, plus dépensiers</Badge>
            <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Double baisse</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                dataKey="x"
                name="Évol. commandes"
                unit="%"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Évolution des commandes (%)", position: "insideBottom", offset: -8, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Évol. panier"
                unit="%"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Évol. panier (%)", angle: -90, position: "insideLeft", fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 400]} />
              <ReferenceLine x={0} stroke="hsl(var(--border))" />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
                      <p className="font-semibold text-popover-foreground">{d.name}</p>
                      <p className="mt-1 text-muted-foreground">Commandes : {fmtInt(d.ordPrev)} → {fmtInt(d.ordCur)} ({pct(d.x)})</p>
                      <p className="text-muted-foreground">Panier : {fmtEur2(d.basketPrev)} → {fmtEur2(d.basketCur)} ({pct(d.y)})</p>
                      <p className="text-muted-foreground">CA : {fmtEur(d.revPrev)} → {fmtEur(d.revCur)}</p>
                      <p className="mt-1 text-popover-foreground">
                        Volume {signed(d.volume, fmtShort)} · Panier {signed(d.basket, fmtShort)}
                      </p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatter} name="Restaurants">
                {scatter.map((d) => (
                  <Cell key={d.id} fill={quadrantColor(d.x, d.y)} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tables cas notables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Plus de commandes, panier en baisse</CardTitle>
            <p className="text-sm text-muted-foreground">Le trafic progresse mais la valeur par commande recule.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <NotableTable rows={traps} year={year} prev={prev} empty="Aucun restaurant dans ce cas." />
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Moins de commandes, panier en hausse</CardTitle>
            <p className="text-sm text-muted-foreground">La valeur par commande compense la perte de trafic.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <NotableTable rows={savers} year={year} prev={prev} empty="Aucun restaurant dans ce cas." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NotableTable({
  rows,
  year,
  prev,
  empty,
}: {
  rows: Array<{ id: string; name: string; x: number; y: number; volume: number; basket: number; delta: number }>;
  year: number;
  prev: number;
  empty: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Restaurant</TableHead>
          <TableHead className="text-right">Évol. cmd</TableHead>
          <TableHead className="text-right">Évol. panier</TableHead>
          <TableHead className="text-right">Effet volume</TableHead>
          <TableHead className="text-right">Effet panier</TableHead>
          <TableHead className="text-right">Écart CA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell className={cn("text-right", r.x >= 0 ? "text-emerald-600" : "text-destructive")}>{pct(r.x)}</TableCell>
            <TableCell className={cn("text-right", r.y >= 0 ? "text-emerald-600" : "text-destructive")}>{pct(r.y)}</TableCell>
            <TableCell className="text-right">{signed(r.volume, fmtShort)}</TableCell>
            <TableCell className="text-right">{signed(r.basket, fmtShort)}</TableCell>
            <TableCell className={cn("text-right font-medium", r.delta >= 0 ? "text-emerald-600" : "text-destructive")}>
              {signed(r.delta, fmtShort)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
