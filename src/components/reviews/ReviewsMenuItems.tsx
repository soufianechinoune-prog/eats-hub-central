import { useState, useMemo } from "react";
import { MenuItemReview } from "@/hooks/useReviews";
import { useMenuItemReviewsStats, ITEM_TAG_LABELS } from "@/hooks/useMenuItemReviewsStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ThumbsUp, Package, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

type SortField = "rank" | "name" | "rate" | "count" | "up" | "down";
type SortDirection = "asc" | "desc";

export function ReviewsMenuItems({ reviews }: ReviewsMenuItemsProps) {
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const {
    monthlyApprovalRates,
    tagStats,
    globalThumbsStats,
    productStats,
    dayOfWeekStats,
    topProducts,
    flopProducts
  } = useMenuItemReviewsStats(reviews);

  // Sorted product stats
  const sortedProductStats = useMemo(() => {
    return [...productStats].sort((a, b) => {
      let comparison = 0;
      const aIndex = productStats.indexOf(a);
      const bIndex = productStats.indexOf(b);
      
      switch (sortField) {
        case "rank":
          comparison = aIndex - bIndex;
          break;
        case "name":
          comparison = a.itemTitle.localeCompare(b.itemTitle);
          break;
        case "rate":
          comparison = a.approvalRate - b.approvalRate;
          break;
        case "count":
          comparison = a.count - b.count;
          break;
        case "up":
          comparison = a.thumbsUp - b.thumbsUp;
          break;
        case "down":
          comparison = a.thumbsDown - b.thumbsDown;
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [productStats, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "rank" || field === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  };

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
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("rank")}
                  >
                    <div className="flex items-center gap-1.5">
                      Rang <SortIcon field="rank" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1.5">
                      Plat <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("rate")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      Taux <SortIcon field="rate" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("count")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      Nb. Avis <SortIcon field="count" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("up")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      👍 <SortIcon field="up" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("down")}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      👎 <SortIcon field="down" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProductStats.map((item) => {
                  const originalIndex = productStats.indexOf(item);
                  return (
                    <TableRow key={item.itemId || item.itemTitle}>
                      <TableCell className="font-medium">
                        {originalIndex === 0 && "🥇"}
                        {originalIndex === 1 && "🥈"}
                        {originalIndex === 2 && "🥉"}
                        {originalIndex > 2 && originalIndex + 1}
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
                  );
                })}
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
