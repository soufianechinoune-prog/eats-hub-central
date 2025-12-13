import { Star, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTagLabel, isNegativeTag } from "@/lib/reviewTagLabels";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CompactReviewRowProps {
  overallRating: number;
  reviewDate: string;
  orderTotal?: number | null;
  comment?: string | null;
  tags?: string[] | null;
  responseStatus?: string | null;
  platform: string;
}

export function CompactReviewRow({
  overallRating,
  reviewDate,
  orderTotal,
  comment,
  tags,
  responseStatus,
  platform,
}: CompactReviewRowProps) {
  const hasComment = !!comment;
  const hasTags = tags && tags.length > 0;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
      {/* Rating - Fixed width */}
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

      {/* Date */}
      <span className="text-xs text-muted-foreground w-[70px] flex-shrink-0">
        {format(new Date(reviewDate), "dd MMM", { locale: fr })}
      </span>

      {/* Order Total */}
      {orderTotal != null && (
        <span className="text-xs font-medium w-[50px] flex-shrink-0 text-right">
          {orderTotal.toFixed(0)}€
        </span>
      )}

      {/* Tags - Scrollable */}
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
                {isNegative ? <ThumbsDown className="h-2.5 w-2.5 mr-0.5" /> : <ThumbsUp className="h-2.5 w-2.5 mr-0.5" />}
                {getTagLabel(tag)}
              </Badge>
            );
          })
        ) : (
          <span className="text-xs text-muted-foreground/50 italic">—</span>
        )}
        {tags && tags.length > 4 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
            +{tags.length - 4}
          </Badge>
        )}
      </div>

      {/* Comment indicator */}
      {hasComment && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-shrink-0">
              <MessageSquare className="h-3.5 w-3.5 text-primary/60" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[300px]">
            <p className="text-xs">{comment}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Platform badge */}
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
        {platform === "uber_eats" ? "UE" : "DL"}
      </Badge>
    </div>
  );
}
