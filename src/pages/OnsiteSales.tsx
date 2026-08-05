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


export default function OnsiteSales() {
  const [year, setYear] = useState(2026);
  const [includePartialMonth, setIncludePartialMonth] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { networkMonths, restaurants, totals, isLoading, error, enabled } = useSplashOnsiteMonthly({
    year,
    includePartialMonth,
  });

  const prev = year - 1;
  const hasPartial = useMemo(() => networkMonths.some((m) => m.isPartial), [networkMonths]);
  const prevIncomplete = prev <= 2024;
  const monthsWithGaps = useMemo(
    () => networkMonths.filter((m) => m.daysZeroCurrent > 0 && !m.isPartial).map((m) => MONTHS[m.month - 1]),
    [networkMonths]
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ventes sur place — {year} vs {prev}</h1>
            <p className="text-muted-foreground">
              CA caisse Splash (hors Uber Eats et Deliveroo), réseau complet de la marque, par restaurant et par mois.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="partial" checked={includePartialMonth} onCheckedChange={setIncludePartialMonth} />
              <Label htmlFor="partial" className="text-sm">Inclure le mois en cours</Label>
            </div>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="gap-2"
              disabled={isLoading || restaurants.length === 0}
              onClick={() => exportOnsiteSalesExcel({ year, networkMonths, restaurants, totals })}
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
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

        {monthsWithGaps.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription>
              Données Splash incomplètes sur : {monthsWithGaps.join(", ")} {year} — certains jours sont absents,
              les totaux de ces mois sont sous-estimés (resynchronisation Splash nécessaire).
            </AlertDescription>
          </Alert>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">CA sur place {year}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{fmt(totals.current)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">CA sur place {prev}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{fmt(totals.previous)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Évolution brute</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold"><Delta current={totals.current} previous={totals.previous} /></p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Commandes {year}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{fmtInt(totals.ordersCurrent)}</p>
                  <p className="text-xs text-muted-foreground">
                    Panier moyen {fmtBasket(totals.current, totals.ordersCurrent)} · {fmtInt(totals.ordersPrevious)} en {prev}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Évolution LFL</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold"><Delta current={totals.lflCurrent} previous={totals.lflPrevious} /></p>
                  <p className="text-xs text-muted-foreground">{fmt(totals.lflCurrent)} vs {fmt(totals.lflPrevious)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Restaurants LFL</CardTitle></CardHeader>
                <CardContent>
                  <p className="flex items-center gap-2 text-2xl font-bold"><Store className="h-5 w-5 text-muted-foreground" />{totals.lflRestaurants}</p>
                  <p className="text-xs text-muted-foreground">sur {restaurants.length} restaurants</p>
                </CardContent>
              </Card>
            </div>

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
                      <TableHead className="text-right">Évol. LFL</TableHead>
                      <TableHead className="text-right">Mois LFL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restaurants.map((r) => (
                      <Fragment key={r.restaurantId}>
                        <TableRow
                          key={r.restaurantId}
                          className="cursor-pointer"
                          onClick={() => setExpanded(expanded === r.restaurantId ? null : r.restaurantId)}
                        >
                          <TableCell>
                            {expanded === r.restaurantId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.current)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(r.previous)}</TableCell>
                          <TableCell className="text-right"><Delta current={r.current} previous={r.previous} /></TableCell>
                          <TableCell className="text-right"><Delta current={r.lflCurrent} previous={r.lflPrevious} /></TableCell>
                          <TableCell className="text-right">{r.lflMonths}</TableCell>
                        </TableRow>
                        {expanded === r.restaurantId && (
                          <TableRow key={`${r.restaurantId}-detail`} className="hover:bg-transparent">
                            <TableCell />
                            <TableCell colSpan={6} className="p-0 pb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead>Mois</TableHead>
                                    <TableHead className="text-right">CA {year}</TableHead>
                                    <TableHead className="text-right">CA {prev}</TableHead>
                                    <TableHead className="text-right">Évol.</TableHead>
                                    <TableHead className="text-right">Périmètre constant</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {r.months.map((m) => (
                                    <TableRow key={m.month}>
                                      <TableCell>{MONTHS[m.month - 1]}{m.isPartial ? " *" : ""}</TableCell>
                                      <TableCell className="text-right">{fmt(m.current)}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{fmt(m.previous)}</TableCell>
                                      <TableCell className="text-right"><Delta current={m.current} previous={m.previous} /></TableCell>
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
          </>
        )}
      </div>
    </AppLayout>
  );
}
