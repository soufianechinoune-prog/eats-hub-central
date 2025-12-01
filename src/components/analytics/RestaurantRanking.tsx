import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Euro,
  Users,
  Percent,
  Medal,
  ExternalLink,
  ShoppingCart,
  ShoppingBag,
  Eye,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Restaurant {
  id: string;
  name: string;
  city?: string | null;
}

interface MonthlyRevenue {
  restaurant_id: string;
  month: number;
  revenue_ttc: number;
  order_count: number;
}

interface MonthlyConversion {
  restaurant_id: string;
  month: number;
  visits: number;
  orders: number;
}

interface MonthlyFees {
  restaurant_id: string;
  month: number;
  net_payout: number;
  uber_fee: number;
  marketing_fee: number;
  offers_cost: number;
  ads_cost: number;
}

interface RestaurantRankingProps {
  restaurants: Restaurant[] | undefined;
  revenueData: MonthlyRevenue[] | undefined;
  conversionData: MonthlyConversion[] | undefined;
  feesData: MonthlyFees[] | undefined;
  prevRevenueData?: MonthlyRevenue[] | undefined;
  prevConversionData?: MonthlyConversion[] | undefined;
  prevFeesData?: MonthlyFees[] | undefined;
  startMonth?: number;
  endMonth?: number;
}

interface RankedRestaurant {
  id: string;
  name: string;
  city: string;
  value: number;
  prevValue: number;
  trend: number | null;
  rank: number;
}

type MetricKey = "revenue" | "orders" | "basket" | "conversion" | "visits" | "fees" | "profitability";

interface MetricConfig {
  key: MetricKey;
  title: string;
  icon: React.ElementType;
  colorClass: string;
  formatValue: (v: number) => string;
  inverseTrend?: boolean;
}

const METRICS: MetricConfig[] = [
  { key: "revenue", title: "Chiffre d'affaires", icon: Euro, colorClass: "text-emerald-500", formatValue: (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v) },
  { key: "orders", title: "Commandes", icon: ShoppingCart, colorClass: "text-orange-500", formatValue: (v) => new Intl.NumberFormat("fr-FR").format(Math.round(v)) },
  { key: "basket", title: "Panier moyen", icon: ShoppingBag, colorClass: "text-amber-500", formatValue: (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v) },
  { key: "conversion", title: "Taux de conversion", icon: Users, colorClass: "text-blue-500", formatValue: (v) => `${v.toFixed(1)}%` },
  { key: "visits", title: "Visites", icon: Eye, colorClass: "text-cyan-500", formatValue: (v) => new Intl.NumberFormat("fr-FR").format(Math.round(v)) },
  { key: "fees", title: "Frais totaux", icon: Receipt, colorClass: "text-red-500", formatValue: (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v), inverseTrend: true },
  { key: "profitability", title: "Rentabilité", icon: Percent, colorClass: "text-violet-500", formatValue: (v) => `${v.toFixed(1)}%` },
];

// Calculate trend as percentage change
const calcTrend = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

// Trend indicator component
function TrendIndicator({ trend, inverse = false }: { trend: number | null; inverse?: boolean }) {
  if (trend === null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  
  const isPositive = inverse ? trend < 0 : trend > 0;
  const isNeutral = Math.abs(trend) < 1;
  
  if (isNeutral) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  
  return isPositive ? (
    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  ) : (
    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  );
}

// Medal component for top 3
function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return (
    <span className="w-5 h-5 flex items-center justify-center text-xs font-medium text-muted-foreground">
      {rank}
    </span>
  );
}

