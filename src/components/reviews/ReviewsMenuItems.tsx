import { MenuItemReview } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReviewsMenuItemsProps {
  reviews: MenuItemReview[];
}

export function ReviewsMenuItems({ reviews }: ReviewsMenuItemsProps) {
  // Calculate stats
  const averageRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0;

  // Aggregate by item
  const itemStats = reviews.reduce((acc, review) => {
    const existing = acc.find((item) => item.itemTitle === review.item_title);
    if (existing) {
      existing.totalRating += review.rating;
      existing.count += 1;
      existing.thumbsUp += review.thumb_up;
      existing.thumbsDown += review.thumb_down;
    } else {
      acc.push({
        itemTitle: review.item_title,
        totalRating: review.rating,
        count: 1,
        thumbsUp: review.thumb_up,
        thumbsDown: review.thumb_down,
      });
    }
    return acc;
  }, [] as { itemTitle: string; totalRating: number; count: number; thumbsUp: number; thumbsDown: number }[]);

  // Sort by average rating
  const sortedItems = itemStats
    .map((item) => ({
      ...item,
      averageRating: item.totalRating / item.count,
    }))
    .sort((a, b) => b.averageRating - a.averageRating);

  // Extract tags
  const allTags = reviews.flatMap((r) => r.tags || []);
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const positiveTags = ["Savoureux", "Généreux", "Bien épicé", "Frais", "Parfait"];
  const negativeTags = ["Froid", "Trop salé", "Manque de sauce", "Trop cuit", "Fade"];

  const compliments = positiveTags
    .map((tag) => ({ tag, count: tagCounts[tag] || 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const improvements = negativeTags
    .map((tag) => ({ tag, count: tagCounts[tag] || 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Note Moyenne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{averageRating.toFixed(1)}</div>
            <div className="flex mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(averageRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Plats Évalués</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{sortedItems.length}</div>
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
              {(
                (reviews.reduce((sum, r) => sum + r.thumb_up, 0) /
                  (reviews.reduce((sum, r) => sum + r.thumb_up + r.thumb_down, 0) ||
                    1)) *
                100
              ).toFixed(0)}
              %
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {reviews.reduce((sum, r) => sum + r.thumb_up, 0)} 👍 /{" "}
              {reviews.reduce((sum, r) => sum + r.thumb_down, 0)} 👎
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tags Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Compliments */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-emerald-500" />
              Compliments Reçus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {compliments.length > 0 ? (
                compliments.map(({ tag, count }) => (
                  <Badge
                    key={tag}
                    className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  >
                    {tag} ({count})
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun compliment</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Improvements */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              Points à Améliorer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {improvements.length > 0 ? (
                improvements.map(({ tag, count }) => (
                  <Badge
                    key={tag}
                    className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                  >
                    {tag} ({count})
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun point négatif
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Ranking Table */}
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
        <CardHeader>
          <CardTitle>Classement des Plats</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rang</TableHead>
                <TableHead>Plat</TableHead>
                <TableHead className="text-center">Note Moyenne</TableHead>
                <TableHead className="text-center">Nb. Avis</TableHead>
                <TableHead className="text-center">👍</TableHead>
                <TableHead className="text-center">👎</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, index) => (
                <TableRow key={item.itemTitle}>
                  <TableCell className="font-medium">
                    {index === 0 && "🥇"}
                    {index === 1 && "🥈"}
                    {index === 2 && "🥉"}
                    {index > 2 && index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{item.itemTitle}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold">
                        {item.averageRating.toFixed(1)}
                      </span>
                    </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
