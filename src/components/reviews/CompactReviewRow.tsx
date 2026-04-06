import { useState } from "react";
import { Star, MessageSquare, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, ShoppingBag, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTagLabel, isNegativeTag } from "@/lib/reviewTagLabels";
import { useReviewItemsByOrderId, MenuItemReview } from "@/hooks/useReviews";

interface CompactReviewRowProps {
  overallRating: number;
  reviewDate: string;
  orderDate?: string | null;
  orderTotal?: number | null;
  comment?: string | null;
  tags?: string[] | null;
  responseStatus?: string | null;
  platform: string;
  uberOrderId?: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function CompactReviewRow({
  overallRating,
  reviewDate,
  orderDate,
  orderTotal,
  comment,
  tags,
  responseStatus,
  platform,
  uberOrderId,
  isExpanded,
  onToggleExpand,
}: CompactReviewRowProps) {
  const hasComment = !!comment;
  const hasTags = tags && tags.length > 0;

  // Load items only when expanded
  const { data: items, isLoading: isLoadingItems } = useReviewItemsByOrderId(
    isExpanded ? uberOrderId ?? null : null
  );

  return (
    <div className="border-b border-border/30 last:border-0">
      {/* Compact row */}
      <div
        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Rating */}
        <div className="flex items-center gap-0.5 w-[72px] flex-shrink-0">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-3 w-3 ${
                star <= overallRating
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        {/* Order Date */}
        <span className="text-xs text-muted-foreground w-[70px] flex-shrink-0">
          {orderDate
            ? format(new Date(orderDate), "dd MMM", { locale: fr })
            : "—"}
        </span>

        {/* Review Date */}
        <span className="text-xs text-muted-foreground w-[70px] flex-shrink-0">
          {format(new Date(reviewDate), "dd MMM", { locale: fr })}
        </span>

        {/* Order Total */}
        <span className="text-xs font-medium w-[50px] flex-shrink-0 text-right">
          {orderTotal != null ? `${orderTotal.toFixed(0)}€` : "—"}
        </span>

        {/* Tags */}
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {hasTags ? (
            tags.slice(0, 4).map((tag, idx) => {
              const isNegative = isNegativeTag(tag);
              return (
                <Badge
                  key={idx}
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                    isNegative
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {isNegative ? (
                    <ThumbsDown className="h-2.5 w-2.5 mr-0.5" />
                  ) : (
                    <ThumbsUp className="h-2.5 w-2.5 mr-0.5" />
                  )}
                  {getTagLabel(tag)}
                </Badge>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">—</span>
          )}
          {tags && tags.length > 4 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 flex-shrink-0"
            >
              +{tags.length - 4}
            </Badge>
          )}
        </div>

        {/* Comment indicator */}
        {hasComment && (
          <MessageSquare className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
        )}

        {/* Platform badge */}
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 flex-shrink-0"
        >
          {platform === "uber_eats" ? "UE" : "DL"}
        </Badge>

        {/* Expand icon */}
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-border/20 space-y-3">
          {/* Customer comment */}
          {hasComment && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Commentaire client</p>
              <p className="text-sm leading-relaxed bg-background rounded-md p-3 border border-border/40">
                {comment}
              </p>
            </div>
          )}

          {/* Items list */}
          {uberOrderId && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ShoppingBag className="h-3 w-3" />
                Plats commandés
              </p>
              {isLoadingItems ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Chargement...
                </div>
              ) : items && items.length > 0 ? (
                <div className="bg-background rounded-md border border-border/40 divide-y divide-border/30">
                  {items.map((item) => (
                    <ReviewItemRow key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic py-1">
                  Aucun plat associé — ré-importez le fichier SKU pour les voir
                </p>
              )}
            </div>
          )}

          {!hasComment && !uberOrderId && (
            <p className="text-xs text-muted-foreground/60 italic">
              Aucun détail supplémentaire disponible
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewItemRow({ item }: { item: MenuItemReview }) {
  const isPositive = item.rating === 1;
  const isNegative = item.rating === 0 && (item.thumb_down > 0);

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      {/* Item name */}
      <span className="flex-1 min-w-0 truncate font-medium">
        {item.item_title}
      </span>

      {/* Category */}
      {item.menu_category && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 text-muted-foreground">
          {item.menu_category}
        </Badge>
      )}

      {/* Price */}
      {item.item_price != null && (
        <span className="text-xs text-muted-foreground flex-shrink-0 w-[45px] text-right">
          {item.item_price.toFixed(2)}€
        </span>
      )}

      {/* Rating indicator */}
      {item.thumb_up > 0 && (
        <ThumbsUp className="h-3 w-3 text-emerald-500 flex-shrink-0" />
      )}
      {item.thumb_down > 0 && (
        <ThumbsDown className="h-3 w-3 text-destructive flex-shrink-0" />
      )}

      {/* Item tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {item.tags.slice(0, 2).map((tag, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className={`text-[9px] px-1 py-0 ${
                isNegativeTag(tag)
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {getTagLabel(tag)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
