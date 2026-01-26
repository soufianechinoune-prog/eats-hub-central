import { Gift, Package, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

export type OfferType = "bogo" | "cross_product" | "percent_discount";
export type Platform = "uber" | "deliveroo";

interface OfferTypeConfig {
  id: OfferType;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  salesImpact: string;
  color: string;
}

const OFFER_TYPES: OfferTypeConfig[] = [
  {
    id: "bogo",
    title: "1 acheté = 1 offert (BOGO)",
    shortTitle: "1 acheté = 1 offert",
    description: "Le client achète un article et reçoit le même gratuitement",
    icon: Gift,
    salesImpact: "+74%",
    color: "orange",
  },
  {
    id: "cross_product",
    title: "1 acheté = 1 autre offert",
    shortTitle: "1 acheté = 1 autre offert",
    description: "Le client achète un produit A et reçoit un produit B offert",
    icon: Package,
    salesImpact: "+45%",
    color: "violet",
  },
  {
    id: "percent_discount",
    title: "Réduction % établissement",
    shortTitle: "Réduction % établissement",
    description: "Réduction en pourcentage sur toute la commande",
    icon: Percent,
    salesImpact: "+16%",
    color: "emerald",
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string; badgeBg: string }> = {
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500", badgeBg: "bg-orange-500" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-500", badgeBg: "bg-violet-500" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500", badgeBg: "bg-emerald-500" },
};

interface OfferTypeHeaderProps {
  selectedType: OfferType;
  onTypeChange: (type: OfferType) => void;
  platform: Platform;
}

export function OfferTypeHeader({ selectedType, onTypeChange, platform }: OfferTypeHeaderProps) {
  const selectedOffer = OFFER_TYPES.find(o => o.id === selectedType) || OFFER_TYPES[0];
  const colors = colorClasses[selectedOffer.color];
  const isUber = platform === "uber";
  const PlatformIcon = isUber ? UberEatsIcon : DeliverooIcon;
  const platformName = isUber ? "Uber Eats" : "Deliveroo";

  return (
    <div className={`relative rounded-lg ${colors.bg} border ${colors.border} overflow-hidden`}>
      <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
      <div className="relative px-4 py-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Offer Type Selector */}
          <div className="flex items-center gap-3 flex-1">
            <div className={`p-2.5 ${colors.bg} backdrop-blur-sm rounded-xl`}>
              <selectedOffer.icon className={`h-5 w-5 ${colors.text}`} />
            </div>
            
            <div className="flex-1">
              <Select value={selectedType} onValueChange={(v) => onTypeChange(v as OfferType)}>
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto shadow-none focus:ring-0 hover:bg-transparent">
                  <div className="flex flex-col items-start">
                    <SelectValue>
                      <span className="text-lg font-semibold">{selectedOffer.title}</span>
                    </SelectValue>
                    <span className="text-sm text-muted-foreground mt-0.5">
                      Calculez la rentabilité des offres "{selectedOffer.shortTitle}" sur {platformName}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent align="start" className="w-[400px]">
                  {OFFER_TYPES.map((offer) => {
                    const offerColors = colorClasses[offer.color];
                    return (
                      <SelectItem key={offer.id} value={offer.id} className="py-3 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${offerColors.bg} rounded-lg`}>
                            <offer.icon className={`h-4 w-4 ${offerColors.text}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{offer.title}</span>
                              <Badge className={`${offerColors.badgeBg} text-white text-xs`}>
                                {offer.salesImpact} ventes
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {offer.description}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sales Impact Badge */}
          <Badge className={`${colors.badgeBg} text-white shadow-lg self-start sm:self-auto`}>
            {selectedOffer.salesImpact} ventes
          </Badge>
        </div>
      </div>
    </div>
  );
}

export { OFFER_TYPES };
