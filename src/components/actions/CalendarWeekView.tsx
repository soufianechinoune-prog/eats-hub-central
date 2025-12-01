import { useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEvent } from "./CalendarEventBar";
import { Badge } from "@/components/ui/badge";
import { Globe, Store, Plus } from "lucide-react";
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
}: CalendarWeekViewProps) {
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

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r last:border-r-0 p-2 relative group cursor-pointer transition-colors",
                isWeekend && "bg-muted/30",
                "hover:bg-accent/30"
              )}
              onClick={() => onDateClick?.(day)}
            >
              {/* Plus icon on hover */}
              <div className="absolute top-2 left-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary/0 group-hover:bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-all">
                <Plus className="h-3 w-3" />
              </div>

              {/* Events */}
              <div className="space-y-1.5 mt-6">
                {dayEvents.map((event) => (
                  <Tooltip key={event.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "p-2 rounded-md text-xs cursor-pointer transition-all",
                          "hover:shadow-md hover:scale-[1.02]",
                          event.color.bg,
                          event.color.text,
                          event.isNational
                            ? "border-l-[3px] border-l-blue-500"
                            : "border-l-[3px] border-l-emerald-500"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onActionClick?.(event.originalAction);
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
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
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
