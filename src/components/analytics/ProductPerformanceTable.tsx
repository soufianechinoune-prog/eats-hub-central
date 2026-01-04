import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Package, Euro, TrendingUp, Search, AlertTriangle, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductData {
  item_id: string;
  item_title: string;
  category: string | null;
  quantity: number;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_unit_price: number;
  refund_rate: number;
}

interface ProductSummary {
  totalSales: number;
  totalRefund: number;
  totalQuantity: number;
  productCount: number;
  topProduct?: string;
  topProductSales?: number;
}

interface ProductPerformanceTableProps {
  data: ProductData[];
  summary: ProductSummary | null;
}

type SortColumn = "title" | "quantity" | "sales" | "refund_rate";
type SortDirection = "asc" | "desc";

export function ProductPerformanceTable({ data, summary }: ProductPerformanceTableProps) {
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("sales");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const formatCurrency = (value: number) => 
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = data.filter(
        item => 
          item.item_title.toLowerCase().includes(searchLower) ||
          (item.category && item.category.toLowerCase().includes(searchLower))
      );
    }

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "title":
          comparison = a.item_title.localeCompare(b.item_title);
          break;
        case "quantity":
          comparison = a.quantity - b.quantity;
          break;
        case "sales":
          comparison = a.sales_incl_vat - b.sales_incl_vat;
          break;
        case "refund_rate":
          comparison = a.refund_rate - b.refund_rate;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, search, sortColumn, sortDirection]);

  if (!data.length) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Aucune donnée produit disponible pour cette période
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{summary.productCount}</div>
              <div className="text-xs text-muted-foreground">Produits</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{summary.totalQuantity}</div>
              <div className="text-xs text-muted-foreground">Unités vendues</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <Euro className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{formatCurrency(summary.totalSales)}</div>
              <div className="text-xs text-muted-foreground">CA total</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-orange-500" />
              <div className="text-lg font-bold">{formatCurrency(summary.totalRefund)}</div>
              <div className="text-xs text-muted-foreground">Remboursements</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center gap-1">
                  Produit
                  {sortColumn === "title" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("quantity")}
              >
                <div className="flex items-center gap-1 justify-end">
                  Qté
                  {sortColumn === "quantity" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("sales")}
              >
                <div className="flex items-center gap-1 justify-end">
                  CA TTC
                  {sortColumn === "sales" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right">Prix unit.</TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("refund_rate")}
              >
                <div className="flex items-center gap-1 justify-end">
                  Remb.
                  {sortColumn === "refund_rate" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.slice(0, 50).map((item, index) => (
              <TableRow 
                key={item.item_id}
                className={cn(
                  index < 3 && "bg-green-500/5",
                  item.refund_rate > 5 && "bg-orange-500/5"
                )}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {index < 3 && (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">
                        #{index + 1}
                      </Badge>
                    )}
                    <div>
                      <span className="font-medium line-clamp-1">{item.item_title}</span>
                      {item.category && (
                        <span className="text-xs text-muted-foreground block">{item.category}</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency(item.sales_incl_vat)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(item.avg_unit_price)}
                </TableCell>
                <TableCell className="text-right">
                  {item.refund_rate > 0 ? (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px]",
                        item.refund_rate > 5 && "text-orange-600 border-orange-600",
                        item.refund_rate > 10 && "text-red-600 border-red-600"
                      )}
                    >
                      {item.refund_rate.toFixed(1)}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredAndSortedData.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Affichage des 50 premiers produits sur {filteredAndSortedData.length}
        </p>
      )}
    </div>
  );
}
