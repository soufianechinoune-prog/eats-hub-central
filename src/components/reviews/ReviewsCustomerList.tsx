import { useState } from "react";
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
import { Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReviewsCustomerListProps {
  reviews: CustomerReview[];
}

export function ReviewsCustomerList({ reviews }: ReviewsCustomerListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [responseFilter, setResponseFilter] = useState<string>("all");
  const [commentFilter, setCommentFilter] = useState<string>("all");

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

    return matchesSearch && matchesRating && matchesResponse && matchesComment;
  });

  const activeFiltersCount = [
    ratingFilter !== "all",
    responseFilter !== "all",
    commentFilter !== "all",
  ].filter(Boolean).length;

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

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setRatingFilter("all");
              setResponseFilter("all");
              setCommentFilter("all");
            }}
          >
            Réinitialiser
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount}
            </Badge>
          </Button>
        )}
      </div>

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
