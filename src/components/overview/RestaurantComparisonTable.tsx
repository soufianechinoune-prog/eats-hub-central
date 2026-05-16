import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Star, ChevronRight, ShoppingCart, Search, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type RestaurantNetworkStats, type NetworkTotals, type PlatformBreakdown } from "@/hooks/useNetworkStats";
import { getMetricStatus, getStatusTextClass } from "@/lib/performanceThresholds";
import { DataSourceBadge } from "@/components/overview/DataSourceBadge";
import type { RestaurantDataSourceInfo } from "@/hooks/useDataSourceBreakdown";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

type SortColumn = "name" | "city" | "revenue" | "orders" | "avgBasket" | "netPayout" | "mealVoucher" | "rating" | "profitability" | "totalDeliveryTime" | "errorRate" | "downtime" | "adsRatio";
type SortDirection = "asc" | "desc";

import type { AdsRatioByRestaurant } from "@/hooks/useAdsRevenueRatio";

interface RestaurantComparisonTableProps {
  stats: RestaurantNetworkStats[];
  networkTotals: NetworkTotals;
  showN1Comparison: boolean;
  onToggleN1: (value: boolean) => void;
  isLoading: boolean;
  onRestaurantClick?: (restaurantId: string) => void;
  /**
   * CA caisse agrégé pour l'ensemble du réseau (Splash360).
   * Affiché uniquement sur la ligne TOTAL RÉSEAU et sur les lignes restaurants
   * sous forme "—" tant que le détail par restaurant n'est pas disponible via l'API.
   */
  networkCashTotal?: number;
  showDataSource?: boolean;
  onToggleDataSource?: (value: boolean) => void;
  dataSourceMap?: Map<string, RestaurantDataSourceInfo>;
  /** % Dépenses pub Uber / CA TTC par restaurant */
  adsRatioMap?: Map<string, AdsRatioByRestaurant>;
  networkAdsSpend?: number;
  networkAdsRevenue?: number;
  networkAdsPct?: number | null;
}

// Format helpers
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + " €";
};

const formatCurrencyPrecise = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " €";
};

const formatMinutesLong = (minutes: number | null): string => {
  if (minutes == null) return "—";
  const mins = Math.round(minutes);
  return `${mins}min`;
};

const formatHours = (hours: number | null): string => {
  if (hours == null) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (h === 0) return `${mins}min`;
  if (mins === 0) return `${h}h`;
  return `${h}h${mins}min`;
};

const formatVariation = (value: number | null | undefined) => {
  if (value == null) return null;
  const isPositive = value > 0;
  const isNeutral = value === 0;
  return (
    <span className={cn(
      "flex items-center gap-1 text-xs font-medium",
      isPositive ? "text-emerald-600 dark:text-emerald-400" :
      isNeutral ? "text-muted-foreground" :
      "text-red-600 dark:text-red-400"
    )}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : !isNeutral ? <TrendingDown className="h-3 w-3" /> : null}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
};

