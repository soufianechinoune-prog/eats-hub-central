import { useState, useMemo } from "react";
import { format, parseISO, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { extractCityName } from "@/lib/restaurantUtils";
import { Star, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface RestaurantRatingData {
  id: string;
  name: string;
  avgRating: number;
  dailyData: Record<string, { sum: number; count: number }>;
}

interface RatingsHeatmapGridProps {
  data: RestaurantRatingData[];
  dateRange: { start: Date; end: Date };
  period: "week" | "month" | "quarter";
  maxVisible?: number;
}

const getRatingColor = (rating: number | null): string => {
  if (rating === null) return "bg-muted/30";
  if (rating >= 4.5) return "bg-emerald-500/80";
  if (rating >= 4.0) return "bg-emerald-500/50";
  if (rating >= 3.5) return "bg-amber-400/60";
  if (rating >= 3.0) return "bg-orange-400/60";
  return "bg-red-500/70";
};

const getRatingTextColor = (rating: number | null): string => {
  if (rating === null) return "text-muted-foreground/50";
  return "text-foreground";
};

const PAGE_SIZE = 20;

export const RatingsHeatmapGrid = ({ 
  data, 
  dateRange, 
  period,
  maxVisible = 20 
}: RatingsHeatmapGridProps) => {
  const [showAll, setShowAll] = useState(false);
  const [modalPage, setModalPage] = useState(1);

  // Generate time columns based on period
  const timeColumns = useMemo(() => {
    if (period === "quarter") {
      // Group by week for quarter view
      const weeks = eachWeekOfInterval(
        { start: dateRange.start, end: dateRange.end },
        { weekStartsOn: 1 }
      );
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        return {
          key: format(weekStart, "yyyy-'W'ww"),
          label: format(weekStart, "d MMM", { locale: fr }),
          start: weekStart,
          end: weekEnd,
        };
      });
    } else {
      // Show individual days for week/month
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      return days.map(day => ({
        key: format(day, "yyyy-MM-dd"),
        label: format(day, period === "week" ? "EEE d" : "d", { locale: fr }),
        start: day,
        end: day,
      }));
    }
  }, [dateRange, period]);

  // Calculate rating for each cell
  const heatmapData = useMemo(() => {
    return data.map(restaurant => {
      const cityName = extractCityName(restaurant.name);
      const cells = timeColumns.map(col => {
        let sum = 0;
        let count = 0;

        if (period === "quarter") {
          // Aggregate all days in the week
          const daysInWeek = eachDayOfInterval({ start: col.start, end: col.end });
          daysInWeek.forEach(day => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayData = restaurant.dailyData[dayKey];
            if (dayData) {
              sum += dayData.sum;
              count += dayData.count;
            }
          });
        } else {
          const dayData = restaurant.dailyData[col.key];
          if (dayData) {
            sum = dayData.sum;
            count = dayData.count;
          }
        }

        const rating = count > 0 ? sum / count : null;
        return {
          key: col.key,
          rating,
          count,
        };
      });

      return {
        id: restaurant.id,
        name: restaurant.name,
        cityName,
        avgRating: restaurant.avgRating,
        cells,
      };
    });
  }, [data, timeColumns, period]);

  // Limit visible restaurants
  const visibleData = heatmapData.slice(0, maxVisible);
  const hasMore = heatmapData.length > maxVisible;

  // Modal pagination
  const totalPages = Math.ceil(heatmapData.length / PAGE_SIZE);
  const paginatedData = heatmapData.slice(
    (modalPage - 1) * PAGE_SIZE,
    modalPage * PAGE_SIZE
  );

  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée disponible
      </div>
    );
  }

  const HeatmapRows = ({ rows }: { rows: typeof heatmapData }) => (
    <div className="space-y-2">
      {rows.map(restaurant => (
        <div key={restaurant.id} className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-28 shrink-0 text-sm font-medium truncate cursor-help">
                {restaurant.cityName}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{restaurant.name}</p>
            </TooltipContent>
          </Tooltip>

          <div className="flex gap-1 flex-1 overflow-x-auto">
            {restaurant.cells.map(cell => (
              <Tooltip key={cell.key}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex-1 min-w-[32px] h-8 rounded transition-all hover:scale-105 cursor-default flex items-center justify-center",
                      getRatingColor(cell.rating)
                    )}
                  >
                    <span className={cn("text-xs font-medium", getRatingTextColor(cell.rating))}>
                      {cell.rating !== null ? cell.rating.toFixed(1) : "-"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{restaurant.cityName}</p>
                  <p className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {cell.rating !== null ? cell.rating.toFixed(2) : "Pas d'avis"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cell.count} avis
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-16 shrink-0 text-right">
            <span className="text-sm font-bold flex items-center justify-end gap-1">
              <Star className={cn(
                "h-3 w-3",
                restaurant.avgRating >= 4.5 ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
              )} />
              {restaurant.avgRating.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header row with time labels */}
      <div className="flex items-center gap-2">
        <div className="w-28 shrink-0" /> {/* Spacer for restaurant name column */}
        <div className="flex gap-1 flex-1 overflow-x-auto pb-1">
          {timeColumns.map(col => (
            <div
              key={col.key}
              className="flex-1 min-w-[32px] text-center text-xs text-muted-foreground font-medium"
            >
              {col.label}
            </div>
          ))}
        </div>
        <div className="w-16 shrink-0 text-right text-xs text-muted-foreground font-medium">
          Moy.
        </div>
      </div>

      {/* Restaurant rows */}
      <HeatmapRows rows={visibleData} />

      {/* Show more button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(true)}
            className="gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Voir les {heatmapData.length - maxVisible} autres restaurants
          </Button>
        </div>
      )}

      {/* Color legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-muted/30" />
          <span>Aucun avis</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-500/70" />
          <span>&lt;3.0</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-orange-400/60" />
          <span>3.0-3.5</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-400/60" />
          <span>3.5-4.0</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-500/50" />
          <span>4.0-4.5</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-500/80" />
          <span>≥4.5</span>
        </div>
      </div>

      {/* Full list modal */}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Performance par période - Tous les restaurants
              <span className="text-sm font-normal text-muted-foreground">
                ({heatmapData.length} restaurants)
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className="w-28 shrink-0" />
              <div className="flex gap-1 flex-1 overflow-x-auto pb-1">
                {timeColumns.map(col => (
                  <div
                    key={col.key}
                    className="flex-1 min-w-[32px] text-center text-xs text-muted-foreground font-medium"
                  >
                    {col.label}
                  </div>
                ))}
              </div>
              <div className="w-16 shrink-0 text-right text-xs text-muted-foreground font-medium">
                Moy.
              </div>
            </div>

            <HeatmapRows rows={paginatedData} />

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setModalPage(p => Math.max(1, p - 1))}
                      className={modalPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setModalPage(page)}
                        isActive={modalPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                      className={modalPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
