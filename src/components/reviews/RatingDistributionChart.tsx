import { Star } from "lucide-react";

interface RatingDistributionChartProps {
  distribution: { [key: number]: number };
  totalReviews: number;
}

export function RatingDistributionChart({ distribution, totalReviews }: RatingDistributionChartProps) {
  const ratings = [5, 4, 3, 2, 1];

  // Calculate stats for footer
  const positiveCount = (distribution[5] || 0) + (distribution[4] || 0);
  const neutralCount = distribution[3] || 0;
  const negativeCount = (distribution[2] || 0) + (distribution[1] || 0);

  return (
    <div className="space-y-4">
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

      {/* Stats rapides */}
      <div className="flex justify-between pt-4 border-t border-border/50">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-500">
            {positiveCount}
          </div>
          <div className="text-xs text-muted-foreground">Avis positifs (4-5★)</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-500">
            {neutralCount}
          </div>
          <div className="text-xs text-muted-foreground">Avis neutres (3★)</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">
            {negativeCount}
          </div>
          <div className="text-xs text-muted-foreground">Avis négatifs (1-2★)</div>
        </div>
      </div>
    </div>
  );
}
