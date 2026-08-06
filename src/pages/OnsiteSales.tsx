import { Fragment, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, Info, Minus, Store } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSplashOnsiteMonthly, deltaPct, avgBasket } from "@/hooks/useSplashOnsiteMonthly";
import { exportOnsiteSalesExcel } from "@/hooks/useOnsiteSalesExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OnsiteEvolutionChart, OnsiteScopeChart } from "@/components/analytics/onsite/OnsiteEvolutionChart";
import { OnsiteScopeDetail } from "@/components/analytics/onsite/OnsiteScopeDetail";
import { OnsiteStoreDetail } from "@/components/analytics/onsite/OnsiteStoreDetail";
import { OnsiteRestaurantSelect } from "@/components/analytics/onsite/OnsiteRestaurantSelect";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const YEARS = [2026, 2025];

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

const fmtBasket = (revenue: number, orders: number) =>
  orders > 0
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
        avgBasket(revenue, orders)
      )
    : "--";

function IncompleteBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-1 inline-flex align-middle text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {fmtInt(days)} jour(s) restaurant sans données Splash sur ce mois
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const d = deltaPct(current, previous);
  if (d === null) return <span className="text-muted-foreground">--</span>;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-0.5 font-medium",
        neutral ? "text-muted-foreground" : d > 0 ? "text-emerald-600" : "text-destructive"
      )}
    >
      {neutral ? <Minus className="h-3.5 w-3.5" /> : d > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {d > 0 ? "+" : ""}
      {d.toFixed(1)}%
    </span>
  );
}


const PRESETS: { value: string; label: string; range: [number, number] | null }[] = [
  { value: "full", label: "Année complète", range: [1, 12] },
  { value: "t1", label: "T1 (Jan-Mar)", range: [1, 3] },
  { value: "t2", label: "T2 (Avr-Juin)", range: [4, 6] },
  { value: "t3", label: "T3 (Juil-Sep)", range: [7, 9] },
  { value: "t4", label: "T4 (Oct-Déc)", range: [10, 12] },
  { value: "s1", label: "S1 (Jan-Juin)", range: [1, 6] },
  { value: "s2", label: "S2 (Juil-Déc)", range: [7, 12] },
  { value: "custom", label: "Personnalisé", range: null },
];

