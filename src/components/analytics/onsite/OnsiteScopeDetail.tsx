import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, DoorOpen, Store, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScopeMonth, ScopeRestaurant, deltaPct } from "@/hooks/useSplashOnsiteMonthly";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function DeltaText({ current, previous }: { current: number; previous: number }) {
  const d = deltaPct(current, previous);
  if (d === null) return <span className="text-muted-foreground">--</span>;
  return (
    <span className={cn("font-medium", d >= 0 ? "text-emerald-600" : "text-destructive")}>
      {d > 0 ? "+" : ""}{d.toFixed(1)}%
    </span>
  );
}

function RestaurantRows({
  rows,
  year,
  showPrevious = true,
  showCurrent = true,
}: {
  rows: ScopeRestaurant[];
  year: number;
  showPrevious?: boolean;
  showCurrent?: boolean;
}) {
  if (rows.length === 0) return <p className="py-2 text-sm text-muted-foreground">Aucun restaurant.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Restaurant</TableHead>
          {showCurrent && <TableHead className="text-right">CA {year}</TableHead>}
          {showPrevious && <TableHead className="text-right">CA {year - 1}</TableHead>}
          {showCurrent && showPrevious && <TableHead className="text-right">Évol.</TableHead>}
          <TableHead className="text-right">Jours d'activité</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.restaurantId}>
            <TableCell className="font-medium">{r.name}</TableCell>
            {showCurrent && <TableCell className="text-right">{fmt(r.current)}</TableCell>}
            {showPrevious && <TableCell className="text-right text-muted-foreground">{fmt(r.previous)}</TableCell>}
            {showCurrent && showPrevious && (
              <TableCell className="text-right"><DeltaText current={r.current} previous={r.previous} /></TableCell>
            )}
            <TableCell className="text-right text-muted-foreground">
              {showCurrent ? `${r.daysActiveCurrent} j en ${year}` : `${r.daysActivePrevious} j en ${year - 1}`}
              {showCurrent && showPrevious && ` · ${r.daysActivePrevious} j en ${year - 1}`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function OnsiteScopeDetail({ scope, year }: { scope: ScopeMonth[]; year: number }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composition du périmètre constant, mois par mois</CardTitle>
        <p className="text-sm text-muted-foreground">
          Un restaurant est « comparable » sur un mois s'il a réalisé du CA caisse à la fois en {year} et en {year - 1}.
          Les autres sont classés en ouverture (CA seulement en {year}) ou en fermeture / arrêt (CA seulement en {year - 1}).
          Le nombre de jours d'activité permet de repérer les mois partiels (restaurant ouvert en cours de mois).
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>Mois</TableHead>
              <TableHead className="text-right">Comparables</TableHead>
              <TableHead className="text-right">CA comparable {year}</TableHead>
              <TableHead className="text-right">CA comparable {year - 1}</TableHead>
              <TableHead className="text-right">Évol. LFL</TableHead>
              <TableHead className="text-right">Ouvertures</TableHead>
              <TableHead className="text-right">Fermetures</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scope.map((sm) => {
              const isOpen = open === sm.month;
              return (
                <>
                  <TableRow
                    key={sm.month}
                    className={cn("cursor-pointer", sm.isPartial && "opacity-70")}
                    onClick={() => setOpen(isOpen ? null : sm.month)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{MONTHS[sm.month - 1]}{sm.isPartial ? " *" : ""}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="gap-1">
                        <Store className="h-3 w-3" />{sm.lfl.length}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(sm.lflCurrent)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(sm.lflPrevious)}</TableCell>
                    <TableCell className="text-right"><DeltaText current={sm.lflCurrent} previous={sm.lflPrevious} /></TableCell>
                    <TableCell className="text-right">
                      {sm.opened.length > 0 ? (
                        <span className="text-emerald-600">+{sm.opened.length} · {fmt(sm.openedCurrent)}</span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {sm.closed.length > 0 ? (
                        <span className="text-destructive">-{sm.closed.length} · {fmt(sm.closedPrevious)}</span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={`${sm.month}-detail`} className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={7} className="space-y-6 p-0 pb-6">
                        <div>
                          <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            Restaurants comparables ({sm.lfl.length})
                          </p>
                          <RestaurantRows rows={sm.lfl} year={year} />
                        </div>
                        {sm.opened.length > 0 && (
                          <div>
                            <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                              <DoorOpen className="h-4 w-4 text-emerald-600" />
                              Ouvertures / hors périmètre — CA uniquement en {year} ({sm.opened.length})
                            </p>
                            <RestaurantRows rows={sm.opened} year={year} showPrevious={false} />
                          </div>
                        )}
                        {sm.closed.length > 0 && (
                          <div>
                            <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                              <XCircle className="h-4 w-4 text-destructive" />
                              Fermetures / arrêts — CA uniquement en {year - 1} ({sm.closed.length})
                            </p>
                            <RestaurantRows rows={sm.closed} year={year} showCurrent={false} />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
