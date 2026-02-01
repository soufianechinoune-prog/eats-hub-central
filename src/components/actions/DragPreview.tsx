import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ArrowRight, Calendar } from "lucide-react";

// Simplified event type for drag preview - works for both calendar and timeline
interface DragPreviewEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: {
    bg: string;
    border: string;
    text: string;
  };
}

interface DragPreviewProps {
  event: DragPreviewEvent | null;
  targetDate: Date | null;
  position: { x: number; y: number } | null;
}

export function DragPreview({ event, targetDate, position }: DragPreviewProps) {
  if (!event || !targetDate || !position) return null;

  const daysDiff = differenceInDays(targetDate, event.start);
  const diffText = daysDiff === 0 
    ? "Même date" 
    : daysDiff > 0 
      ? `+${daysDiff} jour${daysDiff > 1 ? "s" : ""}` 
      : `${daysDiff} jour${daysDiff < -1 ? "s" : ""}`;

  return (
    <div
      className="fixed z-50 pointer-events-none animate-in fade-in duration-100"
      style={{
        left: position.x + 16,
        top: position.y + 16,
      }}
    >
      <div className={cn(
        "rounded-lg shadow-xl border-2 p-3 min-w-[200px]",
        "bg-background/95 backdrop-blur-sm",
        daysDiff === 0 ? "border-muted" : "border-primary"
      )}>
        {/* Event title */}
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            event.color.border.replace("border-", "bg-")
          )} />
          <span className="font-medium text-sm truncate">{event.title}</span>
        </div>
        
        {/* Date change visualization */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{format(event.start, "d MMM", { locale: fr })}</span>
          </div>
          <ArrowRight className={cn(
            "h-3 w-3",
            daysDiff === 0 ? "text-muted-foreground" : "text-primary"
          )} />
          <div className={cn(
            "flex items-center gap-1.5 font-medium",
            daysDiff === 0 ? "text-muted-foreground" : "text-primary"
          )}>
            <span>{format(targetDate, "d MMM", { locale: fr })}</span>
          </div>
        </div>

        {/* Diff badge */}
        {daysDiff !== 0 && (
          <div className={cn(
            "mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
            daysDiff > 0 ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
          )}>
            {diffText}
          </div>
        )}
      </div>
    </div>
  );
}
