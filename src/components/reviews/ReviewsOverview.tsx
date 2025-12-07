import { CustomerReview } from "@/hooks/useReviews";
import { useReviewsStats } from "@/hooks/useReviewsStats";
import { ReviewsKPICards } from "./ReviewsKPICards";
import { RatingEvolutionChart } from "./RatingEvolutionChart";
import { ReviewVolumeChart } from "./ReviewVolumeChart";
import { TagsAnalysisChart } from "./TagsAnalysisChart";
import { ReviewsHeatmap } from "./ReviewsHeatmap";
import { RatingDistributionChart } from "./RatingDistributionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReviewsOverviewProps {
  reviews: CustomerReview[];
}

export function ReviewsOverview({ reviews }: ReviewsOverviewProps) {
  const { stats, monthlyRatings, ratingDistribution, dayStats, tagStats } = useReviewsStats(reviews);

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
      />

      {/* Évolution de la Note */}
      <RatingEvolutionChart data={monthlyRatings} />

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
