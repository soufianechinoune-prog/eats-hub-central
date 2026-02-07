import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RatingDistribution {
  star: string;
  count: number;
}

interface RatingsDistributionBarsProps {
  data: RatingDistribution[];
}

export const RatingsDistributionBars = ({ data }: RatingsDistributionBarsProps) => {
  const totalReviews = data.reduce((sum, d) => sum + d.count, 0);
  
  // Sort data from 5 stars to 1 star
  const sortedData = [...data].sort((a, b) => {
    const starA = parseInt(a.star.replace(' étoiles', ''));
    const starB = parseInt(b.star.replace(' étoiles', ''));
    return starB - starA;
  });

  const maxCount = Math.max(...data.map(d => d.count));

  const getBarColor = (starLabel: string) => {
    if (starLabel.includes('5')) return "bg-amber-400";
    if (starLabel.includes('4')) return "bg-amber-400";
    if (starLabel.includes('3')) return "bg-amber-400";
    if (starLabel.includes('2')) return "bg-amber-400";
    return "bg-amber-400";
  };

  const getStarNumber = (starLabel: string): number => {
    return parseInt(starLabel.replace(' étoiles', ''));
  };

  // Calculate summary stats
  const positiveReviews = data
    .filter(d => getStarNumber(d.star) >= 4)
    .reduce((sum, d) => sum + d.count, 0);
  
  const neutralReviews = data
    .filter(d => getStarNumber(d.star) === 3)
    .reduce((sum, d) => sum + d.count, 0);
  
  const negativeReviews = data
    .filter(d => getStarNumber(d.star) <= 2)
    .reduce((sum, d) => sum + d.count, 0);

  if (totalReviews === 0) {
    return (
      <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Distribution des Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Aucune donnée disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Distribution des Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Horizontal Bars */}
        <div className="space-y-3">
          {sortedData.map((item) => {
            const starNum = getStarNumber(item.star);
            const percentage = totalReviews > 0 ? (item.count / totalReviews) * 100 : 0;
            const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

            return (
              <div key={item.star} className="flex items-center gap-3">
                {/* Star Label */}
                <div className="flex items-center gap-1 w-12 flex-shrink-0">
                  <span className="text-sm font-medium">{starNum}</span>
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </div>

                {/* Bar Container */}
                <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                  <div 
                    className={`h-full rounded-sm transition-all duration-300 ${getBarColor(item.star)}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Count & Percentage */}
                <div className="w-24 text-right flex-shrink-0">
                  <span className="text-sm font-medium">{item.count.toLocaleString('fr-FR')}</span>
                  <span className="text-sm text-muted-foreground ml-1">({percentage.toFixed(0)}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">
              {positiveReviews.toLocaleString('fr-FR')}
            </div>
            <div className="text-xs text-muted-foreground">
              Avis positifs (4-5★)
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {neutralReviews.toLocaleString('fr-FR')}
            </div>
            <div className="text-xs text-muted-foreground">
              Avis neutres (3★)
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">
              {negativeReviews.toLocaleString('fr-FR')}
            </div>
            <div className="text-xs text-muted-foreground">
              Avis négatifs (1-2★)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
