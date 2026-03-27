import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { RatingsInsightsSection } from "@/components/compare/RatingsInsightsSection";
import { RatingsFullRankingTable } from "@/components/compare/RatingsFullRankingTable";
import { RatingsEvolutionChart } from "@/components/compare/RatingsEvolutionChart";
import { RatingsDistributionBars } from "@/components/compare/RatingsDistributionBars";
import { NetworkViewToggle } from "@/components/compare/NetworkViewToggle";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useRatingsExport } from "@/hooks/useRatingsExport";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";
import type { DateRange } from "react-day-picker";

// Format date as YYYY-MM-DD without UTC conversion to avoid timezone issues
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const RATINGS_STORAGE_KEY = "ratings-comparison-state";

// Load saved state from localStorage (set by Overview or persisted locally)
const getInitialRatingsState = () => {
  try {
    const stored = localStorage.getItem(RATINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const RatingsComparison = () => {
  const navigate = useNavigate();
  const storedState = getInitialRatingsState();
  
  // Map Overview periodMode to local periodMode if needed
  const mapPeriodMode = (mode: string | undefined): OverviewPeriodMode => {
    if (!mode) return "previous_week";
    // Overview uses "month" for custom_month
    if (mode === "month") return "custom_month";
    if (mode === "range") return "custom_range";
    return mode as OverviewPeriodMode;
  };
  
  // Period selector state - initialized from localStorage
  const [periodMode, setPeriodModeLocal] = useState<OverviewPeriodMode>(
    () => storedState ? mapPeriodMode(storedState.periodMode) : "previous_week"
  );
  const [selectedYear, setSelectedYearLocal] = useState(
    () => storedState?.selectedYear || new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonthLocal] = useState(
    () => storedState?.selectedMonth || new Date().getMonth() + 1
  );
  const [customDateRange, setCustomDateRangeLocal] = useState<DateRange | undefined>(() => {
    const range = storedState?.customDateRange;
    if (range?.from && range?.to) {
      return { from: new Date(range.from), to: new Date(range.to) };
    }
    return undefined;
  });
  const [isNetworkView, setIsNetworkViewLocal] = useState(
    () => storedState?.isNetworkView ?? true
  );

  // Persist state to localStorage on every filter change
  const setPeriodMode = (mode: OverviewPeriodMode) => {
    setPeriodModeLocal(mode);
  };
  const setSelectedYear = (year: number) => {
    setSelectedYearLocal(year);
  };
  const setSelectedMonth = (month: number) => {
    setSelectedMonthLocal(month);
  };
  const setCustomDateRange = (range: DateRange | undefined) => {
    setCustomDateRangeLocal(range);
  };
  const setIsNetworkView = (value: boolean) => {
    setIsNetworkViewLocal(value);
  };

  // Persist state to localStorage for back-button support
  useEffect(() => {
    const state = {
      periodMode,
      selectedYear,
      selectedMonth,
      customDateRange: customDateRange ? {
        from: customDateRange.from?.toISOString(),
        to: customDateRange.to?.toISOString(),
      } : undefined,
      isNetworkView,
    };
    localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(state));
  }, [periodMode, selectedYear, selectedMonth, customDateRange, isNetworkView]);
  const { 
    setSelectedRestaurants, 
    setVisibleRestaurants,
    setPeriodMode: setContextPeriodMode, 
    setDateRange: setContextDateRange 
  } = useAnalyticsContext();

  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    
    switch (periodMode) {
      case "previous_week": {
        const lastWeek = subWeeks(now, 1);
        start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      }
      case "7d":
        start = subDays(now, 6);
        end = now;
        break;
      case "30d":
        start = subDays(now, 29);
        end = now;
        break;
      case "current_month":
        start = startOfMonth(now);
        end = now;
        break;
      case "year":
        start = new Date(selectedYear, 0, 1);
        end = new Date(selectedYear, 11, 31);
        break;
      case "custom_month":
        start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
        end = endOfMonth(start);
        break;
      case "custom_range":
        if (customDateRange?.from && customDateRange?.to) {
          start = customDateRange.from;
          end = customDateRange.to;
        } else {
          start = subDays(now, 30);
          end = now;
        }
        break;
      default:
        start = subDays(now, 30);
        end = now;
    }
    
    return { start, end };
  }, [periodMode, selectedYear, selectedMonth, customDateRange]);

  // Fetch pinned restaurants with activity dates
  const { data: pinnedRestaurantsRaw } = usePinnedRestaurants();
  const { data: allActiveRestaurantsRaw } = useActiveRestaurants();

  // Filter restaurants by activity dates for the selected period
  const pinnedRestaurants = useMemo(() => {
    if (!pinnedRestaurantsRaw) return [];
    return filterActiveRestaurants(pinnedRestaurantsRaw, dateRange.start, dateRange.end);
  }, [pinnedRestaurantsRaw, dateRange.start, dateRange.end]);

  const allActiveRestaurants = useMemo(() => {
    if (!allActiveRestaurantsRaw) return [];
    return filterActiveRestaurants(allActiveRestaurantsRaw, dateRange.start, dateRange.end);
  }, [allActiveRestaurantsRaw, dateRange.start, dateRange.end]);

  // Select restaurants based on view mode
  const selectedRestaurants = isNetworkView ? allActiveRestaurants : pinnedRestaurants;

  // Fetch customer reviews with pagination to bypass 1000 row limit
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ["ratings-comparison-network", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, isNetworkView],
    queryFn: async () => {
      if (!selectedRestaurants?.length) return [];
      
      const allReviews: any[] = [];
      const pageSize = 1000;
      
      // Paginate through ALL reviews for the date range
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from("customer_reviews")
          .select("restaurant_id, overall_rating, review_date, platform, tags")
          .gte("review_date", formatDateLocal(dateRange.start))
          .lte("review_date", formatDateLocal(dateRange.end))
          .not("overall_rating", "is", null)
          .order("review_date", { ascending: false })
          .range(offset, offset + pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Filter to only include restaurants we care about
          const restaurantIds = new Set(selectedRestaurants.map(r => r.id));
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
    enabled: !!selectedRestaurants?.length,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!reviewsData?.length || !selectedRestaurants?.length) return [];
    
    const stats = selectedRestaurants.map(restaurant => {
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
  }, [reviewsData, selectedRestaurants]);

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
      star: `${star} étoiles`,
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
              </h1>
              <p className="text-muted-foreground text-sm">
                Analyse de {restaurantStats.length} restaurants | {periodLabel}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <NetworkViewToggle
              isNetworkView={isNetworkView}
              onToggle={setIsNetworkView}
              pinnedCount={pinnedRestaurants?.length || 0}
              networkCount={allActiveRestaurants?.length || 0}
            />
            
            <OverviewPeriodSelector
              periodMode={periodMode}
              onPeriodModeChange={setPeriodMode}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              dateRange={customDateRange}
              onDateRangeChange={setCustomDateRange}
            />
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
              dateRange={dateRange}
            />

            {/* Evolution Chart - Below ranking */}
            {reviewsData && reviewsData.length > 0 && (
              <RatingsEvolutionChart 
                reviews={reviewsData}
                dateRange={dateRange}
              />
            )}

            {/* Rating Distribution - Horizontal Bars */}
            <RatingsDistributionBars data={distributionData} />

          </div>
        )}
      </div>
    </div>
  );
};

export default RatingsComparison;
