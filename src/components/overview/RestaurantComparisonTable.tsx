import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Star, ChevronRight, ShoppingCart, Search, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type RestaurantNetworkStats, type NetworkTotals } from "@/hooks/useNetworkStats";
import { type RestaurantCashStats } from "@/hooks/useRestaurantCashRevenue";
import { ChannelBreakdownPanel, ChannelMixBar, ChannelChips, type ChannelId, type ChannelSegment } from "@/components/overview/ChannelBreakdownPanel";
import { getMetricStatus, getStatusTextClass } from "@/lib/performanceThresholds";
import { DataSourceBadge } from "@/components/overview/DataSourceBadge";
import type { RestaurantDataSourceInfo } from "@/hooks/useDataSourceBreakdown";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { NegotiatedCofinPopover } from "@/components/shared/NegotiatedCofinPopover";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { format } from "date-fns";

type SortColumn = "name" | "city" | "revenue" | "orders" | "avgBasket" | "netPayout" | "mealVoucher" | "rating" | "profitability" | "totalDeliveryTime" | "errorRate" | "downtime" | "adsRatio";
type SortDirection = "asc" | "desc";
type ChannelTab = "all" | "uber" | "deliveroo" | "cash";

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
  /** Stats Caisse par restaurant (Splash360) — CA, commandes, panier, variation N-1. */
  cashByRestaurant?: Map<string, RestaurantCashStats>;
  /** Force le canal affiché (cache les tabs internes). */
  forcedChannel?: "all" | "uber" | "deliveroo" | "cash";
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

