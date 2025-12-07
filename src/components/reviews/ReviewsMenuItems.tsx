import { MenuItemReview } from "@/hooks/useReviews";
import { useMenuItemReviewsStats, ITEM_TAG_LABELS } from "@/hooks/useMenuItemReviewsStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ThumbsUp, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TagsAnalysisChart } from "./TagsAnalysisChart";
import { ApprovalRateChart } from "./ApprovalRateChart";
import { ThumbsDistributionChart } from "./ThumbsDistributionChart";
import { TopFlopProductsChart } from "./TopFlopProductsChart";
import { ProductsHeatmap } from "./ProductsHeatmap";

interface ReviewsMenuItemsProps {
  reviews: MenuItemReview[];
}

export function ReviewsMenuItems({ reviews }: ReviewsMenuItemsProps) {
  const {
    monthlyApprovalRates,
    tagStats,
    globalThumbsStats,
    productStats,
    dayOfWeekStats,
    topProducts,
    flopProducts
  } = useMenuItemReviewsStats(reviews);

  // Préparer les tags pour TagsAnalysisChart avec les bons labels
  const positiveTagsForChart = tagStats.positive.map(t => ({
    tag: t.label,
    count: t.count,
    isPositive: true
  }));

  const negativeTagsForChart = tagStats.negative.map(t => ({
    tag: t.label,
    count: t.count,
    isPositive: false
  }));

  return (
    <div className="space-y-6">
      {/* Ligne 1: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Plats Évalués
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{productStats.length}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {reviews.length} avis au total
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-emerald-500" />
              Taux d'Approbation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {globalThumbsStats.approvalRate.toFixed(0)}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {globalThumbsStats.thumbsUp} 👍 / {globalThumbsStats.thumbsDown} 👎
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Tags Collectés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {tagStats.positive.reduce((s, t) => s + t.count, 0) + tagStats.negative.reduce((s, t) => s + t.count, 0)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {tagStats.positive.reduce((s, t) => s + t.count, 0)} positifs / {tagStats.negative.reduce((s, t) => s + t.count, 0)} négatifs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ligne 2: Tags Analysis */}
      <TagsAnalysisChart positive={positiveTagsForChart} negative={negativeTagsForChart} />

      {/* Ligne 3: Évolution + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ApprovalRateChart data={monthlyApprovalRates} />
        </div>
        <ThumbsDistributionChart 
          thumbsUp={globalThumbsStats.thumbsUp}
          thumbsDown={globalThumbsStats.thumbsDown}
          approvalRate={globalThumbsStats.approvalRate}
        />
      </div>

      {/* Ligne 4: Top/Flop produits */}
      <TopFlopProductsChart topProducts={topProducts} flopProducts={flopProducts} />

      {/* Ligne 5: Heatmap par jour */}
      <ProductsHeatmap data={dayOfWeekStats} />

      {/* Ligne 6: Tableau classement */}
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
        <CardHeader>
          <CardTitle>Classement Complet des Plats</CardTitle>
        </CardHeader>
        <CardContent>
          {productStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rang</TableHead>
                  <TableHead>Plat</TableHead>
                  <TableHead className="text-center">Taux</TableHead>
                  <TableHead className="text-center">Nb. Avis</TableHead>
                  <TableHead className="text-center">👍</TableHead>
                  <TableHead className="text-center">👎</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productStats.map((item, index) => (
                  <TableRow key={item.itemId || item.itemTitle}>
                    <TableCell className="font-medium">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                      {index > 2 && index + 1}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {item.itemTitle}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${
                        item.approvalRate >= 80 ? "text-emerald-600" :
                        item.approvalRate >= 60 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {item.approvalRate.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{item.count}</TableCell>
                    <TableCell className="text-center text-emerald-600 font-medium">
                      {item.thumbsUp}
                    </TableCell>
                    <TableCell className="text-center text-red-600 font-medium">
                      {item.thumbsDown}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun plat évalué
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
