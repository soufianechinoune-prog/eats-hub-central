import { CustomerReview } from "@/hooks/useReviews";
import { useReviewsStats } from "@/hooks/useReviewsStats";
import { ReviewsKPICards } from "./ReviewsKPICards";
import { RatingEvolutionChart } from "./RatingEvolutionChart";
import { ReviewVolumeChart } from "./ReviewVolumeChart";
import { TagsAnalysisChart } from "./TagsAnalysisChart";
import { ReviewsHeatmap } from "./ReviewsHeatmap";
import { RatingDistributionChart } from "./RatingDistributionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { format, getDaysInMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface ReviewsOverviewProps {
  reviews: CustomerReview[];
}

export function ReviewsOverview({ reviews }: ReviewsOverviewProps) {
  const [showActions, setShowActions] = useState(true);
  const { selectedRestaurants, periodMode, setPeriodMode, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useAnalyticsContext();
  const { stats, monthlyRatings, ratingDistribution, dayStats, tagStats } = useReviewsStats(reviews);

  // Fetch actions for the selected restaurants
  const { data: actions = [] } = useQuery({
    queryKey: ['restaurant-actions-reviews', selectedRestaurants],
    queryFn: async () => {
      if (!selectedRestaurants.length) return [];
      
      const { data, error } = await supabase
        .from('restaurant_actions')
        .select('id, title, start_date, category')
        .or(selectedRestaurants.map(id => `restaurant_ids.cs.{${id}}`).join(','))
        .order('start_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching actions:', error);
        return [];
      }
      return data || [];
    },
    enabled: selectedRestaurants.length > 0
  });

  // Distribution for legacy chart
  const distribution = reviews.reduce((acc, review) => {
    const rating = Math.round(review.overall_rating);
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {} as { [key: number]: number });

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

  // Daily ratings data for drill-down (when periodMode === "month")
  const dailyRatings = useMemo(() => {
    if (periodMode !== "month" || !selectedMonth || !selectedYear) return [];

    const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1));
    const dayMap = new Map<number, { total: number; count: number }>();

    // Initialize all days
    for (let i = 1; i <= daysInMonth; i++) {
      dayMap.set(i, { total: 0, count: 0 });
    }

    // Aggregate reviews by day
    reviews.forEach(review => {
      const date = new Date(review.review_date);
      if (date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear) {
        const day = date.getDate();
        const existing = dayMap.get(day) || { total: 0, count: 0 };
        dayMap.set(day, {
          total: existing.total + (review.overall_rating || 0),
          count: existing.count + 1
        });
      }
    });

    return Array.from(dayMap.entries())
      .map(([day, data]) => ({
        month: `${day}`,
        rating: data.count > 0 ? data.total / data.count : null,
        count: data.count,
        monthIndex: selectedMonth - 1,
        year: selectedYear
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => parseInt(a.month) - parseInt(b.month));
  }, [reviews, periodMode, selectedMonth, selectedYear]);

  // Chart data based on period mode
  const chartData = periodMode === "month" ? dailyRatings : monthlyRatings;

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
        data={chartData} 
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
      />

      {/* Volume et Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReviewVolumeChart data={ratingDistribution} />
        
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
      </div>

      {/* Heatmap et Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReviewsHeatmap data={dayStats} />
        <TagsAnalysisChart positive={tagStats.positive} negative={tagStats.negative} />
      </div>
    </div>
  );
}
