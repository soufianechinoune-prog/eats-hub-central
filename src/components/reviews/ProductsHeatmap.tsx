import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { DayOfWeekStats } from "@/hooks/useMenuItemReviewsStats";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductsHeatmapProps {
  data: DayOfWeekStats[];
}

export function ProductsHeatmap({ data }: ProductsHeatmapProps) {
  const getColorClass = (rate: number) => {
    if (rate >= 80) return "bg-emerald-500";
    if (rate >= 70) return "bg-emerald-400";
    if (rate >= 60) return "bg-amber-400";
    if (rate >= 50) return "bg-orange-400";
    return "bg-red-400";
  };

  const getOpacity = (rate: number, count: number) => {
    if (count === 0) return "opacity-20";
    if (rate >= 80) return "opacity-100";
    if (rate >= 60) return "opacity-80";
    return "opacity-70";
  };

  if (data.every(d => d.reviewCount === 0)) {
    return (
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-primary" />
            Taux d'Approbation par Jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[100px] flex items-center justify-center text-muted-foreground">
            Aucune donnée disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-primary" />
          Taux d'Approbation par Jour
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex gap-2 justify-center">
            {data.map((d) => (
              <Tooltip key={d.day}>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">{d.day}</span>
                    <div 
                      className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm ${getColorClass(d.approvalRate)} ${getOpacity(d.approvalRate, d.reviewCount)} transition-all hover:scale-110 cursor-pointer`}
                    >
                      {d.reviewCount > 0 ? `${d.approvalRate.toFixed(0)}%` : "-"}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{d.day}</p>
                  <p className="text-sm">Taux: {d.approvalRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{d.reviewCount} avis</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        
        {/* Légende */}
        <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>≥80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-400" />
            <span>60-80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-400" />
            <span>&lt;60%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
