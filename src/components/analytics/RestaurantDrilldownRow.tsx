import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinancesDrilldown, DrilldownGranularity } from "@/hooks/useFinancesDrilldown";
import { Loader2, Calendar, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PayoutDetailSheet } from "./PayoutDetailSheet";

interface RestaurantDrilldownRowProps {
  restaurantId: string;
  restaurantName?: string;
  startDate: Date;
  endDate: Date;
  colSpan: number;
}

const formatCurrency = (value: number) =>
  `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getProfitabilityColor = (profitability: number) => {
  if (profitability >= 60) return "text-green-600";
  if (profitability >= 50) return "text-amber-600";
  return "text-red-600";
};

export function RestaurantDrilldownRow({
  restaurantId,
  restaurantName,
  startDate,
  endDate,
  colSpan,
}: RestaurantDrilldownRowProps) {
  const [activeTab, setActiveTab] = useState<DrilldownGranularity>("daily");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { dailyData, hourlyData, productData, isLoading } = useFinancesDrilldown({
    restaurantIds: [restaurantId],
    startDate,
    endDate,
    granularity: activeTab,
    enabled: true,
  });

  // Fetch payout data for selected date
  const { data: payoutData } = useQuery({
    queryKey: ["payout-detail-drilldown", restaurantId, selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("payout_date", selectedDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDate && sheetOpen,
  });

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setSheetOpen(true);
  };

  const calcProfitability = (totalPayout: number, sales: number) => {
    if (sales === 0) return 0;
    return (totalPayout / sales) * 100;
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-muted/20 py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // Calculate totals for daily data
  const dailyTotals = dailyData.reduce(
    (acc, d) => ({
      order_count: acc.order_count + d.order_count,
      sales_incl_vat: acc.sales_incl_vat + d.sales_incl_vat,
      uber_fee_incl_vat: acc.uber_fee_incl_vat + (d.uber_fee_incl_vat || 0),
      promo_incl_vat: acc.promo_incl_vat + (d.promo_incl_vat || 0),
      refund_incl_vat: acc.refund_incl_vat + d.refund_incl_vat,
      total_payout: acc.total_payout + (d.total_payout || 0),
    }),
    { order_count: 0, sales_incl_vat: 0, uber_fee_incl_vat: 0, promo_incl_vat: 0, refund_incl_vat: 0, total_payout: 0 }
  );

  // Calculate totals for hourly data
  const hourlyTotals = hourlyData.reduce(
    (acc, d) => ({
      order_count: acc.order_count + d.order_count,
      sales_incl_vat: acc.sales_incl_vat + d.sales_incl_vat,
      uber_fee_incl_vat: acc.uber_fee_incl_vat + (d.uber_fee_incl_vat || 0),
      promo_incl_vat: acc.promo_incl_vat + (d.promo_incl_vat || 0),
      refund_incl_vat: acc.refund_incl_vat + d.refund_incl_vat,
      total_payout: acc.total_payout + (d.total_payout || 0),
    }),
    { order_count: 0, sales_incl_vat: 0, uber_fee_incl_vat: 0, promo_incl_vat: 0, refund_incl_vat: 0, total_payout: 0 }
  );

  return (
    <>
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-muted/20 p-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DrilldownGranularity)}>
            <TabsList className="grid w-[300px] grid-cols-3 mb-4">
              <TabsTrigger value="daily" className="gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Jour
              </TabsTrigger>
              <TabsTrigger value="hourly" className="gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" />
                Heure
              </TabsTrigger>
              <TabsTrigger value="product" className="gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5" />
                Produits
              </TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="mt-0">
              {dailyData.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-right text-xs">Cmd</TableHead>
                        <TableHead className="text-right text-xs">CA TTC</TableHead>
                        <TableHead className="text-right text-xs text-orange-600">Commission</TableHead>
                        <TableHead className="text-right text-xs">Promos</TableHead>
                        <TableHead className="text-right text-xs">Remb.</TableHead>
                        <TableHead className="text-right text-xs text-green-600">Versement</TableHead>
                        <TableHead className="text-right text-xs">Rentab.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyData.map((day, idx) => {
                        const profitability = calcProfitability(day.total_payout || 0, day.sales_incl_vat);
                        return (
                          <TableRow 
                            key={day.date} 
                            className={cn(
                              idx % 2 === 0 && "bg-muted/10",
                              "cursor-pointer hover:bg-muted/30 transition-colors"
                            )}
                            onClick={() => handleDayClick(day.date)}
                          >
                            <TableCell className="text-xs font-medium">{day.label}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{day.order_count}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-medium">{formatCurrency(day.sales_incl_vat)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-orange-600">{formatCurrency(day.uber_fee_incl_vat || 0)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(day.promo_incl_vat || 0)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(day.refund_incl_vat)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-medium text-green-600">{formatCurrency(day.net_payout || 0)}</TableCell>
                            <TableCell className={cn("text-right text-xs tabular-nums font-medium", getProfitabilityColor(profitability))}>
                              {formatPercent(profitability)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Total row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell className="text-xs">Total</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{dailyTotals.order_count}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{formatCurrency(dailyTotals.sales_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-orange-600">{formatCurrency(dailyTotals.uber_fee_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(dailyTotals.promo_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(dailyTotals.refund_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-green-600">{formatCurrency(dailyTotals.total_payout)}</TableCell>
                        <TableCell className={cn("text-right text-xs tabular-nums font-medium", getProfitabilityColor(calcProfitability(dailyTotals.total_payout, dailyTotals.sales_incl_vat)))}>
                          {formatPercent(calcProfitability(dailyTotals.total_payout, dailyTotals.sales_incl_vat))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Aucune donnée journalière disponible
                </div>
              )}
            </TabsContent>

            <TabsContent value="hourly" className="mt-0">
              {hourlyData.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Heure</TableHead>
                        <TableHead className="text-right text-xs">Cmd</TableHead>
                        <TableHead className="text-right text-xs">CA TTC</TableHead>
                        <TableHead className="text-right text-xs text-orange-600">Commission</TableHead>
                        <TableHead className="text-right text-xs">Promos</TableHead>
                        <TableHead className="text-right text-xs">Remb.</TableHead>
                        <TableHead className="text-right text-xs text-green-600">Versement</TableHead>
                        <TableHead className="text-right text-xs">Rentab.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hourlyData.map((hour, idx) => {
                        const profitability = calcProfitability(hour.net_payout || 0, hour.sales_incl_vat);
                        return (
                          <TableRow key={hour.hour} className={cn(idx % 2 === 0 && "bg-muted/10")}>
                            <TableCell className="text-xs font-medium">{hour.label}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{hour.order_count}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-medium">{formatCurrency(hour.sales_incl_vat)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-orange-600">{formatCurrency(hour.uber_fee_incl_vat || 0)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(hour.promo_incl_vat || 0)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(hour.refund_incl_vat)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-medium text-green-600">{formatCurrency(hour.net_payout || 0)}</TableCell>
                            <TableCell className={cn("text-right text-xs tabular-nums font-medium", getProfitabilityColor(profitability))}>
                              {formatPercent(profitability)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Total row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell className="text-xs">Total</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{hourlyTotals.order_count}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{formatCurrency(hourlyTotals.sales_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-orange-600">{formatCurrency(hourlyTotals.uber_fee_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(hourlyTotals.promo_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(hourlyTotals.refund_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-green-600">{formatCurrency(hourlyTotals.total_payout)}</TableCell>
                        <TableCell className={cn("text-right text-xs tabular-nums font-medium", getProfitabilityColor(calcProfitability(hourlyTotals.total_payout, hourlyTotals.sales_incl_vat)))}>
                          {formatPercent(calcProfitability(hourlyTotals.total_payout, hourlyTotals.sales_incl_vat))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Aucune donnée horaire disponible
                </div>
              )}
            </TabsContent>

            <TabsContent value="product" className="mt-0">
              {productData.length > 0 ? (
                <div className="rounded-md border overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Produit</TableHead>
                        <TableHead className="text-right text-xs">Qté</TableHead>
                        <TableHead className="text-right text-xs">CA TTC</TableHead>
                        <TableHead className="text-right text-xs">Promos</TableHead>
                        <TableHead className="text-right text-xs">Remb.</TableHead>
                        <TableHead className="text-right text-xs">Taux Remb.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productData.slice(0, 20).map((product, idx) => (
                        <TableRow key={product.item_id} className={cn(idx % 2 === 0 && "bg-muted/10")}>
                          <TableCell className="text-xs">
                            <div className="font-medium truncate max-w-[200px]">{product.item_title}</div>
                            {product.category && (
                              <div className="text-[10px] text-muted-foreground">{product.category}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{product.quantity}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums font-medium">{formatCurrency(product.sales_incl_vat)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(product.promo_incl_vat || 0)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(product.refund_incl_vat)}</TableCell>
                          <TableCell className={cn(
                            "text-right text-xs tabular-nums",
                            product.refund_rate > 5 && "text-red-600 font-medium"
                          )}>
                            {product.refund_rate.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell className="text-xs">
                          Total ({productData.length} produits)
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {productData.reduce((sum, d) => sum + d.quantity, 0)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatCurrency(productData.reduce((sum, d) => sum + d.sales_incl_vat, 0))}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(productData.reduce((sum, d) => sum + (d.promo_incl_vat || 0), 0))}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(productData.reduce((sum, d) => sum + d.refund_incl_vat, 0))}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">-</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Aucune donnée produit disponible
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TableCell>
      </TableRow>

      {/* Payout Detail Sheet */}
      <PayoutDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        payouts={payoutData?.map(p => ({
          ...p,
          restaurant_name: restaurantName,
          sales_incl_vat: p.sales_incl_vat || 0,
          net_payout: p.net_payout || 0,
          uber_fee_after_promo_incl_vat: p.uber_fee_after_promo_incl_vat || 0,
          item_promo_incl_vat: p.item_promo_incl_vat || 0,
          refund_incl_vat: p.refund_incl_vat || 0,
          other_payments_incl_vat: p.other_payments_incl_vat || 0,
          marketing_fee_adjustment: p.marketing_fee_adjustment || 0,
          order_count: p.order_count || 0,
        })) || []}
        restaurants={[{ id: restaurantId, name: restaurantName || "Restaurant" }]}
      />
    </>
  );
}
