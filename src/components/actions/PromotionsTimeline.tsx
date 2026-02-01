import { useMemo, useState, useRef, useCallback } from "react";
import { parseISO, startOfYear, endOfYear, differenceInDays, format, eachMonthOfInterval, isBefore, isAfter, addDays, startOfQuarter, endOfQuarter, setMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarRange, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DragPreview } from "./DragPreview";

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
}

interface PromotionsTimelineProps {
  actions: RestaurantAction[];
  restaurants: Restaurant[];
  onActionClick: (action: RestaurantAction) => void;
  onActionDrop?: (actionId: string, actionTitle: string, originalStart: Date, originalEnd: Date | null, newStart: Date, newEnd: Date | null) => void;
}

interface TimelineRow {
  audience: string;
  label: string;
  color: string;
  bgClass: string;
  borderClass: string;
}

const AUDIENCE_ROWS: TimelineRow[] = [
  { 
    audience: "Tous les clients", 
    label: "Tous clients", 
    color: "hsl(var(--muted-foreground))",
    bgClass: "bg-muted/50",
    borderClass: "border-muted-foreground/30"
  },
  { 
    audience: "Uniquement pour les nouveaux clients", 
    label: "Nouveaux clients", 
    color: "hsl(142 76% 36%)",
    bgClass: "bg-emerald-100 dark:bg-emerald-900/30",
    borderClass: "border-emerald-400"
  },
  { 
    audience: "Réservé aux membres Uber One", 
    label: "Clients Uber One", 
    color: "hsl(45 93% 47%)",
    bgClass: "bg-amber-100 dark:bg-amber-900/30",
    borderClass: "border-amber-400"
  },
  { 
    audience: "Audience personnalisée", 
    label: "Clients inactifs", 
    color: "hsl(25 95% 53%)",
    bgClass: "bg-orange-100 dark:bg-orange-900/30",
    borderClass: "border-orange-400"
  },
];

// Calculate position and width for a block on the timeline
function getBlockPosition(
  startDate: Date,
  endDate: Date | null,
  viewStart: Date,
  viewEnd: Date
): { left: number; width: number; visible: boolean } {
  const totalDays = differenceInDays(viewEnd, viewStart) + 1;
  
  const blockStart = isBefore(startDate, viewStart) ? viewStart : startDate;
  const actualEndDate = endDate || startDate;
  const blockEnd = isAfter(actualEndDate, viewEnd) ? viewEnd : actualEndDate;
  
  if (isAfter(blockStart, viewEnd) || isBefore(blockEnd, viewStart)) {
    return { left: 0, width: 0, visible: false };
  }
  
  const leftDays = differenceInDays(blockStart, viewStart);
  const durationDays = differenceInDays(blockEnd, blockStart) + 1;
  
  return {
    left: (leftDays / totalDays) * 100,
    width: Math.max((durationDays / totalDays) * 100, 2), // min 2% for visibility
    visible: true
  };
}

