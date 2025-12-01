import { format, isToday, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEvent } from "./CalendarEventBar";
import { Badge } from "@/components/ui/badge";
import { Globe, Store, Plus, Calendar } from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

interface CalendarDayViewProps {
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

export function CalendarDayView({
  currentDate,
  events,
  onActionClick,
  onDateClick,
}: CalendarDayViewProps) {
  // Get events for the current day
  const dayEvents = events.filter((event) => {
    const eventEnd = event.end || event.start;
    return currentDate >= event.start && currentDate <= eventEnd;
  });

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Day Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "h-16 w-16 flex flex-col items-center justify-center rounded-xl",
              isToday(currentDate) 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted"
            )}
          >
            <span className="text-2xl font-bold">{format(currentDate, "d")}</span>
            <span className="text-xs uppercase">{format(currentDate, "EEE", { locale: fr })}</span>
          </div>
          <div>
            <h3 className="text-xl font-semibold capitalize">
              {format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {dayEvents.length === 0 
                ? "Aucune action prévue"
                : `${dayEvents.length} action${dayEvents.length > 1 ? "s" : ""} prévue${dayEvents.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => onDateClick?.(currentDate)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvelle action</span>
        </button>
      </div>

      {/* Events List */}
      <div className="flex-1 p-4 overflow-auto">
        {dayEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg">Aucune action ce jour</p>
            <p className="text-sm">Cliquez sur "Nouvelle action" pour en créer une</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayEvents.map((event) => (
              <div
                key={event.id}
                className={cn(
                  "p-4 rounded-lg cursor-pointer transition-all",
                  "hover:shadow-lg hover:scale-[1.01]",
                  event.color.bg,
                  event.color.text,
                  event.isNational
                    ? "border-l-4 border-l-blue-500"
                    : "border-l-4 border-l-emerald-500"
                )}
                onClick={() => onActionClick?.(event.originalAction)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {event.isNational ? (
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white">
                          <Globe className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500 text-white">
                          <Store className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <h4 className="font-semibold text-lg">{event.title}</h4>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="secondary" className={cn("text-xs", event.color.bg, event.color.text)}>
                        {CATEGORY_LABELS[event.category] || event.category}
                      </Badge>
                      <span className="text-sm opacity-75">{event.actionType}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        {event.platform === "uber_eats" ? (
                          <UberEatsIcon className="h-4 w-4" />
                        ) : (
                          <DeliverooIcon className="h-4 w-4" />
                        )}
                        <span className="opacity-75">
                          {event.platform === "uber_eats" ? "Uber Eats" : "Deliveroo"}
                        </span>
                      </div>
                      <div className="opacity-75">
                        {format(event.start, "d MMM", { locale: fr })}
                        {event.end && ` → ${format(event.end, "d MMM", { locale: fr })}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-sm">
                    {event.isNational ? (
                      <div className="text-blue-600 font-medium">Action nationale</div>
                    ) : event.restaurants.length > 0 && (
                      <div className="text-emerald-600">
                        {event.restaurants.length === 1 ? (
                          <span>{event.restaurants[0]}</span>
                        ) : (
                          <span>{event.restaurants.length} restaurants</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
