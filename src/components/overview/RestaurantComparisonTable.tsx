import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Star, Clock, Percent, AlertTriangle, PauseCircle, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type RestaurantNetworkStats, type NetworkTotals } from "@/hooks/useNetworkStats";
import { getMetricStatus, getStatusTextClass } from "@/lib/performanceThresholds";

type SortColumn = "name" | "city" | "revenue" | "orders" | "avgBasket" | "netPayout" | "rating" | "profitability" | "prepTime" | "errorRate" | "downtime";
type SortDirection = "asc" | "desc";

interface RestaurantComparisonTableProps {
  stats: RestaurantNetworkStats[];
  networkTotals: NetworkTotals;
  showN1Comparison: boolean;
  onToggleN1: (value: boolean) => void;
  isLoading: boolean;
}

// Format helpers
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + " €";
};

const formatMinutes = (minutes: number | null): string => {
  if (minutes == null) return "—";
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m${secs > 0 ? ` ${secs}s` : ""}`;
};

const formatHours = (hours: number | null): string => {
  if (hours == null || hours === 0) return "—";
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

export function RestaurantComparisonTable({
  stats,
  networkTotals,
  showN1Comparison,
  onToggleN1,
  isLoading,
}: RestaurantComparisonTableProps) {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = useState<SortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      // Default to desc for most metrics (higher is better), asc for prepTime, errorRate, downtime
      setSortDirection(["prepTime", "errorRate", "downtime"].includes(column) ? "asc" : "desc");
    }
  };

  // Format net payout
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
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "city":
          aVal = (a.city || "").toLowerCase();
          bVal = (b.city || "").toLowerCase();
          break;
        case "revenue":
          aVal = a.revenue;
          bVal = b.revenue;
          break;
        case "orders":
          aVal = a.orders;
          bVal = b.orders;
          break;
        case "avgBasket":
          aVal = a.avgBasket;
          bVal = b.avgBasket;
          break;
        case "netPayout":
          aVal = a.netPayout;
          bVal = b.netPayout;
          break;
        case "rating":
          aVal = a.rating ?? -999;
          bVal = b.rating ?? -999;
          break;
        case "profitability":
          aVal = a.profitability ?? -999;
          bVal = b.profitability ?? -999;
          break;
        case "prepTime":
          aVal = a.prepTime ?? 999;
          bVal = b.prepTime ?? 999;
          break;
        case "errorRate":
          aVal = a.errorRate ?? 999;
          bVal = b.errorRate ?? 999;
          break;
        case "downtime":
          aVal = a.downtime ?? 999;
          bVal = b.downtime ?? 999;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = aVal as number;
      const numB = bVal as number;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [stats, sortColumn, sortDirection]);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const HeaderCell = ({
    column,
    children,
    className,
  }: {
    column: SortColumn;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50 transition-colors text-xs font-semibold uppercase whitespace-nowrap",
        className
      )}
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
          <div className="flex items-center gap-2">
            <Switch
              id="n1-toggle"
              checked={showN1Comparison}
              onCheckedChange={onToggleN1}
            />
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
              <HeaderCell column="city">Ville</HeaderCell>
              <HeaderCell column="revenue" className="text-right">CA</HeaderCell>
              {showN1Comparison && (
                <TableHead className="text-right text-xs font-semibold uppercase whitespace-nowrap">vs N-1</TableHead>
              )}
              <HeaderCell column="orders" className="text-right">Cmds</HeaderCell>
              <HeaderCell column="avgBasket" className="text-right">Panier</HeaderCell>
              <HeaderCell column="netPayout" className="text-right">Versement</HeaderCell>
              <HeaderCell column="rating" className="text-right">Note</HeaderCell>
              <HeaderCell column="profitability" className="text-right">Rentab.</HeaderCell>
              <HeaderCell column="prepTime" className="text-right">Prépa</HeaderCell>
              <HeaderCell column="errorRate" className="text-right">Erreurs</HeaderCell>
              <HeaderCell column="downtime" className="text-right">Inactiv.</HeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map((resto, idx) => {
              const ratingStatus = getMetricStatus("rating", resto.rating);
              const profitStatus = getMetricStatus("profitability", resto.profitability);
              const prepStatus = getMetricStatus("prepTime", resto.prepTime);
              const errorStatus = getMetricStatus("errorRate", resto.errorRate);
              const downtimeStatus = getMetricStatus("downtime", resto.downtime);

              return (
                <TableRow
                  key={resto.id}
                  className="cursor-pointer hover:bg-muted/50 transition-all duration-200 border-border/30 group"
                  onClick={() => navigate(`/restaurants/${resto.id}`)}
                >
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="bg-muted text-muted-foreground text-xs h-6 w-6 flex items-center justify-center rounded-md"
                    >
                      {idx + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold group-hover:text-primary transition-colors">
                    {resto.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {resto.city || "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">
                    {formatCurrency(resto.revenue)}
                  </TableCell>
                  {showN1Comparison && (
                    <TableCell className="text-right">
                      {formatVariation(resto.revenueVariation)}
                    </TableCell>
                  )}
                  <TableCell className="text-right text-muted-foreground">
                    {resto.orders.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {resto.avgBasket.toFixed(2)} €
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {formatNetPayout(resto.netPayout)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("flex items-center justify-end gap-1 font-medium", getStatusTextClass(ratingStatus))}>
                      <Star className="h-3 w-3" />
                      {resto.rating?.toFixed(1) ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-medium", getStatusTextClass(profitStatus))}>
                      {resto.profitability != null ? `${resto.profitability.toFixed(1)}%` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-medium whitespace-nowrap", getStatusTextClass(prepStatus))}>
                      {formatMinutes(resto.prepTime)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-medium", getStatusTextClass(errorStatus))}>
                      {resto.errorRate != null ? `${resto.errorRate.toFixed(1)}%` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-medium whitespace-nowrap", getStatusTextClass(downtimeStatus))}>
                      {formatHours(resto.downtime)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Network totals row */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border hover:bg-muted/40">
              <TableCell></TableCell>
              <TableCell className="font-bold text-primary">RÉSEAU</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {stats.length} restaurants
              </TableCell>
              <TableCell className="text-right font-bold whitespace-nowrap">
                {formatCurrency(networkTotals.totalRevenue)}
              </TableCell>
              {showN1Comparison && (
                <TableCell className="text-right">
                  {formatVariation(networkTotals.revenueVariation)}
                </TableCell>
              )}
              <TableCell className="text-right font-semibold">
                {networkTotals.totalOrders.toLocaleString("fr-FR")}
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">
                {networkTotals.avgBasket.toFixed(2)} €
              </TableCell>
              <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {formatNetPayout(networkTotals.totalNetPayout)}
              </TableCell>
              <TableCell className="text-right">
                <span className="flex items-center justify-end gap-1 font-semibold text-muted-foreground">
                  <Star className="h-3 w-3" />
                  {networkTotals.avgRating?.toFixed(1) ?? "—"}
                </span>
              </TableCell>
              <TableCell className="text-right font-semibold text-muted-foreground">
                {networkTotals.avgProfitability != null
                  ? `${networkTotals.avgProfitability.toFixed(1)}%`
                  : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold text-muted-foreground whitespace-nowrap">
                {formatMinutes(networkTotals.avgPrepTime)}
              </TableCell>
              <TableCell className="text-right font-semibold text-muted-foreground">
                {networkTotals.avgErrorRate != null
                  ? `${networkTotals.avgErrorRate.toFixed(1)}%`
                  : "—"}
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
