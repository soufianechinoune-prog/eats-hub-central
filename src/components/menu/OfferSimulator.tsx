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
  const [showCalculationDetails, setShowCalculationDetails] = useState<boolean>(true);

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

          {/* Calculation Details */}
          {simulation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-0 border border-indigo-500/20 rounded-lg pointer-events-none" />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-indigo-500" />
                      Comprendre le calcul du seuil
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCalculationDetails(!showCalculationDetails)}
                      className="h-8 px-2"
                    >
                      {showCalculationDetails ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                
                {showCalculationDetails && (
                  <CardContent className="relative space-y-6">
                    {/* Step 1: Normal Sale */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500 text-white">Étape 1</Badge>
                        <span className="font-semibold text-sm">Marge sans offre (1 vente = 1 produit)</span>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-white/40">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <div className="flex flex-col items-center p-3 bg-emerald-500/10 rounded-lg min-w-[80px]">
                            <span className="text-xs text-muted-foreground">Prix</span>
                            <span className="font-bold text-emerald-600">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-5 w-5 text-muted-foreground" />
                          <div className="flex flex-col items-center p-3 bg-orange-500/10 rounded-lg min-w-[80px]">
                            <span className="text-xs text-muted-foreground">Commission</span>
                            <span className="font-bold text-orange-600">{(simulation.price * uberCommission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-5 w-5 text-muted-foreground" />
                          <div className="flex flex-col items-center p-3 bg-red-500/10 rounded-lg min-w-[80px]">
                            <span className="text-xs text-muted-foreground">Food Cost</span>
                            <span className="font-bold text-red-600">{simulation.foodCost.toFixed(2)}€</span>
                          </div>
                          <Equal className="h-5 w-5 text-muted-foreground" />
                          <div className="flex flex-col items-center p-3 bg-primary/15 rounded-lg min-w-[80px] border-2 border-primary/30">
                            <span className="text-xs text-muted-foreground">Marge</span>
                            <span className="font-bold text-primary">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <ArrowDown className="h-5 w-5 mx-auto text-muted-foreground/50" />

                    {/* Step 2: BOGO Sale */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500 text-white">Étape 2</Badge>
                        <span className="font-semibold text-sm">Marge avec BOGO (1 vente = 2 produits)</span>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-white/40">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <div className="flex flex-col items-center p-3 bg-emerald-500/10 rounded-lg min-w-[80px]">
                            <span className="text-xs text-muted-foreground">Prix</span>
                            <span className="font-bold text-emerald-600">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-5 w-5 text-muted-foreground" />
                          <div className="flex flex-col items-center p-3 bg-orange-500/10 rounded-lg min-w-[80px]">
                            <span className="text-xs text-muted-foreground">Commission</span>
                            <span className="font-bold text-orange-600">{(simulation.price * uberCommission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-5 w-5 text-muted-foreground" />
                          <div className="flex flex-col items-center p-3 bg-red-500/10 rounded-lg min-w-[80px]">
                            <span className="text-xs text-muted-foreground">Food Cost ×2</span>
                            <span className="font-bold text-red-600">{(simulation.foodCost * 2).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-5 w-5 text-muted-foreground" />
                          <div className="flex flex-col items-center p-3 bg-purple-500/10 rounded-lg min-w-[80px]">
                            <span className="text-xs text-muted-foreground">Frais offre</span>
                            <span className="font-bold text-purple-600">{offerFee.toFixed(2)}€</span>
                          </div>
                          <Equal className="h-5 w-5 text-muted-foreground" />
                          <div className={`flex flex-col items-center p-3 rounded-lg min-w-[80px] border-2 ${simulation.isLoss ? "bg-red-500/15 border-red-500/30" : "bg-primary/15 border-primary/30"}`}>
                            <span className="text-xs text-muted-foreground">Marge</span>
                            <span className={`font-bold ${simulation.isLoss ? "text-red-500" : "text-primary"}`}>{simulation.netMarginBogo.toFixed(2)}€</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <ArrowDown className="h-5 w-5 mx-auto text-muted-foreground/50" />

                    {/* Step 3: Breakeven Calculation */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-500 text-white">Étape 3</Badge>
                        <span className="font-semibold text-sm">Calcul du seuil de rentabilité</span>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-white/40">
                        <div className="text-center space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Pour gagner autant qu'avant, combien de ventes BOGO faut-il faire pour 1 vente normale ?
                          </p>
                          <div className="flex items-center justify-center gap-3 flex-wrap">
                            <div className="flex flex-col items-center p-3 bg-primary/10 rounded-lg">
                              <span className="text-xs text-muted-foreground">Marge normale</span>
                              <span className="font-bold">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                            </div>
                            <Divide className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col items-center p-3 bg-primary/10 rounded-lg">
                              <span className="text-xs text-muted-foreground">Marge BOGO</span>
                              <span className="font-bold">{simulation.netMarginBogo.toFixed(2)}€</span>
                            </div>
                            <Equal className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col items-center p-4 bg-blue-500/15 rounded-xl border-2 border-blue-500/30">
                              <span className="text-xs text-muted-foreground">Multiplicateur</span>
                              <span className="font-bold text-xl text-blue-600">
                                {simulation.breakevenMultiplier?.toFixed(2) ?? "N/A"}×
                              </span>
                            </div>
                          </div>
                          
                          {simulation.breakevenIncreasePercent !== null && !simulation.isLoss && (
                            <motion.div 
                              className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-500/20"
                              initial={{ scale: 0.9 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200 }}
                            >
                              <p className="text-sm text-muted-foreground mb-2">
                                Il faut <strong>{simulation.breakevenMultiplier?.toFixed(2)}×</strong> plus de ventes, soit une augmentation de :
                              </p>
                              <div className="flex items-center justify-center gap-2">
                                <Target className="h-6 w-6 text-blue-500" />
                                <span className="text-3xl font-bold text-blue-600">
                                  +{simulation.breakevenIncreasePercent.toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                ({simulation.breakevenMultiplier?.toFixed(2)} - 1) × 100 = {simulation.breakevenIncreasePercent.toFixed(0)}%
                              </p>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Comparison with Uber estimate */}
                    {simulation.uberEstimate !== null && simulation.breakevenIncreasePercent !== null && !simulation.isLoss && (
                      <>
                        <ArrowDown className="h-5 w-5 mx-auto text-muted-foreground/50" />
                        
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                          className="space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <Badge className={simulation.isProfitable ? "bg-emerald-500" : "bg-red-500"}>Verdict</Badge>
                            <span className="font-semibold text-sm">Comparaison avec l'estimation Uber</span>
                          </div>
                          <div className={`rounded-xl p-4 border-2 ${simulation.isProfitable ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                            <div className="flex items-center justify-center gap-6 flex-wrap">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Estimation Uber</p>
                                <div className="flex items-center gap-1">
                                  <UberEatsIcon className="h-5 w-5" />
                                  <span className="text-2xl font-bold text-orange-600">+{simulation.uberEstimate}%</span>
                                </div>
                              </div>
                              <div className={`text-2xl font-bold ${simulation.isProfitable ? "text-emerald-500" : "text-red-500"}`}>
                                {simulation.isProfitable ? ">" : "<"}
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Seuil requis</p>
                                <div className="flex items-center gap-1">
                                  <Target className="h-5 w-5 text-blue-500" />
                                  <span className="text-2xl font-bold text-blue-600">+{simulation.breakevenIncreasePercent.toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                            <p className={`text-center mt-3 text-sm font-medium ${simulation.isProfitable ? "text-emerald-600" : "text-red-600"}`}>
                              {simulation.isProfitable 
                                ? "✓ L'offre devrait être rentable selon l'estimation Uber"
                                : "✗ L'offre risque de diluer votre marge"
                              }
                            </p>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
