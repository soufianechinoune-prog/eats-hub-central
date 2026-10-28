import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isAdsConsolidating } from "@/lib/adsConsolidation";

export function AdsConsolidationBadge({ endDate }: { endDate: Date }) {
  if (!isAdsConsolidating(endDate)) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" tabIndex={0} className="max-w-full whitespace-normal border-uber/30 bg-uber/5 text-uber text-[10px] gap-1 leading-snug">
            <Clock3 className="h-3 w-3 shrink-0" /> En cours de consolidation
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          Chiffres provisoires : Uber transmet les frais publicitaires avec un décalage par rapport aux ventes.
          Les remontées et le rattrapage automatique peuvent encore modifier le budget et le ratio.
          Cet indicateur signale une période récente, pas une vérification de complétude.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}