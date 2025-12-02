import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { ContextualEvent } from "@/hooks/useSchoolHolidays";

interface ContextualEventBarProps {
  event: ContextualEvent;
  compact?: boolean;
}

export function ContextualEventBar({ event, compact = false }: ContextualEventBarProps) {
  const startDate = parseISO(event.start_date);
  const endDate = parseISO(event.end_date);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-default",
            "border border-dashed",
            event.color.bg,
            event.color.border,
            event.color.text,
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          <span>{event.icon}</span>
          <span className="truncate font-medium">
            {compact ? event.title.split(' ')[0] : event.title}
          </span>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{event.icon}</span>
            <span className="font-semibold">{event.title}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Du {format(startDate, "d MMMM", { locale: fr })} au {format(endDate, "d MMMM yyyy", { locale: fr })}
          </div>
          {event.zones.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.zones.map((zone) => (
                <Badge 
                  key={zone} 
                  variant="outline" 
                  className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30"
                >
                  {zone}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
