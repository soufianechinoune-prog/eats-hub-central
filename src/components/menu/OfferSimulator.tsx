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
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Gift,
  Percent,
  Euro,
  Info,
  Target,
  Zap,
  ArrowRight,
  ArrowDown,
  Minus,
  Equal,
  Divide,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  ThumbsUp,
  ThumbsDown,
  Minus as MinusIcon,
} from "lucide-react";
import { UberEatsIcon } from "@/components/icons/PlatformIcons";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
}

interface OfferSimulatorProps {
  menuItems: MenuItem[];
}

export function OfferSimulator({ menuItems }: OfferSimulatorProps) {
  // Simulation parameters
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [uberCommission, setUberCommission] = useState<number>(30);
  const [offerFee, setOfferFee] = useState<number>(0.89);
  const [uberEstimatedIncrease, setUberEstimatedIncrease] = useState<string>("");
  const [showCalculationDetails, setShowCalculationDetails] = useState<boolean>(false);

  // Get products with food cost and uber price
  const eligibleProducts = useMemo(() => {
    return menuItems.filter(
      item => item.price_uber && item.food_cost && item.food_cost > 0 && item.is_active
    );
  }, [menuItems]);

  // Get selected product
  const selectedProduct = useMemo(() => {
    return eligibleProducts.find(p => p.id === selectedProductId);
  }, [eligibleProducts, selectedProductId]);

  // Calculate BOGO simulation
  const simulation = useMemo(() => {
    if (!selectedProduct || !selectedProduct.price_uber || !selectedProduct.food_cost) {
      return null;
    }

    const price = selectedProduct.price_uber;
    const foodCost = selectedProduct.food_cost;
    const commission = uberCommission / 100;

    // Without offer: 1 unit sold
    // Revenue: price
    // Uber commission: price * commission
    // Food cost: foodCost
    // Net margin per unit = price - (price * commission) - foodCost
    const netMarginPerUnit = price - (price * commission) - foodCost;
    const marginPercentWithoutOffer = (netMarginPerUnit / price) * 100;

    // With BOGO offer: 2 units for price of 1
    // Revenue: price (for 2 units)
    // Uber commission: price * commission
    // Offer fee: offerFee
    // Food cost: foodCost * 2 (2 units produced)
    // Net margin per BOGO sale = price - (price * commission) - offerFee - (foodCost * 2)
    const netMarginBogo = price - (price * commission) - offerFee - (foodCost * 2);
    const marginPercentWithOffer = (netMarginBogo / price) * 100;

    // Breakeven calculation
    // To maintain same total profit, need X BOGO sales instead of 1 normal sale
    // X * netMarginBogo = netMarginPerUnit
    // X = netMarginPerUnit / netMarginBogo
    const breakevenMultiplier = netMarginBogo > 0 ? netMarginPerUnit / netMarginBogo : null;
    const breakevenIncreasePercent = breakevenMultiplier ? (breakevenMultiplier - 1) * 100 : null;

    // Compare with Uber's estimated increase if provided
    const uberEstimate = parseFloat(uberEstimatedIncrease) || null;
    const isProfitable = breakevenIncreasePercent !== null && uberEstimate !== null && uberEstimate > breakevenIncreasePercent;
    const isBreakeven = breakevenIncreasePercent !== null && uberEstimate !== null && Math.abs(uberEstimate - breakevenIncreasePercent) < 5;

    return {
      price,
      foodCost,
      netMarginPerUnit,
      marginPercentWithoutOffer,
      netMarginBogo,
      marginPercentWithOffer,
      breakevenMultiplier,
      breakevenIncreasePercent,
      uberEstimate,
      isProfitable,
      isBreakeven,
      isLoss: netMarginBogo < 0,
    };
  }, [selectedProduct, uberCommission, offerFee, uberEstimatedIncrease]);

  // Calculate all products analysis for the summary table
  const allProductsAnalysis = useMemo(() => {
    const commission = uberCommission / 100;
    
    return eligibleProducts.map(product => {
      const price = product.price_uber!;
      const foodCost = product.food_cost!;
      
      const netMarginPerUnit = price - (price * commission) - foodCost;
      const netMarginBogo = price - (price * commission) - offerFee - (foodCost * 2);
      const breakevenMultiplier = netMarginBogo > 0 ? netMarginPerUnit / netMarginBogo : null;
      const breakevenIncreasePercent = breakevenMultiplier ? (breakevenMultiplier - 1) * 100 : null;
      const marginPercent = (netMarginPerUnit / price) * 100;
      const foodCostPercent = (foodCost / price) * 100;
      
      // Recommendation based on breakeven threshold
      let recommendation: "recommended" | "moderate" | "not_recommended";
      if (netMarginBogo <= 0) {
        recommendation = "not_recommended";
      } else if (breakevenIncreasePercent !== null && breakevenIncreasePercent <= 80) {
        recommendation = "recommended";
      } else if (breakevenIncreasePercent !== null && breakevenIncreasePercent <= 150) {
        recommendation = "moderate";
      } else {
        recommendation = "not_recommended";
      }
      
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        price,
        foodCost,
        foodCostPercent,
        netMarginPerUnit,
        netMarginBogo,
        marginPercent,
        breakevenIncreasePercent,
        recommendation,
      };
    }).sort((a, b) => {
      // Sort by recommendation first (recommended > moderate > not_recommended)
      // Then by breakeven percent (lower is better)
      const order = { recommended: 0, moderate: 1, not_recommended: 2 };
      if (order[a.recommendation] !== order[b.recommendation]) {
        return order[a.recommendation] - order[b.recommendation];
      }
      // Lower breakeven is better
      const aBreakeven = a.breakevenIncreasePercent ?? Infinity;
      const bBreakeven = b.breakevenIncreasePercent ?? Infinity;
      return aBreakeven - bBreakeven;
    });
  }, [eligibleProducts, uberCommission, offerFee]);

  // Determine recommendation
  const recommendation = useMemo(() => {
    if (!simulation) return null;

    if (simulation.isLoss) {
      return {
        type: "danger",
        icon: AlertTriangle,
        title: "Offre non rentable",
        message: "Cette offre génère une perte à chaque vente BOGO. Déconseillé.",
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
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
      };
    }

    if (simulation.isProfitable) {
      return {
        type: "success",
        icon: CheckCircle2,
        title: "Offre rentable",
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
      title: "Offre risquée",
      message: `L'estimation Uber (+${simulation.uberEstimate}%) est inférieure au seuil nécessaire (+${simulation.breakevenIncreasePercent?.toFixed(0)}%)`,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
    };
  }, [simulation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <CardHeader className="relative">
            <div className="flex items-center gap-3">
              <motion.div 
                className="p-3 bg-primary/15 backdrop-blur-sm rounded-xl shadow-lg"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Gift className="h-6 w-6 text-primary" />
              </motion.div>
              <div>
                <CardTitle className="text-xl">Simulateur d'Offres BOGO</CardTitle>
                <CardDescription>
                  Calculez la rentabilité des offres "1 acheté = 1 offert" sur Uber Eats
                </CardDescription>
              </div>
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
                <Calculator className="h-5 w-5 text-primary" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-6">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Produit
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Seuls les produits avec Food Cost renseigné sont affichés</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="bg-white/60 dark:bg-white/5 border-white/40">
                    <SelectValue placeholder="Sélectionner un produit" />
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
                {eligibleProducts.length === 0 && (
                  <p className="text-sm text-amber-600">
                    Aucun produit avec Food Cost renseigné. Complétez d'abord l'onglet Food Cost.
                  </p>
                )}
              </div>

              {/* Product Info Display */}
              {selectedProduct && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Prix Uber</span>
                    <span className="font-mono font-semibold text-orange-600">
                      {selectedProduct.price_uber?.toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Food Cost</span>
                    <span className="font-mono font-semibold">
                      {selectedProduct.food_cost?.toFixed(2)}€
                    </span>
                  </div>
                  {selectedProduct.category && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Catégorie</span>
                      <Badge variant="secondary">{selectedProduct.category}</Badge>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Uber Commission */}
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Commission Uber
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Taux de commission Uber Eats appliqué sur chaque commande</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <Badge variant="outline" className="font-mono">{uberCommission}%</Badge>
                </Label>
                <Slider
                  value={[uberCommission]}
                  onValueChange={([value]) => setUberCommission(value)}
                  min={15}
                  max={40}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Offer Fee */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Frais d'utilisation de l'offre
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Frais fixe facturé par Uber pour chaque utilisation de l'offre</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
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

              {/* Uber Estimated Increase */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UberEatsIcon className="h-4 w-4" />
                  Estimation Uber (augmentation commandes)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Pourcentage d'augmentation des commandes estimé par Uber (ex: +74%)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Ex: 74"
                    value={uberEstimatedIncrease}
                    onChange={(e) => setUberEstimatedIncrease(e.target.value)}
                    className="bg-white/60 dark:bg-white/5 border-white/40 pr-8"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              {/* Without Offer */}
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
                      {simulation.netMarginPerUnit.toFixed(2)}€
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

              {/* With BOGO */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className={`border-0 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] ${simulation.isLoss ? "bg-red-500/10" : "bg-white/60 dark:bg-white/5"}`}>
                  <div className={`absolute inset-0 border rounded-lg pointer-events-none ${simulation.isLoss ? "border-red-500/30" : "border-white/40"}`} />
                  <CardHeader className="relative pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5" />
                      Avec BOGO
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className={`text-2xl font-bold tracking-tight ${simulation.isLoss ? "text-red-500" : ""}`}>
                      {simulation.netMarginBogo.toFixed(2)}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marge nette / vente BOGO
                    </p>
                    <Badge 
                      className={`mt-2 ${simulation.marginPercentWithOffer >= 15 ? "bg-emerald-500" : simulation.marginPercentWithOffer >= 0 ? "bg-amber-500" : "bg-red-500"}`}
                    >
                      {simulation.marginPercentWithOffer.toFixed(1)}%
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Breakeven */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="col-span-2"
              >
                <Card className="border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
                  <div className="absolute inset-0 border border-blue-500/20 rounded-lg pointer-events-none" />
                  <CardHeader className="relative pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      Seuil de rentabilité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    {simulation.breakevenIncreasePercent !== null && !simulation.isLoss ? (
                      <div className="space-y-2">
                        <p className="text-3xl font-bold tracking-tight text-blue-600">
                          +{simulation.breakevenIncreasePercent.toFixed(0)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Augmentation minimum des commandes nécessaire pour maintenir la rentabilité
                        </p>
                        {simulation.uberEstimate !== null && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                            <UberEatsIcon className="h-4 w-4" />
                            <span className="text-sm">
                              Estimation Uber: <strong className="text-orange-600">+{simulation.uberEstimate}%</strong>
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
                        Impossible de calculer - marge BOGO négative
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
                  <p>Sélectionnez un produit pour lancer la simulation</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calculation Details - Compact Version */}
          {simulation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-0 border border-indigo-500/20 rounded-lg pointer-events-none" />
                <CardHeader className="relative py-3">
                  <button
                    onClick={() => setShowCalculationDetails(!showCalculationDetails)}
                    className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm font-medium text-muted-foreground">Détail du calcul</span>
                      <Badge variant="outline" className="text-xs font-normal">3 étapes</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Compact Summary when collapsed */}
                      {!showCalculationDetails && (
                        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded">
                            {simulation.netMarginPerUnit.toFixed(2)}€
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className={`px-2 py-0.5 rounded ${simulation.isLoss ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"}`}>
                            {simulation.netMarginBogo.toFixed(2)}€
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded font-semibold">
                            +{simulation.breakevenIncreasePercent?.toFixed(0) ?? "?"}%
                          </span>
                        </div>
                      )}
                      {showCalculationDetails ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                </CardHeader>
                
                {showCalculationDetails && (
                  <CardContent className="relative pt-0 pb-4">
                    {/* Compact 3-column layout on desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {/* Step 1: Normal Sale */}
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-white/40">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">1</Badge>
                          <span className="text-xs font-medium">Sans offre</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 flex-wrap text-xs">
                          <div className="flex flex-col items-center p-1.5 bg-emerald-500/10 rounded min-w-[50px]">
                            <span className="text-[10px] text-muted-foreground">Prix</span>
                            <span className="font-bold text-emerald-600 text-sm">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-orange-500/10 rounded min-w-[50px]">
                            <span className="text-[10px] text-muted-foreground">Comm.</span>
                            <span className="font-bold text-orange-600 text-sm">{(simulation.price * uberCommission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-red-500/10 rounded min-w-[50px]">
                            <span className="text-[10px] text-muted-foreground">FC</span>
                            <span className="font-bold text-red-600 text-sm">{simulation.foodCost.toFixed(2)}€</span>
                          </div>
                          <Equal className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-primary/15 rounded border border-primary/30 min-w-[50px]">
                            <span className="text-[10px] text-muted-foreground">Marge</span>
                            <span className="font-bold text-primary text-sm">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: BOGO Sale */}
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-white/40">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">2</Badge>
                          <span className="text-xs font-medium">Avec BOGO</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 flex-wrap text-xs">
                          <div className="flex flex-col items-center p-1.5 bg-emerald-500/10 rounded min-w-[45px]">
                            <span className="text-[10px] text-muted-foreground">Prix</span>
                            <span className="font-bold text-emerald-600 text-sm">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-orange-500/10 rounded min-w-[45px]">
                            <span className="text-[10px] text-muted-foreground">Comm.</span>
                            <span className="font-bold text-orange-600 text-sm">{(simulation.price * uberCommission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-red-500/10 rounded min-w-[45px]">
                            <span className="text-[10px] text-muted-foreground">FC×2</span>
                            <span className="font-bold text-red-600 text-sm">{(simulation.foodCost * 2).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-purple-500/10 rounded min-w-[45px]">
                            <span className="text-[10px] text-muted-foreground">Frais</span>
                            <span className="font-bold text-purple-600 text-sm">{offerFee.toFixed(2)}€</span>
                          </div>
                          <Equal className="h-3 w-3 text-muted-foreground" />
                          <div className={`flex flex-col items-center p-1.5 rounded border min-w-[45px] ${simulation.isLoss ? "bg-red-500/15 border-red-500/30" : "bg-primary/15 border-primary/30"}`}>
                            <span className="text-[10px] text-muted-foreground">Marge</span>
                            <span className={`font-bold text-sm ${simulation.isLoss ? "text-red-500" : "text-primary"}`}>{simulation.netMarginBogo.toFixed(2)}€</span>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Breakeven */}
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-white/40">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">3</Badge>
                          <span className="text-xs font-medium">Seuil rentabilité</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 text-xs">
                          <div className="flex flex-col items-center p-1.5 bg-primary/10 rounded">
                            <span className="text-[10px] text-muted-foreground">Normale</span>
                            <span className="font-bold text-sm">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                          </div>
                          <Divide className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-primary/10 rounded">
                            <span className="text-[10px] text-muted-foreground">BOGO</span>
                            <span className="font-bold text-sm">{simulation.netMarginBogo.toFixed(2)}€</span>
                          </div>
                          <Equal className="h-3 w-3 text-muted-foreground" />
                          <div className="flex flex-col items-center p-2 bg-blue-500/15 rounded-lg border border-blue-500/30">
                            <span className="text-[10px] text-muted-foreground">Seuil</span>
                            <span className="font-bold text-lg text-blue-600">+{simulation.breakevenIncreasePercent?.toFixed(0) ?? "?"}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Products Summary Table */}
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
                  className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 backdrop-blur-sm rounded-xl"
                  whileHover={{ scale: 1.1 }}
                >
                  <ListOrdered className="h-5 w-5 text-emerald-600" />
                </motion.div>
                <div>
                  <CardTitle className="text-lg">Classement des produits pour BOGO</CardTitle>
                  <CardDescription>
                    {allProductsAnalysis.length} produits analysés, classés par potentiel de rentabilité
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {allProductsAnalysis.filter(p => p.recommendation === "recommended").length} Recommandés
                </Badge>
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                  <MinusIcon className="h-3 w-3 mr-1" />
                  {allProductsAnalysis.filter(p => p.recommendation === "moderate").length} Modérés
                </Badge>
                <Badge className="bg-red-500/15 text-red-600 border-red-500/30">
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  {allProductsAnalysis.filter(p => p.recommendation === "not_recommended").length} Déconseillés
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
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Prix Uber</TableHead>
                    <TableHead className="text-right">Food Cost</TableHead>
                    <TableHead className="text-right">Marge actuelle</TableHead>
                    <TableHead className="text-right">Marge BOGO</TableHead>
                    <TableHead className="text-center">Seuil rentabilité</TableHead>
                    <TableHead className="text-center">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProductsAnalysis.slice(0, 15).map((product, index) => (
                    <TableRow 
                      key={product.id}
                      className={`transition-colors cursor-pointer hover:bg-muted/20 ${
                        selectedProductId === product.id ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                      }`}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[200px]">{product.name}</span>
                          {product.category && (
                            <span className="text-xs text-muted-foreground">{product.category}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {product.price.toFixed(2)}€
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono">{product.foodCost.toFixed(2)}€</span>
                          <span className={`text-xs ${product.foodCostPercent > 40 ? "text-red-500" : product.foodCostPercent > 30 ? "text-amber-500" : "text-emerald-500"}`}>
                            ({product.foodCostPercent.toFixed(0)}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-semibold text-emerald-600">{product.netMarginPerUnit.toFixed(2)}€</span>
                          <span className="text-xs text-muted-foreground">({product.marginPercent.toFixed(0)}%)</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono font-semibold ${product.netMarginBogo < 0 ? "text-red-500" : "text-blue-600"}`}>
                          {product.netMarginBogo.toFixed(2)}€
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {product.breakevenIncreasePercent !== null ? (
                          <Badge 
                            variant="outline" 
                            className={`font-mono ${
                              product.breakevenIncreasePercent <= 80 
                                ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10" 
                                : product.breakevenIncreasePercent <= 150 
                                  ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                                  : "border-red-500/40 text-red-600 bg-red-500/10"
                            }`}
                          >
                            +{product.breakevenIncreasePercent.toFixed(0)}%
                          </Badge>
                        ) : (
                          <Badge variant="destructive">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {product.recommendation === "recommended" ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center justify-center">
                                  <ThumbsUp className="h-4 w-4 text-emerald-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Seuil atteignable (&lt;80%), BOGO recommandé</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : product.recommendation === "moderate" ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center justify-center">
                                  <MinusIcon className="h-4 w-4 text-amber-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Seuil modéré (80-150%), risque acceptable</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center justify-center">
                                  <ThumbsDown className="h-4 w-4 text-red-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Seuil trop élevé (&gt;150%) ou marge négative, déconseillé</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {allProductsAnalysis.length > 15 && (
              <p className="text-center text-sm text-muted-foreground mt-3">
                Affichage des 15 premiers produits sur {allProductsAnalysis.length}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
