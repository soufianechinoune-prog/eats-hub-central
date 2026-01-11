import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, Minus, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useRestaurantConsolidatedExport } from "@/hooks/useRestaurantConsolidatedExport";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

interface RevenueDataPoint {
  month: string;
  monthNum?: number;
  fullDate?: string;
  revenue: number;
  orders: number;
  avgBasket?: number;
  prevRevenue: number;
  prevOrders: number;
}

interface RevenueDataTableProps {
  data: RevenueDataPoint[];
  showComparison?: boolean;
  selectedYear: number;
  comparisonMode?: "yearOverYear" | "rollingPeriod";
}

type SortField = "date" | "revenue" | "prevRevenue" | "revenueVar" | "orders" | "prevOrders" | "ordersVar" | "avgBasket" | "prevAvgBasket" | "avgBasketVar";
type SortDirection = "asc" | "desc";

const calcVariation = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

function VariationCell({ current, previous }: { current: number; previous: number }) {
  const variation = calcVariation(current, previous);
  if (variation === null) return <span className="text-muted-foreground">--</span>;
  const isPositive = variation > 0;
  const isNeutral = Math.abs(variation) < 0.5;
  return (
    <span className={cn("flex items-center gap-0.5 font-medium", isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-600" : "text-red-600")}>
      {isNeutral ? <Minus className="h-3.5 w-3.5" /> : isPositive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {variation > 0 ? "+" : ""}{variation.toFixed(1)}%
    </span>
  );
}

function SortableHeader({ label, field, currentSort, currentDirection, onSort }: { label: string; field: SortField; currentSort: SortField; currentDirection: SortDirection; onSort: (field: SortField) => void }) {
  const isActive = currentSort === field;
  return (
    <Button variant="ghost" size="sm" className={cn("h-auto p-0 font-medium hover:bg-transparent", isActive && "text-primary")} onClick={() => onSort(field)}>
      {label}
      {isActive ? (currentDirection === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />) : <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  );
}

export function RevenueDataTable({ data, showComparison = true, selectedYear, comparisonMode = "yearOverYear" }: RevenueDataTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const prevYear = selectedYear - 1;
  const currentLabel = comparisonMode === "rollingPeriod" ? "Actuel" : String(selectedYear);
  const prevLabel = comparisonMode === "rollingPeriod" ? "Préc." : String(prevYear);

  // Get analytics context for restaurant export
  const {
    selectedRestaurants,
    selectedPlatform,
    periodMode,
    selectedMonth,
    dateRange,
    comparisonMode: ctxComparisonMode,
  } = useAnalyticsContext();

  const { exportToExcel: exportByRestaurant, isLoading: isExportLoading } = useRestaurantConsolidatedExport({
    restaurantIds: selectedRestaurants,
    platform: selectedPlatform,
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
    comparisonMode: ctxComparisonMode,
  });

  const enrichedData = useMemo(() => data.map(row => ({
    ...row,
    avgBasket: row.orders > 0 ? row.revenue / row.orders : 0,
    prevAvgBasket: row.prevOrders > 0 ? row.prevRevenue / row.prevOrders : 0,
  })), [data]);

  const sortedData = useMemo(() => {
    return [...enrichedData].sort((a, b) => {
      let aValue = 0, bValue = 0;
      if (sortField === "date") { aValue = a.monthNum || 0; bValue = b.monthNum || 0; }
      else if (sortField === "revenue") { aValue = a.revenue; bValue = b.revenue; }
      else if (sortField === "prevRevenue") { aValue = a.prevRevenue; bValue = b.prevRevenue; }
      else if (sortField === "revenueVar") { aValue = calcVariation(a.revenue, a.prevRevenue) || -999; bValue = calcVariation(b.revenue, b.prevRevenue) || -999; }
      else if (sortField === "orders") { aValue = a.orders; bValue = b.orders; }
      else if (sortField === "prevOrders") { aValue = a.prevOrders; bValue = b.prevOrders; }
      else if (sortField === "ordersVar") { aValue = calcVariation(a.orders, a.prevOrders) || -999; bValue = calcVariation(b.orders, b.prevOrders) || -999; }
      else if (sortField === "avgBasket") { aValue = a.avgBasket; bValue = b.avgBasket; }
      else if (sortField === "prevAvgBasket") { aValue = a.prevAvgBasket; bValue = b.prevAvgBasket; }
      else if (sortField === "avgBasketVar") { aValue = calcVariation(a.avgBasket, a.prevAvgBasket) || -999; bValue = calcVariation(b.avgBasket, b.prevAvgBasket) || -999; }
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [enrichedData, sortField, sortDirection]);

  const totals = useMemo(() => {
    const totalRevenue = enrichedData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = enrichedData.reduce((sum, d) => sum + d.orders, 0);
    const totalPrevRevenue = enrichedData.reduce((sum, d) => sum + d.prevRevenue, 0);
    const totalPrevOrders = enrichedData.reduce((sum, d) => sum + d.prevOrders, 0);
    return {
      revenue: totalRevenue, orders: totalOrders, avgBasket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      prevRevenue: totalPrevRevenue, prevOrders: totalPrevOrders, prevAvgBasket: totalPrevOrders > 0 ? totalPrevRevenue / totalPrevOrders : 0,
    };
  }, [enrichedData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("desc"); }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

  const handleExportExcel = () => {
    const exportData = sortedData.map(row => ({
      "Date": row.month, [`CA ${currentLabel}`]: row.revenue,
      ...(showComparison ? { [`CA ${prevLabel}`]: row.prevRevenue, "Évol. CA (%)": calcVariation(row.revenue, row.prevRevenue)?.toFixed(1) || "--" } : {}),
      [`Cmd ${currentLabel}`]: row.orders,
      ...(showComparison ? { [`Cmd ${prevLabel}`]: row.prevOrders, "Évol. Cmd (%)": calcVariation(row.orders, row.prevOrders)?.toFixed(1) || "--" } : {}),
      [`Panier ${currentLabel}`]: row.avgBasket.toFixed(2),
      ...(showComparison ? { [`Panier ${prevLabel}`]: row.prevAvgBasket.toFixed(2), "Évol. Panier (%)": calcVariation(row.avgBasket, row.prevAvgBasket)?.toFixed(1) || "--" } : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Revenus");
    XLSX.writeFile(wb, `revenus_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sortedData.length} période{sortedData.length > 1 ? "s" : ""}</p>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportByRestaurant} 
            disabled={isExportLoading || selectedRestaurants.length === 0}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export par Restaurant
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><SortableHeader label="Date" field="date" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortableHeader label={`CA ${currentLabel}`} field="revenue" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead>
              {showComparison && <><TableHead className="text-right"><SortableHeader label={`CA ${prevLabel}`} field="prevRevenue" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead><TableHead className="text-right"><SortableHeader label="Évol." field="revenueVar" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead></>}
              <TableHead className="text-right"><SortableHeader label={`Cmd ${currentLabel}`} field="orders" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead>
              {showComparison && <><TableHead className="text-right"><SortableHeader label={`Cmd ${prevLabel}`} field="prevOrders" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead><TableHead className="text-right"><SortableHeader label="Évol." field="ordersVar" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead></>}
              <TableHead className="text-right"><SortableHeader label={`Panier ${currentLabel}`} field="avgBasket" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead>
              {showComparison && <><TableHead className="text-right"><SortableHeader label={`Panier ${prevLabel}`} field="prevAvgBasket" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead><TableHead className="text-right"><SortableHeader label="Évol." field="avgBasketVar" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} /></TableHead></>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.month}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(row.revenue)}</TableCell>
                {showComparison && <><TableCell className="text-right text-muted-foreground">{formatCurrency(row.prevRevenue)}</TableCell><TableCell className="text-right"><VariationCell current={row.revenue} previous={row.prevRevenue} /></TableCell></>}
                <TableCell className="text-right font-semibold">{row.orders.toLocaleString("fr-FR")}</TableCell>
                {showComparison && <><TableCell className="text-right text-muted-foreground">{row.prevOrders.toLocaleString("fr-FR")}</TableCell><TableCell className="text-right"><VariationCell current={row.orders} previous={row.prevOrders} /></TableCell></>}
                <TableCell className="text-right font-semibold">{formatCurrency(row.avgBasket)}</TableCell>
                {showComparison && <><TableCell className="text-right text-muted-foreground">{formatCurrency(row.prevAvgBasket)}</TableCell><TableCell className="text-right"><VariationCell current={row.avgBasket} previous={row.prevAvgBasket} /></TableCell></>}
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
              <TableCell className="font-bold">TOTAL</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(totals.revenue)}</TableCell>
              {showComparison && <><TableCell className="text-right text-muted-foreground font-semibold">{formatCurrency(totals.prevRevenue)}</TableCell><TableCell className="text-right"><VariationCell current={totals.revenue} previous={totals.prevRevenue} /></TableCell></>}
              <TableCell className="text-right font-bold">{totals.orders.toLocaleString("fr-FR")}</TableCell>
              {showComparison && <><TableCell className="text-right text-muted-foreground font-semibold">{totals.prevOrders.toLocaleString("fr-FR")}</TableCell><TableCell className="text-right"><VariationCell current={totals.orders} previous={totals.prevOrders} /></TableCell></>}
              <TableCell className="text-right font-bold">{formatCurrency(totals.avgBasket)}</TableCell>
              {showComparison && <><TableCell className="text-right text-muted-foreground font-semibold">{formatCurrency(totals.prevAvgBasket)}</TableCell><TableCell className="text-right"><VariationCell current={totals.avgBasket} previous={totals.prevAvgBasket} /></TableCell></>}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
