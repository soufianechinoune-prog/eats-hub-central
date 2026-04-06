import { CustomerReview, ReviewsOverviewStats } from "@/hooks/useReviews";
import { ReviewsKPICards } from "./ReviewsKPICards";
import { RatingEvolutionChart } from "./RatingEvolutionChart";

import { TagsAnalysisChart } from "./TagsAnalysisChart";
import { ReviewsHeatmap } from "./ReviewsHeatmap";
import { RatingDistributionChart } from "./RatingDistributionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ActionFormDialog } from "@/components/actions/ActionFormDialog";

export type DateMode = "review" | "order";

interface ReviewsOverviewProps {
  reviews?: CustomerReview[];
  allReviewsForRolling?: CustomerReview[];
  dateMode?: DateMode;
  overviewStats?: ReviewsOverviewStats;
}

// Quick period modes that should display daily data
const DAILY_PERIOD_MODES = ["7d", "previous_week", "30d", "current_month", "range", "month"];

export function ReviewsOverview({ reviews = [], allReviewsForRolling, dateMode = "order", overviewStats }: ReviewsOverviewProps) {
  const [showActions, setShowActions] = useState(true);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionDialogDate, setActionDialogDate] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();
  const { selectedRestaurants, periodMode, setPeriodMode, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, dateRange, selectedChainId } = useAnalyticsContext();

  // Determine if we should show daily granularity
  const showDailyData = DAILY_PERIOD_MODES.includes(periodMode);

  // Handle adding action from chart context menu
  const handleAddAction = (date: Date) => {
    setActionDialogDate(date);
    setActionDialogOpen(true);
  };

  const handleActionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['restaurant-actions-reviews'] });
  };

  // Fetch actions for the selected restaurants (filtered by chain)
  const { data: actions = [] } = useQuery({
    queryKey: ['restaurant-actions-reviews', selectedRestaurants, selectedChainId],
    queryFn: async () => {
      // First get restaurant IDs for the active chain
      let chainRestaurantIds: string[] | null = null;
      if (selectedChainId) {
        const { data: chainRestos } = await supabase
          .from('restaurants')
          .select('id')
          .eq('chain_id', selectedChainId);
        chainRestaurantIds = chainRestos?.map(r => r.id) || [];
        if (chainRestaurantIds.length === 0) return [];
      }

      const { data, error } = await supabase
        .from('restaurant_actions')
        .select('id, title, start_date, category, restaurant_ids, restaurant_id')
        .order('start_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching actions:', error);
        return [];
      }
      
      let filtered = data || [];
      
      // Filter by chain restaurants
      if (chainRestaurantIds) {
        filtered = filtered.filter(action => {
          if (action.restaurant_ids?.length) {
            return action.restaurant_ids.some((id: string) => chainRestaurantIds!.includes(id));
          }
          if (action.restaurant_id) {
            return chainRestaurantIds.includes(action.restaurant_id);
          }
          return false;
        });
      }
      
      // Further filter by selected restaurants
      if (selectedRestaurants.length > 0) {
        filtered = filtered.filter(action => {
          if (action.restaurant_ids?.length) {
            return action.restaurant_ids.some((id: string) => selectedRestaurants.includes(id));
          }
          if (action.restaurant_id) {
            return selectedRestaurants.includes(action.restaurant_id);
          }
          return false;
        });
      }
      
      return filtered;
    },
  });

  // Use RPC stats for KPIs — now fully from RPC including variations
  const kpiStats = useMemo(() => {
    if (overviewStats && overviewStats.total_count > 0) {
      const prevPeriod = overviewStats.previous_period;
      const hasPrev = !!(prevPeriod && prevPeriod.total_count > 0);
      const prevAvg = prevPeriod?.avg_rating || 0;
      const prevCount = prevPeriod?.total_count || 0;
      const currentAvg = overviewStats.avg_rating || 0;
      const currentCount = overviewStats.total_count;

      return {
        averageRating: currentAvg,
        totalReviews: currentCount,
        tagRate: overviewStats.tag_rate || 0,
        commentRate: overviewStats.comment_rate || 0,
        ratingVariation: hasPrev ? currentAvg - prevAvg : 0,
        volumeVariation: hasPrev && prevCount > 0 ? ((currentCount - prevCount) / prevCount) * 100 : 0,
        hasPreviousPeriodData: hasPrev,
      };
    }
    return {
      averageRating: 0, totalReviews: 0, tagRate: 0, commentRate: 0,
      ratingVariation: 0, volumeVariation: 0, hasPreviousPeriodData: false,
    };
  }, [overviewStats]);

  // Distribution: use RPC
  const distribution = useMemo(() => {
    if (overviewStats?.rating_distribution) {
      const dist: { [key: number]: number } = {};
      Object.entries(overviewStats.rating_distribution).forEach(([key, val]) => {
        dist[Number(key)] = val;
      });
      return dist;
    }
    return {};
  }, [overviewStats]);

  // Day stats: use RPC
  const effectiveDayStats = useMemo(() => {
    if (overviewStats?.day_stats) {
      const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
      const orderedDays = [1, 2, 3, 4, 5, 6, 0];
      return orderedDays.map(dayIndex => {
        const found = overviewStats.day_stats!.find(d => d.day_index === dayIndex);
        return {
          day: dayNames[dayIndex],
          dayIndex,
          avgRating: found?.avg_rating || 0,
          count: found?.count || 0,
        };
      });
    }
    return [];
  }, [overviewStats]);

  // Tag stats: use RPC
  const effectiveTagStats = useMemo(() => {
    if (overviewStats?.tag_counts) {
      const POSITIVE_TAGS = [
        "restaurant_delicious_options", "restaurant_sustainable_packaging", "restaurant_nicely_presented",
        "restaurant_high-quality_ingredients", "restaurant_perfectly_cooked", "restaurant_fast_casual",
        "restaurant_fresh_ingredients", "restaurant_locally_owned", "restaurant_authentic_dishes", "restaurant_unique_flavors"
      ];
      const NEGATIVE_TAGS = [
        "restaurant_not_tasty", "restaurant_too_slow", "restaurant_poor_packaging",
        "restaurant_unsustainable_packaging", "restaurant_missed_request"
      ];
      const TAG_LABELS: Record<string, string> = {
        "restaurant_delicious_options": "Options délicieuses", "restaurant_sustainable_packaging": "Emballage durable",
        "restaurant_nicely_presented": "Bien présenté", "restaurant_high-quality_ingredients": "Ingrédients de qualité",
        "restaurant_perfectly_cooked": "Parfaitement cuisiné", "restaurant_fast_casual": "Rapide et pratique",
        "restaurant_fresh_ingredients": "Ingrédients frais", "restaurant_locally_owned": "Restaurant local",
        "restaurant_authentic_dishes": "Plats authentiques", "restaurant_unique_flavors": "Saveurs uniques",
        "restaurant_not_tasty": "Pas savoureux", "restaurant_too_slow": "Trop lent",
        "restaurant_poor_packaging": "Mauvais emballage", "restaurant_unsustainable_packaging": "Emballage non écologique",
        "restaurant_missed_request": "Demande non respectée"
      };
      const tagMap = new Map<string, number>();
      overviewStats.tag_counts.forEach(t => tagMap.set(t.tag, t.count));
      const positive = POSITIVE_TAGS.map(tag => ({
        tag: TAG_LABELS[tag] || tag, count: tagMap.get(tag) || 0, isPositive: true
      })).filter(t => t.count > 0).sort((a, b) => b.count - a.count);
      const negative = NEGATIVE_TAGS.map(tag => ({
        tag: TAG_LABELS[tag] || tag, count: tagMap.get(tag) || 0, isPositive: false
      })).filter(t => t.count > 0).sort((a, b) => b.count - a.count);
      return { positive, negative };
    }
    return { positive: [], negative: [] };
  }, [overviewStats]);

  // Drill-down handlers
  const handleDrillDown = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setPeriodMode("month");
  };

  const handleBackToYear = () => {
    setPeriodMode("year");
    setSelectedMonth(undefined);
  };

  const handlePrevMonth = () => {
    if (!selectedMonth || !selectedYear) return;
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (!selectedMonth || !selectedYear) return;
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Build chart data from RPC aggregates
  const showDailyData = DAILY_PERIOD_MODES.includes(periodMode);

  const enrichedChartData = useMemo(() => {
    if (showDailyData && overviewStats?.daily_evolution) {
      return overviewStats.daily_evolution.map(d => ({
        month: format(new Date(d.date), "d MMM", { locale: fr }),
        rating: d.avg_rating,
        count: d.count,
        monthIndex: new Date(d.date).getMonth(),
        year: new Date(d.date).getFullYear(),
        dateKey: d.date,
      }));
    }
    if (!showDailyData && overviewStats?.monthly_evolution) {
      const MONTH_NAMES = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
      return overviewStats.monthly_evolution.map(m => ({
        month: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
        rating: m.avg_rating,
        count: m.count,
        monthIndex: m.month - 1,
        year: m.year,
      }));
    }
    return [];
  }, [showDailyData, overviewStats]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Premium */}
      <ReviewsKPICards
        averageRating={kpiStats.averageRating}
        totalReviews={kpiStats.totalReviews}
        tagRate={kpiStats.tagRate}
        commentRate={kpiStats.commentRate}
        ratingVariation={kpiStats.ratingVariation}
        volumeVariation={kpiStats.volumeVariation}
        hasPreviousPeriodData={kpiStats.hasPreviousPeriodData}
      />

      {/* Évolution de la Note */}
      <RatingEvolutionChart 
        data={enrichedChartData} 
        actions={actions}
        showActions={showActions}
        onToggleActions={() => setShowActions(!showActions)}
        periodMode={periodMode}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onDrillDown={handleDrillDown}
        onBackToYear={handleBackToYear}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        chartType={chartType}
        onChartTypeChange={setChartType}
        onAddAction={handleAddAction}
        previousPeriodAverage={stats.hasPreviousPeriodData ? stats.previousAverageRating : null}
      />

      {/* Action Form Dialog */}
      <ActionFormDialog
        isOpen={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        initialDate={actionDialogDate}
        initialRestaurantIds={selectedRestaurants}
        onSuccess={handleActionSuccess}
      />

      {/* Distribution des Notes */}
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
        <CardHeader>
          <CardTitle>Distribution des Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <RatingDistributionChart
            distribution={distribution}
            totalReviews={kpiStats.totalReviews}
          />
        </CardContent>
      </Card>

      {/* Heatmap et Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReviewsHeatmap data={effectiveDayStats} />
        <TagsAnalysisChart positive={effectiveTagStats.positive} negative={effectiveTagStats.negative} />
      </div>
    </div>
  );
}
