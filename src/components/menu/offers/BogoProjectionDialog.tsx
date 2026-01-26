import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { subDays, startOfYear } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Euro,
  Package,
  Users,
  ArrowRight,
  Sparkles,
  Calculator,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName } from "@/lib/fuzzyMatch";

interface MenuItem {
  id: string;
  name: string;
  price_uber: number | null;
  food_cost: number | null;
  vat_rate: number | null;
}

interface BogoProjectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: MenuItem[];
  selectedRestaurantIds: string[];
  audience: string;
  cofinancingType: "percent" | "amount";
  cofinancingValue: number;
  offerFeeWaived: boolean;
  averageHtPrice: number;
}

type SalesPeriod = "30days" | "90days" | "year" | "all";

const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  "30days": "30 derniers jours",
  "90days": "90 derniers jours",
  "year": "Cette année",
  "all": "Tout l'historique",
};

const OFFER_FEE = 0.89;
const ESTIMATED_VOLUME_INCREASE = 0.30;

const getStartDate = (period: SalesPeriod): string | null => {
  const now = new Date();
  switch (period) {
    case "30days": return subDays(now, 30).toISOString();
    case "90days": return subDays(now, 90).toISOString();
    case "year": return startOfYear(now).toISOString();
    default: return null;
  }
};

const getPeriodDays = (period: SalesPeriod): number => {
  const now = new Date();
  switch (period) {
    case "30days": return 30;
    case "90days": return 90;
    case "year": return Math.ceil((now.getTime() - startOfYear(now).getTime()) / (1000 * 60 * 60 * 24));
    default: return 365; // Fallback for "all"
  }
};

