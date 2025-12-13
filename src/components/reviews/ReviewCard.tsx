import { Star, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTagLabel, isNegativeTag } from "@/lib/reviewTagLabels";

interface ReviewCardProps {
  customerName: string;
  customerType: string;
  overallRating: number;
  reviewDate: string;
  orderTotal: number;
  comment?: string | null;
  tags?: string[] | null;
  responseStatus?: string | null;
  platform: string;
}

export function ReviewCard({
  customerName,
  customerType,
  overallRating,
  reviewDate,
  orderTotal,
  comment,
  tags,
  responseStatus,
  platform,
}: ReviewCardProps) {
  const safeName = customerName || "Client";
  const initials = safeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const avatarColor = `hsl(${(safeName.charCodeAt(0) * 137) % 360}, 70%, 60%)`;

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow duration-200">
      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">{customerName}</h4>
              <p className="text-xs text-muted-foreground">{customerType}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {platform === "uber_eats" ? "Uber Eats" : "Deliveroo"}
            </Badge>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= overallRating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {format(new Date(reviewDate), "dd MMM yyyy", { locale: fr })}
            </span>
            {orderTotal != null && (
              <span className="text-sm text-muted-foreground">
                • {orderTotal.toFixed(2)}€
              </span>
            )}
          </div>

          {/* Comment */}
          {comment && (
            <p className="text-sm text-foreground/80 bg-muted/30 p-2 rounded">
              {comment}
            </p>
          )}

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {tags.map((tag, idx) => {
                const isNegative = isNegativeTag(tag);
                return (
                  <Badge 
                    key={idx} 
                    variant="secondary" 
                    className={`text-xs flex items-center gap-1 ${
                      isNegative 
                        ? "bg-destructive/10 text-destructive border-destructive/20" 
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {isNegative ? (
                      <ThumbsDown className="h-3 w-3" />
                    ) : (
                      <ThumbsUp className="h-3 w-3" />
                    )}
                    {getTagLabel(tag)}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Response Status */}
          {responseStatus && (
            <div className="flex items-center gap-2 text-xs">
              <MessageSquare className="h-3 w-3" />
              <span className="text-muted-foreground">
                {responseStatus === "replied" ? "Répondu" : "En attente de réponse"}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
