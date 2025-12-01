import { useState } from "react";
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
} from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarEvent } from "./CalendarEventBar";

interface MiniCalendarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
}

export function MiniCalendar({ currentDate, onDateSelect, events }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(currentDate);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { locale: fr });
  const calendarEnd = endOfWeek(monthEnd, { locale: fr });

  // Generate days
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const hasEvents = (date: Date) => {
    return events.some((event) => {
      const eventEnd = event.end || event.start;
      return date >= event.start && date <= eventEnd;
    });
  };

  const weekDays = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="bg-card rounded-lg border shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewDate(subMonths(viewDate, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">
          {format(viewDate, "MMMM yyyy", { locale: fr })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewDate(addMonths(viewDate, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((d, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const isCurrentMonth = isSameMonth(d, viewDate);
          const isSelected = isSameDay(d, currentDate);
          const dayHasEvents = hasEvents(d);

          return (
            <button
              key={d.toISOString()}
              onClick={() => onDateSelect(d)}
              className={cn(
                "h-7 w-7 flex items-center justify-center text-xs rounded-full relative transition-colors",
                !isCurrentMonth && "text-muted-foreground/50",
                isSelected && "bg-primary text-primary-foreground",
                isToday(d) && !isSelected && "border border-primary text-primary",
                !isSelected && "hover:bg-accent"
              )}
            >
              {format(d, "d")}
              {dayHasEvents && !isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick navigation */}
      <div className="mt-4 pt-4 border-t space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={() => {
            const today = new Date();
            setViewDate(today);
            onDateSelect(today);
          }}
        >
          Aujourd'hui
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={() => {
            const nextMonth = addMonths(new Date(), 1);
            setViewDate(nextMonth);
            onDateSelect(startOfMonth(nextMonth));
          }}
        >
          Mois prochain
        </Button>
      </div>

      {/* Events summary */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-muted-foreground mb-2">
          Événements ce mois
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">
            {events.filter((e) => isSameMonth(e.start, viewDate)).length}
          </span>
          <span className="text-xs text-muted-foreground">actions</span>
        </div>
      </div>
    </div>
  );
}
