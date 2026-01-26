import { Gift, Package, Percent, ChevronDown } from "lucide-react";
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
  color: string;
}

const OFFER_TYPES: OfferTypeConfig[] = [
  {
    id: "bogo",
    title: "1 acheté = 1 offert (BOGO)",
    shortTitle: "1 acheté = 1 offert",
    description: "Le client achète un article et reçoit le même gratuitement",
    icon: Gift,
    color: "orange",
  },
  {
    id: "cross_product",
    title: "1 acheté = 1 autre offert",
    shortTitle: "1 acheté = 1 autre offert",
    description: "Le client achète un produit A et reçoit un produit B offert",
    icon: Package,
    color: "violet",
  },
  {
    id: "percent_discount",
    title: "Réduction % établissement",
    shortTitle: "Réduction % établissement",
    description: "Réduction en pourcentage sur toute la commande",
    icon: Percent,
    color: "emerald",
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-500" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" },
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
  const platformName = isUber ? "Uber Eats" : "Deliveroo";

  return (
    <Select value={selectedType} onValueChange={(v) => onTypeChange(v as OfferType)}>
      <SelectTrigger 
        className={`w-full h-auto p-0 border-0 shadow-none focus:ring-0 [&>svg]:hidden`}
      >
        <div className={`w-full relative rounded-lg ${colors.bg} border ${colors.border} overflow-hidden`}>
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <div className="relative px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 ${colors.bg} backdrop-blur-sm rounded-xl`}>
                <selectedOffer.icon className={`h-5 w-5 ${colors.text}`} />
              </div>
              
              <div className="flex-1 text-left">
                <div className="text-lg font-semibold">{selectedOffer.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Calculez la rentabilité des offres "{selectedOffer.shortTitle}" sur {platformName}
                </div>
              </div>

              <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </div>
        </div>
      </SelectTrigger>
      
      <SelectContent 
        align="start" 
        className="w-[var(--radix-select-trigger-width)] p-0 border-0 shadow-lg rounded-lg overflow-hidden bg-background"
      >
        {OFFER_TYPES.map((offer) => {
          const offerColors = colorClasses[offer.color];
          const isSelected = offer.id === selectedType;
          
          return (
            <SelectItem 
              key={offer.id} 
              value={offer.id} 
              className={`p-0 cursor-pointer focus:bg-transparent data-[highlighted]:bg-transparent [&>span:first-child]:hidden`}
            >
              <div className={`w-full px-4 py-4 sm:px-6 ${offerColors.bg} ${isSelected ? 'ring-2 ring-inset ring-primary/50' : ''} hover:brightness-95 transition-all`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 ${offerColors.bg} backdrop-blur-sm rounded-xl`}>
                    <offer.icon className={`h-5 w-5 ${offerColors.text}`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-semibold">{offer.title}</div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {offer.description}
                    </p>
                  </div>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export { OFFER_TYPES };
