import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Gift,
  Package,
  Percent,
  Tag,
  TrendingUp,
  Box,
  Truck,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export type OfferType = 
  | "bogo" 
  | "cross_product" 
  | "percent_discount" 
  | "item_discount" 
  | "spend_more" 
  | "free_item" 
  | "free_delivery" 
  | "happy_hour";

interface OfferTypeConfig {
  id: OfferType;
  title: string;
  description: string;
  icon: React.ElementType;
  salesImpact: string;
  color: string;
  gradient: string;
  available: boolean;
}

const offerTypes: OfferTypeConfig[] = [
  {
    id: "bogo",
    title: "1 acheté = 1 offert",
    description: "Le client achète un article et reçoit le même gratuitement",
    icon: Gift,
    salesImpact: "+74%",
    color: "orange",
    gradient: "from-orange-500/20 via-orange-500/10 to-amber-500/5",
    available: true,
  },
  {
    id: "cross_product",
    title: "1 acheté = 1 autre offert",
    description: "Le client achète un produit A et reçoit un produit B offert",
    icon: Package,
    salesImpact: "+45%",
    color: "violet",
    gradient: "from-violet-500/20 via-purple-500/10 to-fuchsia-500/5",
    available: true,
  },
  {
    id: "percent_discount",
    title: "Réduction % établissement",
    description: "Réduction en pourcentage sur toute la commande",
    icon: Percent,
    salesImpact: "+16%",
    color: "emerald",
    gradient: "from-emerald-500/20 via-green-500/10 to-teal-500/5",
    available: true,
  },
  {
    id: "item_discount",
    title: "Réduction sur articles",
    description: "Réduction en pourcentage sur des articles spécifiques",
    icon: Tag,
    salesImpact: "+15%",
    color: "blue",
    gradient: "from-blue-500/20 via-blue-500/10 to-cyan-500/5",
    available: false,
  },
  {
    id: "spend_more",
    title: "Dépensez plus, économisez",
    description: "Réduction accordée à partir d'un montant minimum",
    icon: TrendingUp,
    salesImpact: "+14%",
    color: "indigo",
    gradient: "from-indigo-500/20 via-indigo-500/10 to-violet-500/5",
    available: false,
  },
  {
    id: "free_item",
    title: "Article offert",
    description: "Un article gratuit pour toute commande au-dessus d'un seuil",
    icon: Box,
    salesImpact: "+5%",
    color: "pink",
    gradient: "from-pink-500/20 via-pink-500/10 to-rose-500/5",
    available: false,
  },
  {
    id: "free_delivery",
    title: "Livraison offerte",
    description: "Frais de livraison offerts jusqu'à un certain montant",
    icon: Truck,
    salesImpact: "Variable",
    color: "cyan",
    gradient: "from-cyan-500/20 via-cyan-500/10 to-sky-500/5",
    available: false,
  },
  {
    id: "happy_hour",
    title: "Happy Hour",
    description: "Réductions spéciales pendant les heures creuses (14h-17h)",
    icon: Clock,
    salesImpact: "Variable",
    color: "amber",
    gradient: "from-amber-500/20 via-amber-500/10 to-yellow-500/5",
    available: false,
  },
];

const colorClasses: Record<string, { text: string; bg: string; border: string; badgeBg: string }> = {
  orange: { text: "text-orange-500", bg: "bg-orange-500/15", border: "border-orange-500/30", badgeBg: "bg-orange-500" },
  violet: { text: "text-violet-500", bg: "bg-violet-500/15", border: "border-violet-500/30", badgeBg: "bg-violet-500" },
  emerald: { text: "text-emerald-500", bg: "bg-emerald-500/15", border: "border-emerald-500/30", badgeBg: "bg-emerald-500" },
  blue: { text: "text-blue-500", bg: "bg-blue-500/15", border: "border-blue-500/30", badgeBg: "bg-blue-500" },
  indigo: { text: "text-indigo-500", bg: "bg-indigo-500/15", border: "border-indigo-500/30", badgeBg: "bg-indigo-500" },
  pink: { text: "text-pink-500", bg: "bg-pink-500/15", border: "border-pink-500/30", badgeBg: "bg-pink-500" },
  cyan: { text: "text-cyan-500", bg: "bg-cyan-500/15", border: "border-cyan-500/30", badgeBg: "bg-cyan-500" },
  amber: { text: "text-amber-500", bg: "bg-amber-500/15", border: "border-amber-500/30", badgeBg: "bg-amber-500" },
};

interface OfferTypeSelectorProps {
  onSelectOffer: (type: OfferType) => void;
}

export function OfferTypeSelector({ onSelectOffer }: OfferTypeSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <CardContent className="relative py-8">
            <div className="text-center space-y-3">
              <motion.div 
                className="inline-flex p-4 bg-primary/15 backdrop-blur-sm rounded-2xl shadow-lg mx-auto"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Sparkles className="h-8 w-8 text-primary" />
              </motion.div>
              <h1 className="text-2xl font-bold">Simulateur d'Offres Uber Eats</h1>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Analysez la rentabilité de vos promotions avant de les activer. 
                Sélectionnez un type d'offre pour commencer la simulation.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Offers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {offerTypes.map((offer, index) => {
          const colors = colorClasses[offer.color];
          
          return (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className={`relative border-0 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] overflow-hidden cursor-pointer transition-all duration-300 ${
                  offer.available 
                    ? `bg-gradient-to-br ${offer.gradient} hover:scale-[1.02] hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)]` 
                    : "bg-muted/30 opacity-60 cursor-not-allowed"
                }`}
                onClick={() => offer.available && onSelectOffer(offer.id)}
              >
                <div className={`absolute inset-0 border rounded-lg pointer-events-none ${offer.available ? colors.border : "border-border/30"}`} />
                
                {/* Content */}
                <CardContent className="relative p-5 space-y-4">
                  {/* Icon and Impact Badge */}
                  <div className="flex items-start justify-between">
                    <motion.div 
                      className={`p-3 ${colors.bg} backdrop-blur-sm rounded-xl`}
                      whileHover={offer.available ? { scale: 1.1, rotate: 5 } : {}}
                    >
                      <offer.icon className={`h-6 w-6 ${colors.text}`} />
                    </motion.div>
                    
                    {offer.available ? (
                      <Badge className={`${colors.badgeBg} text-white shadow-lg`}>
                        {offer.salesImpact} ventes
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="opacity-70">
                        Bientôt
                      </Badge>
                    )}
                  </div>

                  {/* Title and Description */}
                  <div className="space-y-1.5">
                    <h3 className={`font-semibold text-lg ${offer.available ? "" : "text-muted-foreground"}`}>
                      {offer.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {offer.description}
                    </p>
                  </div>

                  {/* Action Indicator */}
                  {offer.available && (
                    <motion.div 
                      className={`flex items-center gap-2 text-sm font-medium ${colors.text}`}
                      initial={{ x: 0 }}
                      whileHover={{ x: 5 }}
                    >
                      Simuler cette offre
                      <ArrowRight className="h-4 w-4" />
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Stats Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{offerTypes.filter(o => o.available).length} offres disponibles</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span>{offerTypes.filter(o => !o.available).length} à venir</span>
        </div>
      </motion.div>
    </div>
  );
}
