import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Ticket, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  MEAL_VOUCHER_PROVIDERS,
  type MealVoucherProvider,
  type MealVoucherRestaurantRow,
} from "@/hooks/useMealVoucherBreakdown";

interface Props {
  rows: MealVoucherRestaurantRow[];
  restaurantNames: Map<string, string>;
  isLoading: boolean;
  periodLabel: string;
  onRestaurantClick?: (id: string) => void;
}

const fmtEur = (v: number) =>
  v >= 1000
    ? `${Math.round(v).toLocaleString("fr-FR")} €`
    : `${v.toFixed(2)} €`;

const PROVIDER_COLORS: Record<MealVoucherProvider, string> = {
  Edenred: "bg-red-500/10 text-red-600 border-red-500/30",
  Swile: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  Sodexo: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  UpDejeuner: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  "Bimpli (ex Apetiz)": "bg-violet-500/10 text-violet-600 border-violet-500/30",
  Pluxee: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

const PROVIDER_LABELS: Record<MealVoucherProvider, string> = {
  Edenred: "Edenred",
  Swile: "Swile",
  Sodexo: "Sodexo",
  UpDejeuner: "UpDéjeuner",
  "Bimpli (ex Apetiz)": "Bimpli",
  Pluxee: "Pluxee",
};

type SortKey = "name" | "tr" | "share" | MealVoucherProvider;

export function MealVoucherAnalysisPanel({
  rows,
  restaurantNames,
  isLoading,
  periodLabel,
  onRestaurantClick,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Réseau totals
  const network = useMemo(() => {
    const totalTR = rows.reduce((s, r) => s + r.trAmount, 0);
    const totalUber = rows.reduce((s, r) => s + r.uberRevenueTTC, 0);
    const totalTROrders = rows.reduce((s, r) => s + r.trOrderCount, 0);
    const byProvider = {} as Record<MealVoucherProvider, { amount: number; restos: number; orders: number }>;
    for (const p of MEAL_VOUCHER_PROVIDERS) {
      byProvider[p] = { amount: 0, restos: 0, orders: 0 };
    }
    for (const r of rows) {
      for (const p of MEAL_VOUCHER_PROVIDERS) {
        const v = r.byProvider[p];
        byProvider[p].amount += v.amount;
        byProvider[p].orders += v.orderCount;
        if (v.amount > 0) byProvider[p].restos += 1;
      }
    }
    return {
      totalTR,
      totalUber,
      totalTROrders,
      shareOfUber: totalUber > 0 ? (totalTR / totalUber) * 100 : 0,
      avgBasket: totalTROrders > 0 ? totalTR / totalTROrders : 0,
      byProvider,
      activeRestos: rows.filter((r) => r.trAmount > 0).length,
      missingRestos: rows.filter((r) => r.uberOrderCount > 0 && r.trAmount === 0).length,
    };
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows
      .filter((r) => r.uberOrderCount > 0) // ignore restos sans Uber sur la période
      .map((r) => ({ ...r, name: restaurantNames.get(r.restaurantId) ?? "—" }));
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      }
      if (sortKey === "tr") {
        av = a.trAmount;
        bv = b.trAmount;
      } else if (sortKey === "share") {
        av = a.trShareOfUber;
        bv = b.trShareOfUber;
      } else {
        av = a.byProvider[sortKey].amount;
        bv = b.byProvider[sortKey].amount;
      }
      return (av as number) < (bv as number) ? -dir : (av as number) > (bv as number) ? dir : 0;
    });
    return list;
  }, [rows, restaurantNames, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI réseau */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Ticket className="h-4 w-4" /> Total TR encaissés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtEur(network.totalTR)}</div>
            <div className="text-xs text-muted-foreground mt-1">{periodLabel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">% du CA Uber</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{network.shareOfUber.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {network.totalTROrders.toLocaleString("fr-FR")} cmds avec TR
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Panier moyen TR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{network.avgBasket.toFixed(2)} €</div>
          </CardContent>
        </Card>
        <Card className={network.missingRestos > 0 ? "border-amber-500/40" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Restos sans aucun TR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{network.missingRestos}</div>
            <div className="text-xs text-muted-foreground mt-1">
              sur {network.activeRestos + network.missingRestos} restos actifs
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cartes par émetteur */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Répartition par émetteur — réseau</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {MEAL_VOUCHER_PROVIDERS.map((p) => {
              const v = network.byProvider[p];
              const share = network.totalTR > 0 ? (v.amount / network.totalTR) * 100 : 0;
              return (
                <div
                  key={p}
                  className={cn("rounded-lg border p-3 space-y-1", PROVIDER_COLORS[p])}
                >
                  <div className="text-xs font-medium opacity-80">{PROVIDER_LABELS[p]}</div>
                  <div className="text-lg font-bold">{fmtEur(v.amount)}</div>
                  <div className="text-xs opacity-70">
                    {share.toFixed(1)}% · {v.restos} restos
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tableau matriciel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-4 w-4" /> Détail par restaurant × émetteur
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 text-xs uppercase tracking-wider"
                    >
                      Restaurant <SortIcon k="name" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => toggleSort("tr")}
                      className="flex items-center gap-1 ml-auto text-xs uppercase tracking-wider"
                    >
                      Total TR <SortIcon k="tr" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => toggleSort("share")}
                      className="flex items-center gap-1 ml-auto text-xs uppercase tracking-wider"
                    >
                      % CA Uber <SortIcon k="share" />
                    </button>
                  </TableHead>
                  {MEAL_VOUCHER_PROVIDERS.map((p) => (
                    <TableHead key={p} className="text-right">
                      <button
                        onClick={() => toggleSort(p)}
                        className="flex items-center gap-1 ml-auto text-xs uppercase tracking-wider"
                      >
                        {PROVIDER_LABELS[p]} <SortIcon k={p} />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="text-center text-xs uppercase tracking-wider">
                    Manquants
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4 + MEAL_VOUCHER_PROVIDERS.length + 1} className="text-center py-8 text-muted-foreground text-sm">
                      Aucune donnée sur la période.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSorted.map((row, idx) => {
                    const noTR = row.trAmount === 0;
                    return (
                      <TableRow
                        key={row.restaurantId}
                        className={cn(
                          "hover:bg-muted/40 cursor-pointer",
                          noTR && "bg-amber-500/5",
                        )}
                        onClick={() => onRestaurantClick?.(row.restaurantId)}
                      >
                        <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {row.name}
                          {noTR && (
                            <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-600 text-[10px]">
                              Aucun TR
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {row.trAmount > 0 ? fmtEur(row.trAmount) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {row.trShareOfUber > 0 ? `${row.trShareOfUber.toFixed(1)}%` : "—"}
                        </TableCell>
                        {MEAL_VOUCHER_PROVIDERS.map((p) => {
                          const v = row.byProvider[p];
                          const empty = v.amount === 0;
                          return (
                            <TableCell
                              key={p}
                              className={cn(
                                "text-right text-sm tabular-nums",
                                empty ? "text-muted-foreground/40" : "font-medium",
                              )}
                            >
                              {empty ? (
                                "—"
                              ) : (
                                <div>
                                  <div>{fmtEur(v.amount)}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {v.share.toFixed(0)}% · {v.orderCount}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          {row.missingProviders.length === 0 ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">
                              0
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                row.missingProviders.length >= 4
                                  ? "border-red-500/40 text-red-600"
                                  : "border-amber-500/40 text-amber-600",
                              )}
                              title={row.missingProviders.map((p) => PROVIDER_LABELS[p]).join(", ")}
                            >
                              {row.missingProviders.length}/6
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
