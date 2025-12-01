import { useMemo, useState, useCallback, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  differenceInDays,
  isBefore,
  isAfter,
  isWithinInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEventBar, CalendarEvent } from "./CalendarEventBar";
import { DragPreview } from "./DragPreview";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onActionClick?: (action: any) => void;
  onActionDelete?: (action: any) => void;
  onDateClick?: (date: Date) => void;
  onDateRangeSelect?: (startDate: Date, endDate: Date) => void;
  onActionDrop?: (eventId: string, newStartDate: Date, newEndDate: Date | null) => void;
}

export function CalendarMonthView({
  currentDate,
  events,
  onActionClick,
  onActionDelete,
  onDateClick,
  onDateRangeSelect,
  onActionDrop,
}: CalendarMonthViewProps) {
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Date range selection state
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: fr });
  const calendarEnd = endOfWeek(monthEnd, { locale: fr });

  // Generate weeks
  const weeks: Date[][] = useMemo(() => {
    const result: Date[][] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [calendarStart, calendarEnd]);

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  // Check if event starts on this day
  const isEventStart = (event: CalendarEvent, date: Date) => {
    return isSameDay(event.start, date);
  };

  // Get event duration from this day to end of week or event end
  const getEventSpan = (event: CalendarEvent, date: Date, weekDays: Date[]) => {
    const eventEnd = event.end || event.start;
    const dayIndex = weekDays.findIndex((d) => isSameDay(d, date));
    let span = 1;
    
    for (let i = dayIndex + 1; i < weekDays.length; i++) {
      if (weekDays[i] <= eventEnd) {
        span++;
      } else {
        break;
      }
    }
    return span;
  };

  // Handle drag start - capture the event being dragged
  const handleDragStartCapture = useCallback((event: CalendarEvent) => {
    setDraggedEvent(event);
  }, []);

  // Handle drag over with position tracking
  const handleDragOver = useCallback((e: React.DragEvent, day: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(day);
    setDragPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragLeave = useCallback(() => {
    // Don't clear immediately to prevent flickering
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    setDraggedEvent(null);
    setDragPosition(null);
    setIsDragging(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      console.log("Drop data received:", data);
      const { eventId, originalStart, originalEnd } = data;
      
      const originalStartDate = new Date(originalStart);
      const daysDiff = differenceInDays(targetDate, originalStartDate);
      
      // Don't do anything if dropped on same date
      if (daysDiff === 0) {
        console.log("Dropped on same date, ignoring");
        return;
      }
      
      const newStartDate = targetDate;
      let newEndDate: Date | null = null;
      
      if (originalEnd) {
        const originalEndDate = new Date(originalEnd);
        newEndDate = addDays(originalEndDate, daysDiff);
      }
      
      console.log("Calling onActionDrop:", eventId, newStartDate, newEndDate);
      onActionDrop?.(eventId, newStartDate, newEndDate);
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  }, [onActionDrop]);

  // Custom drag start handler to capture event
  const handleEventDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    console.log("Drag started for event:", event.title, event.id);
    e.dataTransfer.setData("application/json", JSON.stringify({
      eventId: event.id,
      originalStart: event.start.toISOString(),
      originalEnd: event.end?.toISOString() || null,
    }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedEvent(event);
    setIsDragging(true);
    
    // Create a custom drag image
    const dragImage = document.createElement("div");
    dragImage.style.opacity = "0";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }, []);

  const handleDragEndFull = useCallback(() => {
    setDragOverDate(null);
    setDraggedEvent(null);
    setDragPosition(null);
    setIsDragging(false);
  }, []);

  // Reset drag state when drag ends outside the calendar
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDragOverDate(null);
      setDraggedEvent(null);
      setDragPosition(null);
      setIsDragging(false);
    };

    // Listen for dragend anywhere on the document
    document.addEventListener("dragend", handleGlobalDragEnd);
    
    // Escape key to cancel drag
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleGlobalDragEnd();
        setRangeStart(null);
        setRangeEnd(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("dragend", handleGlobalDragEnd);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      {/* Date Range Selection Indicator */}
      {rangeStart && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/20 animate-fade-in">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-medium text-primary">
              {rangeEnd ? (
                <>
                  Plage sélectionnée : {format(isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd, "d MMM", { locale: fr })} 
                  → {format(isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd, "d MMM", { locale: fr })}
                </>
              ) : (
                <>
                  Date de début : {format(rangeStart, "d MMM yyyy", { locale: fr })}
                  <span className="text-muted-foreground ml-2">• Cliquez sur une autre date pour définir la fin</span>
                </>
              )}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setRangeStart(null);
              setRangeEnd(null);
            }}
          >
            <X className="h-3 w-3" />
            Annuler
          </Button>
        </div>
      )}
      
      {/* Week Days Header */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "px-2 py-3 text-center text-sm font-medium text-muted-foreground",
              index >= 5 && "bg-muted/30"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="divide-y">
        {weeks.map((week, weekIndex) => {
          // Get all events that appear in this week
          const weekEvents = events.filter((event) => {
            const eventEnd = event.end || event.start;
            return week.some(
              (day) => day >= event.start && day <= eventEnd
            );
          });

          // Track which rows events occupy
          const eventRows: Map<string, number> = new Map();
          let maxRow = 0;

          weekEvents.forEach((event) => {
            let row = 0;
            while (true) {
              const hasConflict = Array.from(eventRows.entries()).some(
                ([eventId, eventRow]) => {
                  if (eventRow !== row) return false;
                  const otherEvent = weekEvents.find((e) => e.id === eventId);
                  if (!otherEvent) return false;
                  const otherEnd = otherEvent.end || otherEvent.start;
                  const thisEnd = event.end || event.start;
                  return !(thisEnd < otherEvent.start || event.start > otherEnd);
                }
              );
              if (!hasConflict) break;
              row++;
            }
            eventRows.set(event.id, row);
            maxRow = Math.max(maxRow, row);
          });

          const minHeight = Math.max(100, 32 + (maxRow + 1) * 26);

          return (
            <div key={weekIndex} className="grid grid-cols-7 relative" style={{ minHeight }}>
              {week.map((day, dayIndex) => {
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isWeekend = dayIndex >= 5;
                const isDragOver = dragOverDate && isSameDay(dragOverDate, day);
                
                // Check if day is in selected range
                const isRangeStart = rangeStart && isSameDay(rangeStart, day);
                const isRangeEnd = rangeEnd && isSameDay(rangeEnd, day);
                const isInRange = rangeStart && rangeEnd && isWithinInterval(day, {
                  start: isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd,
                  end: isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd,
                });
                const isRangeSelected = isRangeStart || isRangeEnd || isInRange;

                // Handle day click for range selection
                const handleDayClick = () => {
                  if (!rangeStart) {
                    // First click - set start date
                    setRangeStart(day);
                    setRangeEnd(null);
                  } else if (!rangeEnd) {
                    // Second click - set end date and trigger callback
                    const start = isBefore(rangeStart, day) ? rangeStart : day;
                    const end = isAfter(rangeStart, day) ? rangeStart : day;
                    setRangeEnd(day);
                    
                    if (onDateRangeSelect) {
                      onDateRangeSelect(start, end);
                    }
                    // Clear selection after callback
                    setTimeout(() => {
                      setRangeStart(null);
                      setRangeEnd(null);
                    }, 100);
                  } else {
                    // Third click - reset and start new selection
                    setRangeStart(day);
                    setRangeEnd(null);
                  }
                };

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r last:border-r-0 relative transition-all duration-200 group",
                      !isCurrentMonth && "bg-muted/20",
                      isWeekend && "bg-muted/30",
                      "hover:bg-accent/50 cursor-pointer",
                      isDragOver && "bg-primary/15 scale-[1.03] z-10",
                      // Range selection styling
                      isRangeStart && "bg-primary/30 rounded-l-lg",
                      isRangeEnd && "bg-primary/30 rounded-r-lg",
                      isInRange && !isRangeStart && !isRangeEnd && "bg-primary/15"
                    )}
                    onClick={handleDayClick}
                    onDragOver={(e) => handleDragOver(e, day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    {/* Drop zone animated border */}
                    {isDragOver && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-md">
                        <div className="absolute inset-0 border-2 border-primary rounded-md animate-pulse" />
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent" />
                      </div>
                    )}
                    
                    <div className="p-1 flex justify-between items-start relative z-10">
                      <span className={cn(
                        "h-5 w-5 flex items-center justify-center rounded-full transition-all text-xs",
                        isDragOver 
                          ? "bg-primary text-primary-foreground opacity-100 scale-110" 
                          : isRangeSelected
                            ? "bg-primary text-primary-foreground opacity-100"
                            : "bg-primary/0 group-hover:bg-primary text-primary-foreground opacity-0 group-hover:opacity-100"
                      )}>
                        <Plus className="h-3 w-3" />
                      </span>
                      <span
                        className={cn(
                          "h-7 w-7 flex items-center justify-center text-sm rounded-full transition-all duration-200",
                          isToday(day) && "bg-primary text-primary-foreground font-bold",
                          !isCurrentMonth && "text-muted-foreground",
                          isDragOver && "bg-primary text-primary-foreground font-bold scale-125 shadow-lg",
                          (isRangeStart || isRangeEnd) && !isToday(day) && "bg-primary text-primary-foreground font-bold"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    
                    {/* Drop zone label */}
                    {isDragOver && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="animate-fade-in text-xs font-semibold text-primary bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-primary/30">
                          Déposer ici • {format(day, "d MMM", { locale: fr })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Event Bars */}
              {weekEvents.map((event) => {
                const startDay = week.find(
                  (d) => isSameDay(d, event.start) || (d >= event.start && d <= (event.end || event.start))
                );
                if (!startDay) return null;

                const dayIndex = week.findIndex((d) => isSameDay(d, startDay));
                const isStart = isEventStart(event, startDay) || dayIndex === 0;
                const span = getEventSpan(event, startDay, week);
                const row = eventRows.get(event.id) || 0;
                const isEnd = !event.end || 
                  isSameDay(addDays(startDay, span - 1), event.end) ||
                  dayIndex + span === 7;
                const isBeingDragged = draggedEvent?.id === event.id;

                return (
                  <div
                    key={`${event.id}-${weekIndex}`}
                    className={cn(
                      "transition-opacity duration-150",
                      isBeingDragged && "opacity-40",
                      // Allow drops through events when dragging
                      isDragging && !isBeingDragged && "pointer-events-none"
                    )}
                  >
                    <CalendarEventBar
                      event={event}
                      dayIndex={dayIndex}
                      span={span}
                      row={row}
                      isStart={isStart}
                      isEnd={isEnd}
                      isDraggable={!!onActionDrop}
                      onClick={() => onActionClick?.(event.originalAction)}
                      onDelete={onActionDelete ? () => onActionDelete(event.originalAction) : undefined}
                      onDragStart={(e) => handleEventDragStart(e, event)}
                      onDragEnd={handleDragEndFull}
                    />
                  </div>
                );
              })}
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
    </>
  );
}
