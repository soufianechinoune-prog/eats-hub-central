import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, SlidersHorizontal, Store, TrendingUp, TrendingDown, MoreHorizontal, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { RestaurantNetworkStats, NetworkTotals } from "@/hooks/useNetworkStats";
import type { RestaurantCashStats } from "@/hooks/useRestaurantCashRevenue";

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v)) + " €";

type StatusFilter = "all" | "up" | "down" | "watch";
type SortKey = "name" | "revenue" | "cash" | "uber" | "deliveroo" | "mix";

/** Sparkline de tendance (CA journalier tous canaux), colorée selon la variation. */
function TrendSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 88;
  const h = 28;
  if (points.length < 2) return <span className="text-muted-foreground">—</span>;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - 3 - ((p - min) / range) * (h - 6)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const stroke = positive ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
  const fill = positive ? "hsl(142 71% 45% / 0.12)" : "hsl(0 84% 60% / 0.12)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ml-auto">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export interface NetworkComparisonTableProps {
  stats: RestaurantNetworkStats[];
  networkTotals: NetworkTotals;
  isLoading: boolean;
  onRestaurantClick?: (restaurantId: string) => void;
  cashByRestaurant?: Map<string, RestaurantCashStats>;
  chataigneByRestaurant?: Map<string, { revenue: number; orders: number; avgBasket: number }>;
  dishopByRestaurant?: Map<string, number>;
  /** CA journalier par restaurant (sparklines de tendance). */
  dailyByRestaurant?: Map<string, { date: string; total: number }[]>;
  /** Logo de l'enseigne active (avatar des lignes). */
  chainLogoUrl?: string | null;
  showN1Comparison: boolean;
  onToggleN1: (value: boolean) => void;
}

