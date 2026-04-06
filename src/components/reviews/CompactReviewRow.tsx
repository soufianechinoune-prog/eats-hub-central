import { Star, ThumbsUp, ThumbsDown, ShoppingBag, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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

  const { data: items, isLoading: isLoadingItems } = useReviewItemsByOrderId(
    isExpanded ? uberOrderId ?? null : null
  );

  const hasExpandableContent = !!uberOrderId;

  return (
    <div className="border-b border-border/30 last:border-0">
      {/* Main row */}
      <div className="flex gap-3 py-2.5 px-3 hover:bg-muted/30 transition-colors">
        {/* Left: rating + date + basket */}
        <div className="flex items-start gap-3 flex-shrink-0">
          {/* Rating */}
          <div className="flex items-center gap-0.5 w-[72px] pt-0.5">
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

          {/* Date */}
          <span className="text-xs text-muted-foreground w-[60px] pt-0.5">
            {orderDate
              ? format(new Date(orderDate), "dd MMM", { locale: fr })
              : format(new Date(reviewDate), "dd MMM", { locale: fr })}
          </span>

          {/* Basket */}
          <span className="text-xs font-medium w-[40px] text-right pt-0.5">
            {orderTotal != null ? `${orderTotal.toFixed(0)}€` : "—"}
          </span>
        </div>

        {/* Center: comment + tags */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Comment displayed directly */}
          {hasComment && (
            <p className="text-sm text-foreground/90 leading-snug line-clamp-2">
              {comment}
            </p>
          )}

          {/* Tags */}
          {hasTags && (
            <div className="flex items-center gap-1 flex-wrap">
              {tags.slice(0, 5).map((tag, idx) => {
                const isNegative = isNegativeTag(tag);
                return (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${
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
              })}
              {tags.length > 5 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{tags.length - 5}
                </Badge>
              )}
            </div>
          )}

          {!hasComment && !hasTags && (
            <span className="text-xs text-muted-foreground/40 italic">—</span>
          )}
        </div>

        {/* Right: expand */}
        <div className="flex items-start flex-shrink-0 pt-0.5">
          {hasExpandableContent && (
            <button
              onClick={onToggleExpand}
              className="p-0.5 rounded hover:bg-muted/50 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded: items list */}
      {isExpanded && hasExpandableContent && (
        <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-border/20">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
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
              Aucun plat associé — ré-importez le fichier SKU
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewItemRow({ item }: { item: MenuItemReview }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <span className="flex-1 min-w-0 truncate font-medium">
        {item.item_title}
      </span>

      {item.menu_category && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 text-muted-foreground">
          {item.menu_category}
        </Badge>
      )}

      {item.item_price != null && (
        <span className="text-xs text-muted-foreground flex-shrink-0 w-[45px] text-right">
          {item.item_price.toFixed(2)}€
        </span>
      )}

      {item.thumb_up > 0 && (
        <ThumbsUp className="h-3 w-3 text-emerald-500 flex-shrink-0" />
      )}
      {item.thumb_down > 0 && (
        <ThumbsDown className="h-3 w-3 text-destructive flex-shrink-0" />
      )}

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
