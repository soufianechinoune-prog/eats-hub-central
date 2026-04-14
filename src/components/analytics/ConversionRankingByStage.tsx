import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Users,
  Eye,
  ShoppingCart,
  Package,
  Trophy,
  Medal,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface RestaurantConversionData {
  restaurantId: string;
  restaurantName: string;
  visits: number;
  views: number;
  cart: number;
  orders: number;
}

interface ConversionRankingByStageProps {
  data: RestaurantConversionData[];
  className?: string;
  highlightedRestaurants?: string[];
}

type StageKey = "visits" | "views" | "cart" | "orders" | "conversionRate";

const STAGES: { key: StageKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: "visits", label: "Visites", icon: Users, color: "hsl(var(--chart-1))" },
  { key: "views", label: "Vues menu", icon: Eye, color: "hsl(var(--chart-2))" },
  { key: "cart", label: "Paniers", icon: ShoppingCart, color: "hsl(var(--chart-3))" },
  { key: "orders", label: "Commandes", icon: Package, color: "hsl(var(--chart-4))" },
  { key: "conversionRate", label: "Taux conv.", icon: TrendingUp, color: "hsl(var(--primary))" },
];

export function ConversionRankingByStage({
  data,
  className,
  highlightedRestaurants = [],
}: ConversionRankingByStageProps) {
  const [selectedStage, setSelectedStage] = useState<StageKey>("conversionRate");
  const [showAll, setShowAll] = useState(false);

  // Calculate rankings for the selected stage
  const allRankings = useMemo(() => {
    return data
      .map((r) => {
        const conversionRate = r.visits > 0 ? (r.orders / r.visits) * 100 : 0;
        return {
          ...r,
          conversionRate,
          value: selectedStage === "conversionRate" ? conversionRate : r[selectedStage as keyof typeof r] as number,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data, selectedStage]);

  const rankings = showAll ? allRankings : allRankings.slice(0, 10);

  const maxValue = rankings[0]?.value || 1;
  const stageConfig = STAGES.find((s) => s.key === selectedStage)!;
  const StageIcon = stageConfig.icon;

  const formatValue = (value: number) => {
    if (selectedStage === "conversionRate") {
      return `${value.toFixed(2)}%`;
    }
    return value.toLocaleString("fr-FR");
  };

  // Get medal for position
  const getMedal = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 text-amber-500" />;
    if (index === 1) return <Medal className="h-4 w-4 text-slate-400" />;
    if (index === 2) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs text-muted-foreground w-4 text-center">{index + 1}</span>;
  };

  if (data.length < 2) return null;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span>Classement par Étape</span>
          </div>
          <Badge variant="secondary" className="font-normal">
            {data.length} restaurants
          </Badge>
        </CardTitle>

        {/* Stage selector pills */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const isSelected = selectedStage === stage.key;
            return (
              <Button
                key={stage.key}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 gap-1.5 transition-all",
                  isSelected && "shadow-md"
                )}
                style={{
                  backgroundColor: isSelected ? stage.color : undefined,
                  borderColor: isSelected ? stage.color : undefined,
                }}
                onClick={() => setSelectedStage(stage.key)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs">{stage.label}</span>
              </Button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className={cn(showAll && allRankings.length > 10 && "h-[400px]")}>
          <div className="space-y-2">
            {rankings.map((restaurant, index) => {
              const barWidth = maxValue > 0 ? (restaurant.value / maxValue) * 100 : 0;
              const isTop3 = index < 3;
              const isHighlighted = highlightedRestaurants.includes(restaurant.restaurantId);

              return (
                <motion.div
                  key={restaurant.restaurantId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index, 10) * 0.05, duration: 0.2 }}
                  className={cn(
                    "flex items-center gap-3 py-1.5 transition-all",
                    isTop3 && "bg-muted/30 -mx-2 px-2 rounded-lg",
                    isHighlighted && "bg-primary/10 border-l-4 border-primary -mx-2 px-2 rounded-r-lg"
                  )}
                >
                  {/* Rank medal */}
                  <div className="w-6 flex justify-center shrink-0">
                    {getMedal(index)}
                  </div>

                  {/* Restaurant name and bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-medium truncate max-w-[280px] cursor-help">
                              {restaurant.restaurantName}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <div className="text-xs space-y-1">
                              <p className="font-semibold">{restaurant.restaurantName}</p>
                              <p>Visites: {restaurant.visits.toLocaleString("fr-FR")}</p>
                              <p>Vues: {restaurant.views.toLocaleString("fr-FR")}</p>
                              <p>Paniers: {restaurant.cart.toLocaleString("fr-FR")}</p>
                              <p>Commandes: {restaurant.orders.toLocaleString("fr-FR")}</p>
                              <p className="font-medium pt-1 border-t">
                                Taux: {restaurant.conversionRate.toFixed(2)}%
                              </p>
                            </div>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                      <span className="text-sm font-bold tabular-nums" style={{ color: stageConfig.color }}>
                        {formatValue(restaurant.value)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ delay: Math.min(index, 10) * 0.05 + 0.1, duration: 0.4, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${stageConfig.color}, ${stageConfig.color}99)`,
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Toggle show all / reduce */}
        {allRankings.length > 10 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 text-muted-foreground"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Réduire
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Voir les {allRankings.length} restaurants
              </>
            )}
          </Button>
        )}

        {/* Network average indicator */}
        {allRankings.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Moyenne réseau :</span>
            <Badge variant="outline" className="font-mono">
              {formatValue(
                allRankings.reduce((sum, r) => sum + r.value, 0) / allRankings.length
              )}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
