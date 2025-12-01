import { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Globe, Store, Layers } from "lucide-react";
import { CalendarEvent } from "./CalendarEventBar";
import { MiniCalendar } from "./MiniCalendar";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarDayView } from "./CalendarDayView";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ScopeFilter = "all" | "national" | "local";
type ViewMode = "month" | "week" | "day";

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
  onActionDrop?: (actionId: string, newStartDate: Date, newEndDate: Date | null) => void;
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
  onActionDrop,
}: ActionsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("month");

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

  // Filter events by scope
  const filteredEvents = useMemo(() => {
    if (scopeFilter === "all") return calendarEvents;
    if (scopeFilter === "national") return calendarEvents.filter(e => e.isNational);
    return calendarEvents.filter(e => !e.isNational);
  }, [calendarEvents, scopeFilter]);

  // Stats for the filter badges
  const nationalCount = calendarEvents.filter(e => e.isNational).length;
  const localCount = calendarEvents.filter(e => !e.isNational).length;

  // Navigation handlers based on view mode
  const goToPrevious = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        break;
    }
  };

  const goToNext = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Get title based on view mode
  const getTitle = () => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: fr });
      case "week":
        return `Semaine du ${format(currentDate, "d MMMM yyyy", { locale: fr })}`;
      case "day":
        return format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
    }
  };

  return (
    <TooltipProvider>
      <div className="flex gap-4">
        {/* Mini Calendar Sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <MiniCalendar
            currentDate={currentDate}
            onDateSelect={(date) => {
              setCurrentDate(date);
              if (viewMode === "month") {
                setViewMode("day");
              }
            }}
            events={filteredEvents}
          />
        </div>

        {/* Main Calendar */}
        <div className="flex-1 bg-card rounded-lg border shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="flex flex-col gap-3 p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Aujourd'hui
                </Button>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" onClick={goToPrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={goToNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <h2 className="text-xl font-semibold capitalize">
                {getTitle()}
              </h2>
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-background rounded-lg p-0.5 border">
                  <Button
                    variant={viewMode === "month" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setViewMode("month")}
                  >
                    Mois
                  </Button>
                  <Button
                    variant={viewMode === "week" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setViewMode("week")}
                  >
                    Semaine
                  </Button>
                  <Button
                    variant={viewMode === "day" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setViewMode("day")}
                  >
                    Jour
                  </Button>
                </div>
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            
            {/* Scope Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">Portée :</span>
              <div className="flex items-center bg-background rounded-lg p-0.5 border">
                <Button
                  variant={scopeFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setScopeFilter("all")}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Toutes
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {calendarEvents.length}
                  </Badge>
                </Button>
                <Button
                  variant={scopeFilter === "national" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setScopeFilter("national")}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Nationales
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-blue-500/10 text-blue-600">
                    {nationalCount}
                  </Badge>
                </Button>
                <Button
                  variant={scopeFilter === "local" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setScopeFilter("local")}
                >
                  <Store className="h-3.5 w-3.5" />
                  Par restaurant
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-emerald-500/10 text-emerald-600">
                    {localCount}
                  </Badge>
                </Button>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          {viewMode === "month" && (
            <CalendarMonthView
              currentDate={currentDate}
              events={filteredEvents}
              onActionClick={onActionClick}
              onDateClick={onDateClick}
              onActionDrop={onActionDrop}
            />
          )}
          {viewMode === "week" && (
            <CalendarWeekView
              currentDate={currentDate}
              events={filteredEvents}
              onActionClick={onActionClick}
              onDateClick={onDateClick}
              onActionDrop={onActionDrop}
            />
          )}
          {viewMode === "day" && (
            <CalendarDayView
              currentDate={currentDate}
              events={filteredEvents}
              onActionClick={onActionClick}
              onDateClick={onDateClick}
            />
          )}

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
