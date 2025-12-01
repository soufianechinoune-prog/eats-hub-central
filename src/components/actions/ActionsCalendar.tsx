import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  differenceInDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarEventBar, CalendarEvent } from "./CalendarEventBar";
import { MiniCalendar } from "./MiniCalendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RestaurantAction {
  id: string;
  restaurant_id: string | null;
  restaurant_ids: string[] | null;
  category: string;
  action_type: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  impact_value: number | null;
  impact_unit: string | null;
  target_item_ids: string[];
  platform: string;
  created_at: string;
  change_context: any;
}

interface Restaurant {
  id: string;
  name: string;
  postal_code: string | null;
  account_manager_name: string | null;
}

interface ActionsCalendarProps {
  actions: RestaurantAction[];
  restaurants: Restaurant[];
  onActionClick?: (action: RestaurantAction) => void;
  onDateClick?: (date: Date) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  visuals: { bg: "bg-purple-500/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-500" },
  pricing: { bg: "bg-amber-500/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500" },
  promotions: { bg: "bg-pink-500/20", text: "text-pink-700 dark:text-pink-300", border: "border-pink-500" },
  marketing: { bg: "bg-blue-500/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500" },
  menu: { bg: "bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500" },
  operational: { bg: "bg-slate-500/20", text: "text-slate-700 dark:text-slate-300", border: "border-slate-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  visuals: "Visuels",
  pricing: "Prix",
  promotions: "Promotions",
  marketing: "Marketing",
  menu: "Menu",
  operational: "Opérations",
};

export function ActionsCalendar({
  actions,
  restaurants,
  onActionClick,
  onDateClick,
}: ActionsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return actions.map((action) => {
      const isNational = !action.restaurant_ids?.length && !action.restaurant_id;
      const restaurantNames = action.restaurant_ids
        ?.map((id) => restaurants.find((r) => r.id === id)?.name)
        .filter(Boolean) as string[] || [];
      
      if (action.restaurant_id && !action.restaurant_ids?.length) {
        const name = restaurants.find((r) => r.id === action.restaurant_id)?.name;
        if (name) restaurantNames.push(name);
      }

      return {
        id: action.id,
        title: action.title,
        start: parseISO(action.start_date),
        end: action.end_date ? parseISO(action.end_date) : null,
        category: action.category,
        actionType: action.action_type,
        platform: action.platform,
        isNational,
        restaurants: restaurantNames,
        color: CATEGORY_COLORS[action.category] || CATEGORY_COLORS.operational,
        originalAction: action,
      };
    });
  }, [actions, restaurants]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: fr });
  const calendarEnd = endOfWeek(monthEnd, { locale: fr });

  // Generate weeks
  const weeks: Date[][] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  // Get events for each day with their positions
  const getEventsForDay = (date: Date) => {
    return calendarEvents.filter((event) => {
      const eventStart = event.start;
      const eventEnd = event.end || event.start;
      return date >= eventStart && date <= eventEnd;
    });
  };

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

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <TooltipProvider>
      <div className="flex gap-4">
        {/* Mini Calendar Sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <MiniCalendar
            currentDate={currentDate}
            onDateSelect={setCurrentDate}
            events={calendarEvents}
          />
        </div>

        {/* Main Calendar */}
        <div className="flex-1 bg-card rounded-lg border shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Aujourd'hui
              </Button>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <h2 className="text-xl font-semibold capitalize">
              {format(currentDate, "MMMM yyyy", { locale: fr })}
            </h2>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

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
              const weekEvents = calendarEvents.filter((event) => {
                const eventEnd = event.end || event.start;
                return week.some(
                  (day) => day >= event.start && day <= eventEnd
                );
              });

              // Track which rows events occupy
              const eventRows: Map<string, number> = new Map();
              let maxRow = 0;

              weekEvents.forEach((event) => {
                // Find first available row
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

              const minHeight = Math.max(100, 32 + (maxRow + 1) * 24);

              return (
                <div key={weekIndex} className="grid grid-cols-7 relative" style={{ minHeight }}>
                  {week.map((day, dayIndex) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const dayEvents = getEventsForDay(day);
                    const isWeekend = dayIndex >= 5;

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "border-r last:border-r-0 relative transition-colors",
                          !isCurrentMonth && "bg-muted/20",
                          isWeekend && "bg-muted/30",
                          "hover:bg-accent/50 cursor-pointer"
                        )}
                        onClick={() => onDateClick?.(day)}
                      >
                        {/* Day Number */}
                        <div className="p-1 flex justify-end">
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

                  {/* Event Bars - Rendered as overlays */}
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
                        onClick={() => onActionClick?.(event.originalAction)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="p-3 border-t bg-muted/30 flex flex-wrap gap-3">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-3 w-3 rounded-sm",
                    CATEGORY_COLORS[key].bg,
                    `border ${CATEGORY_COLORS[key].border}`
                  )}
                />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
