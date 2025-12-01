import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { Globe, Store } from "lucide-react";

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
}: CalendarEventBarProps) {
  const leftPercent = (dayIndex / 7) * 100;
  const widthPercent = (span / 7) * 100;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute h-5 px-1.5 text-xs flex items-center gap-1 cursor-pointer transition-all",
            "hover:shadow-md hover:z-20 z-10",
            event.color.bg,
            event.color.text,
            isStart && "rounded-l-md ml-0.5",
            isEnd && "rounded-r-md mr-0.5",
            !isStart && "border-l-0",
            !isEnd && "border-r-0"
          )}
          style={{
            left: `calc(${leftPercent}% + ${isStart ? 2 : 0}px)`,
            width: `calc(${widthPercent}% - ${(isStart ? 2 : 0) + (isEnd ? 4 : 0)}px)`,
            top: `${32 + row * 24}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {isStart && (
            <>
              {event.isNational ? (
                <Globe className="h-3 w-3 flex-shrink-0" />
              ) : (
                <Store className="h-3 w-3 flex-shrink-0" />
              )}
              <span className="truncate font-medium">{event.title}</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
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
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
