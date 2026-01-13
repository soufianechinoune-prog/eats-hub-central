import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Package, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { OffersCampaign } from "@/hooks/useMarketingCampaigns";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductPerformanceAnalysisProps {
  offers: OffersCampaign[];
}

type SortField = "product" | "campaigns" | "sales" | "orders" | "newCustomers" | "avgBasket";
type SortDirection = "asc" | "desc";

export function ProductPerformanceAnalysis({ offers }: ProductPerformanceAnalysisProps) {
  const [sortField, setSortField] = useState<SortField>("sales");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  // Aggregate by product/items affected
  const productPerformance = useMemo(() => {
    const byProduct: Record<string, {
      campaigns: number;
      sales: number;
      orders: number;
      newCustomers: number;
      avgBasket: number;
    }> = {};

    offers.forEach((offer) => {
      const product = offer.items_affected || offer.title || "Non spécifié";
      
      if (!byProduct[product]) {
        byProduct[product] = { campaigns: 0, sales: 0, orders: 0, newCustomers: 0, avgBasket: 0 };
      }
      
      byProduct[product].campaigns++;
      byProduct[product].sales += offer.generated_sales;
      byProduct[product].orders += offer.orders;
      byProduct[product].newCustomers += offer.new_customers;
    });

    // Calculate average basket
    Object.keys(byProduct).forEach((product) => {
      const data = byProduct[product];
      data.avgBasket = data.orders > 0 ? data.sales / data.orders : 0;
    });

    return Object.entries(byProduct)
      .map(([product, data]) => ({ product, ...data }));
  }, [offers]);

  // Sorted data
  const sortedData = useMemo(() => {
    return [...productPerformance]
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === "product") {
          comparison = a.product.localeCompare(b.product);
        } else {
          comparison = a[sortField] - b[sortField];
        }
        return sortDirection === "desc" ? -comparison : comparison;
      })
      .slice(0, 20);
  }, [productPerformance, sortField, sortDirection]);

  // Chart data (always top 10 by sales)
  const chartData = useMemo(() => {
    return [...productPerformance]
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [productPerformance]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 -ml-3 font-medium hover:bg-muted/50"
        onClick={() => handleSort(field)}
      >
        {children}
        {sortField === field ? (
          sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3" />
          ) : (
            <ArrowUp className="ml-1 h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
        )}
      </Button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top 10 produits en promotion par CA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" className="text-xs" />
              <YAxis
                dataKey="product"
                type="category"
                width={200}
                className="text-xs"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => value.length > 35 ? value.slice(0, 35) + "..." : value}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar
                dataKey="sales"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                name="CA généré"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Full Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Performance détaillée par produit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="product" className="w-[350px]">
                  Produit / Article
                </SortableHeader>
                <SortableHeader field="campaigns" className="text-center">
                  Campagnes
                </SortableHeader>
                <SortableHeader field="sales" className="text-right">
                  CA généré
                </SortableHeader>
                <SortableHeader field="orders" className="text-right">
                  Commandes
                </SortableHeader>
                <SortableHeader field="newCustomers" className="text-right">
                  Nouveaux clients
                </SortableHeader>
                <SortableHeader field="avgBasket" className="text-right">
                  Panier moyen
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((item, idx) => (
                <TableRow key={item.product}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-5 flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate max-w-[300px] cursor-default">{item.product}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[400px]">
                            <p>{item.product}</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{item.campaigns}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">
                    {formatCurrency(item.sales)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.orders.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                    {item.newCustomers.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.avgBasket)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