export default function OnsiteSales() {
  const [year, setYear] = useState(2026);
  const [includePartialMonth, setIncludePartialMonth] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preset, setPreset] = useState("full");
  const [monthFrom, setMonthFrom] = useState(1);
  const [monthTo, setMonthTo] = useState(12);
  const [restaurantFilter, setRestaurantFilter] = useState<string[]>([]);
  const { data: allRestaurants } = useActiveRestaurants();


  const applyPreset = (value: string) => {
    setPreset(value);
    const p = PRESETS.find((x) => x.value === value);
    if (p?.range) {
      setMonthFrom(p.range[0]);
      setMonthTo(p.range[1]);
    }
  };

  const setFrom = (m: number) => {
    setPreset("custom");
    setMonthFrom(m);
    if (m > monthTo) setMonthTo(m);
  };
  const setTo = (m: number) => {
    setPreset("custom");
    setMonthTo(m);
    if (m < monthFrom) setMonthFrom(m);
  };

  const { networkMonths, restaurants, totals, scope, coverage, isLoading, error, enabled } = useSplashOnsiteMonthly({
    year,
    includePartialMonth,
    monthFrom,
    monthTo,
    restaurantIds: restaurantFilter,
  });


  const prev = year - 1;
  const hasPartial = useMemo(() => networkMonths.some((m) => m.isPartial), [networkMonths]);
  const prevIncomplete = prev <= 2024;
  const monthsWithGaps = useMemo(
    () => networkMonths.filter((m) => m.daysZeroCurrent > 0 && !m.isPartial).map((m) => MONTHS[m.month - 1]),
    [networkMonths]
  );

  const periodLabel =
    monthFrom === 1 && monthTo === 12
      ? "année complète"
      : monthFrom === monthTo
        ? MONTHS[monthFrom - 1]
        : `${MONTHS[monthFrom - 1]} → ${MONTHS[monthTo - 1]}`;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header façon "Revenus & Ventes" */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Ventes sur place</h1>
            <p className="mt-1 text-muted-foreground">
              CA caisse Splash (hors Uber Eats et Deliveroo) · {year} vs {prev} · période : {periodLabel}
            </p>
          </div>
          <Button
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isLoading || restaurants.length === 0}
            onClick={() => exportOnsiteSalesExcel({ year, networkMonths, restaurants, totals })}
          >
            <Download className="h-4 w-4" />
            Exporter Excel
          </Button>
        </div>

        {/* Barre de filtres */}
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <OnsiteRestaurantSelect
              restaurants={allRestaurants ?? []}
              selected={restaurantFilter}
              onChange={setRestaurantFilter}
            />
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-12 w-32 rounded-xl bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="h-12 w-52 rounded-xl bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Select value={String(monthFrom)} onValueChange={(v) => setFrom(Number(v))}>
                <SelectTrigger className="h-12 w-24 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">→</span>
              <Select value={String(monthTo)} onValueChange={(v) => setTo(Number(v))}>
                <SelectTrigger className="h-12 w-24 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-xl bg-background px-4 py-3">
              <Switch id="partial" checked={includePartialMonth} onCheckedChange={setIncludePartialMonth} />
              <Label htmlFor="partial" className="text-sm">Inclure le mois en cours</Label>
            </div>
          </div>
        </div>




        {(hasPartial || prevIncomplete) && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {hasPartial && <>Le mois en cours est partiel : il est {includePartialMonth ? "inclus" : "exclu"} des totaux. </>}
              {prevIncomplete && <>Les données Splash démarrent en mai 2024 : la comparaison sur {prev} est incomplète (janvier à avril manquants).</>}
            </AlertDescription>
          </Alert>
        )}

        {(monthsWithGaps.length > 0 || coverage.unmappedSplashIds > 0) && (
          <div className="rounded-xl border bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500/80" />
                <span>
                  Couverture Splash {year} : {fmtInt(coverage.daysZeroCurrent)} jour(s)-restaurant sans données
                  {coverage.unmappedSplashIds > 0 && (
                    <>, {coverage.unmappedSplashIds} boutique(s) non rattachée(s)</>
                  )}.
                </span>
              </div>
              <button
                onClick={() => setExpanded(expanded === "coverage" ? null : "coverage")}
                className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-foreground hover:underline"
              >
                {expanded === "coverage" ? "Moins" : "Détails"}
                {expanded === "coverage" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
            {expanded === "coverage" && (
              <div className="mt-2 space-y-1 border-t border-border/50 pt-2 text-xs">
                {monthsWithGaps.length > 0 && (
                  <p>Mois avec des jours manquants : {monthsWithGaps.join(", ")}. Les totaux de ces mois sont sous-estimés.</p>
                )}
                {coverage.unmappedSplashIds > 0 && (
                  <p>
                    {coverage.unmappedSplashIds} restaurant(s) Splash non rattaché(s), soit {fmt(coverage.unmappedRevenueTtc)} de CA sur place exclu de ce rapport.
                  </p>
                )}
                <p className="text-muted-foreground/80">Ces écarts expliquent la différence résiduelle avec le dashboard Splash.</p>
              </div>
            )}
          </div>
        )}



        {error && (
          <Alert variant="destructive">
            <AlertDescription>Impossible de charger les ventes sur place : {(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {!enabled ? (
          <Skeleton className="h-32 w-full" />
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card className="rounded-2xl border-none bg-muted/30 shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CA sur place {year}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold tracking-tight">{fmt(totals.current)}</p></CardContent>
              </Card>
              <Card className="rounded-2xl border-none bg-muted/30 shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CA sur place {prev}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold tracking-tight text-muted-foreground">{fmt(totals.previous)}</p></CardContent>
              </Card>
              <Card className="rounded-2xl border-none bg-muted/30 shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Évolution brute</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold tracking-tight"><Delta current={totals.current} previous={totals.previous} /></p></CardContent>
              </Card>
              <Card className="rounded-2xl border-none bg-muted/30 shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commandes {year}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tracking-tight">{fmtInt(totals.ordersCurrent)}</p>
                  <p className="text-xs text-muted-foreground">
                    Panier moyen {fmtBasket(totals.current, totals.ordersCurrent)} · {fmtInt(totals.ordersPrevious)} en {prev}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-none bg-muted/30 shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Évolution LFL</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tracking-tight"><Delta current={totals.lflCurrent} previous={totals.lflPrevious} /></p>
                  <p className="text-xs text-muted-foreground">{fmt(totals.lflCurrent)} vs {fmt(totals.lflPrevious)}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-none bg-muted/30 shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Restaurants LFL</CardTitle></CardHeader>
                <CardContent>
                  <p className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Store className="h-5 w-5 text-muted-foreground" />{totals.lflRestaurants}</p>
                  <p className="text-xs text-muted-foreground">sur {restaurants.length} restaurants</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="charts" className="space-y-4">
              <TabsList className="h-auto gap-1 rounded-2xl bg-muted/40 p-1.5">
                <TabsTrigger className="rounded-xl px-4 py-2 text-sm data-[state=active]:shadow-sm" value="charts">Vue globale</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-sm data-[state=active]:shadow-sm" value="scope">Périmètre constant</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-sm data-[state=active]:shadow-sm" value="stores">Par restaurant</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-sm data-[state=active]:shadow-sm" value="tables">Tableaux détaillés</TabsTrigger>
              </TabsList>


              <TabsContent value="charts" className="space-y-4">
                <OnsiteEvolutionChart months={networkMonths} year={year} />
                <OnsiteScopeChart months={networkMonths} year={year} />
              </TabsContent>

              <TabsContent value="scope">
                <OnsiteScopeDetail scope={scope} year={year} />
              </TabsContent>

              <TabsContent value="stores">
                <OnsiteStoreDetail restaurants={restaurants} year={year} />
              </TabsContent>


              <TabsContent value="tables" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Synthèse mensuelle réseau</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">

                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">CA {year}</TableHead>
                      <TableHead className="text-right">CA {prev}</TableHead>
                      <TableHead className="text-right">Évol. brute</TableHead>
                      <TableHead className="text-right">Cmd {year}</TableHead>
                      <TableHead className="text-right">Cmd {prev}</TableHead>
                      <TableHead className="text-right">Évol. cmd</TableHead>
                      <TableHead className="text-right">Panier moy. {year}</TableHead>
                      <TableHead className="text-right">LFL {year}</TableHead>
                      <TableHead className="text-right">LFL {prev}</TableHead>
                      <TableHead className="text-right">Évol. LFL</TableHead>
                      <TableHead className="text-right">Restos LFL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkMonths.map((m) => (
                      <TableRow key={m.month} className={cn(m.isPartial && "opacity-70")}>
                        <TableCell className="font-medium">
                          {MONTHS[m.month - 1]}{m.isPartial ? " *" : ""}
                          <IncompleteBadge days={m.isPartial ? 0 : m.daysZeroCurrent} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmt(m.current)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(m.previous)}</TableCell>
                        <TableCell className="text-right"><Delta current={m.current} previous={m.previous} /></TableCell>
                        <TableCell className="text-right">{fmtInt(m.ordersCurrent)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtInt(m.ordersPrevious)}</TableCell>
                        <TableCell className="text-right"><Delta current={m.ordersCurrent} previous={m.ordersPrevious} /></TableCell>
                        <TableCell className="text-right">{fmtBasket(m.current, m.ordersCurrent)}</TableCell>
                        <TableCell className="text-right">{fmt(m.lflCurrent)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(m.lflPrevious)}</TableCell>
                        <TableCell className="text-right"><Delta current={m.lflCurrent} previous={m.lflPrevious} /></TableCell>
                        <TableCell className="text-right">{m.lflRestaurants}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{fmt(totals.current)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.previous)}</TableCell>
                      <TableCell className="text-right"><Delta current={totals.current} previous={totals.previous} /></TableCell>
                      <TableCell className="text-right">{fmtInt(totals.ordersCurrent)}</TableCell>
                      <TableCell className="text-right">{fmtInt(totals.ordersPrevious)}</TableCell>
                      <TableCell className="text-right"><Delta current={totals.ordersCurrent} previous={totals.ordersPrevious} /></TableCell>
                      <TableCell className="text-right">{fmtBasket(totals.current, totals.ordersCurrent)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.lflCurrent)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.lflPrevious)}</TableCell>
                      <TableCell className="text-right"><Delta current={totals.lflCurrent} previous={totals.lflPrevious} /></TableCell>
                      <TableCell className="text-right">{totals.lflRestaurants}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>


            <Card>
              <CardHeader><CardTitle>Détail par restaurant</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8" />
                      <TableHead>Restaurant</TableHead>
                      <TableHead className="text-right">CA {year}</TableHead>
                      <TableHead className="text-right">CA {prev}</TableHead>
                      <TableHead className="text-right">Évol. brute</TableHead>
                      <TableHead className="text-right">Cmd {year}</TableHead>
                      <TableHead className="text-right">Évol. cmd</TableHead>
                      <TableHead className="text-right">Panier moy.</TableHead>
                      <TableHead className="text-right">Évol. LFL</TableHead>
                      <TableHead className="text-right">Mois LFL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restaurants.map((r) => (
                      <Fragment key={r.restaurantId}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setExpanded(expanded === r.restaurantId ? null : r.restaurantId)}
                        >
                          <TableCell>
                            {expanded === r.restaurantId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.name}
                            <IncompleteBadge days={r.daysZeroCurrent} />
                          </TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.current)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(r.previous)}</TableCell>
                          <TableCell className="text-right"><Delta current={r.current} previous={r.previous} /></TableCell>
                          <TableCell className="text-right">{fmtInt(r.ordersCurrent)}</TableCell>
                          <TableCell className="text-right"><Delta current={r.ordersCurrent} previous={r.ordersPrevious} /></TableCell>
                          <TableCell className="text-right">{fmtBasket(r.current, r.ordersCurrent)}</TableCell>
                          <TableCell className="text-right"><Delta current={r.lflCurrent} previous={r.lflPrevious} /></TableCell>
                          <TableCell className="text-right">{r.lflMonths}</TableCell>
                        </TableRow>
                        {expanded === r.restaurantId && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell />
                            <TableCell colSpan={9} className="p-0 pb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead>Mois</TableHead>
                                    <TableHead className="text-right">CA {year}</TableHead>
                                    <TableHead className="text-right">CA {prev}</TableHead>
                                    <TableHead className="text-right">Évol.</TableHead>
                                    <TableHead className="text-right">Cmd {year}</TableHead>
                                    <TableHead className="text-right">Cmd {prev}</TableHead>
                                    <TableHead className="text-right">Panier moy.</TableHead>
                                    <TableHead className="text-right">Périmètre constant</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {r.months.map((m) => (
                                    <TableRow key={m.month}>
                                      <TableCell>
                                        {MONTHS[m.month - 1]}{m.isPartial ? " *" : ""}
                                        <IncompleteBadge days={m.isPartial ? 0 : m.daysZeroCurrent} />
                                      </TableCell>
                                      <TableCell className="text-right">{fmt(m.current)}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{fmt(m.previous)}</TableCell>
                                      <TableCell className="text-right"><Delta current={m.current} previous={m.previous} /></TableCell>
                                      <TableCell className="text-right">{fmtInt(m.ordersCurrent)}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{fmtInt(m.ordersPrevious)}</TableCell>
                                      <TableCell className="text-right">{fmtBasket(m.current, m.ordersCurrent)}</TableCell>
                                      <TableCell className="text-right">{m.lflRestaurants > 0 ? "Oui" : "Non"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>

                </Table>
              </CardContent>
            </Card>
              </TabsContent>
            </Tabs>
          </>


        )}
      </div>
    </AppLayout>
  );
}
