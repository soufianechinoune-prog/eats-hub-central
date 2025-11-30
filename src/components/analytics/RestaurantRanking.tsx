import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";

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
}: {
  title: string;
  icon: React.ElementType;
  data: RankedRestaurant[];
  formatValue: (v: number) => string;
  maxValue: number;
  colorClass: string;
}) {
  return (
    <Card className="flex-1 min-w-[280px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={cn("h-4 w-4", colorClass)} />
          {title}
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
                          <TrendIndicator trend={restaurant.trend} />
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
  // Calculate revenue ranking
  const revenueRanking = useMemo(() => {
    if (!restaurants || !revenueData) return [];

    const aggregated = new Map<string, { current: number; prev: number }>();
    
    // Aggregate current year
    revenueData
      .filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.current += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    // Aggregate previous year
    prevRevenueData
      ?.filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { current: 0, prev: 0 };
        existing.prev += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    const ranked: RankedRestaurant[] = Array.from(aggregated.entries())
      .map(([id, { current, prev }]) => {
        const restaurant = restaurants.find(r => r.id === id);
        return {
          id,
          name: restaurant?.name || "Inconnu",
          city: restaurant?.city || "",
          value: current,
          prevValue: prev,
          trend: calcTrend(current, prev),
          rank: 0,
        };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return ranked;
  }, [restaurants, revenueData, prevRevenueData, startMonth, endMonth]);

  // Calculate conversion ranking
  const conversionRanking = useMemo(() => {
    if (!restaurants || !conversionData) return [];

    const aggregated = new Map<string, { currentVisits: number; currentOrders: number; prevVisits: number; prevOrders: number }>();
    
    // Aggregate current year
    conversionData
      .filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentVisits: 0, currentOrders: 0, prevVisits: 0, prevOrders: 0 };
        existing.currentVisits += Number(r.visits) || 0;
        existing.currentOrders += Number(r.orders) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    // Aggregate previous year
    prevConversionData
      ?.filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentVisits: 0, currentOrders: 0, prevVisits: 0, prevOrders: 0 };
        existing.prevVisits += Number(r.visits) || 0;
        existing.prevOrders += Number(r.orders) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    const ranked: RankedRestaurant[] = Array.from(aggregated.entries())
      .map(([id, data]) => {
        const restaurant = restaurants.find(r => r.id === id);
        const currentRate = data.currentVisits > 0 ? (data.currentOrders / data.currentVisits) * 100 : 0;
        const prevRate = data.prevVisits > 0 ? (data.prevOrders / data.prevVisits) * 100 : 0;
        
        return {
          id,
          name: restaurant?.name || "Inconnu",
          city: restaurant?.city || "",
          value: currentRate,
          prevValue: prevRate,
          trend: calcTrend(currentRate, prevRate),
          rank: 0,
        };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return ranked;
  }, [restaurants, conversionData, prevConversionData, startMonth, endMonth]);

  // Calculate profitability ranking
  const profitabilityRanking = useMemo(() => {
    if (!restaurants || !revenueData || !feesData) return [];

    const aggregated = new Map<string, { currentRevenue: number; currentPayout: number; prevRevenue: number; prevPayout: number }>();
    
    // Aggregate current year revenue
    revenueData
      .filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.currentRevenue += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    // Aggregate current year payout
    feesData
      .filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.currentPayout += Number(r.net_payout) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    // Aggregate previous year revenue
    prevRevenueData
      ?.filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.prevRevenue += Number(r.revenue_ttc) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    // Aggregate previous year payout
    prevFeesData
      ?.filter(r => r.month >= startMonth && r.month <= endMonth)
      .forEach(r => {
        const existing = aggregated.get(r.restaurant_id) || { currentRevenue: 0, currentPayout: 0, prevRevenue: 0, prevPayout: 0 };
        existing.prevPayout += Number(r.net_payout) || 0;
        aggregated.set(r.restaurant_id, existing);
      });

    const ranked: RankedRestaurant[] = Array.from(aggregated.entries())
      .map(([id, data]) => {
        const restaurant = restaurants.find(r => r.id === id);
        const currentProfit = data.currentRevenue > 0 ? (data.currentPayout / data.currentRevenue) * 100 : 0;
        const prevProfit = data.prevRevenue > 0 ? (data.prevPayout / data.prevRevenue) * 100 : 0;
        
        return {
          id,
          name: restaurant?.name || "Inconnu",
          city: restaurant?.city || "",
          value: currentProfit,
          prevValue: prevProfit,
          trend: calcTrend(currentProfit, prevProfit),
          rank: 0,
        };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return ranked;
  }, [restaurants, revenueData, feesData, prevRevenueData, prevFeesData, startMonth, endMonth]);

  const maxRevenue = revenueRanking[0]?.value || 0;
  const maxConversion = conversionRanking[0]?.value || 100;
  const maxProfitability = profitabilityRanking[0]?.value || 100;

  const formatCurrency = (v: number) => 
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-500" />
          Classement des restaurants
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <RankingCard
            title="Chiffre d'affaires"
            icon={Euro}
            data={revenueRanking}
            formatValue={formatCurrency}
            maxValue={maxRevenue}
            colorClass="text-emerald-500"
          />
          <RankingCard
            title="Taux de conversion"
            icon={Users}
            data={conversionRanking}
            formatValue={formatPercent}
            maxValue={maxConversion}
            colorClass="text-blue-500"
          />
          <RankingCard
            title="Rentabilité"
            icon={Percent}
            data={profitabilityRanking}
            formatValue={formatPercent}
            maxValue={maxProfitability}
            colorClass="text-violet-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}
