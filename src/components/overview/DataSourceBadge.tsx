import { Zap, FileText, GitMerge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DataSource = "uber_api" | "csv_import" | "mixed";

interface DataSourceBadgeProps {
  source: DataSource;
  uberShare?: number;
  className?: string;
}

const CONFIG: Record<DataSource, { label: string; icon: typeof Zap; classes: string; tooltip: string }> = {
  uber_api: {
    label: "Live",
    icon: Zap,
    classes: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
    tooltip: "Données synchronisées en temps réel via l'API Uber Eats",
  },
  csv_import: {
    label: "Historique",
    icon: FileText,
    classes: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
    tooltip: "Données issues des rapports historiques Uber Eats (CSV) — source officielle, exhaustive",
  },
  mixed: {
    label: "Live + Historique",
    icon: GitMerge,
    classes: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15",
    tooltip: "Mix Live + Historique sur la période",
  },
};

export function DataSourceBadge({ source, uberShare, className }: DataSourceBadgeProps) {
  const cfg = CONFIG[source];
  const Icon = cfg.icon;
  const tooltipText =
    source === "mixed" && uberShare != null
      ? `${cfg.tooltip} — ${(uberShare * 100).toFixed(0)}% API`
      : cfg.tooltip;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 px-1.5 py-0 h-5 text-[10px] font-medium uppercase tracking-wide cursor-help",
              cfg.classes,
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon className="h-2.5 w-2.5" />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