// Platform sub-row component
function PlatformSubRow({
  platform,
  data,
  showN1Comparison,
  isUber,
  revenueShare,
  rating,
  errorRate,
  prepTime,
  downtime,
  showCashColumn = false,
}: {
  platform: string;
  data: PlatformBreakdown;
  showN1Comparison: boolean;
  isUber: boolean;
  revenueShare: number;
  rating?: number | null;
  errorRate?: number | null;
  prepTime?: number | null;
  downtime?: number | null;
  showCashColumn?: boolean;
}) {
  if (data.orders === 0 && data.revenue === 0) return null;

  const ratingStatus = isUber ? getMetricStatus("rating", rating) : "warning";
  const errorStatus = isUber ? getMetricStatus("errorRate", errorRate) : "warning";
  const totalDeliveryStatus = isUber ? getMetricStatus("totalDeliveryTime", prepTime) : "warning";
  const downtimeStatus = isUber ? getMetricStatus("downtime", downtime) : "warning";

  return (
    <TableRow className="bg-muted/10 hover:bg-muted/20 border-border/20">
      <TableCell></TableCell>
      <TableCell className="pl-8 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium min-w-[28px] text-right">
            {revenueShare.toFixed(0)}%
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] h-4 px-1.5 font-normal",
              isUber
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-cyan-500 text-cyan-600 dark:text-cyan-400"
            )}
          >
            {platform}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-right text-xs whitespace-nowrap">
        {formatCurrency(data.revenue)}
      </TableCell>
      {showN1Comparison && <TableCell></TableCell>}
      {showCashColumn && <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>}
      <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        {formatCurrency(data.netPayout)}
      </TableCell>
      <TableCell className="text-right text-xs text-primary whitespace-nowrap">
        {data.mealVoucher > 0 ? formatCurrencyPrecise(data.mealVoucher) : "—"}
      </TableCell>
      <TableCell className="text-right text-xs">
        {data.profitability != null ? `${data.profitability.toFixed(1)}%` : "—"}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {data.orders.toLocaleString("fr-FR")}
      </TableCell>
      <TableCell className="text-right text-xs whitespace-nowrap">
        {data.avgBasket.toFixed(2)} €
      </TableCell>
      <TableCell className="text-right text-xs">
        {isUber && rating != null ? (
          <span className={cn("flex items-center justify-end gap-1", getStatusTextClass(ratingStatus))}>
            <Star className="h-3 w-3" />{rating.toFixed(1)}
          </span>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right text-xs">
        {isUber && errorRate != null ? (
          <span className={getStatusTextClass(errorStatus)}>{errorRate.toFixed(1)}%</span>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right text-xs">
        {isUber && prepTime != null ? (
          <span className={cn("whitespace-nowrap", getStatusTextClass(totalDeliveryStatus))}>{formatMinutesLong(prepTime)}</span>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right text-xs">
        {isUber && downtime != null ? (
          <span className={cn("whitespace-nowrap", getStatusTextClass(downtimeStatus))}>{formatHours(downtime)}</span>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}

export function RestaurantComparisonTable({
  stats,
  networkTotals,
  showN1Comparison,
  onToggleN1,
  isLoading,
  onRestaurantClick,
  networkCashTotal = 0,
  showDataSource = false,
  onToggleDataSource,
  dataSourceMap,
  adsRatioMap,
  networkAdsSpend = 0,
  networkAdsRevenue = 0,
  networkAdsPct = null,
}: RestaurantComparisonTableProps) {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = useState<SortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const showCashColumn = networkCashTotal > 0;

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(["totalDeliveryTime", "errorRate", "downtime"].includes(column) ? "asc" : "desc");
    }
  };

  const formatNetPayout = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " €";
  };

  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortColumn) {
        case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case "city": aVal = (a.city || "").toLowerCase(); bVal = (b.city || "").toLowerCase(); break;
        case "revenue": aVal = a.revenue; bVal = b.revenue; break;
        case "orders": aVal = a.orders; bVal = b.orders; break;
        case "avgBasket": aVal = a.avgBasket; bVal = b.avgBasket; break;
        case "netPayout": aVal = a.netPayout; bVal = b.netPayout; break;
        case "mealVoucher": aVal = a.mealVoucher; bVal = b.mealVoucher; break;
        case "rating": aVal = a.rating ?? -999; bVal = b.rating ?? -999; break;
        case "profitability": aVal = a.profitability ?? -999; bVal = b.profitability ?? -999; break;
        case "totalDeliveryTime": aVal = a.totalDeliveryTime ?? 999; bVal = b.totalDeliveryTime ?? 999; break;
        case "errorRate": aVal = a.errorRate ?? 999; bVal = b.errorRate ?? 999; break;
        case "downtime": aVal = a.downtime ?? 999; bVal = b.downtime ?? 999; break;
        case "adsRatio": {
          aVal = adsRatioMap?.get(a.id)?.adsPct ?? -1;
          bVal = adsRatioMap?.get(b.id)?.adsPct ?? -1;
          break;
        }
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const numA = aVal as number;
      const numB = bVal as number;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [stats, sortColumn, sortDirection]);

  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) return sortedStats;
    const q = searchQuery.toLowerCase();
    return sortedStats.filter(r => r.name.toLowerCase().includes(q));
  }, [sortedStats, searchQuery]);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const HeaderCell = ({ column, children, className }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors text-xs font-semibold uppercase whitespace-nowrap", className)}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon column={column} />
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-lg backdrop-blur-xl bg-card/80">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-lg backdrop-blur-xl bg-card/80">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Comparatif des restaurants
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="h-8 w-[200px] pl-8 text-sm"
              />
            </div>
            {onToggleDataSource && (
              <>
                <Switch id="data-source-toggle" checked={showDataSource} onCheckedChange={onToggleDataSource} />
                <Label htmlFor="data-source-toggle" className="text-sm text-muted-foreground cursor-pointer">
                  Source des données
                </Label>
              </>
            )}
            <Switch id="n1-toggle" checked={showN1Comparison} onCheckedChange={onToggleN1} />
            <Label htmlFor="n1-toggle" className="text-sm text-muted-foreground cursor-pointer">
              Afficher N-1
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-12 text-xs font-semibold uppercase">#</TableHead>
              <HeaderCell column="name">Restaurant</HeaderCell>
              <HeaderCell column="revenue" className="text-right">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1">CA <Info className="h-3 w-3 opacity-60" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Chiffre d'affaires brut TTC, toutes commandes confondues (Uber + Deliveroo).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </HeaderCell>
              {showN1Comparison && (
                <TableHead className="text-right text-xs font-semibold uppercase whitespace-nowrap">vs N-1</TableHead>
              )}
              {showCashColumn && (
                <TableHead className="text-right text-xs font-semibold uppercase whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-cash">
                    <Store className="h-3 w-3" /> Caisse
                  </span>
                </TableHead>
              )}
              <HeaderCell column="netPayout" className="text-right">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1">Versement <Info className="h-3 w-3 opacity-60" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Net réellement versé sur le compte bancaire = Payout Uber + Titres-restaurant + Versement Deliveroo. Hors ajustements (ads, eco-contribution, marketing) traités dans les onglets Finances / Frais.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </HeaderCell>
              <HeaderCell column="mealVoucher" className="text-right">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1">Titre restaurant <Info className="h-3 w-3 opacity-60" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Montant des titres-restaurant Uber importé, inclus dans le Versement.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </HeaderCell>
              <HeaderCell column="profitability" className="text-right">Rentab.</HeaderCell>
              <HeaderCell column="orders" className="text-right">Cmds</HeaderCell>
              <HeaderCell column="avgBasket" className="text-right">Panier</HeaderCell>
              <HeaderCell column="rating" className="text-right">Note</HeaderCell>
              <HeaderCell column="errorRate" className="text-right">Erreurs</HeaderCell>
              <HeaderCell column="totalDeliveryTime" className="text-right">Prépa+Livr</HeaderCell>
              <HeaderCell column="downtime" className="text-right">Inactiv.</HeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStats.map((resto, idx) => {
              const ratingStatus = getMetricStatus("rating", resto.rating);
              const profitStatus = getMetricStatus("profitability", resto.profitability);
              const totalDeliveryStatus = getMetricStatus("totalDeliveryTime", resto.totalDeliveryTime);
              const errorStatus = getMetricStatus("errorRate", resto.errorRate);
              const downtimeStatus = getMetricStatus("downtime", resto.downtime);
              const isExpanded = expandedRows.has(resto.id);

              return (
                <>
                  <TableRow
                    key={resto.id}
                    className="cursor-pointer hover:bg-muted/50 transition-all duration-200 border-border/30 group"
                    onClick={() => onRestaurantClick ? onRestaurantClick(resto.id) : navigate(`/restaurants/${resto.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRow(resto.id); }}
                          className="p-0.5 rounded hover:bg-muted transition-transform"
                        >
                          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-90")} />
                        </button>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs h-6 w-6 flex items-center justify-center rounded-md">
                          {idx + 1}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold group-hover:text-primary transition-colors">
                      <div className="flex items-center gap-2">
                        <span>{resto.name}</span>
                        {showDataSource && dataSourceMap?.get(resto.id) && (
                          <DataSourceBadge
                            source={dataSourceMap.get(resto.id)!.dominantSource}
                            uberShare={dataSourceMap.get(resto.id)!.uberShare}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {formatCurrency(resto.revenue)}
                    </TableCell>
                    {showN1Comparison && (
                      <TableCell className="text-right">
                        {formatVariation(resto.revenueVariation)}
                      </TableCell>
                    )}
                    {showCashColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatNetPayout(resto.netPayout)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary whitespace-nowrap">
                      {resto.mealVoucher > 0 ? formatCurrencyPrecise(resto.mealVoucher) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-medium", getStatusTextClass(profitStatus))}>
                        {resto.profitability != null ? `${resto.profitability.toFixed(1)}%` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {resto.orders.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {resto.avgBasket.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("flex items-center justify-end gap-1 font-medium", getStatusTextClass(ratingStatus))}>
                        <Star className="h-3 w-3" />
                        {resto.rating?.toFixed(1) ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-medium", getStatusTextClass(errorStatus))}>
                        {resto.errorRate != null ? `${resto.errorRate.toFixed(1)}%` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-medium whitespace-nowrap", getStatusTextClass(totalDeliveryStatus))}>
                        {formatMinutesLong(resto.totalDeliveryTime)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-medium whitespace-nowrap", getStatusTextClass(downtimeStatus))}>
                        {formatHours(resto.downtime)}
                      </span>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <>
                      <PlatformSubRow
                        platform="Uber Eats"
                        data={resto.platformBreakdown.uber}
                        showN1Comparison={showN1Comparison}
                        isUber={true}
                        revenueShare={resto.revenue > 0 ? (resto.platformBreakdown.uber.revenue / resto.revenue) * 100 : 0}
                        rating={resto.rating}
                        errorRate={resto.errorRate}
                        prepTime={resto.totalDeliveryTime}
                        downtime={resto.downtime}
                      />
                      <PlatformSubRow
                        platform="Deliveroo"
                        data={resto.platformBreakdown.deliveroo}
                        showN1Comparison={showN1Comparison}
                        isUber={false}
                        revenueShare={resto.revenue > 0 ? (resto.platformBreakdown.deliveroo.revenue / resto.revenue) * 100 : 0}
                      />
                    </>
                  )}
                </>
              );
            })}

            {/* Network totals row */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border hover:bg-muted/40">
              <TableCell></TableCell>
              <TableCell className="font-bold text-primary">
                RÉSEAU <span className="text-muted-foreground font-normal text-sm">({stats.length} restos)</span>
              </TableCell>
              <TableCell className="text-right font-bold whitespace-nowrap">
                {formatCurrency(networkTotals.totalRevenue)}
              </TableCell>
              {showN1Comparison && (
                <TableCell className="text-right">
                  {formatVariation(networkTotals.revenueVariation)}
                </TableCell>
              )}
              {showCashColumn && (
                <TableCell className="text-right font-bold text-cash whitespace-nowrap">
                  {formatCurrency(networkCashTotal)}
                </TableCell>
              )}
              <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {formatNetPayout(networkTotals.totalNetPayout)}
              </TableCell>
              <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                {networkTotals.totalMealVoucher > 0 ? formatCurrencyPrecise(networkTotals.totalMealVoucher) : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold text-muted-foreground">
                {networkTotals.avgProfitability != null ? `${networkTotals.avgProfitability.toFixed(1)}%` : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {networkTotals.totalOrders.toLocaleString("fr-FR")}
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">
                {networkTotals.avgBasket.toFixed(2)} €
              </TableCell>
              <TableCell className="text-right">
                <span className="flex items-center justify-end gap-1 font-semibold text-muted-foreground">
                  <Star className="h-3 w-3" />
                  {networkTotals.avgRating?.toFixed(1) ?? "—"}
                </span>
              </TableCell>
              <TableCell className="text-right font-semibold text-muted-foreground">
                {networkTotals.avgErrorRate != null ? `${networkTotals.avgErrorRate.toFixed(1)}%` : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold text-muted-foreground whitespace-nowrap">
                {formatMinutesLong(networkTotals.avgTotalDeliveryTime)}
              </TableCell>
              <TableCell className="text-right font-semibold text-muted-foreground whitespace-nowrap">
                {formatHours(networkTotals.totalDowntime)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {stats.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucun restaurant épinglé trouvé
          </div>
        )}
      </CardContent>
    </Card>
  );
}
