import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinancesDrilldown, DrilldownGranularity } from "@/hooks/useFinancesDrilldown";
import { Loader2, Calendar, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestaurantDrilldownRowProps {
  restaurantId: string;
  startDate: Date;
  endDate: Date;
  colSpan: number;
}

const formatCurrency = (value: number) =>
  `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

export function RestaurantDrilldownRow({
  restaurantId,
  startDate,
  endDate,
  colSpan,
}: RestaurantDrilldownRowProps) {
  const [activeTab, setActiveTab] = useState<DrilldownGranularity>("daily");

  const { dailyData, hourlyData, productData, isLoading } = useFinancesDrilldown({
    restaurantIds: [restaurantId],
    startDate,
    endDate,
    granularity: activeTab,
    enabled: true,
  });

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

  return (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.map((day, idx) => (
                      <TableRow key={day.date} className={cn(idx % 2 === 0 && "bg-muted/10")}>
                        <TableCell className="text-xs font-medium">{day.label}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{day.order_count}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium">{formatCurrency(day.sales_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-orange-600">{formatCurrency(day.uber_fee_incl_vat || 0)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(day.promo_incl_vat || 0)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(day.refund_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium text-green-600">{formatCurrency(day.net_payout || 0)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Total row */}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell className="text-xs">Total</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {dailyData.reduce((sum, d) => sum + d.order_count, 0)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatCurrency(dailyData.reduce((sum, d) => sum + d.sales_incl_vat, 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-orange-600">
                        {formatCurrency(dailyData.reduce((sum, d) => sum + (d.uber_fee_incl_vat || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(dailyData.reduce((sum, d) => sum + (d.promo_incl_vat || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(dailyData.reduce((sum, d) => sum + d.refund_incl_vat, 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-green-600">
                        {formatCurrency(dailyData.reduce((sum, d) => sum + (d.net_payout || 0), 0))}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hourlyData.map((hour, idx) => (
                      <TableRow key={hour.hour} className={cn(idx % 2 === 0 && "bg-muted/10")}>
                        <TableCell className="text-xs font-medium">{hour.label}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{hour.order_count}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium">{formatCurrency(hour.sales_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-orange-600">{formatCurrency(hour.uber_fee_incl_vat || 0)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(hour.promo_incl_vat || 0)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(hour.refund_incl_vat)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium text-green-600">{formatCurrency(hour.net_payout || 0)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Total row */}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell className="text-xs">Total</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {hourlyData.reduce((sum, d) => sum + d.order_count, 0)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatCurrency(hourlyData.reduce((sum, d) => sum + d.sales_incl_vat, 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-orange-600">
                        {formatCurrency(hourlyData.reduce((sum, d) => sum + (d.uber_fee_incl_vat || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(hourlyData.reduce((sum, d) => sum + (d.promo_incl_vat || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(hourlyData.reduce((sum, d) => sum + d.refund_incl_vat, 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-green-600">
                        {formatCurrency(hourlyData.reduce((sum, d) => sum + (d.net_payout || 0), 0))}
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
  );
}
