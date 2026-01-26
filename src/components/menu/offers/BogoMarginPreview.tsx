import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, ArrowRight, TrendingUp, AlertTriangle, CheckCircle2, Package } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  price_uber: number | null;
  food_cost: number | null;
  vat_rate: number | null;
}

interface Restaurant {
  id: string;
  name: string;
}

interface BogoMarginPreviewProps {
  selectedItems: MenuItem[];
  selectedRestaurantIds: string[];
  restaurants: Restaurant[];
  commissionRate: number;
}

interface MarginData {
  item: MenuItem;
  prixTTC: number;
  prixHT: number;
  foodCost: number;
  vatRate: number;
  margeBrute: number;
  margeNette: number;
  foodCostPercent: number;
  margeBruteBogo: number;
  margeNetteBogo: number;
  foodCostPercentBogo: number;
}

export function BogoMarginPreview({
  selectedItems,
  selectedRestaurantIds,
  restaurants,
  commissionRate,
}: BogoMarginPreviewProps) {
  const navigate = useNavigate();

  // Calculate margins for each item
  const marginData = useMemo<MarginData[]>(() => {
    return selectedItems.map((item) => {
      const prixTTC = item.price_uber || 0;
      const vatRate = item.vat_rate ?? 10;
      const foodCost = item.food_cost || 0;

      // Prix HT
      const prixHT = prixTTC / (1 + vatRate / 100);

      // Commission HT (applied on TTC)
      const commissionHT = prixTTC * (commissionRate / 100);

      // Marge Brute % = (Prix HT - Food Cost) / Prix HT
      const margeBrute = prixHT > 0 ? ((prixHT - foodCost) / prixHT) * 100 : 0;

      // Marge Nette % = (Prix HT - Commission HT - Food Cost) / Prix HT
      const margeNette =
        prixHT > 0 ? ((prixHT - commissionHT - foodCost) / prixHT) * 100 : 0;

      // % Food Cost
      const foodCostPercent = prixHT > 0 ? (foodCost / prixHT) * 100 : 0;

      // BOGO Impact: Food Cost x 2
      const foodCostBogo = foodCost * 2;
      const margeBruteBogo =
        prixHT > 0 ? ((prixHT - foodCostBogo) / prixHT) * 100 : 0;
      const margeNetteBogo =
        prixHT > 0 ? ((prixHT - commissionHT - foodCostBogo) / prixHT) * 100 : 0;
      const foodCostPercentBogo = prixHT > 0 ? (foodCostBogo / prixHT) * 100 : 0;

      return {
        item,
        prixTTC,
        prixHT,
        foodCost,
        vatRate,
        margeBrute,
        margeNette,
        foodCostPercent,
        margeBruteBogo,
        margeNetteBogo,
        foodCostPercentBogo,
      };
    });
  }, [selectedItems, commissionRate]);

  // Navigate to marketing analytics with filters
  const handleViewHistory = () => {
    const params = new URLSearchParams();
    params.set("type", "1 acheté = 1 offert");
    params.set("tab", "offers");

    if (selectedRestaurantIds.length === 1) {
      const restaurant = restaurants.find(
        (r) => r.id === selectedRestaurantIds[0]
      );
      if (restaurant) {
        params.set("restaurant", restaurant.name);
      }
    }

    navigate(`/marketing-analytics?${params.toString()}`);
  };

  // Status indicator
  const getStatusIndicator = (value: number, type: "margin" | "foodCost") => {
    if (type === "foodCost") {
      // Food cost: <30% green, 30-35% orange, >35% red
      if (value < 30)
        return (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        );
      if (value <= 35)
        return (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        );
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    // Margin: >40% green, 20-40% orange, <20% red
    if (value > 40)
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (value >= 20)
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  const getValueColor = (value: number, type: "margin" | "foodCost") => {
    if (type === "foodCost") {
      if (value < 30) return "text-emerald-600";
      if (value <= 35) return "text-amber-600";
      return "text-destructive";
    }
    if (value > 40) return "text-emerald-600";
    if (value >= 20) return "text-amber-600";
    return "text-destructive";
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);

  if (selectedItems.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5 text-amber-600" />
          Articles sélectionnés ({selectedItems.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {marginData.map((data) => (
          <div
            key={data.item.id}
            className="bg-background rounded-lg border p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{data.item.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Prix TTC: {formatCurrency(data.prixTTC)} • Food Cost:{" "}
                  {formatCurrency(data.foodCost)} • TVA: {data.vatRate}%
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              {/* Marge Brute */}
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">Marge Brute</p>
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={`text-lg font-bold ${getValueColor(
                      data.margeBrute,
                      "margin"
                    )}`}
                  >
                    {data.margeBrute.toFixed(1)}%
                  </span>
                  {getStatusIndicator(data.margeBrute, "margin")}
                </div>
              </div>

              {/* Marge Nette */}
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Marge Nette ({commissionRate}%)
                </p>
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={`text-lg font-bold ${getValueColor(
                      data.margeNette,
                      "margin"
                    )}`}
                  >
                    {data.margeNette.toFixed(1)}%
                  </span>
                  {getStatusIndicator(data.margeNette, "margin")}
                </div>
              </div>

              {/* % Food Cost */}
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">% Food Cost</p>
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={`text-lg font-bold ${getValueColor(
                      data.foodCostPercent,
                      "foodCost"
                    )}`}
                  >
                    {data.foodCostPercent.toFixed(1)}%
                  </span>
                  {getStatusIndicator(data.foodCostPercent, "foodCost")}
                </div>
              </div>
            </div>

            {/* BOGO Impact */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800">
                    Impact BOGO : Food Cost x2 ({formatCurrency(data.foodCost * 2)})
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      Marge Brute:{" "}
                      <span
                        className={`font-medium ${getValueColor(
                          data.margeBruteBogo,
                          "margin"
                        )}`}
                      >
                        {data.margeBruteBogo.toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      Marge Nette:{" "}
                      <span
                        className={`font-medium ${getValueColor(
                          data.margeNetteBogo,
                          "margin"
                        )}`}
                      >
                        {data.margeNetteBogo.toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      % Food Cost:{" "}
                      <span
                        className={`font-medium ${getValueColor(
                          data.foodCostPercentBogo,
                          "foodCost"
                        )}`}
                      >
                        {data.foodCostPercentBogo.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Button */}
        <Button
          onClick={handleViewHistory}
          className="w-full"
          variant="default"
          size="lg"
        >
          <History className="h-4 w-4 mr-2" />
          Voir l'historique des offres BOGO
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
