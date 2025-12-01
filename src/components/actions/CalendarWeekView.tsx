import { useMemo, useState, useCallback } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  differenceInDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEvent } from "./CalendarEventBar";
import { DragPreview } from "./DragPreview";
import { Badge } from "@/components/ui/badge";
import { Globe, Store, Plus, GripVertical } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onActionClick?: (action: any) => void;
  onDateClick?: (date: Date) => void;
  onActionDrop?: (eventId: string, newStartDate: Date, newEndDate: Date | null) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  visuals: "Visuels",
  pricing: "Prix",
  promotions: "Promotions",
  marketing: "Marketing",
  menu: "Menu",
  operational: "Opérations",
};

export function CalendarWeekView({
  currentDate,
  events,
  onActionClick,
  onDateClick,
  onActionDrop,
}: CalendarWeekViewProps) {
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  const weekStart = startOfWeek(currentDate, { locale: fr });

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventEnd = event.end || event.start;
      return date >= event.start && date <= eventEnd;
    });
  };

  // Handle drag
  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      eventId: event.id,
      originalStart: event.start.toISOString(),
      originalEnd: event.end?.toISOString() || null,
    }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedEvent(event);
    
    // Create invisible drag image
    const dragImage = document.createElement("div");
    dragImage.style.opacity = "0";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedEvent(null);
    setDragOverDate(null);
    setDragPosition(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, day: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(day);
    setDragPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragLeave = useCallback(() => {
    // Don't clear to prevent flickering
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    setDraggedEvent(null);
    setDragPosition(null);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const { eventId, originalStart, originalEnd } = data;
      
      const originalStartDate = new Date(originalStart);
      const daysDiff = differenceInDays(targetDate, originalStartDate);
      
      if (daysDiff === 0) return;
      
      const newStartDate = targetDate;
      let newEndDate: Date | null = null;
      
      if (originalEnd) {
        const originalEndDate = new Date(originalEnd);
        newEndDate = addDays(originalEndDate, daysDiff);
      }
      
      onActionDrop?.(eventId, newStartDate, newEndDate);
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  }, [onActionDrop]);

  return (
    <div className="flex flex-col h-full">
      {/* Week Days Header */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day, index) => (
          <div
            key={day.toISOString()}
            className={cn(
              "px-2 py-3 text-center border-r last:border-r-0",
              index >= 5 && "bg-muted/30"
            )}
          >
            <div className="text-sm font-medium text-muted-foreground">
              {format(day, "EEE", { locale: fr })}
            </div>
            <div
              className={cn(
                "mt-1 h-8 w-8 mx-auto flex items-center justify-center text-lg rounded-full",
                isToday(day) && "bg-primary text-primary-foreground font-bold"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 flex-1 min-h-[400px]">
        {weekDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isWeekend = index >= 5;
          const isDragOver = dragOverDate && isSameDay(dragOverDate, day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r last:border-r-0 p-2 relative group cursor-pointer transition-all duration-150",
                isWeekend && "bg-muted/30",
                "hover:bg-accent/30",
                isDragOver && "bg-primary/20 ring-2 ring-primary ring-inset scale-[1.01]"
              )}
              onClick={() => onDateClick?.(day)}
              onDragOver={(e) => handleDragOver(e, day)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
            >
              {/* Plus icon on hover */}
              <div className="absolute top-2 left-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary/0 group-hover:bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-all">
                <Plus className="h-3 w-3" />
              </div>

              {/* Drop zone indicator */}
              {isDragOver && (
                <div className="absolute top-2 right-2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {format(day, "d MMM", { locale: fr })}
                </div>
              )}

              {/* Events */}
              <div className="space-y-1.5 mt-6">
                {dayEvents.map((event) => {
                  const isBeingDragged = draggedEvent?.id === event.id;
                  
                  return (
                    <Tooltip key={event.id}>
                      <TooltipTrigger asChild>
                        <div
                          draggable={!!onActionDrop}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "p-2 rounded-md text-xs cursor-pointer transition-all",
                            "hover:shadow-md hover:scale-[1.02]",
                            onActionDrop && "cursor-grab active:cursor-grabbing",
                            event.color.bg,
                            event.color.text,
                            event.isNational
                              ? "border-l-[3px] border-l-blue-500"
                              : "border-l-[3px] border-l-emerald-500",
                            isBeingDragged && "opacity-40"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onActionClick?.(event.originalAction);
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            {onActionDrop && (
                              <GripVertical className="h-3 w-3 opacity-40 flex-shrink-0" />
                            )}
                            {event.isNational ? (
                              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-blue-500 text-white flex-shrink-0">
                                <Globe className="h-2.5 w-2.5" />
                              </span>
                            ) : (
                              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500 text-white flex-shrink-0">
                                <Store className="h-2.5 w-2.5" />
                              </span>
                            )}
                            <span className="font-medium truncate">{event.title}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] opacity-75">
                            {event.platform === "uber_eats" ? (
                              <UberEatsIcon className="h-3 w-3" />
                            ) : (
                              <DeliverooIcon className="h-3 w-3" />
                            )}
                            <span>{CATEGORY_LABELS[event.category] || event.category}</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-2">
                          <div className="font-semibold">{event.title}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="secondary" className={cn("text-[10px]", event.color.bg, event.color.text)}>
                              {CATEGORY_LABELS[event.category] || event.category}
                            </Badge>
                            <span className="text-muted-foreground">{event.actionType}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(event.start, "d MMM", { locale: fr })}
                            {event.end && ` → ${format(event.end, "d MMM", { locale: fr })}`}
                          </div>
                          {event.isNational ? (
                            <div className="flex items-center gap-1 text-xs text-blue-600">
                              <Globe className="h-3 w-3" />
                              Action nationale
                            </div>
                          ) : event.restaurants.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <Store className="h-3 w-3 inline mr-1" />
                              {event.restaurants.length === 1
                                ? event.restaurants[0]
                                : `${event.restaurants.length} restaurants`}
                            </div>
                          )}
                          {onActionDrop && (
                            <div className="text-[10px] text-muted-foreground/60 border-t pt-1 mt-1">
                              Glisser-déposer pour changer la date
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag Preview */}
      <DragPreview
        event={draggedEvent}
        targetDate={dragOverDate}
        position={dragPosition}
      />
    </div>
  );
}
