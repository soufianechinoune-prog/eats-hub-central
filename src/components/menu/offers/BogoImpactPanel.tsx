import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Search, Bell, ShoppingCart, Heart, ChevronDown, Check } from "lucide-react";
import chickenStreetPromo from "@/assets/chicken-street-promo.jpg";

interface BogoImpactPanelProps {
  restaurantCount: number;
  selectedItemsCount: number;
  offerFee: number;
  offerFeeWaived?: boolean;
  cofinancingType?: "percent" | "amount";
  cofinancingValue?: number;
}

export function BogoImpactPanel({
  restaurantCount,
  selectedItemsCount,
  offerFee,
  offerFeeWaived = false,
  cofinancingType = "percent",
  cofinancingValue = 0,
}: BogoImpactPanelProps) {
  return (
    <div className="space-y-6">
      {/* iPhone Mockup - Uber Eats style */}
      <div className="flex justify-center">
        <div className="relative w-[280px]">
          {/* iPhone Frame */}
          <div className="bg-foreground rounded-[40px] p-2 shadow-2xl">
            <div className="bg-background rounded-[32px] overflow-hidden">
              {/* Notch / Dynamic Island */}
              <div className="h-8 bg-background flex items-center justify-center relative">
                <div className="w-24 h-6 bg-foreground rounded-full" />
              </div>
              
              {/* App Header */}
              <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="w-20 h-4 bg-muted rounded" />
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-foreground" />
                  <Bell className="h-5 w-5 text-foreground" />
                  <ShoppingCart className="h-5 w-5 text-foreground" />
                </div>
              </div>

              {/* Quick Filters */}
              <div className="px-4 py-2 flex gap-2">
                <div className="w-16 h-8 bg-muted rounded-lg" />
                <div className="w-20 h-8 bg-muted rounded-lg" />
              </div>

              {/* Search placeholder */}
              <div className="px-4 py-2 flex gap-2">
                <div className="flex-1 h-6 bg-muted/50 rounded" />
                <div className="w-8 h-6 bg-muted/50 rounded-full" />
              </div>
              <div className="px-4 pb-2">
                <div className="w-32 h-4 bg-muted/50 rounded" />
              </div>

              {/* Section Title */}
              <div className="px-4 pt-2 pb-3">
                <p className="font-semibold text-sm">Tous les établissements</p>
              </div>

              {/* Restaurant Card with Promo */}
              <div className="px-4 pb-3">
                <div className="relative rounded-xl overflow-hidden">
                  {/* Badge on image */}
                  <Badge className="absolute top-2 left-2 z-10 bg-[#C8102E] hover:bg-[#C8102E] text-white text-[10px] px-2 py-1 font-medium">
                    Un acheté = un offert
                  </Badge>
                  <img 
                    src={chickenStreetPromo} 
                    alt="Chicken Street"
                    className="w-full h-28 object-cover"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="font-medium text-sm">Chicken Street - Juvisy</p>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="w-24 h-3 bg-muted/50 rounded mt-1" />
              </div>

              {/* Another card placeholder */}
              <div className="px-4 pb-4">
                <div className="w-full h-16 bg-muted/30 rounded-xl" />
              </div>

              {/* Home indicator */}
              <div className="flex justify-center pb-2">
                <div className="w-32 h-1 bg-foreground/20 rounded-full" />
              </div>
            </div>
          </div>
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
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold text-foreground">
            Jusqu'à <span className="text-primary">63 %</span> de ventes en plus
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
        {offerFeeWaived ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Check className="h-3 w-3 mr-1" />
              Frais offerts
            </Badge>
            <span className="text-sm text-muted-foreground line-through">
              {offerFee.toFixed(2).replace(".", ",")} €
            </span>
          </div>
        ) : (
          <p className="text-lg font-semibold">
            {offerFee.toFixed(2).replace(".", ",")} € par commande
          </p>
        )}
      </div>

      {/* Cofinancement Information */}
      {cofinancingValue > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Cofinancement</p>
          <p className="text-lg font-semibold text-primary">
            {cofinancingType === "percent"
              ? `${cofinancingValue}% du prix HT`
              : `${cofinancingValue.toFixed(2).replace(".", ",")} € par article`}
          </p>
        </div>
      )}
    </div>
  );
}
