import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import {
  Users,
  Eye,
  ShoppingCart,
  Package,
  Trophy,
  Medal,
  TrendingUp,
  ArrowRight,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionTabProps {
  dateRange: string; // "1", "7", "30"
}

const MONTHS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

export function ConversionTab({ dateRange }: ConversionTabProps) {
  const navigate = useNavigate();
  const daysAgo = parseInt(dateRange);

  // Fetch conversion data for all restaurants
  const { data: conversionData, isLoading } = useQuery({
    queryKey: ["dashboard-conversion", dateRange],
    queryFn: async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysAgo);

      // Get restaurants
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .eq("is_active", true);

      if (!restaurants) return { restaurants: [], global: null, evolution: [] };

      // Get daily conversion data for the period
      const { data: dailyConversion } = await supabase
        .from("daily_conversion")
        .select("*")
        .gte("date", fromDate.toISOString().split("T")[0]);

      // Aggregate per restaurant
      const restaurantStats = restaurants.map((restaurant) => {
        const restData = dailyConversion?.filter(
          (d) => d.restaurant_id === restaurant.id
        ) || [];

        const totals = restData.reduce(
          (acc, d) => ({
            visits: acc.visits + (d.visits || 0),
            views: acc.views + (d.menu_views || 0),
            cart: acc.cart + (d.add_to_cart || 0),
            orders: acc.orders + (d.orders || 0),
          }),
          { visits: 0, views: 0, cart: 0, orders: 0 }
        );

        const conversionRate = totals.visits > 0 
          ? (totals.orders / totals.visits) * 100 
          : 0;

        return {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          city: restaurant.city,
          ...totals,
          conversionRate,
        };
      });

      // Global totals
      const globalTotals = restaurantStats.reduce(
        (acc, r) => ({
          visits: acc.visits + r.visits,
          views: acc.views + r.views,
          cart: acc.cart + r.cart,
          orders: acc.orders + r.orders,
        }),
        { visits: 0, views: 0, cart: 0, orders: 0 }
      );

      const globalRate = globalTotals.visits > 0 
        ? (globalTotals.orders / globalTotals.visits) * 100 
        : 0;

      // Evolution data (group by date)
      const dateGroups: Record<string, { visits: number; orders: number }> = {};
      dailyConversion?.forEach((d) => {
        if (!dateGroups[d.date]) {
          dateGroups[d.date] = { visits: 0, orders: 0 };
        }
        dateGroups[d.date].visits += d.visits || 0;
        dateGroups[d.date].orders += d.orders || 0;
      });

      const evolution = Object.entries(dateGroups)
        .map(([date, data]) => ({
          date,
          label: new Date(date).toLocaleDateString("fr-FR", { 
            day: "2-digit", 
            month: "short" 
          }),
          conversionRate: data.visits > 0 ? (data.orders / data.visits) * 100 : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        restaurants: restaurantStats,
        global: {
          ...globalTotals,
          conversionRate: globalRate,
        },
        evolution,
      };
    },
  });

  // Sort restaurants by conversion rate
  const rankedRestaurants = useMemo(() => {
    if (!conversionData?.restaurants) return [];
    return [...conversionData.restaurants]
      .filter((r) => r.visits > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 10);
  }, [conversionData?.restaurants]);

  const maxRate = rankedRestaurants[0]?.conversionRate || 1;
  const avgRate = rankedRestaurants.length > 0
    ? rankedRestaurants.reduce((sum, r) => sum + r.conversionRate, 0) / rankedRestaurants.length
    : 0;

  const getMedal = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 text-amber-500" />;
    if (index === 1) return <Medal className="h-4 w-4 text-slate-400" />;
    if (index === 2) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs text-muted-foreground w-4 text-center">{index + 1}</span>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="p-6"><Skeleton className="h-[300px]" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-[300px]" /></CardContent></Card>
        </div>
      </div>
    );
  }

  const global = conversionData?.global;

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Visites
            </div>
            <p className="text-2xl font-bold">
              {global?.visits.toLocaleString("fr-FR") || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              Vues menu
            </div>
            <p className="text-2xl font-bold">
              {global?.views.toLocaleString("fr-FR") || 0}
            </p>
            {global && global.visits > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((global.views / global.visits) * 100).toFixed(1)}% des visites
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShoppingCart className="h-4 w-4" />
              Ajouts panier
            </div>
            <p className="text-2xl font-bold">
              {global?.cart.toLocaleString("fr-FR") || 0}
            </p>
            {global && global.views > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((global.cart / global.views) * 100).toFixed(1)}% des vues
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Percent className="h-4 w-4 text-primary" />
              Taux de conversion
            </div>
            <p className="text-2xl font-bold text-primary">
              {global?.conversionRate.toFixed(2) || 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {global?.orders.toLocaleString("fr-FR")} commandes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Conversion Evolution Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Évolution du taux de conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversionData?.evolution && conversionData.evolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={conversionData.evolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-medium mb-1">{d.label}</p>
                          <p className="text-primary font-bold">
                            {d.conversionRate.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine 
                    y={avgRate} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5"
                    label={{ 
                      value: `Moy: ${avgRate.toFixed(2)}%`, 
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))"
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="conversionRate"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Aucune donnée de conversion disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restaurant Ranking */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-500" />
                Classement par taux de conversion
              </div>
              <Badge variant="secondary" className="font-normal text-xs">
                Top 10
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankedRestaurants.length > 0 ? (
              <>
                {rankedRestaurants.map((restaurant, index) => {
                  const barWidth = maxRate > 0 ? (restaurant.conversionRate / maxRate) * 100 : 0;
                  const isTop3 = index < 3;

                  return (
                    <motion.div
                      key={restaurant.restaurantId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.2 }}
                      className={cn(
                        "flex items-center gap-3 py-1.5 transition-all",
                        isTop3 && "bg-muted/30 -mx-2 px-2 rounded-lg"
                      )}
                    >
                      <div className="w-6 flex justify-center shrink-0">
                        {getMedal(index)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium truncate max-w-[180px] cursor-help">
                                  {restaurant.restaurantName}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <div className="text-xs space-y-1">
                                  <p className="font-semibold">{restaurant.restaurantName}</p>
                                  <p className="text-muted-foreground">{restaurant.city}</p>
                                  <p>Visites: {restaurant.visits.toLocaleString("fr-FR")}</p>
                                  <p>Commandes: {restaurant.orders.toLocaleString("fr-FR")}</p>
                                </div>
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                          <span className="text-sm font-bold tabular-nums text-primary">
                            {restaurant.conversionRate.toFixed(2)}%
                          </span>
                        </div>

                        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ delay: index * 0.05 + 0.1, duration: 0.4, ease: "easeOut" }}
                            className="h-full rounded-full bg-primary"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Average indicator */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Moyenne réseau :</span>
                  <Badge variant="outline" className="font-mono">
                    {avgRate.toFixed(2)}%
                  </Badge>
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Link to detailed analytics */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          onClick={() => navigate("/analytics?tab=conversion")}
          className="gap-2"
        >
          Voir l'analyse détaillée
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