// Sub-row components removed — channel breakdown is now rendered as a
// dashboard panel (ChannelBreakdownPanel) inside a single full-width cell.


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
  cashByRestaurant,
  forcedChannel,
}: RestaurantComparisonTableProps) {
  const navigate = useNavigate();
  const { dateRange } = useAnalyticsContext();
  const startDateStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const endDateStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDateStr;
  const [sortColumn, setSortColumn] = useState<SortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [internalChannelTab, setInternalChannelTab] = useState<ChannelTab>("all");
  const channelTab: ChannelTab = forcedChannel ?? internalChannelTab;
  const setChannelTab = (v: ChannelTab) => setInternalChannelTab(v);

  const hasUber = useMemo(() => stats.some(r => r.platformBreakdown.uber.revenue > 0), [stats]);
  const hasDeliveroo = useMemo(() => stats.some(r => r.platformBreakdown.deliveroo.revenue > 0), [stats]);
  const hasCash = useMemo(() => {
    if (!cashByRestaurant) return networkCashTotal > 0;
    for (const v of cashByRestaurant.values()) if (v > 0) return true;
    return networkCashTotal > 0;
  }, [cashByRestaurant, networkCashTotal]);

  // In the "Tous" tab we remove the standalone Caisse column (Caisse has its own tab now)
  // and rely on the mix-bar + chips under the CA column instead.
  const showCashColumn = false;

  // Remap a restaurant row to the active channel view.
  // Returns null when the restaurant has no data for that channel (filtered out).
  const projectForTab = useCallback((r: RestaurantNetworkStats) => {
    if (channelTab === "all") {
      return {
        revenue: r.revenue,
        orders: r.orders,
        avgBasket: r.avgBasket,
        netPayout: r.netPayout,
        mealVoucher: r.mealVoucher,
        profitability: r.profitability,
        rating: r.rating,
        errorRate: r.errorRate,
        totalDeliveryTime: r.totalDeliveryTime,
        downtime: r.downtime,
        availabilityRate: r.availabilityRate,
        hide: false,
      };
    }
    if (channelTab === "uber") {
      const p = r.platformBreakdown.uber;
      return {
        revenue: p.revenue,
        orders: p.orders,
        avgBasket: p.avgBasket,
        netPayout: p.netPayout,
        mealVoucher: p.mealVoucher,
        profitability: p.profitability,
        // Note/Erreurs/Prépa/Downtime sont Uber-driven dans nos données → on les conserve
        rating: r.rating,
        errorRate: r.errorRate,
        totalDeliveryTime: r.totalDeliveryTime,
        downtime: r.downtime,
        availabilityRate: r.availabilityRate,
        hide: p.revenue <= 0,
      };
    }
    if (channelTab === "deliveroo") {
      const p = r.platformBreakdown.deliveroo;
      return {
        revenue: p.revenue,
        orders: p.orders,
        avgBasket: p.avgBasket,
        netPayout: p.netPayout,
        mealVoucher: 0,
        profitability: p.profitability,
        rating: null,
        errorRate: null,
        totalDeliveryTime: null,
        downtime: null,
        availabilityRate: null,
        hide: p.revenue <= 0,
      };
    }
    // cash
    const cash = cashByRestaurant?.get(r.id) ?? 0;
    return {
      revenue: cash,
      orders: 0,
      avgBasket: 0,
      netPayout: 0,
      mealVoucher: 0,
      profitability: null,
      rating: null,
      errorRate: null,
      totalDeliveryTime: null,
      downtime: null,
      availabilityRate: null,
      hide: cash <= 0,
    };
  }, [channelTab, cashByRestaurant]);

  // Column visibility per tab
  const cols = useMemo(() => {
    if (channelTab === "all") {
      return { caMix: true, chips: true, expand: true, payout: true, mealVoucher: true, profitability: true, adsRatio: true, orders: true, basket: true, rating: true, errorRate: true, delivery: true, downtime: true };
    }
    if (channelTab === "uber") {
      return { caMix: false, chips: false, expand: false, payout: true, mealVoucher: true, profitability: true, adsRatio: true, orders: true, basket: true, rating: true, errorRate: true, delivery: true, downtime: true };
    }
    if (channelTab === "deliveroo") {
      return { caMix: false, chips: false, expand: false, payout: true, mealVoucher: false, profitability: true, adsRatio: false, orders: true, basket: true, rating: false, errorRate: false, delivery: false, downtime: false };
    }
    // cash
    return { caMix: false, chips: false, expand: false, payout: false, mealVoucher: false, profitability: false, adsRatio: false, orders: false, basket: false, rating: false, errorRate: false, delivery: false, downtime: false };
  }, [channelTab]);


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

  // Build channel-projected rows then sort + filter
  type Row = { resto: RestaurantNetworkStats; v: ReturnType<typeof projectForTab> };
  const projectedRows = useMemo<Row[]>(() => {
    return stats
      .map(r => ({ resto: r, v: projectForTab(r) }))
      .filter(row => !row.v.hide);
  }, [stats, projectForTab]);

  const sortedStats = useMemo(() => {
    return [...projectedRows].sort((A, B) => {
      const a = A.v, b = B.v;
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortColumn) {
        case "name": aVal = A.resto.name.toLowerCase(); bVal = B.resto.name.toLowerCase(); break;
        case "city": aVal = (A.resto.city || "").toLowerCase(); bVal = (B.resto.city || "").toLowerCase(); break;
        case "revenue": aVal = a.revenue; bVal = b.revenue; break;
        case "orders": aVal = a.orders; bVal = b.orders; break;
        case "avgBasket": aVal = a.avgBasket; bVal = b.avgBasket; break;
        case "netPayout": aVal = a.netPayout; bVal = b.netPayout; break;
        case "mealVoucher": aVal = a.mealVoucher; bVal = b.mealVoucher; break;
        case "rating": aVal = a.rating ?? -999; bVal = b.rating ?? -999; break;
        case "profitability": aVal = a.profitability ?? -999; bVal = b.profitability ?? -999; break;
        case "totalDeliveryTime": aVal = a.totalDeliveryTime ?? 999; bVal = b.totalDeliveryTime ?? 999; break;
        case "errorRate": aVal = a.errorRate ?? 999; bVal = b.errorRate ?? 999; break;
        case "downtime": aVal = a.availabilityRate ?? -1; bVal = b.availabilityRate ?? -1; break;
        case "adsRatio": {
          aVal = adsRatioMap?.get(A.resto.id)?.adsPct ?? -1;
          bVal = adsRatioMap?.get(B.resto.id)?.adsPct ?? -1;
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
  }, [projectedRows, sortColumn, sortDirection, adsRatioMap]);

  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) return sortedStats;
    const q = searchQuery.toLowerCase();
    return sortedStats.filter(row => row.resto.name.toLowerCase().includes(q));
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-xl flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Comparatif des restaurants
          </CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            {!forcedChannel && (
              <Tabs value={channelTab} onValueChange={(v) => { setChannelTab(v as ChannelTab); setExpandedRows(new Set()); }}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3">Tous</TabsTrigger>
                  {hasUber && <TabsTrigger value="uber" className="text-xs px-3 data-[state=active]:text-uber">Uber Eats</TabsTrigger>}
                  {hasDeliveroo && <TabsTrigger value="deliveroo" className="text-xs px-3 data-[state=active]:text-deliveroo">Deliveroo</TabsTrigger>}
                  {hasCash && <TabsTrigger value="cash" className="text-xs px-3 data-[state=active]:text-cash">Caisse</TabsTrigger>}
                </TabsList>
              </Tabs>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="h-8 w-[200px] pl-8 text-sm"
              />
            </div>
            {onToggleDataSource && channelTab === "all" && (
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
              {showN1Comparison && channelTab === "all" && (
                <TableHead className="text-right text-xs font-semibold uppercase whitespace-nowrap">vs N-1</TableHead>
              )}
              {cols.payout && (
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
              )}
              {cols.mealVoucher && (
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
              )}
              {cols.profitability && (
                <HeaderCell column="profitability" className="text-right">Rentab.</HeaderCell>
              )}
              {cols.adsRatio && (
                <HeaderCell column="adsRatio" className="text-right">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1">% Pub <Info className="h-3 w-3 opacity-60" /></span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Dépenses publicitaires Uber Eats / CA TTC sur la période. Calculé à partir des lignes « advertising » des versements Uber.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </HeaderCell>
              )}
              {cols.orders && <HeaderCell column="orders" className="text-right">Cmds</HeaderCell>}
              {cols.basket && <HeaderCell column="avgBasket" className="text-right">Panier</HeaderCell>}
              {cols.rating && <HeaderCell column="rating" className="text-right">Note</HeaderCell>}
              {cols.errorRate && <HeaderCell column="errorRate" className="text-right">Erreurs</HeaderCell>}
              {cols.delivery && <HeaderCell column="totalDeliveryTime" className="text-right">Prépa+Livr</HeaderCell>}
              {cols.downtime && <HeaderCell column="downtime" className="text-right">Dispo.</HeaderCell>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStats.map((row, idx) => {
              const resto = row.resto;
              const v = row.v;
              const ratingStatus = getMetricStatus("rating", v.rating);
              const profitStatus = getMetricStatus("profitability", v.profitability);
              const totalDeliveryStatus = getMetricStatus("totalDeliveryTime", v.totalDeliveryTime);
              const errorStatus = getMetricStatus("errorRate", v.errorRate);
              const availabilityStatus = getMetricStatus("availabilityRate", v.availabilityRate);
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
                        {cols.expand ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRow(resto.id); }}
                            className="p-0.5 rounded hover:bg-muted transition-transform"
                          >
                            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-90")} />
                          </button>
                        ) : (
                          <span className="w-[18px] inline-block" />
                        )}
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
                        {cols.chips && (() => {
                          const cash = cashByRestaurant?.get(resto.id) ?? 0;
                          const active: ChannelId[] = [];
                          if (resto.platformBreakdown.uber.revenue > 0) active.push("uber");
                          if (resto.platformBreakdown.deliveroo.revenue > 0) active.push("deliveroo");
                          if (cash > 0) active.push("cash");
                          return <ChannelChips channels={active} />;
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {cols.caMix ? (() => {
                        const cash = cashByRestaurant?.get(resto.id) ?? 0;
                        const segments: ChannelSegment[] = [
                          { id: "uber", revenue: resto.platformBreakdown.uber.revenue },
                          { id: "deliveroo", revenue: resto.platformBreakdown.deliveroo.revenue },
                          { id: "cash", revenue: cash },
                        ];
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span>{formatCurrency(v.revenue)}</span>
                            <div className="w-20">
                              <ChannelMixBar segments={segments} size="xs" />
                            </div>
                          </div>
                        );
                      })() : (
                        <span>{formatCurrency(v.revenue)}</span>
                      )}
                    </TableCell>
                    {showN1Comparison && channelTab === "all" && (
                      <TableCell className="text-right">
                        {formatVariation(resto.revenueVariation)}
                      </TableCell>
                    )}
                    {cols.payout && (
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatNetPayout(v.netPayout)}
                      </TableCell>
                    )}
                    {cols.mealVoucher && (
                      <TableCell className="text-right font-semibold text-primary whitespace-nowrap">
                        {v.mealVoucher > 0 ? formatCurrencyPrecise(v.mealVoucher) : "—"}
                      </TableCell>
                    )}
                    {cols.profitability && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {channelTab === "all" && resto.negotiatedCofinancement > 0 && startDateStr && endDateStr ? (
                          <NegotiatedCofinPopover
                            restaurantId={resto.id}
                            restaurantName={resto.name}
                            startDate={startDateStr}
                            endDate={endDateStr}
                            totalAmount={resto.negotiatedCofinancement}
                          >
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "font-medium cursor-pointer inline-flex items-center gap-1 hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded px-1",
                                getStatusTextClass(profitStatus)
                              )}
                              title={`Inclut ${formatCurrency(resto.negotiatedCofinancement)} de cofinancement marketing négocié. Cliquer pour le détail.`}
                            >
                              {v.profitability != null ? `${v.profitability.toFixed(1)}%` : "—"}
                              <Info className="h-3 w-3 text-amber-500" />
                            </button>
                          </NegotiatedCofinPopover>
                        ) : (
                          <span className={cn("font-medium", getStatusTextClass(profitStatus))}>
                            {v.profitability != null ? `${v.profitability.toFixed(1)}%` : "—"}
                          </span>
                        )}
                      </TableCell>
                    )}
                    {cols.adsRatio && (
                      <TableCell className="text-right whitespace-nowrap">
                        {(() => {
                          const r = adsRatioMap?.get(resto.id);
                          if (!r || r.adsPct == null) return <span className="text-muted-foreground">—</span>;
                          return (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-medium cursor-help">
                                    {r.adsPct.toFixed(2).replace(".", ",")}%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {formatCurrency(r.adsSpend)} de pub / {formatCurrency(r.revenueTtc)} de CA TTC
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </TableCell>
                    )}
                    {cols.orders && (
                      <TableCell className="text-right text-muted-foreground">
                        {v.orders.toLocaleString("fr-FR")}
                      </TableCell>
                    )}
                    {cols.basket && (
                      <TableCell className="text-right whitespace-nowrap">
                        {v.avgBasket.toFixed(2)} €
                      </TableCell>
                    )}
                    {cols.rating && (
                      <TableCell className="text-right">
                        <span className={cn("flex items-center justify-end gap-1 font-medium", getStatusTextClass(ratingStatus))}>
                          <Star className="h-3 w-3" />
                          {v.rating?.toFixed(1) ?? "—"}
                        </span>
                      </TableCell>
                    )}
                    {cols.errorRate && (
                      <TableCell className="text-right">
                        <span className={cn("font-medium", getStatusTextClass(errorStatus))}>
                          {v.errorRate != null ? `${v.errorRate.toFixed(1)}%` : "—"}
                        </span>
                      </TableCell>
                    )}
                    {cols.delivery && (
                      <TableCell className="text-right">
                        <span className={cn("font-medium whitespace-nowrap", getStatusTextClass(totalDeliveryStatus))}>
                          {formatMinutesLong(v.totalDeliveryTime)}
                        </span>
                      </TableCell>
                    )}
                    {cols.downtime && (
                      <TableCell className="text-right">
                        <span className={cn("font-medium whitespace-nowrap", getStatusTextClass(availabilityStatus))}>
                          {v.availabilityRate != null ? `${v.availabilityRate.toFixed(1)}%` : "—"}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                  {cols.expand && isExpanded && (() => {
                    const cash = cashByRestaurant?.get(resto.id) ?? 0;
                    const adsPct = adsRatioMap?.get(resto.id)?.adsPct ?? null;
                    // # + Restaurant + CA + (vs N-1) + payout + meal + profit + ads + orders + basket + rating + err + delivery + downtime
                    const visibleCols = 3
                      + (showN1Comparison && channelTab === "all" ? 1 : 0)
                      + (cols.payout ? 1 : 0)
                      + (cols.mealVoucher ? 1 : 0)
                      + (cols.profitability ? 1 : 0)
                      + (cols.adsRatio ? 1 : 0)
                      + (cols.orders ? 1 : 0)
                      + (cols.basket ? 1 : 0)
                      + (cols.rating ? 1 : 0)
                      + (cols.errorRate ? 1 : 0)
                      + (cols.delivery ? 1 : 0)
                      + (cols.downtime ? 1 : 0);
                    return (
                      <TableRow className="bg-muted/5 hover:bg-muted/5 border-border/20">
                        <TableCell colSpan={visibleCols} className="p-3">
                          <ChannelBreakdownPanel
                            resto={resto}
                            cash={cash}
                            adsPct={adsPct}
                          />
                        </TableCell>
                      </TableRow>
                    );

                  })()}
                </>
              );
            })}

            {/* Network totals row */}
            {(() => {
              // For "all" use networkTotals (network-wide aggregates).
              // For other tabs compute totals from the visible projected rows.
              const isAll = channelTab === "all";
              const sumRevenue = isAll ? networkTotals.totalRevenue : filteredStats.reduce((s, r) => s + r.v.revenue, 0);
              const sumOrders = isAll ? networkTotals.totalOrders : filteredStats.reduce((s, r) => s + r.v.orders, 0);
              const sumPayout = isAll ? networkTotals.totalNetPayout : filteredStats.reduce((s, r) => s + r.v.netPayout, 0);
              const sumMeal = isAll ? networkTotals.totalMealVoucher : filteredStats.reduce((s, r) => s + r.v.mealVoucher, 0);
              const avgBasket = sumOrders > 0 ? sumRevenue / sumOrders : 0;
              const restoCount = filteredStats.length;
              return (
                <TableRow className="bg-muted/30 font-semibold border-t-2 border-border hover:bg-muted/40">
                  <TableCell></TableCell>
                  <TableCell className="font-bold text-primary">
                    RÉSEAU <span className="text-muted-foreground font-normal text-sm">({restoCount} restos)</span>
                  </TableCell>
                  <TableCell className="text-right font-bold whitespace-nowrap">
                    {formatCurrency(sumRevenue)}
                  </TableCell>
                  {showN1Comparison && isAll && (
                    <TableCell className="text-right">
                      {formatVariation(networkTotals.revenueVariation)}
                    </TableCell>
                  )}
                  {cols.payout && (
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatNetPayout(sumPayout)}
                    </TableCell>
                  )}
                  {cols.mealVoucher && (
                    <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                      {sumMeal > 0 ? formatCurrencyPrecise(sumMeal) : "—"}
                    </TableCell>
                  )}
                  {cols.profitability && (
                    <TableCell className="text-right font-semibold text-muted-foreground">
                      {isAll && networkTotals.avgProfitability != null ? `${networkTotals.avgProfitability.toFixed(1)}%` : "—"}
                    </TableCell>
                  )}
                  {cols.adsRatio && (
                    <TableCell className="text-right font-bold text-uber whitespace-nowrap">
                      {networkAdsPct != null ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{networkAdsPct.toFixed(2).replace(".", ",")}%</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {formatCurrency(networkAdsSpend)} de pub / {formatCurrency(networkAdsRevenue)} de CA TTC
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : "—"}
                    </TableCell>
                  )}
                  {cols.orders && (
                    <TableCell className="text-right font-semibold">
                      {sumOrders.toLocaleString("fr-FR")}
                    </TableCell>
                  )}
                  {cols.basket && (
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {avgBasket.toFixed(2)} €
                    </TableCell>
                  )}
                  {cols.rating && (
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1 font-semibold text-muted-foreground">
                        <Star className="h-3 w-3" />
                        {networkTotals.avgRating?.toFixed(1) ?? "—"}
                      </span>
                    </TableCell>
                  )}
                  {cols.errorRate && (
                    <TableCell className="text-right font-semibold text-muted-foreground">
                      {networkTotals.avgErrorRate != null ? `${networkTotals.avgErrorRate.toFixed(1)}%` : "—"}
                    </TableCell>
                  )}
                  {cols.delivery && (
                    <TableCell className="text-right font-semibold text-muted-foreground whitespace-nowrap">
                      {formatMinutesLong(networkTotals.avgTotalDeliveryTime)}
                    </TableCell>
                  )}
                  {cols.downtime && (
                    <TableCell className="text-right font-semibold text-muted-foreground whitespace-nowrap">
                      {formatHours(networkTotals.totalDowntime)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })()}
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
