import { useMemo, useState } from "react";
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
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEventBar, CalendarEvent } from "./CalendarEventBar";
import { Plus } from "lucide-react";

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onActionClick?: (action: any) => void;
  onDateClick?: (date: Date) => void;
  onActionDrop?: (eventId: string, newStartDate: Date, newEndDate: Date | null) => void;
}

export function CalendarMonthView({
  currentDate,
  events,
  onActionClick,
  onDateClick,
  onActionDrop,
}: CalendarMonthViewProps) {
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

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

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(day);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const { eventId, originalStart, originalEnd } = data;
      
      const originalStartDate = new Date(originalStart);
      const daysDiff = differenceInDays(targetDate, originalStartDate);
      
      // Calculate new dates
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
  };

  return (
    <>
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

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r last:border-r-0 relative transition-colors group",
                      !isCurrentMonth && "bg-muted/20",
                      isWeekend && "bg-muted/30",
                      "hover:bg-accent/50 cursor-pointer",
                      isDragOver && "bg-primary/20 ring-2 ring-primary ring-inset"
                    )}
                    onClick={() => onDateClick?.(day)}
                    onDragOver={(e) => handleDragOver(e, day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <div className="p-1 flex justify-between items-start">
                      <span className="h-5 w-5 flex items-center justify-center rounded-full bg-primary/0 group-hover:bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-all text-xs">
                        <Plus className="h-3 w-3" />
                      </span>
                      <span
                        className={cn(
                          "h-7 w-7 flex items-center justify-center text-sm rounded-full",
                          isToday(day) && "bg-primary text-primary-foreground font-bold",
                          !isCurrentMonth && "text-muted-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
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

                return (
                  <CalendarEventBar
                    key={`${event.id}-${weekIndex}`}
                    event={event}
                    dayIndex={dayIndex}
                    span={span}
                    row={row}
                    isStart={isStart}
                    isEnd={isEnd}
                    isDraggable={!!onActionDrop}
                    onClick={() => onActionClick?.(event.originalAction)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