interface TimelineBlockProps {
  action: RestaurantAction;
  left: number;
  width: number;
  borderClass: string;
  restaurants: Restaurant[];
  onClick: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

function TimelineBlock({ action, left, width, borderClass, restaurants, onClick, onDragStart, isDragging }: TimelineBlockProps) {
  const isNational = !action.restaurant_ids?.length && !action.restaurant_id;
  
  // Get restaurant names
  const restaurantNames = useMemo(() => {
    if (isNational) return "Tous les restaurants";
    if (action.restaurant_ids?.length) {
      const names = action.restaurant_ids
        .map(id => restaurants.find(r => r.id === id)?.name)
        .filter(Boolean);
      if (names.length > 2) return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
      return names.join(", ");
    }
    if (action.restaurant_id) {
      return restaurants.find(r => r.id === action.restaurant_id)?.name || "Restaurant";
    }
    return "";
  }, [action, restaurants, isNational]);

  const endDateFormatted = action.end_date 
    ? format(parseISO(action.end_date), "d MMM", { locale: fr })
    : format(parseISO(action.start_date), "d MMM", { locale: fr });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute top-2 bottom-2 rounded-md border-2 px-2 py-1",
              "cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] hover:z-20",
              "flex flex-col justify-center text-xs overflow-hidden group",
              "bg-card dark:bg-card",
              borderClass,
              isDragging && "opacity-50 cursor-grabbing"
            )}
            style={{ 
              left: `${left}%`, 
              width: `${width}%`,
              minWidth: "60px"
            }}
            onClick={onClick}
          >
            {/* Drag handle */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-muted/80 to-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                onDragStart?.(e);
              }}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
            {isNational && (
              <span className="text-[9px] text-muted-foreground absolute top-0.5 right-1 uppercase tracking-wide">
                national
              </span>
            )}
            <span className="font-medium truncate pr-1">{action.title}</span>
            <span className="text-muted-foreground text-[10px] truncate">
              Du {format(parseISO(action.start_date), "d", { locale: fr })} au {endDateFormatted}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px]">
          <div className="space-y-1">
            <p className="font-semibold">{action.title}</p>
            <p className="text-xs text-muted-foreground">{action.action_type}</p>
            <p className="text-xs">
              {format(parseISO(action.start_date), "d MMMM yyyy", { locale: fr })}
              {action.end_date && ` → ${format(parseISO(action.end_date), "d MMMM yyyy", { locale: fr })}`}
            </p>
            <p className="text-xs text-muted-foreground">{restaurantNames}</p>
            {action.impact_value && (
              <p className="text-xs font-medium">
                Impact: {action.impact_value}{action.impact_unit}
              </p>
            )}
            {action.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PromotionsTimeline({ actions, restaurants, onActionClick, onActionDrop }: PromotionsTimelineProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [granularity, setGranularity] = useState<"month" | "quarter">("month");
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null); // 0-3 for T1-T4, null for full year
  
  // Drag state
  const [draggingAction, setDraggingAction] = useState<RestaurantAction | null>(null);
  const [dragTargetDate, setDragTargetDate] = useState<Date | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Filter only promotion actions
  const promotionActions = useMemo(() => {
    return actions.filter(a => a.category === "promotions");
  }, [actions]);

  // View date range - either full year or a specific quarter
  const viewStart = useMemo(() => {
    if (selectedQuarter !== null) {
      // T1: Jan 1, T2: Apr 1, T3: Jul 1, T4: Oct 1
      return new Date(year, selectedQuarter * 3, 1);
    }
    return startOfYear(new Date(year, 0, 1));
  }, [year, selectedQuarter]);
  
  const viewEnd = useMemo(() => {
    if (selectedQuarter !== null) {
      return endOfQuarter(viewStart);
    }
    return endOfYear(new Date(year, 0, 1));
  }, [year, selectedQuarter, viewStart]);

  // Get months for headers - when quarter selected, show only those 3 months
  const periods = useMemo(() => {
    const months = eachMonthOfInterval({ start: viewStart, end: viewEnd });
    // Always show months in current view (whether full year or single quarter)
    return months.map(m => ({ label: format(m, "MMMM", { locale: fr }), months: [m] }));
  }, [viewStart, viewEnd]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent, action: RestaurantAction) => {
    e.preventDefault();
    setDraggingAction(action);
    setDragPosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Calculate date from mouse position on grid
  const getDateFromPosition = useCallback((clientX: number): Date | null => {
    if (!gridRef.current) return null;
    
    const rect = gridRef.current.getBoundingClientRect();
    // Account for the 160px (w-40) audience label column
    const labelWidth = 160;
    const gridLeft = rect.left + labelWidth;
    const gridWidth = rect.width - labelWidth;
    
    const relativeX = clientX - gridLeft;
    const percentage = Math.max(0, Math.min(1, relativeX / gridWidth));
    
    const totalDays = differenceInDays(viewEnd, viewStart);
    const dayOffset = Math.round(percentage * totalDays);
    
    return addDays(viewStart, Math.max(0, Math.min(dayOffset, totalDays)));
  }, [viewStart, viewEnd]);

  // Handle drag move
  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingAction) return;
    
    setDragPosition({ x: e.clientX, y: e.clientY });
    const targetDate = getDateFromPosition(e.clientX);
    setDragTargetDate(targetDate);
  }, [draggingAction, getDateFromPosition]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (draggingAction && dragTargetDate && onActionDrop) {
      const originalStart = parseISO(draggingAction.start_date);
      const originalEnd = draggingAction.end_date ? parseISO(draggingAction.end_date) : null;
      
      // Calculate new dates preserving duration
      const duration = originalEnd ? differenceInDays(originalEnd, originalStart) : 0;
      const newEnd = duration > 0 ? addDays(dragTargetDate, duration) : null;
      
      // Only trigger if date actually changed
      if (dragTargetDate.getTime() !== originalStart.getTime()) {
        onActionDrop(
          draggingAction.id,
          draggingAction.title,
          originalStart,
          originalEnd,
          dragTargetDate,
          newEnd
        );
      }
    }
    
    setDraggingAction(null);
    setDragTargetDate(null);
    setDragPosition(null);
  }, [draggingAction, dragTargetDate, onActionDrop]);

  // Handle quarter button click
  const handleQuarterClick = (quarterIndex: number) => {
    if (selectedQuarter === quarterIndex) {
      // If clicking the same quarter, go back to full year view
      setSelectedQuarter(null);
    } else {
      setSelectedQuarter(quarterIndex);
    }
  };

  // Group actions by audience
  const actionsByAudience = useMemo(() => {
    const groups: Record<string, RestaurantAction[]> = {};
    
    AUDIENCE_ROWS.forEach(row => {
      groups[row.audience] = promotionActions.filter(a => {
        const audience = (a.change_context as any)?.audience;
        // Match audience or default to "Tous les clients" if not specified
        if (!audience && row.audience === "Tous les clients") return true;
        return audience === row.audience;
      });
    });
    
    return groups;
  }, [promotionActions]);

  // Count total promos for the year
  const yearPromoCount = useMemo(() => {
    return promotionActions.filter(a => {
      const start = parseISO(a.start_date);
      const end = a.end_date ? parseISO(a.end_date) : start;
      return !isAfter(start, viewEnd) && !isBefore(end, viewStart);
    }).length;
  }, [promotionActions, viewStart, viewEnd]);

  const columnCount = selectedQuarter !== null ? 3 : 12;

  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      {/* Header with navigation */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setYear(y => y - 1); setSelectedQuarter(null); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-lg min-w-[60px] text-center">{year}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setYear(y => y + 1); setSelectedQuarter(null); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Quick quarter shortcuts - click to zoom into that quarter */}
        <div className="flex gap-1">
          {["T1", "T2", "T3", "T4"].map((q, index) => (
            <Button 
              key={q} 
              variant={selectedQuarter === index ? "secondary" : "outline"} 
              size="sm" 
              className={cn(
                "h-7 text-xs px-3",
                selectedQuarter === index && "ring-2 ring-primary/50"
              )}
              onClick={() => handleQuarterClick(index)}
            >
              {q}
            </Button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {yearPromoCount} promotion{yearPromoCount > 1 ? "s" : ""} en {year}
            {selectedQuarter !== null && ` (T${selectedQuarter + 1})`}
          </span>
          
          {/* View reset button when in quarter mode */}
          {selectedQuarter !== null && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => setSelectedQuarter(null)}
            >
              Voir l'année
            </Button>
          )}
        </div>
      </div>
      
      {/* Timeline Grid */}
      <div 
        className="relative overflow-x-auto"
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Period headers */}
        <div className="flex border-b sticky top-0 bg-background z-10">
          <div className="w-40 flex-shrink-0 border-r p-2 font-medium text-sm flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            Audience
          </div>
          {periods.map((period, i) => (
            <div 
              key={i} 
              className="flex-1 text-center p-2 border-r text-sm font-medium capitalize"
              style={{ minWidth: selectedQuarter !== null ? "150px" : "80px" }}
            >
              {period.label}
            </div>
          ))}
        </div>
        
        {/* Timeline content with ref for drag calculations */}
        <div ref={gridRef} className="flex-1">
          {/* Rows by audience */}
          {AUDIENCE_ROWS.map(row => {
            const rowActions = actionsByAudience[row.audience] || [];
            const visibleActions = rowActions.filter(a => {
              const start = parseISO(a.start_date);
              const end = a.end_date ? parseISO(a.end_date) : start;
              return !isAfter(start, viewEnd) && !isBefore(end, viewStart);
            });
            
            return (
              <div key={row.audience} className="flex border-b min-h-[80px]">
                {/* Audience label */}
                <div 
                  className={cn("w-40 flex-shrink-0 border-r p-3 font-medium text-sm flex items-center", row.bgClass)}
                  style={{ borderLeftWidth: 4, borderLeftColor: row.color }}
                >
                  {row.label}
                  {visibleActions.length > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      ({visibleActions.length})
                    </span>
                  )}
                </div>
                
                {/* Blocks area */}
                <div 
                  className="flex-1 relative" 
                  style={{ minWidth: `${columnCount * (selectedQuarter !== null ? 150 : 80)}px` }}
                >
                  {/* Grid lines */}
                  {periods.map((_, i) => (
                    <div 
                      key={i}
                      className="absolute top-0 bottom-0 border-r border-dashed border-border/50"
                      style={{ left: `${((i + 1) / columnCount) * 100}%` }}
                    />
                  ))}
                  
                  {/* Action blocks */}
                  {visibleActions.map(action => {
                    const pos = getBlockPosition(
                      parseISO(action.start_date),
                      action.end_date ? parseISO(action.end_date) : null,
                      viewStart,
                      viewEnd
                    );
                    
                    if (!pos.visible) return null;
                    
                    const isDragging = draggingAction?.id === action.id;
                    
                    return (
                      <TimelineBlock
                        key={action.id}
                        action={action}
                        left={pos.left}
                        width={pos.width}
                        borderClass={row.borderClass}
                        restaurants={restaurants}
                        onClick={() => !isDragging && onActionClick(action)}
                        onDragStart={(e) => handleDragStart(e, action)}
                        isDragging={isDragging}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Empty state */}
        {yearPromoCount === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Aucune promotion enregistrée pour {year}
            {selectedQuarter !== null && ` (T${selectedQuarter + 1})`}
          </div>
        )}
      </div>
      
      {/* Drag preview */}
      {draggingAction && (
        <DragPreview
          event={{
            id: draggingAction.id,
            title: draggingAction.title,
            start: parseISO(draggingAction.start_date),
            end: draggingAction.end_date ? parseISO(draggingAction.end_date) : parseISO(draggingAction.start_date),
            color: { bg: "bg-card", border: "border-primary", text: "text-foreground" }
          }}
          targetDate={dragTargetDate}
          position={dragPosition}
        />
      )}
    </div>
  );
}