export function BogoProjectionDialog({
  open,
  onOpenChange,
  selectedItems,
  selectedRestaurantIds,
  audience,
  cofinancingType,
  cofinancingValue,
  offerFeeWaived,
  averageHtPrice,
}: BogoProjectionDialogProps) {
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("90days");

  // Fetch historical sales for selected items
  const { data: historicalSales, isLoading } = useQuery({
    queryKey: ["bogo-historical-sales", selectedItems.map((i) => i.id), selectedRestaurantIds, salesPeriod],
    queryFn: async () => {
      if (selectedItems.length === 0) return null;

      const startDate = getStartDate(salesPeriod);

      // Build query with orders -> order_items join
      let query = supabase
        .from("orders")
        .select(`
          order_datetime,
          restaurant_id,
          order_items (
            item_title,
            quantity,
            sales_incl_vat
          )
        `);

      // Filter by date if applicable
      if (startDate) {
        query = query.gte("order_datetime", startDate);
      }

      // Filter by selected restaurants
      if (selectedRestaurantIds.length > 0) {
        query = query.in("restaurant_id", selectedRestaurantIds);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error("Error fetching historical sales:", error);
        return null;
      }

      // Flatten all order items
      const allItems = orders?.flatMap(o => o.order_items || []) || [];

      // Create normalized name map for matching
      const normalizedToItem = new Map<string, MenuItem>();
      selectedItems.forEach(item => {
        normalizedToItem.set(normalizeName(item.name), item);
      });

      // Match and aggregate
      let totalQuantity = 0;
      let totalSales = 0;
      let matchedItemsCount = 0;
      const matchedItemNames = new Set<string>();

      allItems.forEach(row => {
        if (!row.item_title) return;
        
        const normalizedTitle = normalizeName(row.item_title);
        let matched = false;

        // Exact match first
        if (normalizedToItem.has(normalizedTitle)) {
          matched = true;
        } else {
          // Fuzzy match: contains
          for (const [normalized] of normalizedToItem) {
            if (normalizedTitle.includes(normalized) || normalized.includes(normalizedTitle)) {
              matched = true;
              break;
            }
          }
        }

        if (matched) {
          totalQuantity += row.quantity || 0;
          totalSales += row.sales_incl_vat || 0;
          matchedItemNames.add(row.item_title);
        }
      });

      matchedItemsCount = matchedItemNames.size;
      const periodDays = getPeriodDays(salesPeriod);

      return {
        totalQuantity,
        totalSales,
        avgPerDay: totalQuantity / periodDays,
        avgSalesPerDay: totalSales / periodDays,
        matchedItemsCount,
        periodDays,
      };
    },
    enabled: open && selectedItems.length > 0,
  });
  // Calculate costs and projections
  const calculations = useMemo(() => {
    if (!selectedItems.length) return null;

    // Average price calculations
    const avgTtcPrice =
      selectedItems.reduce((sum, item) => sum + (item.price_uber || 0), 0) /
      selectedItems.length;
    const avgFoodCost =
      selectedItems.reduce((sum, item) => sum + (item.food_cost || 0), 0) /
      selectedItems.length;

    // For BOGO: customer pays for 1, gets 2 - so effective price per item = TTC/2
    const effectivePricePerItem = avgTtcPrice; // Customer pays full price for 1 item

    // Cost per BOGO order
    const foodCostBogo = avgFoodCost * 2; // 2 items produced

    // Co-financing from Uber
    const cofinancingPerItem =
      cofinancingType === "percent"
        ? (cofinancingValue / 100) * averageHtPrice
        : cofinancingValue;

    // Offer fee
    const offerFee = offerFeeWaived ? 0 : OFFER_FEE;

    // Net cost of the BOGO offer per order
    // Revenue = 1 item TTC
    // Costs = 2x food cost + offer fee - cofinancing
    const netCostPerOrder = foodCostBogo + offerFee - cofinancingPerItem;
    const revenuePerOrder = avgTtcPrice;

    // Margin with BOGO
    const marginWithBogo = revenuePerOrder - netCostPerOrder;
    const marginPercent = revenuePerOrder > 0 ? (marginWithBogo / revenuePerOrder) * 100 : 0;

    // Normal margin (selling 1 item)
    const normalMargin = avgTtcPrice - avgFoodCost;
    const normalMarginPercent = avgTtcPrice > 0 ? (normalMargin / avgTtcPrice) * 100 : 0;

    // Estimated additional volume
    const currentDailySales = historicalSales?.avgPerDay || 5; // Default assumption
    const estimatedAdditionalOrders = currentDailySales * ESTIMATED_VOLUME_INCREASE * 30;

    // ROI estimation (30 days)
    const additionalRevenue = estimatedAdditionalOrders * revenuePerOrder;
    const additionalCost = estimatedAdditionalOrders * netCostPerOrder;
    const estimatedNetGain = additionalRevenue - additionalCost;

    // Recommendation score
    let recommendation: "go" | "risque" | "stop";
    let recommendationLabel: string;

    if (marginPercent >= 15 && estimatedNetGain > 0) {
      recommendation = "go";
      recommendationLabel = "Offre rentable";
    } else if (marginPercent >= 5 || estimatedNetGain > -50) {
      recommendation = "risque";
      recommendationLabel = "À surveiller";
    } else {
      recommendation = "stop";
      recommendationLabel = "Non recommandé";
    }

    return {
      avgTtcPrice,
      avgFoodCost,
      foodCostBogo,
      cofinancingPerItem,
      offerFee,
      netCostPerOrder,
      revenuePerOrder,
      marginWithBogo,
      marginPercent,
      normalMargin,
      normalMarginPercent,
      estimatedAdditionalOrders,
      additionalRevenue,
      estimatedNetGain,
      recommendation,
      recommendationLabel,
    };
  }, [selectedItems, cofinancingType, cofinancingValue, averageHtPrice, offerFeeWaived, historicalSales]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  const formatPercent = (value: number) =>
    value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";

  if (!calculations) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            Projection financière BOGO
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Recommendation Badge */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex justify-center"
          >
            <Badge
              variant="outline"
              className={`px-6 py-3 text-lg font-semibold ${
                calculations.recommendation === "go"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                  : calculations.recommendation === "risque"
                  ? "border-amber-500 bg-amber-500/10 text-amber-600"
                  : "border-destructive bg-destructive/10 text-destructive"
              }`}
            >
              {calculations.recommendation === "go" && <CheckCircle2 className="h-5 w-5 mr-2" />}
              {calculations.recommendation === "risque" && <AlertTriangle className="h-5 w-5 mr-2" />}
              {calculations.recommendation === "stop" && <XCircle className="h-5 w-5 mr-2" />}
              {calculations.recommendationLabel}
            </Badge>
          </motion.div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Marge / commande BOGO</p>
                <p className={`text-2xl font-bold ${calculations.marginWithBogo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {formatCurrency(calculations.marginWithBogo)}
                </p>
                <p className="text-xs text-muted-foreground">
                  soit {formatPercent(calculations.marginPercent)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Gain estimé (30j)</p>
                <p className={`text-2xl font-bold ${calculations.estimatedNetGain >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {calculations.estimatedNetGain >= 0 ? "+" : ""}{formatCurrency(calculations.estimatedNetGain)}
                </p>
                <p className="text-xs text-muted-foreground">
                  +{Math.round(calculations.estimatedAdditionalOrders)} commandes
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">vs Marge normale</p>
                {calculations.marginPercent < calculations.normalMarginPercent ? (
                  <div className="flex items-center justify-center gap-1 text-destructive">
                    <TrendingDown className="h-5 w-5" />
                    <span className="text-2xl font-bold">
                      -{formatPercent(calculations.normalMarginPercent - calculations.marginPercent)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1 text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-2xl font-bold">+{formatPercent(calculations.marginPercent - calculations.normalMarginPercent)}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Normale: {formatPercent(calculations.normalMarginPercent)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Cost Breakdown */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              Décomposition des coûts par commande BOGO
            </h3>

            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Prix TTC (1 article vendu)</span>
                <span className="font-medium text-emerald-600">+{formatCurrency(calculations.revenuePerOrder)}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center text-destructive">
                <span className="text-sm">Food Cost (2 articles produits)</span>
                <span className="font-medium">-{formatCurrency(calculations.foodCostBogo)}</span>
              </div>

              {calculations.offerFee > 0 && (
                <div className="flex justify-between items-center text-destructive">
                  <span className="text-sm">Frais d'offre</span>
                  <span className="font-medium">-{formatCurrency(calculations.offerFee)}</span>
                </div>
              )}

              {calculations.cofinancingPerItem > 0 && (
                <div className="flex justify-between items-center text-emerald-600">
                  <span className="text-sm">Cofinancement Uber</span>
                  <span className="font-medium">+{formatCurrency(calculations.cofinancingPerItem)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center font-semibold">
                <span>Marge nette BOGO</span>
                <span className={calculations.marginWithBogo >= 0 ? "text-emerald-600" : "text-destructive"}>
                  {formatCurrency(calculations.marginWithBogo)}
                </span>
              </div>
            </div>
          </div>

          {/* Historical Sales Context */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Historique de ventes
              </h3>
              <Select value={salesPeriod} onValueChange={(v) => setSalesPeriod(v as SalesPeriod)}>
                <SelectTrigger className="w-[180px] h-8">
                  <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SALES_PERIOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
              </div>
            ) : historicalSales && historicalSales.totalQuantity > 0 ? (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Quantité vendue</p>
                      <p className="text-xl font-bold">{historicalSales.totalQuantity} unités</p>
                      <p className="text-xs text-muted-foreground">
                        ~{historicalSales.avgPerDay.toFixed(1)} / jour
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CA généré</p>
                      <p className="text-xl font-bold">{formatCurrency(historicalSales.totalSales)}</p>
                      <p className="text-xs text-muted-foreground">
                        ~{formatCurrency(historicalSales.avgSalesPerDay)} / jour
                      </p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs text-muted-foreground">
                    Basé sur {selectedRestaurantIds.length > 0 
                      ? `${selectedRestaurantIds.length} restaurant(s)` 
                      : "tous les restaurants"} 
                    {" "}• {historicalSales.matchedItemsCount} article(s) matchés • {historicalSales.periodDays} jours
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-600">Pas d'historique de ventes</p>
                      <p className="text-sm text-muted-foreground">
                        Aucune vente trouvée pour ces articles sur la période sélectionnée. 
                        Essayez d'élargir la période ou vérifiez que les données de commandes sont importées.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Audience Impact */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Impact audience
            </h3>
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {audience === "all" && "Tous les clients"}
                      {audience === "new" && "Nouveaux clients uniquement"}
                      {audience === "returning" && "Clients fidèles"}
                      {audience === "inactive" && "Clients inactifs"}
                      {audience === "uberOne" && "Membres Uber One"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {audience === "new" && "Coût d'acquisition plus élevé, mais potentiel de fidélisation"}
                      {audience === "returning" && "Meilleur ROI, clients déjà conquis"}
                      {audience === "inactive" && "Réactivation à coût modéré"}
                      {audience === "uberOne" && "Volume élevé, clients premium"}
                      {audience === "all" && "Volume maximal, ciblage large"}
                    </p>
                  </div>
                  <Sparkles className="h-8 w-8 text-primary/30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Items Summary */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {selectedItems.length} article{selectedItems.length > 1 ? "s" : ""} sélectionné{selectedItems.length > 1 ? "s" : ""}
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedItems.slice(0, 5).map((item) => (
                <Badge key={item.id} variant="secondary" className="text-xs">
                  {item.name}
                </Badge>
              ))}
              {selectedItems.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{selectedItems.length - 5} autres
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Modifier la simulation
            </Button>
            <Button
              onClick={() => {
                // Could navigate to Marketing Analytics or close
                onOpenChange(false);
              }}
              className="gap-2"
            >
              Compris
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
