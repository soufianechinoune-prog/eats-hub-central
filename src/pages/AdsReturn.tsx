import { useNavigate } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdsBudgetSimulator } from "@/components/ads/AdsBudgetSimulator";
import { UberEatsLogo } from "@/components/icons/PlatformIcons";

/** Rendement de la pub : où mettre chaque euro de pub Uber, restaurant par restaurant. */
export default function AdsReturn() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/analytics/ads-spend")} aria-label="Retour aux dépenses pub"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="h-11 w-11 rounded-xl bg-uber/10 flex items-center justify-center"><SlidersHorizontal className="h-5 w-5 text-uber" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rendement de la pub</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5"><UberEatsLogo size={12} /> Uber Eats · jusqu'où la pub vaut le coup, et où la mettre</p>
        </div>
      </div>
      <AdsBudgetSimulator />
    </div>
  );
}
