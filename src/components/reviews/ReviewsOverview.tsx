import { CustomerReview } from "@/hooks/useReviews";
import { useReviewsStats, DateMode } from "@/hooks/useReviewsStats";
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
import { format, getDaysInMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ActionFormDialog } from "@/components/actions/ActionFormDialog";

interface ReviewsOverviewProps {
  reviews: CustomerReview[];
  allReviewsForRolling?: CustomerReview[];
  dateMode?: DateMode;
}

// Quick period modes that should display daily data
const DAILY_PERIOD_MODES = ["7d", "previous_week", "30d", "current_month", "range", "month"];

export function ReviewsOverview({ reviews, allReviewsForRolling, dateMode = "order" }: ReviewsOverviewProps) {
  const [showActions, setShowActions] = useState(true);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionDialogDate, setActionDialogDate] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();
  const { selectedRestaurants, periodMode, setPeriodMode, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, dateRange } = useAnalyticsContext();
  
  // Helper function to get the appropriate date from a review
  const getReviewDate = (review: CustomerReview): string => {
    if (dateMode === "order" && review.order_date) {
      return review.order_date;
    }
    return review.review_date;
  };
  
  const { stats, monthlyRatings, ratingDistribution, dayStats, tagStats, globalAverageRating, rollingAverageByDate } = useReviewsStats(
    reviews, 
    {
      periodMode: periodMode as "year" | "month",
      selectedMonth,
      selectedYear,
      dateMode
    },
    allReviewsForRolling
  );

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

  // Fetch actions for the selected restaurants
  const { data: actions = [] } = useQuery({
    queryKey: ['restaurant-actions-reviews', selectedRestaurants],
    queryFn: async () => {
      // Fetch all actions
      const { data, error } = await supabase
        .from('restaurant_actions')
        .select('id, title, start_date, category, restaurant_ids')
        .order('start_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching actions:', error);
        return [];
      }
      
      // If restaurants are selected, filter to only those actions
      if (selectedRestaurants.length > 0) {
        return (data || []).filter(action => 
          action.restaurant_ids?.some((id: string) => selectedRestaurants.includes(id))
        );
      }
      
      // If no restaurants selected, return all actions
      return data || [];
    },
  });

  // Distribution filtrée par période
  const distribution = useMemo(() => {
    return ratingDistribution.reduce((acc, item) => {
      acc[item.rating] = item.count;
      return acc;
    }, {} as { [key: number]: number });
  }, [ratingDistribution]);

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

  // Daily ratings data for drill-down (when periodMode === "month" or quick period modes)
  const dailyRatings = useMemo(() => {
    // For month mode, use month-based logic
    if (periodMode === "month" && selectedMonth && selectedYear) {
      const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1));
      const dayMap = new Map<number, { total: number; count: number; dateKey: string }>();

      for (let i = 1; i <= daysInMonth; i++) {
        const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayMap.set(i, { total: 0, count: 0, dateKey });
      }

      reviews.forEach(review => {
        const date = new Date(getReviewDate(review));
        if (date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear) {
          const day = date.getDate();
          const existing = dayMap.get(day);
          if (existing) {
            dayMap.set(day, {
              ...existing,
              total: existing.total + (review.overall_rating || 0),
              count: existing.count + 1
            });
          }
        }
      });
          const existing = dayMap.get(day);
          if (existing) {
            dayMap.set(day, {
              ...existing,
              total: existing.total + (review.overall_rating || 0),
              count: existing.count + 1
            });
          }
        }
      });

      return Array.from(dayMap.entries())
        .map(([day, data]) => ({
          month: `${day}`,
          rating: data.count > 0 ? data.total / data.count : null,
          count: data.count,
          monthIndex: selectedMonth - 1,
          year: selectedYear,
          dateKey: data.dateKey
        }))
        .filter(d => d.count > 0)
        .sort((a, b) => parseInt(a.month) - parseInt(b.month));
    }

    // For quick period modes (7d, previous_week, 30d, current_month, range)
    if (DAILY_PERIOD_MODES.includes(periodMode) && dateRange?.from && dateRange?.to) {
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dayMap = new Map<string, { date: Date; total: number; count: number }>();

      // Initialize all days in the range
      days.forEach(day => {
        const key = format(day, "yyyy-MM-dd");
        dayMap.set(key, { date: day, total: 0, count: 0 });
      });

      // Aggregate reviews by day
      reviews.forEach(review => {
        const reviewDateValue = new Date(getReviewDate(review));
        const key = format(reviewDateValue, "yyyy-MM-dd");
        const existing = dayMap.get(key);
        if (existing) {
          dayMap.set(key, {
            date: existing.date,
            total: existing.total + (review.overall_rating || 0),
            count: existing.count + 1
          });
        }
      });

      return Array.from(dayMap.entries())
        .map(([key, data]) => ({
          month: format(data.date, "d MMM", { locale: fr }),
          rating: data.count > 0 ? data.total / data.count : null,
          count: data.count,
          monthIndex: data.date.getMonth(),
          year: data.date.getFullYear(),
          dateKey: key
        }))
        .filter(d => d.count > 0)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }

    return [];
  }, [reviews, periodMode, selectedMonth, selectedYear, dateRange, dateMode]);

  // Enrich chart data with 90-day rolling average
  const enrichedChartData = useMemo(() => {
    const baseData = showDailyData ? dailyRatings : monthlyRatings;
    
    if (!baseData.length || !rollingAverageByDate.size) return baseData;
    
    // Get all dates from rollingAverageByDate sorted
    const sortedDates = Array.from(rollingAverageByDate.keys()).sort();
    
    // For daily data, we can directly use the dateKey
    if (showDailyData) {
      return baseData.map(point => {
        const dateKey = (point as any).dateKey;
        if (!dateKey) return point;
        
        // Find the rolling average for this date or the closest previous date
        let cumulativeAvg: number | undefined;
        for (let i = sortedDates.length - 1; i >= 0; i--) {
          if (sortedDates[i] <= dateKey) {
            cumulativeAvg = rollingAverageByDate.get(sortedDates[i]);
            break;
          }
        }
        
        return { ...point, cumulativeAvg };
      });
    }
    
    // For monthly data, calculate the rolling average at end of each month
    return baseData.map(point => {
      // Find the last day of this month in the rolling data
      const year = point.year;
      const monthIndex = point.monthIndex;
      const monthEndPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      
      // Find the latest date in this month
      let cumulativeAvg: number | undefined;
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (sortedDates[i].startsWith(monthEndPrefix)) {
          cumulativeAvg = rollingAverageByDate.get(sortedDates[i]);
          break;
        }
        // If we've passed this month, use the last available value before it
        if (sortedDates[i] < monthEndPrefix) {
          cumulativeAvg = rollingAverageByDate.get(sortedDates[i]);
          break;
        }
      }
      
      return { ...point, cumulativeAvg };
    });
  }, [showDailyData, dailyRatings, monthlyRatings, rollingAverageByDate]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Premium */}
      <ReviewsKPICards
        averageRating={stats.averageRating}
        totalReviews={stats.totalReviews}
        tagRate={stats.tagRate}
        commentRate={stats.commentRate}
        ratingVariation={stats.ratingVariation}
        volumeVariation={stats.volumeVariation}
        hasPreviousPeriodData={stats.hasPreviousPeriodData}
      />

      {/* Évolution de la Note */}
      <RatingEvolutionChart 
        data={enrichedChartData} 
        actions={actions}
        showActions={showActions}
        onToggleActions={() => setShowActions(!showActions)}
        periodMode={periodMode as "year" | "month"}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onDrillDown={handleDrillDown}
        onBackToYear={handleBackToYear}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        chartType={chartType}
        onChartTypeChange={setChartType}
        onAddAction={handleAddAction}
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
            totalReviews={stats.totalReviews}
          />
        </CardContent>
      </Card>

      {/* Heatmap et Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReviewsHeatmap data={dayStats} />
        <TagsAnalysisChart positive={tagStats.positive} negative={tagStats.negative} />
      </div>
    </div>
  );
}
