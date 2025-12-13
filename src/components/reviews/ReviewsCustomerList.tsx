import { useState, useMemo } from "react";
import { CustomerReview } from "@/hooks/useReviews";
import { ReviewCard } from "./ReviewCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Filter, Tag, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTagLabel, isNegativeTag } from "@/lib/reviewTagLabels";

interface ReviewsCustomerListProps {
  reviews: CustomerReview[];
}

export function ReviewsCustomerList({ reviews }: ReviewsCustomerListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [responseFilter, setResponseFilter] = useState<string>("all");
  const [commentFilter, setCommentFilter] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract all unique tags with counts
  const tagStats = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    reviews.forEach((review) => {
      if (review.tags) {
        review.tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    // Sort by count descending
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count, label: getTagLabel(tag), isNegative: isNegativeTag(tag) }))
      .sort((a, b) => b.count - a.count);
  }, [reviews]);

  // Filter reviews
  const filteredReviews = reviews.filter((review) => {
    const matchesSearch =
      searchTerm === "" ||
      review.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.customer_comment?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRating =
      ratingFilter === "all" ||
      Math.round(review.overall_rating) === parseInt(ratingFilter);

    const matchesResponse =
      responseFilter === "all" ||
      (responseFilter === "pending" && review.response_status === "pending") ||
      (responseFilter === "replied" && review.response_status === "replied") ||
      (responseFilter === "none" && !review.response_status);

    const matchesComment =
      commentFilter === "all" ||
      (commentFilter === "with" && review.customer_comment) ||
      (commentFilter === "without" && !review.customer_comment);

    const matchesTags =
      selectedTags.length === 0 ||
      (review.tags && selectedTags.some((tag) => review.tags?.includes(tag)));

    return matchesSearch && matchesRating && matchesResponse && matchesComment && matchesTags;
  });

  const activeFiltersCount = [
    ratingFilter !== "all",
    responseFilter !== "all",
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
    setResponseFilter("all");
    setCommentFilter("all");
    setSelectedTags([]);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par client ou commentaire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Rating Filter */}
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Note" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les notes</SelectItem>
            <SelectItem value="5">5 étoiles</SelectItem>
            <SelectItem value="4">4 étoiles</SelectItem>
            <SelectItem value="3">3 étoiles</SelectItem>
            <SelectItem value="2">2 étoiles</SelectItem>
            <SelectItem value="1">1 étoile</SelectItem>
          </SelectContent>
        </Select>

        {/* Response Filter */}
        <Select value={responseFilter} onValueChange={setResponseFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Réponse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="replied">Répondu</SelectItem>
            <SelectItem value="none">Aucune réponse</SelectItem>
          </SelectContent>
        </Select>

        {/* Comment Filter */}
        <Select value={commentFilter} onValueChange={setCommentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Commentaire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="with">Avec commentaire</SelectItem>
            <SelectItem value="without">Sans commentaire</SelectItem>
          </SelectContent>
        </Select>

        {/* Tag Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Tag className="h-4 w-4" />
              Tags
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedTags.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="font-medium text-sm">Filtrer par tags</h4>
              <p className="text-xs text-muted-foreground">
                {tagStats.length} tags disponibles
              </p>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-1">
                {tagStats.map(({ tag, count, label, isNegative }) => (
                  <div
                    key={tag}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    <Checkbox
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    <div className="flex items-center gap-1.5 flex-1">
                      {isNegative ? (
                        <ThumbsDown className="h-3 w-3 text-destructive" />
                      ) : (
                        <ThumbsUp className="h-3 w-3 text-emerald-500" />
                      )}
                      <span className={`text-sm ${isNegative ? "text-destructive" : ""}`}>
                        {label}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {selectedTags.length > 0 && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedTags([])}
                >
                  Effacer les tags sélectionnés
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" onClick={clearAllFilters}>
            Réinitialiser
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Tags actifs:</span>
          {selectedTags.map((tag) => {
            const isNegative = isNegativeTag(tag);
            return (
              <Badge
                key={tag}
                variant="secondary"
                className={`text-xs cursor-pointer flex items-center gap-1 ${
                  isNegative
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                }`}
                onClick={() => toggleTag(tag)}
              >
                {isNegative ? (
                  <ThumbsDown className="h-3 w-3" />
                ) : (
                  <ThumbsUp className="h-3 w-3" />
                )}
                {getTagLabel(tag)}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredReviews.length} avis sur {reviews.length}
        </p>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length > 0 ? (
          filteredReviews.map((review) => (
            <ReviewCard
              key={review.id}
              customerName={review.customer_name}
              customerType={review.customer_type}
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
          <div className="text-center py-12 text-muted-foreground">
            Aucun avis ne correspond aux filtres sélectionnés
          </div>
        )}
      </div>
    </div>
  );
}
