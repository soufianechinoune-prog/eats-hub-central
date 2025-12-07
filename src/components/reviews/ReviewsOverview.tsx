import { CustomerReview } from "@/hooks/useReviews";
import { useReviewsStats } from "@/hooks/useReviewsStats";
import { ReviewsKPICards } from "./ReviewsKPICards";
import { RatingEvolutionChart } from "./RatingEvolutionChart";
import { ReviewVolumeChart } from "./ReviewVolumeChart";
import { TagsAnalysisChart } from "./TagsAnalysisChart";
import { ReviewsHeatmap } from "./ReviewsHeatmap";
import { RatingDistributionChart } from "./RatingDistributionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

interface ReviewsOverviewProps {
  reviews: CustomerReview[];
}

export function ReviewsOverview({ reviews }: ReviewsOverviewProps) {
  const [showActions, setShowActions] = useState(true);
  const { selectedRestaurants } = useAnalyticsContext();
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

      {/* Toggle Actions */}
      <div className="flex items-center justify-end gap-2">
        <Switch
          id="show-actions"
          checked={showActions}
          onCheckedChange={setShowActions}
        />
        <Label htmlFor="show-actions" className="text-sm text-muted-foreground cursor-pointer">
          Afficher les actions
        </Label>
      </div>

      {/* Évolution de la Note */}
      <RatingEvolutionChart 
        data={monthlyRatings} 
        actions={actions}
        showActions={showActions}
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
