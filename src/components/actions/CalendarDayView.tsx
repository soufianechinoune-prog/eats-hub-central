import { useState, useCallback, useEffect } from "react";
import { format, isToday, addDays, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEvent } from "./CalendarEventBar";
import { ContextualEventBar } from "./ContextualEventBar";
import { DragPreview } from "./DragPreview";
import { Badge } from "@/components/ui/badge";
import { Globe, Store, Plus, Calendar, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { Button } from "@/components/ui/button";
import type { ContextualEvent } from "@/hooks/useSchoolHolidays";

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  contextualEvents?: ContextualEvent[];
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

export function CalendarDayView({
  currentDate,
  events,
  contextualEvents = [],
  onActionClick,
  onDateClick,
  onActionDrop,
}: CalendarDayViewProps) {
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Get events for the current day
  const dayEvents = events.filter((event) => {
    const eventEnd = event.end || event.start;
    return currentDate >= event.start && currentDate <= eventEnd;
  });

  // Get contextual events for the current day
  const dayContextualEvents = contextualEvents.filter((event) => {
    const start = parseISO(event.start_date);
    const end = parseISO(event.end_date);
    return currentDate >= start && currentDate <= end;
  });

  // Adjacent days for quick drop targets
  const previousDay = addDays(currentDate, -1);
  const nextDay = addDays(currentDate, 1);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      eventId: event.id,
      originalStart: event.start.toISOString(),
      originalEnd: event.end?.toISOString() || null,
    }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedEvent(event);
    
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

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setTimeout(() => setDragOverDate(null), 50);
    }
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

  // Safety timeout for stuck drag state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (dragOverDate && !draggedEvent) {
      timeoutId = setTimeout(() => {
        setDragOverDate(null);
        setDragPosition(null);
      }, 3000);
    }
    return () => clearTimeout(timeoutId);
  }, [dragOverDate, draggedEvent]);

  // Quick drop zone component
  const QuickDropZone = ({ day, label, icon: Icon }: { day: Date; label: string; icon: typeof ChevronLeft }) => {
    const isDragOver = dragOverDate && differenceInDays(dragOverDate, day) === 0;
    
    return (
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed transition-all duration-200",
          isDragOver 
            ? "border-primary bg-primary/10 scale-[1.02]" 
            : "border-muted-foreground/30 hover:border-muted-foreground/50",
          draggedEvent && "opacity-100",
          !draggedEvent && "opacity-50"
        )}
        onDragOver={(e) => handleDragOver(e, day)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, day)}
      >
        <Icon className={cn("h-5 w-5 mb-1", isDragOver ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("text-xs font-medium", isDragOver ? "text-primary" : "text-muted-foreground")}>
          {label}
        </span>
        <span className={cn("text-xs", isDragOver ? "text-primary" : "text-muted-foreground/70")}>
          {format(day, "d MMM", { locale: fr })}
        </span>
      </div>
    );
  };

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
        <Button
          onClick={() => onDateClick?.(currentDate)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvelle action</span>
        </Button>
      </div>

      {/* Quick Drop Zones for adjacent days */}
      {onActionDrop && draggedEvent && (
        <div className="flex gap-3 p-3 bg-muted/30 border-b animate-fade-in">
          <QuickDropZone day={previousDay} label="Jour précédent" icon={ChevronLeft} />
          <QuickDropZone day={nextDay} label="Jour suivant" icon={ChevronRight} />
        </div>
      )}

      {/* Contextual Events Banner */}
      {dayContextualEvents.length > 0 && (
        <div className={cn(
          "p-4 border-b",
          dayContextualEvents.some(e => e.type === "public_holiday") 
            ? "bg-red-500/10 border-red-500/20"
            : dayContextualEvents.some(e => e.type === "football_match")
              ? "bg-blue-500/10 border-blue-500/20"
              : "bg-orange-500/10 border-orange-500/20"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">
              {dayContextualEvents.some(e => e.type === "public_holiday") 
                ? "🇫🇷" 
                : dayContextualEvents.some(e => e.type === "football_match")
                  ? "⚽"
                  : "🎒"}
            </span>
            <span className={cn(
              "font-medium",
              dayContextualEvents.some(e => e.type === "public_holiday") 
                ? "text-red-700 dark:text-red-300"
                : dayContextualEvents.some(e => e.type === "football_match")
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-orange-700 dark:text-orange-300"
            )}>
              Événements contextuels
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dayContextualEvents.map((event) => (
              <ContextualEventBar key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="flex-1 p-4 overflow-auto">
        {dayEvents.length === 0 && dayContextualEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg">Aucune action ce jour</p>
            <p className="text-sm">Cliquez sur "Nouvelle action" pour en créer une</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayEvents.map((event) => {
              const isBeingDragged = draggedEvent?.id === event.id;
              
              return (
                <div
                  key={event.id}
                  draggable={!!onActionDrop}
                  onDragStart={(e) => handleDragStart(e, event)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "p-4 rounded-lg cursor-pointer transition-all",
                    "hover:shadow-lg hover:scale-[1.01]",
                    onActionDrop && "cursor-grab active:cursor-grabbing",
                    event.color.bg,
                    event.color.text,
                    event.isNational
                      ? "border-l-4 border-l-blue-500"
                      : "border-l-4 border-l-emerald-500",
                    isBeingDragged && "opacity-40"
                  )}
                  onClick={() => onActionClick?.(event.originalAction)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {onActionDrop && (
                          <GripVertical className="h-4 w-4 opacity-40 flex-shrink-0" />
                        )}
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
                      
                      {onActionDrop && (
                        <div className="mt-2 text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <GripVertical className="h-3 w-3" />
                          Glisser pour changer la date
                        </div>
                      )}
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
              );
            })}
          </div>
        )}
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
