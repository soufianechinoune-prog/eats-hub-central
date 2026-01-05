import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar, 
  Clock, 
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinancesDrilldown } from "@/hooks/useFinancesDrilldown";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Restaurant {
  id: string;
  name: string;
}

interface OrdersAnalysisSectionProps {
  restaurants: Restaurant[];
  selectedRestaurants: string[];
  startDate: Date;
  endDate: Date;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
};

const formatPercent = (value: number) => {
  return value.toFixed(1) + '%';
};

const getProfitabilityColor = (value: number) => {
  if (value >= 70) return 'text-green-600';
  if (value >= 60) return 'text-amber-600';
  return 'text-red-600';
};

export function OrdersAnalysisSection({ 
  restaurants, 
  selectedRestaurants,
  startDate,
  endDate,
}: OrdersAnalysisSectionProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'hourly' | 'product'>('daily');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    selectedRestaurants.length === 1 ? selectedRestaurants[0] : null
  );
  
  // Payout detail sheet state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  // Determine which restaurant IDs to query
  const queryRestaurantIds = useMemo(() => {
    if (selectedRestaurantId) return [selectedRestaurantId];
    if (selectedRestaurants.length > 0) return selectedRestaurants;
    return restaurants.map(r => r.id);
  }, [selectedRestaurantId, selectedRestaurants, restaurants]);
  
  // Fetch drilldown data
  const { 
    dailyData, 
    hourlyData, 
    productData, 
    isLoading 
  } = useFinancesDrilldown({
    restaurantIds: queryRestaurantIds,
    startDate,
    endDate,
    granularity: activeTab,
    enabled: true,
  });
  
  // Fetch payout detail when a date is selected
  const { data: payoutDetail } = useQuery({
    queryKey: ["payout-detail-orders", selectedRestaurantId, selectedDate],
    queryFn: async () => {
      if (!selectedDate || !selectedRestaurantId) return null;
      
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("restaurant_id", selectedRestaurantId)
        .eq("payout_date", selectedDate)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDate && !!selectedRestaurantId && sheetOpen,
  });
  
  const handleDayClick = (date: string) => {
    if (selectedRestaurantId) {
      setSelectedDate(date);
      setSheetOpen(true);
    }
  };
  
  const getRestaurantName = (id: string) => {
    return restaurants.find(r => r.id === id)?.name || id.slice(0, 8);
  };
  
  // Calculate totals
  const dailyTotals = useMemo(() => {
    if (!dailyData?.length) return null;
    return {
      orders: dailyData.reduce((sum, d) => sum + d.order_count, 0),
      sales: dailyData.reduce((sum, d) => sum + d.sales_incl_vat, 0),
      refunds: dailyData.reduce((sum, d) => sum + d.refund_incl_vat, 0),
      netPayout: dailyData.reduce((sum, d) => sum + d.net_payout, 0),
    };
  }, [dailyData]);
  
  const hourlyTotals = useMemo(() => {
    if (!hourlyData?.length) return null;
    const maxOrders = Math.max(...hourlyData.map(h => h.order_count));
    return {
      orders: hourlyData.reduce((sum, d) => sum + d.order_count, 0),
      sales: hourlyData.reduce((sum, d) => sum + d.sales_incl_vat, 0),
      peakHour: hourlyData.find(h => h.order_count === maxOrders)?.hour ?? null,
    };
  }, [hourlyData]);
  
  const productTotals = useMemo(() => {
    if (!productData?.length) return null;
    return {
      quantity: productData.reduce((sum, d) => sum + d.quantity, 0),
      sales: productData.reduce((sum, d) => sum + d.sales_incl_vat, 0),
    };
  }, [productData]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle>Analyse par Commandes</CardTitle>
            <Badge variant="outline" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Données commandes
            </Badge>
          </div>
          
          {/* Restaurant selector */}
          {(selectedRestaurants.length !== 1) && (
            <Select 
              value={selectedRestaurantId || "all"} 
              onValueChange={(v) => setSelectedRestaurantId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Sélectionner un restaurant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les restaurants</SelectItem>
                {(selectedRestaurants.length > 0 
                  ? restaurants.filter(r => selectedRestaurants.includes(r.id))
                  : restaurants
                ).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        {/* Info banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-4">
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Ces données proviennent des commandes individuelles et peuvent différer 
              des récapitulatifs de versement. Utilisez-les pour analyser les tendances 
              jour/heure/produit, pas pour la comptabilité.
            </span>
          </p>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Par Jour
            </TabsTrigger>
            <TabsTrigger value="hourly" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Par Heure
            </TabsTrigger>
            <TabsTrigger value="product" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Par Produit
            </TabsTrigger>
          </TabsList>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Daily Tab */}
              <TabsContent value="daily" className="mt-0">
                {dailyData && dailyData.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Commandes</TableHead>
                            <TableHead className="text-right">CA TTC</TableHead>
                            <TableHead className="text-right">Panier Ø</TableHead>
                            <TableHead className="text-right">Remb.</TableHead>
                            <TableHead className="text-right">Versement</TableHead>
                            <TableHead className="text-right">Rentab.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dailyData.map((day) => {
                            const profitability = day.sales_incl_vat > 0 
                              ? (day.net_payout / day.sales_incl_vat) * 100 
                              : 0;
                            const isClickable = !!selectedRestaurantId;
                            
                            return (
                              <TableRow 
                                key={day.date}
                                className={cn(
                                  isClickable && "cursor-pointer hover:bg-muted/50"
                                )}
                                onClick={() => isClickable && handleDayClick(day.date)}
                              >
                                <TableCell className="font-medium">
                                  {format(new Date(day.date), "EEEE d MMMM", { locale: fr })}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {day.order_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatCurrency(day.sales_incl_vat)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatCurrency(day.avg_basket)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-red-600">
                                  {day.refund_incl_vat > 0 ? `-${formatCurrency(day.refund_incl_vat)}` : '-'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-green-600 font-medium">
                                  {formatCurrency(day.net_payout)}
                                </TableCell>
                                <TableCell className={cn("text-right tabular-nums font-medium", getProfitabilityColor(profitability))}>
                                  {formatPercent(profitability)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          
                          {/* Totals row */}
                          {dailyTotals && (
                            <TableRow className="bg-muted/50 font-medium border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {dailyTotals.orders}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(dailyTotals.sales)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatCurrency(dailyTotals.orders > 0 ? dailyTotals.sales / dailyTotals.orders : 0)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-red-600">
                                {dailyTotals.refunds > 0 ? `-${formatCurrency(dailyTotals.refunds)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">
                                {formatCurrency(dailyTotals.netPayout)}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right tabular-nums",
                                getProfitabilityColor((dailyTotals.netPayout / dailyTotals.sales) * 100)
                              )}>
                                {formatPercent((dailyTotals.netPayout / dailyTotals.sales) * 100)}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune donnée disponible pour cette période
                  </div>
                )}
              </TabsContent>
              
              {/* Hourly Tab */}
              <TabsContent value="hourly" className="mt-0">
                {hourlyData && hourlyData.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Créneau</TableHead>
                            <TableHead className="text-right">Commandes</TableHead>
                            <TableHead className="text-right">CA TTC</TableHead>
                            <TableHead className="text-right">Panier Ø</TableHead>
                            <TableHead className="text-right">% du total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hourlyData.map((hour) => {
                            const shareOfTotal = hourlyTotals 
                              ? (hour.order_count / hourlyTotals.orders) * 100 
                              : 0;
                            const isPeak = hourlyTotals?.peakHour === hour.hour;
                            
                            return (
                              <TableRow 
                                key={hour.hour}
                                className={cn(isPeak && "bg-green-500/5")}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {`${hour.hour}:00 - ${hour.hour + 1}:00`}
                                    {isPeak && (
                                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        Peak
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {hour.order_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatCurrency(hour.sales_incl_vat)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatCurrency(hour.avg_basket)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary rounded-full"
                                        style={{ width: `${Math.min(shareOfTotal * 3, 100)}%` }}
                                      />
                                    </div>
                                    <span className="w-12 text-right">{formatPercent(shareOfTotal)}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          
                          {/* Totals row */}
                          {hourlyTotals && (
                            <TableRow className="bg-muted/50 font-medium border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {hourlyTotals.orders}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(hourlyTotals.sales)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatCurrency(hourlyTotals.orders > 0 ? hourlyTotals.sales / hourlyTotals.orders : 0)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                100%
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune donnée disponible pour cette période
                  </div>
                )}
              </TabsContent>
              
              {/* Product Tab */}
              <TabsContent value="product" className="mt-0">
                {productData && productData.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead className="text-right">Qté vendue</TableHead>
                            <TableHead className="text-right">CA TTC</TableHead>
                            <TableHead className="text-right">Prix Ø</TableHead>
                            <TableHead className="text-right">Remb.</TableHead>
                            <TableHead className="text-right">Taux remb.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productData.slice(0, 50).map((product, idx) => {
                            const isTopProduct = idx < 3;
                            
                            return (
                              <TableRow 
                                key={product.item_id}
                                className={cn(isTopProduct && "bg-green-500/5")}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isTopProduct && (
                                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">
                                        {idx + 1}
                                      </Badge>
                                    )}
                                    <span className="font-medium truncate max-w-[300px]">
                                      {product.item_title}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {product.quantity}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatCurrency(product.sales_incl_vat)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatCurrency(product.avg_unit_price)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-red-600">
                                  {product.refund_incl_vat > 0 ? `-${formatCurrency(product.refund_incl_vat)}` : '-'}
                                </TableCell>
                                <TableCell className={cn(
                                  "text-right tabular-nums",
                                  product.refund_rate > 5 ? "text-red-600" : "text-muted-foreground"
                                )}>
                                  {product.refund_rate > 0 ? formatPercent(product.refund_rate) : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          
                          {/* Totals row */}
                          {productTotals && (
                            <TableRow className="bg-muted/50 font-medium border-t-2">
                              <TableCell>
                                Total ({productData.length} produits)
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {productTotals.quantity}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(productTotals.sales)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatCurrency(productTotals.quantity > 0 ? productTotals.sales / productTotals.quantity : 0)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                -
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                -
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune donnée disponible pour cette période
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
      
      {/* Payout Detail Sheet */}
      <PayoutDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        payouts={payoutDetail ? [payoutDetail] : []}
        restaurants={restaurants}
      />
    </Card>
  );
}
