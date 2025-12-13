import { useState, useMemo } from "react";
import { CustomerReview } from "@/hooks/useReviews";
import { CompactReviewRow } from "./CompactReviewRow";
import { TagsBarChart } from "./TagsBarChart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTagLabel, isNegativeTag } from "@/lib/reviewTagLabels";

interface ReviewsCustomerListProps {
  reviews: CustomerReview[];
}

export function ReviewsCustomerList({ reviews }: ReviewsCustomerListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [commentFilter, setCommentFilter] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract all tags for the chart
  const allTags = useMemo(() => {
    return reviews.flatMap((r) => r.tags || []);
  }, [reviews]);

  // Filter reviews
  const filteredReviews = reviews.filter((review) => {
    const matchesSearch =
      searchTerm === "" ||
      review.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.customer_comment?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRating =
      ratingFilter === "all" ||
      Math.round(review.overall_rating) === parseInt(ratingFilter);

    const matchesComment =
      commentFilter === "all" ||
      (commentFilter === "with" && review.customer_comment) ||
      (commentFilter === "without" && !review.customer_comment);

    const matchesTags =
      selectedTags.length === 0 ||
      (review.tags && selectedTags.some((tag) => review.tags?.includes(tag)));

    return matchesSearch && matchesRating && matchesComment && matchesTags;
  });

  const activeFiltersCount = [
    ratingFilter !== "all",
    commentFilter !== "all",
    selectedTags.length > 0,
  ].filter(Boolean).length;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearAllFilters = () => {
    setRatingFilter("all");
    setCommentFilter("all");
    setSelectedTags([]);
    setSearchTerm("");
  };

  return (
    <div className="space-y-4">
      {/* Tags Bar Chart */}
      <TagsBarChart 
        tags={allTags} 
        onTagClick={toggleTag}
        selectedTags={selectedTags}
      />

      {/* Compact Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Rating Filter */}
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Note" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="5">⭐ 5</SelectItem>
            <SelectItem value="4">⭐ 4</SelectItem>
            <SelectItem value="3">⭐ 3</SelectItem>
            <SelectItem value="2">⭐ 2</SelectItem>
            <SelectItem value="1">⭐ 1</SelectItem>
          </SelectContent>
        </Select>

        {/* Comment Filter */}
        <Select value={commentFilter} onValueChange={setCommentFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Commentaire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="with">Avec texte</SelectItem>
            <SelectItem value="without">Sans texte</SelectItem>
          </SelectContent>
        </Select>

        {/* Selected Tags */}
        {selectedTags.map((tag) => {
          const isNegative = isNegativeTag(tag);
          return (
            <Badge
              key={tag}
              variant="secondary"
              className={`text-xs cursor-pointer flex items-center gap-1 h-8 ${
                isNegative
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              }`}
              onClick={() => toggleTag(tag)}
            >
              {isNegative ? <ThumbsDown className="h-3 w-3" /> : <ThumbsUp className="h-3 w-3" />}
              {getTagLabel(tag)}
              <X className="h-3 w-3 ml-0.5" />
            </Badge>
          );
        })}

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-xs">
            Effacer ({activeFiltersCount})
          </Button>
        )}

        {/* Results Count - Right aligned */}
        <div className="ml-auto text-xs text-muted-foreground">
          {filteredReviews.length}/{reviews.length} avis
        </div>
      </div>

      {/* Compact Reviews List */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 py-2 px-3 bg-muted/30 border-b text-xs font-medium text-muted-foreground">
          <span className="w-[72px]">Note</span>
          <span className="w-[70px]">Date</span>
          <span className="w-[50px] text-right">Panier</span>
          <span className="flex-1">Tags</span>
          <span className="w-[20px]"></span>
          <span className="w-[28px]">Plat.</span>
        </div>
        
        <ScrollArea className="h-[500px]">
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review) => (
              <CompactReviewRow
                key={review.id}
                overallRating={review.overall_rating}
                reviewDate={review.review_date}
                orderTotal={review.order_total}
                comment={review.customer_comment}
                tags={review.tags}
                responseStatus={review.response_status}
                platform={review.platform}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucun avis ne correspond aux filtres
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
