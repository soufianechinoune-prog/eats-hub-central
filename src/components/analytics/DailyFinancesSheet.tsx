import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinancesDrilldown, DrilldownGranularity } from "@/hooks/useFinancesDrilldown";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2, Calendar, Clock, ShoppingBag, Euro, TrendingUp, Package } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { HourlyBreakdownChart } from "./HourlyBreakdownChart";
import { ProductPerformanceTable } from "./ProductPerformanceTable";

interface DailyFinancesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantIds?: string[];
  startDate: Date;
  endDate: Date;
  periodLabel: string;
}

export function DailyFinancesSheet({
  open,
  onOpenChange,
  restaurantIds,
  startDate,
  endDate,
  periodLabel,
}: DailyFinancesSheetProps) {
  const [activeTab, setActiveTab] = useState<DrilldownGranularity>("daily");

  const { dailyData, hourlyData, productData, summary, isLoading } = useFinancesDrilldown({
    restaurantIds,
    startDate,
    endDate,
    granularity: activeTab,
    enabled: open,
  });

  const formatCurrency = (value: number) => 
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Détail des ventes
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Badge variant="outline">
              {periodLabel}
            </Badge>
            • {format(startDate, "d MMM", { locale: fr })} - {format(endDate, "d MMM yyyy", { locale: fr })}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DrilldownGranularity)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              Jour
            </TabsTrigger>
            <TabsTrigger value="hourly" className="gap-1.5">
              <Clock className="h-4 w-4" />
              Heure
            </TabsTrigger>
            <TabsTrigger value="product" className="gap-1.5">
              <Package className="h-4 w-4" />
              Produits
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="daily" className="mt-4 space-y-4">
                {/* Summary KPIs */}
                {summary && 'totalOrders' in summary && (
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-muted/30">
                      <CardContent className="p-3 text-center">
                        <Euro className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-lg font-bold">{formatCurrency(summary.totalSales)}</div>
                        <div className="text-xs text-muted-foreground">CA total</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardContent className="p-3 text-center">
                        <ShoppingBag className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-lg font-bold">{summary.totalOrders}</div>
                        <div className="text-xs text-muted-foreground">Commandes</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardContent className="p-3 text-center">
                        <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-lg font-bold">{formatCurrency(summary.avgBasket)}</div>
                        <div className="text-xs text-muted-foreground">Panier moyen</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Daily chart */}
                {dailyData.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          interval={dailyData.length > 14 ? Math.floor(dailyData.length / 7) : 0}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v}€`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [formatCurrency(value), "CA"]}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Bar 
                          dataKey="sales_incl_vat" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                          name="CA TTC"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    Aucune donnée disponible pour cette période
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hourly" className="mt-4">
                <HourlyBreakdownChart 
                  data={hourlyData} 
                  summary={summary && 'peakHour' in summary ? {
                    totalSales: summary.totalSales,
                    totalRefund: summary.totalRefund,
                    totalOrders: summary.totalOrders,
                    avgBasket: summary.avgBasket,
                    peakHour: summary.peakHour,
                    peakHourOrders: summary.peakHourOrders,
                  } : null}
                />
              </TabsContent>

              <TabsContent value="product" className="mt-4">
                <ProductPerformanceTable 
                  data={productData}
                  summary={summary && 'productCount' in summary ? {
                    totalSales: summary.totalSales,
                    totalRefund: summary.totalRefund,
                    totalQuantity: summary.totalQuantity,
                    productCount: summary.productCount,
                    topProduct: summary.topProduct,
                    topProductSales: summary.topProductSales,
                  } : null}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
