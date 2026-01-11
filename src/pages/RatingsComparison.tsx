import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, Star, TrendingUp, Award, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { cn } from "@/lib/utils";
import { RatingsHeatmapGrid } from "@/components/compare/RatingsHeatmapGrid";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

type PeriodType = "week" | "month" | "quarter";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const RatingsComparison = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriod = (searchParams.get('period') as PeriodType) || 'month';
  const [period, setPeriod] = useState<PeriodType>(initialPeriod);

  const { 
    setSelectedRestaurants, 
    setVisibleRestaurants,
    setPeriodMode, 
    setDateRange: setContextDateRange 
  } = useAnalyticsContext();

  // Sync period changes with URL
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    setSearchParams({ period: newPeriod });
  };

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "week": {
        const lastWeekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        return { start: lastWeekStart, end: lastWeekEnd };
      }
      case "month": {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case "quarter": {
        return { start: subMonths(now, 3), end: now };
      }
      default:
        return { start: subDays(now, 30), end: now };
    }
  }, [period]);

  // Fetch pinned restaurants
  const { data: pinnedRestaurants } = useQuery({
    queryKey: ["pinned-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("is_pinned", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch customer reviews for pinned restaurants
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ["ratings-comparison", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const { data, error } = await supabase
        .from("customer_reviews")
        .select("restaurant_id, overall_rating, review_date, platform")
        .in("restaurant_id", pinnedRestaurants.map(r => r.id))
        .gte("review_date", dateRange.start.toISOString())
        .lte("review_date", dateRange.end.toISOString())
        .not("overall_rating", "is", null);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pinnedRestaurants?.length,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!reviewsData?.length || !pinnedRestaurants?.length) return [];
    
    const stats = pinnedRestaurants.map(restaurant => {
      const restaurantReviews = reviewsData.filter(r => r.restaurant_id === restaurant.id);
      const totalReviews = restaurantReviews.length;
      const avgRating = totalReviews > 0
        ? restaurantReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / totalReviews
        : 0;
      
      // Platform-specific ratings
      const uberReviews = restaurantReviews.filter(r => r.platform === "uber_eats");
      const deliverooReviews = restaurantReviews.filter(r => r.platform === "deliveroo");
      
      const uberRating = uberReviews.length > 0
        ? uberReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / uberReviews.length
        : null;
      const deliverooRating = deliverooReviews.length > 0
        ? deliverooReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / deliverooReviews.length
        : null;

      // Group by date for daily evolution
      const dailyData: Record<string, { sum: number; count: number }> = {};
      restaurantReviews.forEach(r => {
        if (r.review_date) {
          const date = format(parseISO(r.review_date), "yyyy-MM-dd");
          if (!dailyData[date]) dailyData[date] = { sum: 0, count: 0 };
          dailyData[date].sum += r.overall_rating || 0;
          dailyData[date].count += 1;
        }
      });

      // Rating distribution (1-5 stars)
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      restaurantReviews.forEach(r => {
        const rating = Math.round(r.overall_rating || 0);
        if (rating >= 1 && rating <= 5) {
          distribution[rating] += 1;
        }
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        avgRating: parseFloat(avgRating.toFixed(2)),
        totalReviews,
        uberRating: uberRating ? parseFloat(uberRating.toFixed(2)) : null,
        uberReviewCount: uberReviews.length,
        deliverooRating: deliverooRating ? parseFloat(deliverooRating.toFixed(2)) : null,
        deliverooReviewCount: deliverooReviews.length,
        dailyData,
        distribution,
      };
    });
    
    return stats.sort((a, b) => b.avgRating - a.avgRating);
  }, [reviewsData, pinnedRestaurants]);

  // Global KPIs
  const globalStats = useMemo(() => {
    if (!reviewsData?.length) return { avgRating: 0, totalReviews: 0, uberAvg: 0, deliverooAvg: 0 };
    
    const totalReviews = reviewsData.length;
    const avgRating = reviewsData.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / totalReviews;
    
    const uberReviews = reviewsData.filter(r => r.platform === "uber_eats");
    const deliverooReviews = reviewsData.filter(r => r.platform === "deliveroo");
    
    const uberAvg = uberReviews.length > 0
      ? uberReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / uberReviews.length
      : 0;
    const deliverooAvg = deliverooReviews.length > 0
      ? deliverooReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / deliverooReviews.length
      : 0;
    
    return { 
      avgRating: parseFloat(avgRating.toFixed(2)), 
      totalReviews,
      uberAvg: parseFloat(uberAvg.toFixed(2)),
      deliverooAvg: parseFloat(deliverooAvg.toFixed(2)),
    };
  }, [reviewsData]);

  // Prepare evolution chart data
  const evolutionData = useMemo(() => {
    if (!restaurantStats.length) return [];
    
    // Get all unique dates
    const allDates = new Set<string>();
    restaurantStats.forEach(r => {
      Object.keys(r.dailyData).forEach(date => allDates.add(date));
    });
    
    return Array.from(allDates)
      .sort()
      .map(date => {
        const entry: Record<string, string | number> = { 
          date,
          displayDate: format(parseISO(date), "dd/MM", { locale: fr }),
        };
        restaurantStats.forEach(r => {
          const data = r.dailyData[date];
          entry[r.name] = data ? parseFloat((data.sum / data.count).toFixed(2)) : 0;
        });
        return entry;
      });
  }, [restaurantStats]);

  // Prepare platform comparison data
  const platformData = useMemo(() => {
    return restaurantStats.map(r => ({
      name: r.name.length > 15 ? r.name.slice(0, 15) + "..." : r.name,
      "Uber Eats": r.uberRating || 0,
      "Deliveroo": r.deliverooRating || 0,
    }));
  }, [restaurantStats]);

  // Prepare distribution data
  const distributionData = useMemo(() => {
    const aggregated = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    restaurantStats.forEach(r => {
      for (let i = 1; i <= 5; i++) {
        aggregated[i as keyof typeof aggregated] += r.distribution[i] || 0;
      }
    });
    return [1, 2, 3, 4, 5].map(star => ({
      star: `${star} ★`,
      count: aggregated[star as keyof typeof aggregated],
    }));
  }, [restaurantStats]);

  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [dateRange]);

  // Navigate to reviews page with restaurant and period pre-selected
  const handleNavigateToReviews = (restaurantId: string) => {
    // Update context with the selected restaurant
    setVisibleRestaurants([restaurantId]);
    setSelectedRestaurants([restaurantId]);
    
    // Set period mode to range and apply the current date range
    setPeriodMode("range");
    setContextDateRange({ from: dateRange.start, to: dateRange.end });
    
    // Force localStorage update immediately before navigation
    const currentState = localStorage.getItem("analytics-context");
    const state = currentState ? JSON.parse(currentState) : {};
    const updatedState = {
      ...state,
      selectedRestaurants: [restaurantId],
      visibleRestaurants: [restaurantId],
      periodMode: "range",
      dateRange: {
        from: dateRange.start.toISOString(),
        to: dateRange.end.toISOString(),
      },
    };
    localStorage.setItem("analytics-context", JSON.stringify(updatedState));
    
    // Navigate to the reviews page
    navigate("/analytics/reviews");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Comparaison Notes</h1>
              <p className="text-muted-foreground text-sm">
                Analyse comparative des restaurants épinglés
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Calendar className="h-4 w-4" />
              <span>{periodLabel}</span>
            </div>
            <Select value={period} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semaine précédente</SelectItem>
                <SelectItem value="month">Mois précédent</SelectItem>
                <SelectItem value="quarter">3 derniers mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Note moyenne globale</p>
                      <p className="text-3xl font-bold flex items-center gap-2">
                        <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                        {globalStats.avgRating}
                        <span className="text-lg text-muted-foreground">/5</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total avis</p>
                      <p className="text-3xl font-bold">{globalStats.totalReviews}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-uber/30 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <UberEatsLogo size={16} /> Uber Eats
                      </p>
                      <p className="text-3xl font-bold flex items-center gap-2">
                        {globalStats.uberAvg}
                        <span className="text-lg text-muted-foreground">/5</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-deliveroo/30 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <DeliverooLogo size={16} /> Deliveroo
                      </p>
                      <p className="text-3xl font-bold flex items-center gap-2">
                        {globalStats.deliverooAvg}
                        <span className="text-lg text-muted-foreground">/5</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ranking + Evolution */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Full Ranking */}
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Classement par note
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="w-12 text-xs font-semibold uppercase">#</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Note</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Avis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {restaurantStats.map((resto, idx) => (
                        <TableRow 
                          key={resto.id} 
                          className="cursor-pointer hover:bg-muted/50 transition-all duration-300 border-border/30 group"
                          onClick={() => handleNavigateToReviews(resto.id)}
                        >
                          <TableCell className="font-bold">
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-base h-8 w-8 flex items-center justify-center rounded-lg",
                                idx === 0 && "bg-amber-500/20 text-amber-600 border-amber-500/30",
                                idx === 1 && "bg-slate-400/20 text-slate-600 border-slate-400/30",
                                idx === 2 && "bg-orange-600/20 text-orange-600 border-orange-600/30",
                                idx > 2 && "bg-muted text-muted-foreground"
                              )}
                            >
                              {idx + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold group-hover:text-primary transition-colors">
                            {resto.name}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-2 font-bold text-lg">
                              <Star className={cn(
                                "h-4 w-4",
                                resto.avgRating >= 4.5 ? "fill-amber-400 text-amber-400" : 
                                resto.avgRating >= 4 ? "fill-amber-400/70 text-amber-400/70" :
                                "fill-muted text-muted"
                              )} />
                              {resto.avgRating}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {resto.totalReviews}
                          </TableCell>
                        </TableRow>
                      ))}
                      {restaurantStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Aucune donnée disponible
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Heatmap Evolution */}
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Performance par période
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RatingsHeatmapGrid 
                    data={restaurantStats} 
                    dateRange={dateRange} 
                    period={period}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Platform Comparison + Distribution */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Platform Comparison */}
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Comparatif Uber Eats vs Deliveroo</CardTitle>
                </CardHeader>
                <CardContent>
                  {platformData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={platformData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis 
                          type="number" 
                          domain={[0, 5]} 
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={100}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="Uber Eats" fill="hsl(var(--uber))" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Deliveroo" fill="hsl(var(--deliveroo))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      Aucune donnée disponible
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rating Distribution */}
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Distribution des notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {distributionData.some(d => d.count > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={distributionData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis 
                          dataKey="star"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {distributionData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                index === 4 ? "hsl(var(--chart-2))" :
                                index === 3 ? "hsl(var(--chart-3))" :
                                index === 2 ? "hsl(var(--chart-4))" :
                                "hsl(var(--destructive))"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      Aucune donnée disponible
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RatingsComparison;
