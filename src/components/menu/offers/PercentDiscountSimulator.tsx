import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Calculator, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Euro,
  Info,
  Target,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Minus as MinusIcon,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

export type Platform = "uber" | "deliveroo";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  vat_rate: number | null;
  is_active: boolean;
}

interface EnrichedMenuItemPrice {
  restaurantId: string;
  restaurantName: string;
  price: number | null;
  catalogPrice: number | null;
  usedPrice: number | null;
  hasDifference: boolean;
}

interface EnrichedMenuItem {
  id: string;
  name: string;
  category: string | null;
  food_cost: number | null;
  vat_rate: number | null;
  is_active: boolean;
  price_uber: number | null;
  price_deliveroo: number | null;
  restaurantPrices: EnrichedMenuItemPrice[];
}

interface PercentDiscountSimulatorProps {
  menuItems: MenuItem[];
  platform: Platform;
  commission: number;
  onCommissionChange: (value: number) => void;
  restaurantIds: string[];
  enrichedMenuItems: EnrichedMenuItem[];
}

const discountOptions = [10, 15, 20, 25, 30, 40, 50];
const minSpendOptions = [10, 15, 20, 25, 30, 35, 40];

// Platform-specific defaults
const PLATFORM_CONFIG = {
  uber: { defaultCommission: 30, defaultOfferFee: 0.89, color: "emerald", name: "Uber Eats" },
  deliveroo: { defaultCommission: 25, defaultOfferFee: 0, color: "emerald", name: "Deliveroo" },
};

