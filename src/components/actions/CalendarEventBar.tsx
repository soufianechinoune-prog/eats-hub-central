import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { Globe, Store, GripVertical, Trash2, Pencil } from "lucide-react";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  category: string;
  actionType: string;
  platform: string;
  isNational: boolean;
  restaurants: string[];
  color: { bg: string; text: string; border: string };
  originalAction: any;
}

interface CalendarEventBarProps {
  event: CalendarEvent;
  dayIndex: number;
  span: number;
  row: number;
  isStart: boolean;
  isEnd: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  visuals: "Visuels",
  pricing: "Prix",
  promotions: "Promotions",
  marketing: "Marketing",
  menu: "Menu",
  operational: "Opérations",
};

export function CalendarEventBar({
  event,
  dayIndex,
  span,
  row,
  isStart,
  isEnd,
  onClick,
  onDelete,
  isDraggable = true,
  onDragStart,
  onDragEnd,
}: CalendarEventBarProps) {
  const leftPercent = (dayIndex / 7) * 100;
  const widthPercent = (span / 7) * 100;

  // National vs Local visual distinction
  const scopeStyles = event.isNational
    ? "border-l-[3px] border-l-blue-500 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]"
    : "border-l-[3px] border-l-emerald-500 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          draggable={isDraggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={cn(
            "absolute h-6 px-1.5 text-xs flex items-center gap-1 cursor-pointer transition-all",
            "hover:shadow-lg hover:z-20 z-10 hover:scale-[1.02]",
            isDraggable && "cursor-grab active:cursor-grabbing",
            event.color.bg,
            event.color.text,
            scopeStyles,
            isStart && "rounded-l-md ml-0.5",
            isEnd && "rounded-r-md mr-0.5"
          )}
          style={{
            left: `calc(${leftPercent}% + ${isStart ? 2 : 0}px)`,
            width: `calc(${widthPercent}% - ${(isStart ? 2 : 0) + (isEnd ? 4 : 0)}px)`,
            top: `${32 + row * 26}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {isStart && (
            <>
              {isDraggable && (
                <GripVertical className="h-3 w-3 opacity-40 flex-shrink-0" />
              )}
              {event.isNational ? (
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-blue-500 text-white flex-shrink-0">
                  <Globe className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500 text-white flex-shrink-0">
                  <Store className="h-2.5 w-2.5" />
                </span>
              )}
              <span className="truncate font-medium">{event.title}</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-0 overflow-hidden">
        <div className="p-3 space-y-2">
          <div className="font-semibold">{event.title}</div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className={cn("text-[10px]", event.color.bg, event.color.text)}>
              {CATEGORY_LABELS[event.category] || event.category}
            </Badge>
            <span className="text-muted-foreground">{event.actionType}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {event.platform === "uber_eats" ? (
              <UberEatsIcon className="h-3 w-3" />
            ) : (
              <DeliverooIcon className="h-3 w-3" />
            )}
            <span>
              {format(event.start, "d MMM", { locale: fr })}
              {event.end && ` → ${format(event.end, "d MMM", { locale: fr })}`}
            </span>
          </div>
          {event.isNational ? (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Globe className="h-3 w-3" />
              Action nationale
            </div>
          ) : event.restaurants.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              <Store className="h-3 w-3 inline mr-1" />
              {event.restaurants.length === 1
                ? event.restaurants[0]
                : `${event.restaurants.length} restaurants`}
            </div>
          ) : null}
          {isDraggable && (
            <div className="text-[10px] text-muted-foreground/60">
              Glisser-déposer pour changer la date
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 rounded-none text-xs gap-1.5 hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            <Pencil className="h-3 w-3" />
            Modifier
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 rounded-none text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
              Supprimer
            </Button>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
