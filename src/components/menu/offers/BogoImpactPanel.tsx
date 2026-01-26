import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface BogoImpactPanelProps {
  restaurantCount: number;
  selectedItemsCount: number;
  offerFee: number;
}

export function BogoImpactPanel({
  restaurantCount,
  selectedItemsCount,
  offerFee,
}: BogoImpactPanelProps) {
  return (
    <div className="space-y-6">
      {/* Mobile Mockup */}
      <div className="bg-muted/50 rounded-3xl p-4 border border-border">
        <div className="bg-background rounded-2xl overflow-hidden shadow-lg">
          {/* Status bar mockup */}
          <div className="h-6 bg-muted/30 flex items-center justify-center">
            <div className="w-20 h-1 bg-foreground/20 rounded-full" />
          </div>
          
          {/* App content mockup */}
          <div className="p-4 space-y-3">
            {/* Search bar */}
            <div className="h-10 bg-muted rounded-lg" />
            
            {/* Restaurant card */}
            <div className="bg-muted/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-16 h-16 bg-muted rounded-lg" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted/70 rounded w-1/2" />
                  <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5">
                    Un acheté = un offert
                  </Badge>
                </div>
              </div>
            </div>

            {/* More cards placeholder */}
            <div className="space-y-2 opacity-50">
              <div className="h-20 bg-muted/30 rounded-xl" />
              <div className="h-20 bg-muted/30 rounded-xl" />
            </div>
          </div>

          {/* Bottom bar */}
          <div className="h-5 bg-muted/30" />
        </div>
      </div>

      {/* Summary text */}
      <p className="text-sm text-muted-foreground text-center">
        {restaurantCount > 0 
          ? `${restaurantCount} établissement${restaurantCount > 1 ? "s" : ""} sélectionné${restaurantCount > 1 ? "s" : ""}`
          : "Tous les établissements"
        }
        {selectedItemsCount > 0 && (
          <span> • {selectedItemsCount} article{selectedItemsCount > 1 ? "s" : ""}</span>
        )}
      </p>

      {/* Impact Stats */}
      <Card className="p-4 bg-emerald-500/10 border-emerald-500/30">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold text-foreground">
            Jusqu'à <span className="text-emerald-600">63 %</span> de ventes en plus
          </p>
          <p className="text-sm text-muted-foreground">
            par rapport aux établissements qui ne proposent pas cette offre
          </p>
          <button className="text-sm text-primary underline underline-offset-2 inline-flex items-center gap-1">
            <Info className="h-3 w-3" />
            Comment ce chiffre est-il calculé ?
          </button>
        </div>
      </Card>

      {/* Fee Information */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Frais d'utilisation de l'offre (hors taxes)
        </p>
        <p className="text-lg font-semibold">
          {offerFee.toFixed(2).replace(".", ",")} € par commande
        </p>
      </div>
    </div>
  );
}
