import { Star } from "lucide-react";

interface RatingDistributionChartProps {
  distribution: { [key: number]: number };
  totalReviews: number;
}

export function RatingDistributionChart({ distribution, totalReviews }: RatingDistributionChartProps) {
  const ratings = [5, 4, 3, 2, 1];

  return (
    <div className="space-y-2">
      {ratings.map((rating) => {
        const count = distribution[rating] || 0;
        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

        return (
          <div key={rating} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-12">
              <span className="text-sm font-medium">{rating}</span>
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            </div>
            <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-16 text-right">
              {count} ({percentage.toFixed(0)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}
