import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductsByTimeSlot, TIME_SLOTS } from "@/hooks/useProductsByTimeSlot";
import { cn } from "@/lib/utils";
import { 
  ShoppingBag, 
  Star, 
  TrendingUp,
  Clock,
  Package
} from "lucide-react";

interface ProductsByTimeSlotAnalysisProps {
  restaurantIds: string[];
  startDate: string;
  endDate: string;
  restaurantNames?: string[];
}

export const ProductsByTimeSlotAnalysis = ({
  restaurantIds,
  startDate,
  endDate,
  restaurantNames = [],
}: ProductsByTimeSlotAnalysisProps) => {
  const { slotData, globalTopProducts, isLoading, totalOrders } = useProductsByTimeSlot(
    restaurantIds,
    startDate,
    endDate,
    3
  );

  if (isLoading) {
    return (
      <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!slotData.length) {
    return (
      <Card className="backdrop-blur-xl bg-muted/30 border-border/50">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucune donnée produit disponible pour cette période</p>
          <p className="text-sm">L'analyse produits × créneaux nécessite l'historique des commandes</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

  const truncateName = (name: string, maxLen: number = 25) =>
    name.length > maxLen ? name.slice(0, maxLen) + "…" : name;

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Top Produits par Créneau Horaire
            <Badge variant="secondary" className="ml-2 text-xs">
              {totalOrders.toLocaleString()} commandes analysées
            </Badge>
          </CardTitle>
          {restaurantNames.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {restaurantNames.length === 1 
                ? `Restaurant : ${restaurantNames[0]}`
                : `${restaurantNames.length} restaurants : ${restaurantNames.slice(0, 3).join(", ")}${restaurantNames.length > 3 ? ` +${restaurantNames.length - 3}` : ""}`
              }
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tableau principal */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-xs font-semibold uppercase w-[120px]">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Créneau
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    Top 1
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase">Top 2</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Top 3</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase">CA Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slotData.map((slot) => (
                <TableRow 
                  key={slot.slotLabel} 
                  className="hover:bg-muted/50 transition-colors border-border/30"
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{slot.slotLabel}</span>
                      <span className="text-xs text-muted-foreground">{slot.slotRange}</span>
                    </div>
                  </TableCell>
                  {[0, 1, 2].map((idx) => {
                    const product = slot.topProducts[idx];
                    if (!product) {
                      return (
                        <TableCell key={idx} className="text-muted-foreground/50">
                          —
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={idx}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {idx === 0 && (
                              <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            )}
                            <span 
                              className={cn(
                                "font-medium truncate",
                                idx === 0 && "text-amber-700 dark:text-amber-400"
                              )}
                              title={product.title}
                            >
                              {truncateName(product.title)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                idx === 0 
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30" 
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {product.percentOfSlot}%
                            </Badge>
                            <span className="text-muted-foreground">
                              {product.quantity} vendus
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    <div className="font-bold">{formatCurrency(slot.totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground">
                      {slot.totalOrders} cmd
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* KPIs insight */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            % = part du CA du créneau
          </span>
          {globalTopProducts[0] && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              <Star className="h-3 w-3 mr-1" />
              Best-seller global : {truncateName(globalTopProducts[0].title, 20)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
