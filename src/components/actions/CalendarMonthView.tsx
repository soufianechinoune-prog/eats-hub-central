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
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEventBar, CalendarEvent } from "./CalendarEventBar";
import { ContextualEventBar } from "./ContextualEventBar";
import { DragPreview } from "./DragPreview";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ContextualEvent } from "@/hooks/useSchoolHolidays";

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  contextualEvents?: ContextualEvent[];
  onActionClick?: (action: any) => void;
  onActionDelete?: (action: any) => void;
  onDateClick?: (date: Date) => void;
  onDateRangeSelect?: (startDate: Date, endDate: Date) => void;
  onActionDrop?: (eventId: string, newStartDate: Date, newEndDate: Date | null) => void;
}

export function CalendarMonthView({
  currentDate,
  events,
  contextualEvents = [],
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

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Check if we're really leaving the drop zone
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      // Short delay to prevent flickering when moving between cells
      setTimeout(() => {
        setDragOverDate(null);
      }, 50);
    }
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

  // Safety timeout: clear drag state if it gets stuck
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (dragOverDate && !isDragging) {
      timeoutId = setTimeout(() => {
        setDragOverDate(null);
        setDraggedEvent(null);
        setDragPosition(null);
      }, 3000);
    }
    return () => clearTimeout(timeoutId);
  }, [dragOverDate, isDragging]);

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
                  // Always clear drag states on click
                  setDragOverDate(null);
                  setDraggedEvent(null);
                  setDragPosition(null);
                  
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

                // Get football matches for this day
                const dayStr = format(day, "yyyy-MM-dd");
                const footballMatchesForDay = contextualEvents.filter(
                  event => event.type === "football_match" && event.start_date === dayStr
                );

                // Get public holidays for this day
                const publicHolidaysForDay = contextualEvents.filter(
                  event => event.type === "public_holiday" && event.start_date === dayStr
                );

                // Get school holidays that include this day
                const schoolHolidaysForDay = contextualEvents.filter(event => {
                  if (event.type !== "school_holiday") return false;
                  const startDate = parseISO(event.start_date);
                  const endDate = parseISO(event.end_date);
                  return day >= startDate && day <= endDate;
                });

                // Check if day is within a school holiday period
                const isInSchoolHoliday = schoolHolidaysForDay.length > 0;
                const isSchoolHolidayStart = schoolHolidaysForDay.some(h => isSameDay(parseISO(h.start_date), day));
                const isSchoolHolidayEnd = schoolHolidaysForDay.some(h => isSameDay(parseISO(h.end_date), day));

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r last:border-r-0 relative transition-all duration-200 group",
                      !isCurrentMonth && "bg-muted/20",
                      isWeekend && "bg-muted/30",
                      "hover:bg-accent/50 cursor-pointer",
                      isDragOver && "bg-primary/15 scale-[1.03] z-10",
                      // School holiday background
                      isInSchoolHoliday && !isDragOver && "bg-orange-500/10",
                      isSchoolHolidayStart && "rounded-l-md",
                      isSchoolHolidayEnd && "rounded-r-md",
                      // Public holiday background
                      publicHolidaysForDay.length > 0 && !isDragOver && "bg-red-500/10",
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
                    {/* School holiday indicator bar */}
                    {isInSchoolHoliday && (
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-1 bg-orange-500/60",
                        isSchoolHolidayStart && "rounded-tl-md ml-1",
                        isSchoolHolidayEnd && "rounded-tr-md mr-1",
                        !isSchoolHolidayStart && !isSchoolHolidayEnd && "mx-0"
                      )} />
                    )}
                    
                    {/* Public holiday indicator */}
                    {publicHolidaysForDay.length > 0 && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-red-500/80 rounded-t-md mx-1" />
                    )}
                    
                    {/* Drop zone animated border */}
                    {isDragOver && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-md">
                        <div className="absolute inset-0 border-2 border-primary rounded-md animate-pulse" />
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent" />
                      </div>
                    )}
                    
                    <div className="p-1 flex justify-between items-start relative z-10">
                      {/* Public holiday / school holiday icon indicator */}
                      <div className="flex items-center gap-0.5">
                        {publicHolidaysForDay.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs cursor-default">🇫🇷</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-semibold text-red-600">{publicHolidaysForDay[0].title}</div>
                                <div className="text-xs text-muted-foreground">Jour férié</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isSchoolHolidayStart && schoolHolidaysForDay.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs cursor-default">🎒</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-semibold text-orange-600">{schoolHolidaysForDay[0].title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {schoolHolidaysForDay[0].zones.join(', ')}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {!publicHolidaysForDay.length && !isSchoolHolidayStart && (
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
                        )}
                      </div>
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
                    
                    {/* Football Match Indicators */}
                    {footballMatchesForDay.length > 0 && (
                      <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-1 z-20">
                        {footballMatchesForDay.map((match) => (
                          <Tooltip key={match.id}>
                            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-0.5 bg-gradient-to-r from-blue-600/20 to-blue-500/10 rounded-full px-1 py-0.5 cursor-pointer hover:from-blue-600/40 hover:to-blue-500/20 hover:scale-105 transition-all border border-blue-500/30 shadow-sm">
                                {match.home_team_logo ? (
                                  <img 
                                    src={match.home_team_logo} 
                                    alt={match.home_team || ''} 
                                    className="h-4 w-4 rounded-full object-contain bg-white"
                                  />
                                ) : (
                                  <span className="text-xs">⚽</span>
                                )}
                                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">vs</span>
                                {match.away_team_logo ? (
                                  <img 
                                    src={match.away_team_logo} 
                                    alt={match.away_team || ''} 
                                    className="h-4 w-4 rounded-full object-contain bg-white"
                                  />
                                ) : (
                                  <span className="text-xs">⚽</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="top" 
                              className="max-w-sm bg-card border shadow-xl p-0 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-white/80 text-xs">⚽ Champions League</span>
                                </div>
                              </div>
                              <div className="p-3 space-y-3">
                                <div className="flex items-center justify-center gap-3">
                                  <div className="flex flex-col items-center gap-1">
                                    {match.home_team_logo && (
                                      <img 
                                        src={match.home_team_logo} 
                                        alt={match.home_team || ''} 
                                        className="h-10 w-10 rounded-full object-contain bg-muted p-1"
                                      />
                                    )}
                                    <span className="text-xs font-medium text-center max-w-[80px] truncate">
                                      {match.home_team}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-lg font-bold text-muted-foreground">vs</span>
                                    <span className="text-xs text-muted-foreground">{match.time}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1">
                                    {match.away_team_logo && (
                                      <img 
                                        src={match.away_team_logo} 
                                        alt={match.away_team || ''} 
                                        className="h-10 w-10 rounded-full object-contain bg-muted p-1"
                                      />
                                    )}
                                    <span className="text-xs font-medium text-center max-w-[80px] truncate">
                                      {match.away_team}
                                    </span>
                                  </div>
                                </div>
                                {match.venue && (
                                  <div className="text-xs text-muted-foreground text-center border-t pt-2">
                                    📍 {match.venue}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                    
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