export function PercentDiscountSimulator({ menuItems, platform, commission, onCommissionChange, restaurantIds, enrichedMenuItems }: PercentDiscountSimulatorProps) {
  const config = PLATFORM_CONFIG[platform];
  const isUber = platform === "uber";
  const PlatformIcon = isUber ? UberEatsIcon : DeliverooIcon;
  
  const [discountPercent, setDiscountPercent] = useState<number>(30);
  const [minSpend, setMinSpend] = useState<number>(15);
  const [maxDiscountValue, setMaxDiscountValue] = useState<string>("");
  const [averageBasket, setAverageBasket] = useState<string>("21");
  const [offerFee, setOfferFee] = useState<number>(config.defaultOfferFee);
  const [uberEstimatedIncrease, setUberEstimatedIncrease] = useState<string>("16");

  // Calculate average food cost ratio from menu items
  const avgFoodCostRatio = useMemo(() => {
    const eligibleItems = menuItems.filter(
      item => (isUber ? item.price_uber : item.price_deliveroo) && item.food_cost && item.food_cost > 0 && item.is_active
    );
    if (eligibleItems.length === 0) return 0.30; // Default 30%
    
    const totalRatio = eligibleItems.reduce((sum, item) => {
      const price = (isUber ? item.price_uber : item.price_deliveroo)!;
      return sum + (item.food_cost! / price);
    }, 0);
    return totalRatio / eligibleItems.length;
  }, [menuItems, isUber]);

  const simulation = useMemo(() => {
    const basket = parseFloat(averageBasket) || 0;
    if (basket <= 0) return null;

    const commissionRate = commission / 100;
    const discount = discountPercent / 100;
    
    // Calculate actual discount considering max value cap
    const maxDiscount = parseFloat(maxDiscountValue) || Infinity;
    const rawDiscount = basket * discount;
    const actualDiscount = Math.min(rawDiscount, maxDiscount);
    
    // Customer pays reduced amount
    const customerPays = basket - actualDiscount;
    
    // Average food cost for the basket
    const foodCost = basket * avgFoodCostRatio;
    
    // Without offer
    const revenueWithoutOffer = basket;
    const marginWithoutOffer = basket - (basket * commissionRate) - foodCost;
    const marginPercentWithoutOffer = (marginWithoutOffer / basket) * 100;
    
    // With offer: customer pays less, restaurant gets less revenue but food cost unchanged
    // Revenue is what customer pays (after discount)
    // Commission is on what customer pays
    // Food cost remains the same (we still prepare full order)
    const marginWithOffer = customerPays - (customerPays * commissionRate) - foodCost - offerFee;
    const marginPercentWithOffer = (marginWithOffer / basket) * 100;
    
    // Breakeven calculation
    const breakevenMultiplier = marginWithOffer > 0 ? marginWithoutOffer / marginWithOffer : null;
    const breakevenIncreasePercent = breakevenMultiplier ? (breakevenMultiplier - 1) * 100 : null;
    
    const uberEstimate = parseFloat(uberEstimatedIncrease) || null;
    const isProfitable = breakevenIncreasePercent !== null && uberEstimate !== null && uberEstimate > breakevenIncreasePercent;
    const isBreakeven = breakevenIncreasePercent !== null && uberEstimate !== null && Math.abs(uberEstimate - breakevenIncreasePercent) < 5;

    return {
      basket,
      customerPays,
      actualDiscount,
      foodCost,
      marginWithoutOffer,
      marginPercentWithoutOffer,
      marginWithOffer,
      marginPercentWithOffer,
      breakevenIncreasePercent,
      uberEstimate,
      isProfitable,
      isBreakeven,
      isLoss: marginWithOffer < 0,
    };
  }, [averageBasket, discountPercent, maxDiscountValue, commission, offerFee, avgFoodCostRatio, uberEstimatedIncrease]);

  // Generate scenario comparison table
  const scenarios = useMemo(() => {
    const basket = parseFloat(averageBasket) || 21;
    const commissionRate = commission / 100;
    const foodCost = basket * avgFoodCostRatio;
    const marginWithoutOffer = basket - (basket * commissionRate) - foodCost;

    return discountOptions.map(discPct => {
      const discount = discPct / 100;
      const maxDiscount = parseFloat(maxDiscountValue) || Infinity;
      const rawDiscount = basket * discount;
      const actualDiscount = Math.min(rawDiscount, maxDiscount);
      const customerPays = basket - actualDiscount;
      
      const marginWithOffer = customerPays - (customerPays * commissionRate) - foodCost - offerFee;
      const breakevenMult = marginWithOffer > 0 ? marginWithoutOffer / marginWithOffer : null;
      const breakevenPercent = breakevenMult ? (breakevenMult - 1) * 100 : null;

      let recommendation: "recommended" | "moderate" | "not_recommended";
      if (marginWithOffer <= 0) {
        recommendation = "not_recommended";
      } else if (breakevenPercent !== null && breakevenPercent <= 50) {
        recommendation = "recommended";
      } else if (breakevenPercent !== null && breakevenPercent <= 100) {
        recommendation = "moderate";
      } else {
        recommendation = "not_recommended";
      }

      // Uber estimated increase varies by discount level (rough estimates)
      const estimatedIncrease = discPct <= 20 ? 10 : discPct <= 30 ? 16 : discPct <= 40 ? 22 : 28;

      return {
        discountPercent: discPct,
        customerPays,
        actualDiscount,
        marginWithOffer,
        breakevenPercent,
        estimatedIncrease,
        recommendation,
        isProfitable: breakevenPercent !== null && estimatedIncrease > breakevenPercent,
      };
    });
  }, [averageBasket, commission, offerFee, avgFoodCostRatio, maxDiscountValue]);

  const recommendation = useMemo(() => {
    if (!simulation) return null;

    if (simulation.isLoss) {
      return {
        type: "danger",
        icon: AlertTriangle,
        title: "Réduction non rentable",
        message: "Cette réduction génère une perte à chaque commande. Réduisez le pourcentage ou augmentez le montant minimum.",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
      };
    }

    if (simulation.uberEstimate === null) {
      return {
        type: "info",
        icon: Info,
        title: "Seuil de rentabilité calculé",
        message: `Avec un seuil de +${simulation.breakevenIncreasePercent?.toFixed(0)}%, évaluez si l'augmentation de commandes est atteignable.`,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
      };
    }

    if (simulation.isProfitable) {
      return {
        type: "success",
        icon: CheckCircle2,
        title: "Réduction rentable",
        message: `L'estimation Uber (+${simulation.uberEstimate}%) dépasse le seuil nécessaire (+${simulation.breakevenIncreasePercent?.toFixed(0)}%)`,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
      };
    }

    if (simulation.isBreakeven) {
      return {
        type: "warning",
        icon: AlertTriangle,
        title: "Rentabilité limite",
        message: `L'estimation Uber (+${simulation.uberEstimate}%) est proche du seuil (+${simulation.breakevenIncreasePercent?.toFixed(0)}%). Risque modéré.`,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
      };
    }

    return {
      type: "danger",
      icon: TrendingDown,
      title: "Réduction risquée",
      message: `L'estimation Uber (+${simulation.uberEstimate}%) est inférieure au seuil nécessaire (+${simulation.breakevenIncreasePercent?.toFixed(0)}%)`,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
    };
  }, [simulation]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
            <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-emerald-500" />
                Configuration de l'offre
              </CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-6">
              {/* Discount Percentage */}
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-emerald-500" />
                    Montant de la réduction
                  </span>
                  <Badge className="bg-emerald-500 text-white font-mono text-lg px-3">-{discountPercent}%</Badge>
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {discountOptions.map(pct => (
                    <Button
                      key={pct}
                      variant={discountPercent === pct ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDiscountPercent(pct)}
                      className={discountPercent === pct ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                    >
                      -{pct}%
                    </Button>
                  ))}
                </div>
                {discountPercent === 30 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                    <Sparkles className="h-3.5 w-3.5" />
                    Recommandé par Uber Eats
                  </div>
                )}
              </div>

              {/* Minimum Spend */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-blue-500" />
                  Montant minimum de commande
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {minSpendOptions.map(amount => (
                    <Button
                      key={amount}
                      variant={minSpend === amount ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMinSpend(amount)}
                      className={minSpend === amount ? "bg-blue-500 hover:bg-blue-600" : ""}
                    >
                      {amount}€
                    </Button>
                  ))}
                </div>
                {minSpend === 15 && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-500/10 px-3 py-1.5 rounded-lg">
                    <Sparkles className="h-3.5 w-3.5" />
                    Recommandé par Uber Eats
                  </div>
                )}
              </div>

              {/* Max Discount Value (optional) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Valeur maximale de la réduction (optionnel)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Plafonne la réduction à un montant maximum en €</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Aucun plafond"
                    value={maxDiscountValue}
                    onChange={(e) => setMaxDiscountValue(e.target.value)}
                    className="bg-white/60 dark:bg-white/5 border-primary/30 pr-8"
                  />
                  <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Average Basket */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Panier moyen de votre restaurant
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={averageBasket}
                    onChange={(e) => setAverageBasket(e.target.value)}
                    className="bg-white/60 dark:bg-white/5 border-primary/30 pr-8"
                  />
                  <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Commission */}
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span>Commission {config.name}</span>
                  <Badge variant="outline" className="font-mono">{commission}%</Badge>
                </Label>
                <Slider
                  value={[commission]}
                  onValueChange={([value]) => onCommissionChange(value)}
                  min={15}
                  max={isUber ? 30 : 35}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Offer Fee */}
              <div className="space-y-2">
                <Label>Frais d'utilisation de l'offre</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={offerFee}
                    onChange={(e) => setOfferFee(parseFloat(e.target.value) || 0)}
                    className="bg-white/60 dark:bg-white/5 border-primary/30 pr-8"
                  />
                  <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Food Cost Info */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 inline mr-1" />
                  Food cost moyen calculé depuis votre catalogue : <strong>{(avgFoodCostRatio * 100).toFixed(0)}%</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Offer Preview */}
          {simulation && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 backdrop-blur-xl">
                <div className="absolute inset-0 border border-emerald-500/20 rounded-lg pointer-events-none" />
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Aperçu de l'offre client</p>
                      <p className="text-lg font-bold text-emerald-600">
                        -{discountPercent}% sur la commande
                      </p>
                      <p className="text-sm text-muted-foreground">
                        À partir de {minSpend}€ d'achat
                        {maxDiscountValue && ` • Max -${maxDiscountValue}€`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Sur un panier de {simulation.basket.toFixed(0)}€</p>
                      <p className="text-2xl font-bold">
                        <span className="line-through text-muted-foreground text-base mr-2">{simulation.basket.toFixed(2)}€</span>
                        <span className="text-emerald-600">{simulation.customerPays.toFixed(2)}€</span>
                      </p>
                      <Badge className="bg-emerald-500 text-white">-{simulation.actualDiscount.toFixed(2)}€</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Recommendation Card */}
          {recommendation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <Card className={`border-2 ${recommendation.borderColor} ${recommendation.bgColor} backdrop-blur-xl shadow-lg`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <motion.div 
                      className={`p-3 ${recommendation.bgColor} rounded-xl`}
                      whileHover={{ scale: 1.1 }}
                    >
                      <recommendation.icon className={`h-6 w-6 ${recommendation.color}`} />
                    </motion.div>
                    <div>
                      <h3 className={`font-bold text-lg ${recommendation.color}`}>
                        {recommendation.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {recommendation.message}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Metrics Cards */}
          {simulation && (
            <div className="grid grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
                  <div className="absolute inset-0 border border-white/40 rounded-lg pointer-events-none" />
                  <CardHeader className="relative pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Sans offre</CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className="text-2xl font-bold tracking-tight">
                      {simulation.marginWithoutOffer.toFixed(2)}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marge nette / commande
                    </p>
                    <Badge 
                      className={`mt-2 ${simulation.marginPercentWithoutOffer >= 25 ? "bg-emerald-500" : simulation.marginPercentWithoutOffer >= 15 ? "bg-amber-500" : "bg-red-500"}`}
                    >
                      {simulation.marginPercentWithoutOffer.toFixed(1)}%
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className={`border-0 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] ${simulation.isLoss ? "bg-red-500/10" : "bg-white/60 dark:bg-white/5"}`}>
                  <div className={`absolute inset-0 border rounded-lg pointer-events-none ${simulation.isLoss ? "border-red-500/30" : "border-white/40"}`} />
                  <CardHeader className="relative pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" />
                      Avec -{discountPercent}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className={`text-2xl font-bold tracking-tight ${simulation.isLoss ? "text-red-500" : ""}`}>
                      {simulation.marginWithOffer.toFixed(2)}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marge nette / commande
                    </p>
                    <Badge 
                      className={`mt-2 ${simulation.marginPercentWithOffer >= 15 ? "bg-emerald-500" : simulation.marginPercentWithOffer >= 0 ? "bg-amber-500" : "bg-red-500"}`}
                    >
                      {simulation.marginPercentWithOffer.toFixed(1)}%
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="col-span-2"
              >
                <Card className="border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
                  <div className="absolute inset-0 border border-emerald-500/20 rounded-lg pointer-events-none" />
                  <CardHeader className="relative pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-500" />
                      Seuil de rentabilité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    {simulation.breakevenIncreasePercent !== null && !simulation.isLoss ? (
                      <div className="space-y-2">
                        <p className="text-3xl font-bold tracking-tight text-emerald-600">
                          +{simulation.breakevenIncreasePercent.toFixed(0)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Augmentation minimum des commandes nécessaire
                        </p>
                        {simulation.uberEstimate !== null && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                            <UberEatsIcon className="h-4 w-4" />
                            <span className="text-sm">
                              Estimation Uber: <strong className="text-emerald-600">+{simulation.uberEstimate}%</strong>
                            </span>
                            {simulation.isProfitable ? (
                              <Badge className="bg-emerald-500 ml-auto">Rentable</Badge>
                            ) : simulation.isBreakeven ? (
                              <Badge className="bg-amber-500 ml-auto">Limite</Badge>
                            ) : (
                              <Badge className="bg-red-500 ml-auto">Insuffisant</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">
                        Impossible de calculer - marge négative
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Scenarios Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <CardHeader className="relative">
            <div className="flex items-center gap-3">
              <motion.div 
                className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-green-500/20 backdrop-blur-sm rounded-xl"
                whileHover={{ scale: 1.1 }}
              >
                <Percent className="h-5 w-5 text-emerald-600" />
              </motion.div>
              <div>
                <CardTitle className="text-lg">Comparaison des scénarios</CardTitle>
                <CardDescription>
                  Impact de chaque niveau de réduction sur votre marge
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-20">Réduction</TableHead>
                    <TableHead className="text-right">Client paie</TableHead>
                    <TableHead className="text-right">Votre marge</TableHead>
                    <TableHead className="text-right">Seuil rentabilité</TableHead>
                    <TableHead className="text-right">Est. Uber</TableHead>
                    <TableHead className="text-center">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarios.map((scenario) => (
                    <TableRow 
                      key={scenario.discountPercent}
                      className={`transition-colors cursor-pointer hover:bg-muted/20 ${
                        discountPercent === scenario.discountPercent 
                          ? "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/20" 
                          : ""
                      }`}
                      onClick={() => setDiscountPercent(scenario.discountPercent)}
                    >
                      <TableCell>
                        <Badge 
                          variant={discountPercent === scenario.discountPercent ? "default" : "outline"}
                          className={discountPercent === scenario.discountPercent ? "bg-emerald-500" : ""}
                        >
                          -{scenario.discountPercent}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {scenario.customerPays.toFixed(2)}€
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono font-semibold ${
                          scenario.marginWithOffer < 0 
                            ? "bg-red-500/10 text-red-600" 
                            : scenario.marginWithOffer < 2 
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-emerald-500/10 text-emerald-600"
                        }`}>
                          {scenario.marginWithOffer.toFixed(2)}€
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {scenario.breakevenPercent !== null ? (
                          <span className={scenario.breakevenPercent <= 50 ? "text-emerald-600" : scenario.breakevenPercent <= 100 ? "text-amber-600" : "text-red-600"}>
                            +{scenario.breakevenPercent.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-red-500">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">+{scenario.estimatedIncrease}%</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-help transition-all hover:scale-105 ${
                                scenario.recommendation === "recommended"
                                  ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                                  : scenario.recommendation === "moderate"
                                    ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                                    : "bg-red-500/15 text-red-600 border border-red-500/30"
                              }`}>
                                {scenario.recommendation === "recommended" ? (
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                ) : scenario.recommendation === "moderate" ? (
                                  <MinusIcon className="h-3.5 w-3.5" />
                                ) : (
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                )}
                                <span className="text-xs font-medium">
                                  {scenario.recommendation === "recommended" ? "Go" : scenario.recommendation === "moderate" ? "Risqué" : "Stop"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p className="text-xs">
                                {scenario.isProfitable 
                                  ? "✅ Estimation Uber > Seuil requis" 
                                  : "❌ Estimation Uber < Seuil requis"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
