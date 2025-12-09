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
  Package,
  Euro,
  Info,
  Target,
  Zap,
  ArrowLeft,
  ArrowRight,
  Plus,
  ListOrdered,
  ThumbsUp,
  ThumbsDown,
  Minus as MinusIcon,
  ShoppingCart,
  Gift,
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
  is_active: boolean;
}

interface CrossProductSimulatorProps {
  menuItems: MenuItem[];
  onBack: () => void;
  platform: Platform;
}

// Platform-specific defaults
const PLATFORM_CONFIG = {
  uber: { defaultCommission: 30, defaultOfferFee: 0.89, color: "violet", name: "Uber Eats" },
  deliveroo: { defaultCommission: 25, defaultOfferFee: 0, color: "violet", name: "Deliveroo" },
};

export function CrossProductSimulator({ menuItems, onBack, platform }: CrossProductSimulatorProps) {
  const config = PLATFORM_CONFIG[platform];
  const isUber = platform === "uber";
  const PlatformIcon = isUber ? UberEatsIcon : DeliverooIcon;
  
  const [paidProductId, setPaidProductId] = useState<string>("");
  const [freeProductId, setFreeProductId] = useState<string>("");
  const [commission, setCommission] = useState<number>(config.defaultCommission);
  const [offerFee, setOfferFee] = useState<number>(config.defaultOfferFee);
  const [uberEstimatedIncrease, setUberEstimatedIncrease] = useState<string>("");

  const eligibleProducts = useMemo(() => {
    return menuItems.filter(
      item => (isUber ? item.price_uber : item.price_deliveroo) && item.food_cost && item.food_cost > 0 && item.is_active
    );
  }, [menuItems, isUber]);

  const paidProduct = useMemo(() => {
    return eligibleProducts.find(p => p.id === paidProductId);
  }, [eligibleProducts, paidProductId]);

  const freeProduct = useMemo(() => {
    return eligibleProducts.find(p => p.id === freeProductId);
  }, [eligibleProducts, freeProductId]);

  const simulation = useMemo(() => {
    const paidPrice = isUber ? paidProduct?.price_uber : paidProduct?.price_deliveroo;
    if (!paidProduct || !freeProduct || !paidPrice || !paidProduct.food_cost || !freeProduct.food_cost) {
      return null;
    }

    const paidFoodCost = paidProduct.food_cost;
    const freeFoodCost = freeProduct.food_cost;
    const commissionRate = commission / 100;

    // Without offer: selling paid product alone
    const netMarginWithoutOffer = paidPrice - (paidPrice * commissionRate) - paidFoodCost;
    const marginPercentWithoutOffer = (netMarginWithoutOffer / paidPrice) * 100;

    // With cross-product offer: customer pays for A, gets B free
    // Revenue: paidPrice
    // Commission: paidPrice * commission
    // Food cost: paidFoodCost + freeFoodCost (both products)
    // Offer fee: offerFee
    const netMarginWithOffer = paidPrice - (paidPrice * commissionRate) - paidFoodCost - freeFoodCost - offerFee;
    const marginPercentWithOffer = (netMarginWithOffer / paidPrice) * 100;

    // Breakeven calculation
    const breakevenMultiplier = netMarginWithOffer > 0 ? netMarginWithoutOffer / netMarginWithOffer : null;
    const breakevenIncreasePercent = breakevenMultiplier ? (breakevenMultiplier - 1) * 100 : null;

    const uberEstimate = parseFloat(uberEstimatedIncrease) || null;
    const isProfitable = breakevenIncreasePercent !== null && uberEstimate !== null && uberEstimate > breakevenIncreasePercent;
    const isBreakeven = breakevenIncreasePercent !== null && uberEstimate !== null && Math.abs(uberEstimate - breakevenIncreasePercent) < 5;

    return {
      paidPrice,
      paidFoodCost,
      freeFoodCost,
      netMarginWithoutOffer,
      marginPercentWithoutOffer,
      netMarginWithOffer,
      marginPercentWithOffer,
      breakevenMultiplier,
      breakevenIncreasePercent,
      uberEstimate,
      isProfitable,
      isBreakeven,
      isLoss: netMarginWithOffer < 0,
    };
  }, [paidProduct, freeProduct, commission, offerFee, uberEstimatedIncrease, isUber]);

  // Calculate best combinations
  const bestCombinations = useMemo(() => {
    const commissionRate = commission / 100;
    const combinations: Array<{
      paidProduct: MenuItem;
      freeProduct: MenuItem;
      netMarginWithOffer: number;
      breakevenPercent: number | null;
      recommendation: "recommended" | "moderate" | "not_recommended";
    }> = [];

    for (const paid of eligibleProducts) {
      for (const free of eligibleProducts) {
        if (paid.id === free.id) continue;
        
        const paidPrice = (isUber ? paid.price_uber : paid.price_deliveroo)!;
        const paidFC = paid.food_cost!;
        const freeFC = free.food_cost!;
        
        const marginWithoutOffer = paidPrice - (paidPrice * commissionRate) - paidFC;
        const marginWithOffer = paidPrice - (paidPrice * commissionRate) - paidFC - freeFC - offerFee;
        const breakevenMult = marginWithOffer > 0 ? marginWithoutOffer / marginWithOffer : null;
        const breakevenPercent = breakevenMult ? (breakevenMult - 1) * 100 : null;

        let recommendation: "recommended" | "moderate" | "not_recommended";
        if (marginWithOffer <= 0) {
          recommendation = "not_recommended";
        } else if (breakevenPercent !== null && breakevenPercent <= 60) {
          recommendation = "recommended";
        } else if (breakevenPercent !== null && breakevenPercent <= 120) {
          recommendation = "moderate";
        } else {
          recommendation = "not_recommended";
        }

        combinations.push({
          paidProduct: paid,
          freeProduct: free,
          netMarginWithOffer: marginWithOffer,
          breakevenPercent,
          recommendation,
        });
      }
    }

    return combinations
      .sort((a, b) => {
        const order = { recommended: 0, moderate: 1, not_recommended: 2 };
        if (order[a.recommendation] !== order[b.recommendation]) {
          return order[a.recommendation] - order[b.recommendation];
        }
        return (b.netMarginWithOffer) - (a.netMarginWithOffer);
      })
      .slice(0, 20);
  }, [eligibleProducts, commission, offerFee, isUber]);

  const recommendation = useMemo(() => {
    if (!simulation) return null;

    if (simulation.isLoss) {
      return {
        type: "danger",
        icon: AlertTriangle,
        title: "Combinaison non rentable",
        message: "Cette offre génère une perte à chaque vente. Choisissez un produit offert avec un food cost plus faible.",
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
        message: `Entrez l'estimation Uber pour comparer avec le seuil de +${simulation.breakevenIncreasePercent?.toFixed(0)}%`,
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
        borderColor: "border-violet-500/30",
      };
    }

    if (simulation.isProfitable) {
      return {
        type: "success",
        icon: CheckCircle2,
        title: "Combinaison rentable",
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
      title: "Combinaison risquée",
      message: `L'estimation Uber (+${simulation.uberEstimate}%) est inférieure au seuil nécessaire (+${simulation.breakevenIncreasePercent?.toFixed(0)}%)`,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
    };
  }, [simulation]);

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-violet-500/30 rounded-lg pointer-events-none" />
          <CardHeader className="relative">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div className="h-8 w-px bg-border" />
              <motion.div 
                className="p-3 bg-violet-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Package className="h-6 w-6 text-violet-500" />
              </motion.div>
              <div>
                <CardTitle className="text-xl">1 acheté = 1 autre article offert</CardTitle>
                <CardDescription>
                  Le client achète un produit A et reçoit un produit B gratuit
                </CardDescription>
              </div>
              <Badge className="ml-auto bg-violet-500 text-white">+45% ventes</Badge>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

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
                <Calculator className="h-5 w-5 text-violet-500" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-6">
              {/* Paid Product Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-violet-500" />
                  Produit acheté (payé par le client)
                </Label>
                <Select value={paidProductId} onValueChange={setPaidProductId}>
                  <SelectTrigger className="bg-white/60 dark:bg-white/5 border-violet-500/30">
                    <SelectValue placeholder="Sélectionner le produit payé" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {eligibleProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{product.name}</span>
                          <span className="text-muted-foreground text-sm">
                            {product.price_uber?.toFixed(2)}€
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Visual Connection */}
              {paidProduct && (
                <div className="flex items-center justify-center py-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 rounded-full border border-violet-500/30">
                    <Plus className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-medium text-violet-600">article offert</span>
                    <ArrowRight className="h-4 w-4 text-violet-500" />
                  </div>
                </div>
              )}

              {/* Free Product Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-emerald-500" />
                  Produit offert (gratuit pour le client)
                </Label>
                <Select value={freeProductId} onValueChange={setFreeProductId}>
                  <SelectTrigger className="bg-white/60 dark:bg-white/5 border-emerald-500/30">
                    <SelectValue placeholder="Sélectionner le produit offert" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {eligibleProducts.filter(p => p.id !== paidProductId).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{product.name}</span>
                          <span className="text-muted-foreground text-sm">
                            FC: {product.food_cost?.toFixed(2)}€
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Products Preview */}
              {paidProduct && freeProduct && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-4 rounded-lg bg-gradient-to-br from-violet-500/5 to-emerald-500/5 border border-violet-500/20 space-y-3"
                >
                  <p className="text-sm font-medium text-center">Aperçu de l'offre</p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-center p-3 bg-violet-500/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">Acheté</p>
                        <p className="font-semibold text-sm truncate max-w-[120px]">{paidProduct.name}</p>
                        <p className="text-violet-600 font-mono">{(isUber ? paidProduct.price_uber : paidProduct.price_deliveroo)?.toFixed(2)}€</p>
                      </div>
                      <Plus className="h-5 w-5 text-muted-foreground" />
                      <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
                        <p className="text-xs text-muted-foreground">Offert</p>
                        <p className="font-semibold text-sm truncate max-w-[120px]">{freeProduct.name}</p>
                        <Badge className="bg-emerald-500 text-white text-xs mt-1">GRATUIT</Badge>
                      </div>
                    </div>
                  </motion.div>
              )}

              {/* Commission */}
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span>Commission {config.name}</span>
                  <Badge variant="outline" className="font-mono">{commission}%</Badge>
                </Label>
                <Slider
                  value={[commission]}
                  onValueChange={([value]) => setCommission(value)}
                  min={15}
                  max={40}
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
                    className="bg-white/60 dark:bg-white/5 border-white/40 pr-8"
                  />
                  <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Estimation */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PlatformIcon className="h-4 w-4" />
                  Estimation {config.name} (augmentation commandes)
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Ex: 45"
                    value={uberEstimatedIncrease}
                    onChange={(e) => setUberEstimatedIncrease(e.target.value)}
                    className="bg-white/60 dark:bg-white/5 border-white/40 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
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
                      {simulation.netMarginWithoutOffer.toFixed(2)}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marge nette / unité
                    </p>
                    <Badge 
                      className={`mt-2 ${simulation.marginPercentWithoutOffer >= 30 ? "bg-emerald-500" : simulation.marginPercentWithoutOffer >= 15 ? "bg-amber-500" : "bg-red-500"}`}
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
                      <Package className="h-3.5 w-3.5" />
                      Avec offre
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className={`text-2xl font-bold tracking-tight ${simulation.isLoss ? "text-red-500" : ""}`}>
                      {simulation.netMarginWithOffer.toFixed(2)}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marge nette / vente
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
                <Card className="border-0 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
                  <div className="absolute inset-0 border border-violet-500/20 rounded-lg pointer-events-none" />
                  <CardHeader className="relative pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-violet-500" />
                      Seuil de rentabilité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    {simulation.breakevenIncreasePercent !== null && !simulation.isLoss ? (
                      <div className="space-y-2">
                        <p className="text-3xl font-bold tracking-tight text-violet-600">
                          +{simulation.breakevenIncreasePercent.toFixed(0)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Augmentation minimum des commandes nécessaire
                        </p>
                        {simulation.uberEstimate !== null && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                            <UberEatsIcon className="h-4 w-4" />
                            <span className="text-sm">
                              Estimation Uber: <strong className="text-violet-600">+{simulation.uberEstimate}%</strong>
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

          {/* Empty State */}
          {!simulation && (
            <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
              <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
              <CardContent className="py-12 relative">
                <div className="text-center text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Sélectionnez un produit payé et un produit offert pour lancer la simulation</p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Best Combinations Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="p-2.5 bg-gradient-to-br from-violet-500/20 to-purple-500/20 backdrop-blur-sm rounded-xl"
                  whileHover={{ scale: 1.1 }}
                >
                  <ListOrdered className="h-5 w-5 text-violet-600" />
                </motion.div>
                <div>
                  <CardTitle className="text-lg">Meilleures combinaisons</CardTitle>
                  <CardDescription>
                    Top 20 des combinaisons les plus rentables
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {bestCombinations.filter(c => c.recommendation === "recommended").length} Recommandées
                </Badge>
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                  <MinusIcon className="h-3 w-3 mr-1" />
                  {bestCombinations.filter(c => c.recommendation === "moderate").length} Modérées
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Produit acheté</TableHead>
                    <TableHead>Produit offert</TableHead>
                    <TableHead className="text-right">Marge avec offre</TableHead>
                    <TableHead className="text-right">Seuil rentabilité</TableHead>
                    <TableHead className="text-center">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bestCombinations.map((combo, index) => (
                    <TableRow 
                      key={`${combo.paidProduct.id}-${combo.freeProduct.id}`}
                      className={`transition-colors cursor-pointer hover:bg-muted/20 ${
                        paidProductId === combo.paidProduct.id && freeProductId === combo.freeProduct.id
                          ? "bg-violet-500/5 ring-1 ring-inset ring-violet-500/20" 
                          : ""
                      }`}
                      onClick={() => {
                        setPaidProductId(combo.paidProduct.id);
                        setFreeProductId(combo.freeProduct.id);
                      }}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[150px]">{combo.paidProduct.name}</span>
                          <span className="text-xs text-muted-foreground">{combo.paidProduct.price_uber?.toFixed(2)}€</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[150px]">{combo.freeProduct.name}</span>
                          <span className="text-xs text-muted-foreground">FC: {combo.freeProduct.food_cost?.toFixed(2)}€</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono font-semibold ${
                          combo.netMarginWithOffer < 0 
                            ? "bg-red-500/10 text-red-600" 
                            : combo.netMarginWithOffer < 1 
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-emerald-500/10 text-emerald-600"
                        }`}>
                          {combo.netMarginWithOffer.toFixed(2)}€
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {combo.breakevenPercent !== null ? (
                          <span className={combo.breakevenPercent <= 60 ? "text-emerald-600" : combo.breakevenPercent <= 120 ? "text-amber-600" : "text-red-600"}>
                            +{combo.breakevenPercent.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-red-500">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-help transition-all hover:scale-105 ${
                                combo.recommendation === "recommended"
                                  ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                                  : combo.recommendation === "moderate"
                                    ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                                    : "bg-red-500/15 text-red-600 border border-red-500/30"
                              }`}>
                                {combo.recommendation === "recommended" ? (
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                ) : combo.recommendation === "moderate" ? (
                                  <MinusIcon className="h-3.5 w-3.5" />
                                ) : (
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                )}
                                <span className="text-xs font-medium">
                                  {combo.recommendation === "recommended" ? "Go" : combo.recommendation === "moderate" ? "Risqué" : "Stop"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">
                                  {combo.recommendation === "recommended" 
                                    ? "✅ Combinaison recommandée" 
                                    : combo.recommendation === "moderate"
                                      ? "⚠️ Risque modéré"
                                      : "❌ Combinaison déconseillée"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {combo.recommendation === "recommended" 
                                    ? "Seuil facilement atteignable (<60%)" 
                                    : combo.recommendation === "moderate"
                                      ? "Seuil élevé (60-120%)"
                                      : "Seuil trop élevé ou marge négative"}
                                </p>
                              </div>
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
