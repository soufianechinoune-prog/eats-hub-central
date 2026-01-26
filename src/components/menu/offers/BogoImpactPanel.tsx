import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import chickenStreetPromo from "@/assets/chicken-street-promo.jpg";

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
      {/* Mobile Mockup with Chicken Street image */}
      <div className="bg-muted/50 rounded-3xl p-4 border border-border">
        <div className="bg-background rounded-2xl overflow-hidden shadow-lg">
          {/* Status bar mockup */}
          <div className="h-6 bg-muted/30 flex items-center justify-center">
            <div className="w-20 h-1 bg-foreground/20 rounded-full" />
          </div>
          
          {/* App content mockup */}
          <div className="p-3 space-y-3">
            {/* Restaurant card with promo image */}
            <div className="relative rounded-xl overflow-hidden">
              <img 
                src={chickenStreetPromo} 
                alt="Chicken Street - Naan & Fried Chicken"
                className="w-full h-32 object-cover"
              />
              <Badge className="absolute bottom-2 left-2 bg-emerald-500 text-white text-[10px] px-2 py-1">
                Un acheté = un offert
              </Badge>
            </div>

            {/* Restaurant info */}
            <div className="space-y-1">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted/70 rounded w-1/2" />
            </div>

            {/* More cards placeholder */}
            <div className="space-y-2 opacity-40">
              <div className="h-16 bg-muted/30 rounded-xl" />
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
