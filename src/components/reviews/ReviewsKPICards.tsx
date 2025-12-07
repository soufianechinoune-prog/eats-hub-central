import { Star, FileText, Tag, MessageSquare, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReviewsKPICardsProps {
  averageRating: number;
  totalReviews: number;
  tagRate: number;
  commentRate: number;
  ratingVariation: number;
  volumeVariation: number;
}

export function ReviewsKPICards({
  averageRating,
  totalReviews,
  tagRate,
  commentRate,
  ratingVariation,
  volumeVariation
}: ReviewsKPICardsProps) {
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-emerald-500";
    if (rating >= 3.5) return "text-amber-500";
    return "text-red-500";
  };

  const getVariationIcon = (variation: number) => {
    if (variation > 0) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (variation < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  const formatVariation = (variation: number, isPercent = false) => {
    const sign = variation > 0 ? "+" : "";
    const value = isPercent ? `${sign}${variation.toFixed(0)}%` : `${sign}${variation.toFixed(2)}`;
    return value;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Note Globale */}
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-[1.02] transition-all duration-500 group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <Star className="h-5 w-5 text-amber-400" />
            </div>
            Note Globale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-4xl font-bold", getRatingColor(averageRating))}>
              {averageRating.toFixed(1)}
            </span>
            <span className="text-muted-foreground">/5</span>
          </div>
          <div className="flex mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-5 w-5 transition-all",
                  star <= Math.round(averageRating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
          {ratingVariation !== 0 && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              {getVariationIcon(ratingVariation)}
              <span className={cn(
                ratingVariation > 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {formatVariation(ratingVariation)} vs période précédente
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Avis */}
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-[1.02] transition-all duration-500 group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            Total Avis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{totalReviews.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground mt-1">avis collectés</p>
          {volumeVariation !== 0 && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              {getVariationIcon(volumeVariation)}
              <span className={cn(
                volumeVariation > 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {formatVariation(volumeVariation, true)} vs période précédente
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Taux de Tags */}
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-[1.02] transition-all duration-500 group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
              <Tag className="h-5 w-5 text-purple-500" />
            </div>
            Taux de Tags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{tagRate.toFixed(0)}%</div>
          <p className="text-sm text-muted-foreground mt-1">avis avec tags</p>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(tagRate, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Taux de Commentaires */}
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-[1.02] transition-all duration-500 group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
            </div>
            Taux Commentaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{commentRate.toFixed(0)}%</div>
          <p className="text-sm text-muted-foreground mt-1">avis avec commentaires</p>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(commentRate, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
