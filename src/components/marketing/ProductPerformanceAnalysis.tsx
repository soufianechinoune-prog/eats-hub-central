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
import { Package, TrendingUp } from "lucide-react";
import { OffersCampaign } from "@/hooks/useMarketingCampaigns";
import { useMemo } from "react";

interface ProductPerformanceAnalysisProps {
  offers: OffersCampaign[];
}

export function ProductPerformanceAnalysis({ offers }: ProductPerformanceAnalysisProps) {
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
      .map(([product, data]) => ({ product, ...data }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 15);
  }, [offers]);

  // Chart data
  const chartData = productPerformance.slice(0, 10);

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
                width={180}
                className="text-xs"
                tick={{ fontSize: 10 }}
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
                <TableHead className="w-[250px]">Produit / Article</TableHead>
                <TableHead className="text-center">Campagnes</TableHead>
                <TableHead className="text-right">CA généré</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
                <TableHead className="text-right">Nouveaux clients</TableHead>
                <TableHead className="text-right">Panier moyen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productPerformance.map((item, idx) => (
                <TableRow key={item.product}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-5">
                        {idx + 1}.
                      </span>
                      <span className="truncate max-w-[200px]">{item.product}</span>
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
