import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Euro, 
  Percent, 
  TrendingDown, 
  TrendingUp, 
  ArrowRight,
  Info,
  ShoppingCart,
  Building2,
  Megaphone,
  UtensilsCrossed,
  Wallet,
  Receipt,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

interface PriceDecompositionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    name: string;
    category: string | null;
    price_uber: number | null;
    price_deliveroo: number | null;
    food_cost: number | null;
  };
}

export function PriceDecompositionDetail({
  open,
  onOpenChange,
  product,
}: PriceDecompositionDetailProps) {
  // Configurable rates
  const [uberCommission, setUberCommission] = useState(30);
  const [deliverooCommission, setDeliverooCommission] = useState(35);
  const [marketingRate, setMarketingRate] = useState(5);
  const [tvaRate] = useState(10);

  // Calculate decomposition for a platform
  const calculateDecomposition = useMemo(() => {
    return (priceTTC: number, commission: number) => {
      const priceHT = priceTTC / (1 + tvaRate / 100);
      const tvaAmount = priceTTC - priceHT;
      const commissionAmount = (priceTTC * commission) / 100;
      const marketingAmount = (priceTTC * marketingRate) / 100;
      const foodCost = product.food_cost ?? 0;
      const netProfit = priceTTC - tvaAmount - commissionAmount - marketingAmount - foodCost;
      const netProfitPercent = (netProfit / priceTTC) * 100;

      return {
        priceTTC,
        priceHT,
        tvaAmount,
        tvaPercent: tvaRate,
        commissionAmount,
        commissionPercent: commission,
        marketingAmount,
        marketingPercent: marketingRate,
        foodCost,
        foodCostPercent: priceTTC > 0 ? (foodCost / priceTTC) * 100 : 0,
        netProfit,
        netProfitPercent,
      };
    };
  }, [tvaRate, marketingRate, product.food_cost]);

  const uberDecomp = product.price_uber ? calculateDecomposition(product.price_uber, uberCommission) : null;
  const deliverooDecomp = product.price_deliveroo ? calculateDecomposition(product.price_deliveroo, deliverooCommission) : null;

  const hasFoodCost = product.food_cost !== null && product.food_cost > 0;

  // Waterfall segment component
  const WaterfallSegment = ({ 
    label, 
    amount, 
    percent, 
    color, 
    icon: Icon,
    description,
    isLast = false,
    isPositive = false,
  }: { 
    label: string; 
    amount: number; 
    percent: number; 
    color: string;
    icon: React.ElementType;
    description: string;
    isLast?: boolean;
    isPositive?: boolean;
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${
              isLast 
                ? isPositive 
                  ? "bg-emerald-500/10 border-2 border-emerald-500/30" 
                  : "bg-red-500/10 border-2 border-red-500/30"
                : "bg-muted/30 hover:bg-muted/50"
            }`}
          >
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{percent.toFixed(1)}% du prix</p>
            </div>
            <div className="text-right">
              <p className={`font-bold text-lg ${isLast ? (isPositive ? "text-emerald-600" : "text-red-600") : ""}`}>
                {isLast ? "" : "-"}{amount.toFixed(2)}€
              </p>
            </div>
            {!isLast && (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Visual bar chart
  const VisualBar = ({ decomp, platform }: { decomp: ReturnType<typeof calculateDecomposition>; platform: "uber" | "deliveroo" }) => {
    const segments = [
      { key: "tva", percent: decomp.tvaPercent, color: "bg-slate-400", label: "TVA" },
      { key: "commission", percent: decomp.commissionPercent, color: platform === "uber" ? "bg-orange-500" : "bg-teal-500", label: "Commission" },
      { key: "marketing", percent: decomp.marketingPercent, color: "bg-purple-500", label: "Marketing" },
      { key: "foodcost", percent: decomp.foodCostPercent, color: "bg-amber-500", label: "Food Cost" },
      { key: "profit", percent: Math.max(0, decomp.netProfitPercent), color: decomp.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500", label: "Profit" },
    ];

    return (
      <div className="space-y-2">
        <div className="h-10 w-full bg-muted/30 rounded-xl overflow-hidden flex shadow-inner">
          {segments.map((seg, i) => (
            <motion.div
              key={seg.key}
              initial={{ width: 0 }}
              animate={{ width: `${seg.percent}%` }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              className={`h-full ${seg.color} relative group cursor-pointer hover:brightness-110`}
            >
              {seg.percent >= 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {seg.percent.toFixed(0)}%
                </span>
              )}
            </motion.div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center gap-1 text-xs">
              <div className={`w-3 h-3 rounded ${seg.color}`} />
              <span className="text-muted-foreground">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Platform column
  const PlatformColumn = ({ 
    decomp, 
    platform,
    commission,
    onCommissionChange,
  }: { 
    decomp: ReturnType<typeof calculateDecomposition>; 
    platform: "uber" | "deliveroo";
    commission: number;
    onCommissionChange: (value: number) => void;
  }) => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        {platform === "uber" ? (
          <div className="p-3 bg-orange-500/10 rounded-xl">
            <UberEatsIcon className="h-8 w-8" />
          </div>
        ) : (
          <div className="p-3 bg-teal-500/10 rounded-xl">
            <DeliverooIcon className="h-8 w-8" />
          </div>
        )}
        <div>
          <h3 className={`font-bold text-xl ${platform === "uber" ? "text-orange-600" : "text-teal-600"}`}>
            {platform === "uber" ? "Uber Eats" : "Deliveroo"}
          </h3>
          <p className="text-2xl font-bold">{decomp.priceTTC.toFixed(2)}€ TTC</p>
        </div>
      </div>

      {/* Visual bar */}
      <VisualBar decomp={decomp} platform={platform} />

      {/* Commission slider */}
      <Card className="border-dashed">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Commission {platform === "uber" ? "Uber" : "Deliveroo"}
            </Label>
            <Badge variant="secondary" className="font-mono">
              {commission}%
            </Badge>
          </div>
          <Slider
            value={[commission]}
            onValueChange={([v]) => onCommissionChange(v)}
            min={15}
            max={45}
            step={0.5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Ajustez selon votre contrat (15-45%)
          </p>
        </CardContent>
      </Card>

      {/* Waterfall breakdown */}
      <div className="space-y-2">
        <WaterfallSegment
          label="Prix de vente TTC"
          amount={decomp.priceTTC}
          percent={100}
          color="bg-primary"
          icon={ShoppingCart}
          description="Prix affiché au client sur la plateforme"
        />
        <WaterfallSegment
          label="TVA (10%)"
          amount={decomp.tvaAmount}
          percent={decomp.tvaPercent}
          color="bg-slate-500"
          icon={Receipt}
          description="Taxe sur la valeur ajoutée reversée à l'État"
        />
        <WaterfallSegment
          label={`Commission ${platform === "uber" ? "Uber" : "Deliveroo"}`}
          amount={decomp.commissionAmount}
          percent={decomp.commissionPercent}
          color={platform === "uber" ? "bg-orange-500" : "bg-teal-500"}
          icon={Building2}
          description="Commission prélevée par la plateforme"
        />
        <WaterfallSegment
          label="Frais Marketing"
          amount={decomp.marketingAmount}
          percent={decomp.marketingPercent}
          color="bg-purple-500"
          icon={Megaphone}
          description="Publicité, offres, frais d'utilisation des promotions"
        />
        <WaterfallSegment
          label="Food Cost HT"
          amount={decomp.foodCost}
          percent={decomp.foodCostPercent}
          color="bg-amber-500"
          icon={UtensilsCrossed}
          description="Coût des matières premières (ingrédients)"
        />
        <Separator className="my-2" />
        <WaterfallSegment
          label="PROFIT NET"
          amount={decomp.netProfit}
          percent={decomp.netProfitPercent}
          color={decomp.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}
          icon={Wallet}
          description="Ce qui reste après toutes les déductions"
          isLast
          isPositive={decomp.netProfit >= 0}
        />
      </div>

      {/* Summary */}
      <Card className={`border-2 ${decomp.netProfit >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {decomp.netProfit >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              <span className="font-medium">Rentabilité</span>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${decomp.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {decomp.netProfitPercent.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">
                {decomp.netProfit.toFixed(2)}€ / vente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Euro className="h-6 w-6 text-primary" />
            Décomposition du prix
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-lg">{product.name}</span>
            {product.category && (
              <Badge variant="secondary">{product.category}</Badge>
            )}
          </div>
        </DialogHeader>

        {/* Marketing rate slider - shared */}
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-500" />
                Frais Marketing & Promotions (les deux plateformes)
              </Label>
              <Badge variant="secondary" className="font-mono bg-purple-500/10 text-purple-700">
                {marketingRate}%
              </Badge>
            </div>
            <Slider
              value={[marketingRate]}
              onValueChange={([v]) => setMarketingRate(v)}
              min={0}
              max={15}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Inclut: Publicité, offres sur articles, frais d'utilisation des offres
            </p>
          </CardContent>
        </Card>

        {!hasFoodCost && (
          <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Info className="h-5 w-5 text-amber-600" />
            <p className="text-amber-700">
              <strong>Food Cost manquant</strong> - Saisissez le coût matière pour voir le profit réel
            </p>
          </div>
        )}

        {/* Platform columns */}
        <div className="grid md:grid-cols-2 gap-8 mt-4">
          {uberDecomp && (
            <PlatformColumn
              decomp={uberDecomp}
              platform="uber"
              commission={uberCommission}
              onCommissionChange={setUberCommission}
            />
          )}
          {deliverooDecomp && (
            <PlatformColumn
              decomp={deliverooDecomp}
              platform="deliveroo"
              commission={deliverooCommission}
              onCommissionChange={setDeliverooCommission}
            />
          )}
          {!uberDecomp && !deliverooDecomp && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              Aucun prix disponible pour ce produit
            </div>
          )}
        </div>

        {/* Comparison summary if both platforms */}
        {uberDecomp && deliverooDecomp && (
          <Card className="bg-gradient-to-r from-orange-500/5 to-teal-500/5 border-0">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Comparaison des plateformes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Écart de prix</p>
                  <p className="text-xl font-bold">
                    {((uberDecomp.priceTTC - deliverooDecomp.priceTTC) / deliverooDecomp.priceTTC * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Meilleur profit</p>
                  <div className="flex items-center justify-center gap-2">
                    {uberDecomp.netProfit >= deliverooDecomp.netProfit ? (
                      <>
                        <UberEatsIcon className="h-5 w-5" />
                        <span className="font-bold text-orange-600">Uber</span>
                      </>
                    ) : (
                      <>
                        <DeliverooIcon className="h-5 w-5" />
                        <span className="font-bold text-teal-600">Deliveroo</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Différence profit</p>
                  <p className="text-xl font-bold">
                    {Math.abs(uberDecomp.netProfit - deliverooDecomp.netProfit).toFixed(2)}€
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