export function NetworkComparisonTable({
  stats,
  isLoading,
  onRestaurantClick,
  cashByRestaurant,
  chataigneByRestaurant,
  dishopByRestaurant,
  dailyByRestaurant,
  chainLogoUrl,
  showN1Comparison,
  onToggleN1,
}: NetworkComparisonTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Lignes enrichies : CA tous canaux + répartition
  const rows = useMemo(() => {
    return stats.map((r) => {
      const cash = Math.max(0, cashByRestaurant?.get(r.id)?.cashRevenue ?? 0);
      const uber = r.platformBreakdown.uber.revenue;
      const deliveroo = r.platformBreakdown.deliveroo.revenue;
      const dishop = Math.max(0, dishopByRestaurant?.get(r.id) ?? 0);
      const chataigne = Math.max(0, chataigneByRestaurant?.get(r.id)?.revenue ?? 0);
      const total = uber + deliveroo + cash + dishop + chataigne;
      const deliveryMix = total > 0 ? ((uber + deliveroo) / total) * 100 : null;
      const variation = r.revenueVariation ?? null;
      return { resto: r, cash, uber, deliveroo, dishop, chataigne, total, deliveryMix, variation };
    });
  }, [stats, cashByRestaurant, chataigneByRestaurant, dishopByRestaurant]);

  const counts = useMemo(() => {
    let up = 0;
    let down = 0;
    let watch = 0;
    for (const r of rows) {
      if (r.variation == null) continue;
      if (r.variation <= -10) watch++;
      else if (r.variation < 0) down++;
      else if (r.variation > 0) up++;
    }
    return { all: rows.length, up, down, watch };
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter === "up") out = out.filter((r) => r.variation != null && r.variation > 0);
    if (statusFilter === "down") out = out.filter((r) => r.variation != null && r.variation < 0 && r.variation > -10);
    if (statusFilter === "watch") out = out.filter((r) => r.variation != null && r.variation <= -10);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      out = out.filter((r) => r.resto.name.toLowerCase().includes(q));
    }
    const val = (r: (typeof rows)[number]): number | string => {
      switch (sortKey) {
        case "name": return r.resto.name.toLowerCase();
        case "cash": return r.cash;
        case "uber": return r.uber;
        case "deliveroo": return r.deliveroo;
        case "mix": return r.deliveryMix ?? -1;
        default: return r.total;
      }
    };
    return [...out].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [rows, statusFilter, searchQuery, sortKey, sortDir]);

  const maxTotal = useMemo(() => Math.max(...rows.map((r) => r.total), 1), [rows]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const HeadBtn = ({ col, children, className }: { col: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("text-xs font-medium text-muted-foreground", className)}>
      <button
        type="button"
        onClick={() => handleSort(col)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        <SortIcon col={col} />
      </button>
    </TableHead>
  );

  const pills: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: counts.all },
    { key: "up", label: "En hausse", count: counts.up },
    { key: "down", label: "En baisse", count: counts.down },
    { key: "watch", label: "À surveiller", count: counts.watch },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-56" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[54px] w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* En-tête : titre + pills + recherche + filtres */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Comparatif des restaurants</h2>
            <p className="text-sm text-muted-foreground">Classement par chiffre d'affaires</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
              {pills.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setStatusFilter(p.key)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === p.key
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                  <span className={cn("ml-1.5 tabular-nums", statusFilter === p.key ? "opacity-70" : "opacity-50")}>
                    {p.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un restaurant…"
                className="h-9 w-[220px] pl-8 text-sm"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtres
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="n1-toggle-network" className="text-sm">
                    Comparaison vs N-1
                  </Label>
                  <Switch
                    id="n1-toggle-network"
                    checked={showN1Comparison}
                    onCheckedChange={onToggleN1}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Affiche la variation du chiffre d'affaires par rapport à la même période l'année précédente.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Tableau */}
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 text-xs font-medium text-muted-foreground">#</TableHead>
                <HeadBtn col="name">Restaurant</HeadBtn>
                <HeadBtn col="revenue" className="text-right">
                  <span className="ml-auto">CA total</span>
                </HeadBtn>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Δ</TableHead>
                <HeadBtn col="cash" className="text-right"><span className="ml-auto">Caisse</span></HeadBtn>
                <HeadBtn col="uber" className="text-right"><span className="ml-auto">Uber Eats</span></HeadBtn>
                <HeadBtn col="deliveroo" className="text-right"><span className="ml-auto">Deliveroo</span></HeadBtn>
                <HeadBtn col="mix" className="text-right"><span className="ml-auto">Mix livraison</span></HeadBtn>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Tendance</TableHead>
                <TableHead className="w-[90px]" />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, idx) => {
                const { resto } = row;
                const positive = (row.variation ?? 0) >= 0;
                const spark = (dailyByRestaurant?.get(resto.id) ?? []).map((d) => d.total);
                return (
                  <TableRow
                    key={resto.id}
                    className="h-[54px] cursor-pointer border-border/60 hover:bg-muted/40"
                    onClick={() => onRestaurantClick?.(resto.id)}
                  >
                    <TableCell className="text-sm text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {chainLogoUrl ? (
                          <img
                            src={chainLogoUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md border border-border/60 object-contain"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Store className="h-4 w-4 text-muted-foreground" />
                          </span>
                        )}
                        <span className="font-medium">{resto.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold tabular-nums">{fmtEur(row.total)}</span>
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted lg:inline-block">
                          <span
                            className="block h-full rounded-full bg-cash"
                            style={{ width: `${Math.max(2, (row.total / maxTotal) * 100)}%` }}
                          />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.variation != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                            positive
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                          )}
                        >
                          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {row.variation > 0 ? "+" : ""}
                          {row.variation.toFixed(0)} %
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.cash > 0 ? fmtEur(row.cash) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.uber > 0 ? fmtEur(row.uber) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.deliveroo > 0 ? fmtEur(row.deliveroo) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.deliveryMix != null ? `${Math.round(row.deliveryMix)} %` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <TrendSparkline points={spark} positive={positive} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestaurantClick?.(resto.id);
                        }}
                      >
                        Voir
                      </Button>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onRestaurantClick?.(resto.id)} className="gap-2">
                            <Eye className="h-4 w-4" />
                            Voir le détail
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                    Aucun restaurant ne correspond à ce filtre.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
