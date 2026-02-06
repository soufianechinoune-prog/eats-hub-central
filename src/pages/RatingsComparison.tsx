import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, Star, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { RatingsInsightsSection } from "@/components/compare/RatingsInsightsSection";
import { RatingsFullRankingTable } from "@/components/compare/RatingsFullRankingTable";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useRatingsExport } from "@/hooks/useRatingsExport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type PeriodType = "week" | "month" | "quarter";

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

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    setSearchParams({ period: newPeriod });
  };

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

  // Fetch ALL active restaurants
  const { data: allRestaurants } = useQuery({
    queryKey: ["active-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch customer reviews with pagination to bypass 1000 row limit
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ["ratings-comparison-network", allRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!allRestaurants?.length) return [];
      
      const allReviews: any[] = [];
      const pageSize = 1000;
      
      // Paginate through ALL reviews for the date range
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from("customer_reviews")
          .select("restaurant_id, overall_rating, review_date, platform, tags")
          .gte("review_date", dateRange.start.toISOString())
          .lte("review_date", dateRange.end.toISOString())
          .not("overall_rating", "is", null)
          .order("review_date", { ascending: false })
          .range(offset, offset + pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Filter to only include restaurants we care about
          const restaurantIds = new Set(allRestaurants.map(r => r.id));
          const filteredData = data.filter(r => restaurantIds.has(r.restaurant_id));
          allReviews.push(...filteredData);
          offset += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allReviews;
    },
    enabled: !!allRestaurants?.length,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!reviewsData?.length || !allRestaurants?.length) return [];
    
    const stats = allRestaurants.map(restaurant => {
      const restaurantReviews = reviewsData.filter(r => r.restaurant_id === restaurant.id);
      const totalReviews = restaurantReviews.length;
      const avgRating = totalReviews > 0
        ? restaurantReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / totalReviews
        : 0;
      
      const uberReviews = restaurantReviews.filter(r => r.platform === "uber_eats");
      const deliverooReviews = restaurantReviews.filter(r => r.platform === "deliveroo");
      
      const uberRating = uberReviews.length > 0
        ? uberReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / uberReviews.length
        : null;
      const deliverooRating = deliverooReviews.length > 0
        ? deliverooReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / deliverooReviews.length
        : null;

      const dailyData: Record<string, { sum: number; count: number }> = {};
      restaurantReviews.forEach(r => {
        if (r.review_date) {
          const date = format(parseISO(r.review_date), "yyyy-MM-dd");
          if (!dailyData[date]) dailyData[date] = { sum: 0, count: 0 };
          dailyData[date].sum += r.overall_rating || 0;
          dailyData[date].count += 1;
        }
      });

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
    
    return stats
      .filter(s => s.totalReviews > 0)
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [reviewsData, allRestaurants]);

  // Global KPIs
  const globalStats = useMemo(() => {
    if (!reviewsData?.length) return { avgRating: 0, totalReviews: 0, uberAvg: 0, uberCount: 0, deliverooAvg: 0, deliverooCount: 0 };
    
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
      uberCount: uberReviews.length,
      deliverooAvg: parseFloat(deliverooAvg.toFixed(2)),
      deliverooCount: deliverooReviews.length,
    };
  }, [reviewsData]);

  // Distribution data
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

  // Stats for ranking bars
  const rankingStats = useMemo(() => {
    return restaurantStats.map(s => ({
      id: s.id,
      name: s.name,
      avgRating: s.avgRating,
      totalReviews: s.totalReviews,
    }));
  }, [restaurantStats]);


  // Show Deliveroo card only if there's data
  const showDeliveroo = globalStats.deliverooCount > 0;

  // PDF Export hook
  const { exportToPDF, isExporting } = useRatingsExport();

  // Prepare data for PDF export
  const handleExportPDF = () => {
    const rankedRestaurants = restaurantStats.map((s, idx) => ({
      rank: idx + 1,
      name: s.name,
      avgRating: s.avgRating,
      totalReviews: s.totalReviews,
    }));

    exportToPDF({
      periodLabel,
      globalStats,
      distribution: distributionData,
      restaurants: rankedRestaurants,
    });
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
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Comparaison Notes
                <Badge variant="secondary" className="text-xs font-normal">
                  <Building2 className="h-3 w-3 mr-1" />
                  Vue Réseau
                </Badge>
              </h1>
              <p className="text-muted-foreground text-sm">
                Analyse de {restaurantStats.length} restaurants | {periodLabel}
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
            {/* Global KPIs - Conditional Deliveroo */}
            <div className={`grid gap-4 ${showDeliveroo ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Note moyenne globale</p>
                    <p className="text-3xl font-bold flex items-center gap-2">
                      <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                      {globalStats.avgRating}
                      <span className="text-lg text-muted-foreground">/5</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Total avis</p>
                    <p className="text-3xl font-bold">{globalStats.totalReviews.toLocaleString('fr-FR')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-uber/30 shadow-lg">
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <UberEatsLogo size={16} /> Uber Eats
                    </p>
                    <p className="text-3xl font-bold flex items-center gap-2">
                      {globalStats.uberAvg}
                      <span className="text-lg text-muted-foreground">/5</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{globalStats.uberCount.toLocaleString('fr-FR')} avis</p>
                  </div>
                </CardContent>
              </Card>

              {showDeliveroo && (
                <Card className="backdrop-blur-xl bg-card/80 border-deliveroo/30 shadow-lg">
                  <CardContent className="pt-6">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <DeliverooLogo size={16} /> Deliveroo
                      </p>
                      <p className="text-3xl font-bold flex items-center gap-2">
                        {globalStats.deliverooAvg}
                        <span className="text-lg text-muted-foreground">/5</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{globalStats.deliverooCount.toLocaleString('fr-FR')} avis</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Insights Section */}
            <RatingsInsightsSection 
              stats={rankingStats}
              globalAvg={globalStats.avgRating}
              totalReviews={globalStats.totalReviews}
            />

            {/* Full Ranking Table - Full Width */}
            <RatingsFullRankingTable 
              data={rankingStats}
              onExportPDF={handleExportPDF}
              isExporting={isExporting}
            />

            {/* Rating Distribution - Full Width below */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Distribution des notes</CardTitle>
              </CardHeader>
              <CardContent>
                {distributionData.some(d => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
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
                        formatter={(value: number) => [value.toLocaleString('fr-FR'), 'Avis']}
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
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
};

export default RatingsComparison;