// Single ranking card
function RankingCard({
  title,
  icon: Icon,
  data,
  formatValue,
  maxValue,
  colorClass,
  metricKey,
  inverseTrend = false,
}: {
  title: string;
  icon: React.ElementType;
  data: RankedRestaurant[];
  formatValue: (v: number) => string;
  maxValue: number;
  colorClass: string;
  metricKey: MetricKey;
  inverseTrend?: boolean;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const handleCardClick = () => {
    const platform = searchParams.get("platform") || "uber_eats";
    navigate(`/analytics/ranking/${metricKey}?platform=${platform}`);
  };

  return (
    <Card 
      className="flex-1 min-w-[280px] cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", colorClass)} />
            {title}
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune donnée disponible
          </p>
        ) : (
          data.slice(0, 5).map((restaurant, index) => (
            <motion.div
              key={restaurant.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3"
            >
              <RankMedal rank={restaurant.rank} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium truncate max-w-[120px]">
                          {restaurant.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{restaurant.name}</p>
                        {restaurant.city && (
                          <p className="text-xs text-muted-foreground">{restaurant.city}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatValue(restaurant.value)}
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <TrendIndicator trend={restaurant.trend} inverse={inverseTrend} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {restaurant.trend !== null
                              ? `${restaurant.trend > 0 ? "+" : ""}${restaurant.trend.toFixed(1)}% vs N-1`
                              : "Pas de données N-1"}
                          </p>
                          {restaurant.prevValue > 0 && (
                            <p className="text-xs text-muted-foreground">
                              N-1: {formatValue(restaurant.prevValue)}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <Progress
                  value={maxValue > 0 ? (restaurant.value / maxValue) * 100 : 0}
                  className="h-1.5"
                />
              </div>
            </motion.div>
          ))
        )}
        
        {data.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            Cliquer pour voir le classement complet
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RestaurantRanking({
  restaurants,
  revenueData,
  conversionData,
  feesData,
  prevRevenueData,
  prevConversionData,
  prevFeesData,
  startMonth = 1,
  endMonth = 12,
}: RestaurantRankingProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(["revenue", "conversion", "profitability"]);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 150;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 300);
    }
  };

  const toggleMetric = (metric: MetricKey) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        if (prev.length <= 1) return prev; // Keep at least 1
        return prev.filter(m => m !== metric);
      }
      if (prev.length >= 3) {
        // Replace the last one
        return [...prev.slice(0, 2), metric];
      }
      return [...prev, metric];
    });
  };

  // Calculate all rankings
  const rankings = useMemo(() => {
    const result: Record<MetricKey, RankedRestaurant[]> = {
      revenue: [],
      orders: [],
      basket: [],
      conversion: [],
      visits: [],
      fees: [],
      profitability: [],
    };

    if (!restaurants) return result;

    // Revenue ranking
    if (revenueData) {
      const aggregated = new Map<string, { current: number; prev: number }>();
      revenueData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.current += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      prevRevenueData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.prev += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      result.revenue = Array.from(aggregated.entries())
        .map(([id, { current, prev }]) => {
          const restaurant = restaurants.find(r => r.id === id);
          return { id, name: restaurant?.name || "Inconnu", city: restaurant?.city || "", value: current, prevValue: prev, trend: calcTrend(current, prev), rank: 0 };
        })
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Orders ranking
    if (revenueData) {
      const aggregated = new Map<string, { current: number; prev: number }>();
      revenueData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.current += Number(r.order_count) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      prevRevenueData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.prev += Number(r.order_count) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      result.orders = Array.from(aggregated.entries())
        .map(([id, { current, prev }]) => {
          const restaurant = restaurants.find(r => r.id === id);
          return { id, name: restaurant?.name || "Inconnu", city: restaurant?.city || "", value: current, prevValue: prev, trend: calcTrend(current, prev), rank: 0 };
        })
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Basket ranking
    if (revenueData) {
      const aggregated = new Map<string, { currentRevenue: number; currentOrders: number; prevRevenue: number; prevOrders: number }>();
      revenueData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentOrders: 0, prevRevenue: 0, prevOrders: 0 };
        existing.currentRevenue += Number(r.revenue_ttc) || 0;
        existing.currentOrders += Number(r.order_count) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      prevRevenueData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentOrders: 0, prevRevenue: 0, prevOrders: 0 };
        existing.prevRevenue += Number(r.revenue_ttc) || 0;
        existing.prevOrders += Number(r.order_count) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      result.basket = Array.from(aggregated.entries())
        .map(([id, data]) => {
          const restaurant = restaurants.find(r => r.id === id);
          const currentBasket = data.currentOrders > 0 ? data.currentRevenue / data.currentOrders : 0;
          const prevBasket = data.prevOrders > 0 ? data.prevRevenue / data.prevOrders : 0;
          return { id, name: restaurant?.name || "Inconnu", city: restaurant?.city || "", value: currentBasket, prevValue: prevBasket, trend: calcTrend(currentBasket, prevBasket), rank: 0 };
        })
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Conversion ranking
    if (conversionData) {
      const aggregated = new Map<string, { currentVisits: number; currentOrders: number; prevVisits: number; prevOrders: number }>();
      conversionData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentVisits: 0, currentOrders: 0, prevVisits: 0, prevOrders: 0 };
        existing.currentVisits += Number(r.visits) || 0;
        existing.currentOrders += Number(r.orders) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      prevConversionData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentVisits: 0, currentOrders: 0, prevVisits: 0, prevOrders: 0 };
        existing.prevVisits += Number(r.visits) || 0;
        existing.prevOrders += Number(r.orders) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      result.conversion = Array.from(aggregated.entries())
        .map(([id, data]) => {
          const restaurant = restaurants.find(r => r.id === id);
          const currentRate = data.currentVisits > 0 ? (data.currentOrders / data.currentVisits) * 100 : 0;
          const prevRate = data.prevVisits > 0 ? (data.prevOrders / data.prevVisits) * 100 : 0;
          return { id, name: restaurant?.name || "Inconnu", city: restaurant?.city || "", value: currentRate, prevValue: prevRate, trend: calcTrend(currentRate, prevRate), rank: 0 };
        })
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Visits ranking
    if (conversionData) {
      const aggregated = new Map<string, { current: number; prev: number }>();
      conversionData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.current += Number(r.visits) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      prevConversionData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.prev += Number(r.visits) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      result.visits = Array.from(aggregated.entries())
        .map(([id, { current, prev }]) => {
          const restaurant = restaurants.find(r => r.id === id);
          return { id, name: restaurant?.name || "Inconnu", city: restaurant?.city || "", value: current, prevValue: prev, trend: calcTrend(current, prev), rank: 0 };
        })
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Fees ranking
    if (feesData) {
      const aggregated = new Map<string, { current: number; prev: number }>();
      feesData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        const totalFees = (Number(r.uber_fee) || 0) + (Number(r.marketing_fee) || 0) + (Number(r.offers_cost) || 0) + (Number(r.ads_cost) || 0);
        existing.current += totalFees;
        aggregated.set(r.restaurant_id, existing);
      });
      prevFeesData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        const totalFees = (Number((r as any).uber_fee) || 0) + (Number((r as any).marketing_fee) || 0) + (Number((r as any).offers_cost) || 0) + (Number((r as any).ads_cost) || 0);
        existing.prev += totalFees;
        aggregated.set(r.restaurant_id, existing);
      });
      result.fees = Array.from(aggregated.entries())
        .map(([id, { current, prev }]) => {
          const restaurant = restaurants.find(r => r.id === id);
          return { id, name: restaurant?.name || "Inconnu", city: restaurant?.city || "", value: current, prevValue: prev, trend: calcTrend(current, prev), rank: 0 };
        })
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    // Profitability ranking
    if (revenueData && feesData) {
      const aggregated = new Map<string, { currentRevenue: number; currentPayout: number; prevRevenue: number; prevPayout: number }>();
      revenueData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.currentRevenue += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      feesData.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.currentPayout += Number(r.net_payout) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      prevRevenueData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.prevRevenue += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      prevFeesData?.filter(r => r.month >= startMonth && r.month <= endMonth).forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.prevPayout += Number(r.net_payout) || 0;
        aggregated.set(r.restaurant_id, existing);
      });
      result.profitability = Array.from(aggregated.entries())
        .map(([id, data]) => {
          const restaurant = restaurants.find(r => r.id === id);
          const currentProfit = data.currentRevenue > 0 ? (data.currentPayout / data.currentRevenue) * 100 : 0;
          const prevProfit = data.prevRevenue > 0 ? (data.prevPayout / data.prevRevenue) * 100 : 0;
          return { id, name: restaurant?.name || "Inconnu", city: restaurant?.city || "", value: currentProfit, prevValue: prevProfit, trend: calcTrend(currentProfit, prevProfit), rank: 0 };
        })
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    return result;
  }, [restaurants, revenueData, prevRevenueData, conversionData, prevConversionData, feesData, prevFeesData, startMonth, endMonth]);

  const getMaxValue = (metric: MetricKey) => rankings[metric][0]?.value || 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-500" />
          Classement des restaurants
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scrollable badges */}
        <div className="relative">
          {canScrollLeft && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-6 w-6 rounded-full bg-background/90 backdrop-blur-sm shadow-sm"
              onClick={() => scroll("left")}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
          )}
          
          {canScrollRight && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-6 w-6 rounded-full bg-background/90 backdrop-blur-sm shadow-sm"
              onClick={() => scroll("right")}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}

          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card to-transparent z-[5] pointer-events-none" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-[5] pointer-events-none" />
          )}

          <div 
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 scroll-smooth px-1"
            onScroll={checkScroll}
          >
            {METRICS.map((metric) => {
              const Icon = metric.icon;
              const isSelected = selectedMetrics.includes(metric.key);
              return (
                <Badge
                  key={metric.key}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer whitespace-nowrap transition-all hover:scale-105 flex items-center gap-1.5 px-3 py-1.5",
                    isSelected && "ring-2 ring-primary/20"
                  )}
                  onClick={() => toggleMetric(metric.key)}
                >
                  <Icon className={cn("h-3.5 w-3.5", isSelected ? "" : metric.colorClass)} />
                  {metric.title}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Ranking cards - original 3-column layout */}
        <div className="flex flex-wrap gap-4">
          {selectedMetrics.slice(0, 3).map((metricKey) => {
            const metric = METRICS.find(m => m.key === metricKey)!;
            return (
              <RankingCard
                key={metricKey}
                title={metric.title}
                icon={metric.icon}
                data={rankings[metricKey]}
                formatValue={metric.formatValue}
                maxValue={getMaxValue(metricKey)}
                colorClass={metric.colorClass}
                metricKey={metricKey}
                inverseTrend={metric.inverseTrend}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
