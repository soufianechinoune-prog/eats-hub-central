import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  Gift,
  Percent,
  Euro,
  Info,
  Target,
  Zap,
  ArrowRight,
  ArrowLeft,
  Minus,
  Equal,
  Divide,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  ThumbsUp,
  ThumbsDown,
  Minus as MinusIcon,
  Flame,
  TrendingUp,
  Filter,
  ArrowUpDown,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { UberEatsIcon } from "@/components/icons/PlatformIcons";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName } from "@/lib/fuzzyMatch";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
}

interface BogoSimulatorProps {
  menuItems: MenuItem[];
  onBack: () => void;
}

type SortCriteria = "score" | "margin_percent" | "sales" | "margin_euro";

export function BogoSimulator({ menuItems, onBack }: BogoSimulatorProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [uberCommission, setUberCommission] = useState<number>(30);
  const [offerFee, setOfferFee] = useState<number>(0.89);
  const [uberEstimatedIncrease, setUberEstimatedIncrease] = useState<string>("");
  const [showCalculationDetails, setShowCalculationDetails] = useState<boolean>(false);
  
  // Sales data from order_items
  const [salesData, setSalesData] = useState<Record<string, number>>({});
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  
  // Filters & Sorting
  const [sortBy, setSortBy] = useState<SortCriteria>("score");
  const [filterTopSellers, setFilterTopSellers] = useState(false);
  const [filterMaxPrice, setFilterMaxPrice] = useState(false);
  const [maxPriceValue, setMaxPriceValue] = useState(20);
  const [minMarginPercent, setMinMarginPercent] = useState(0);

  // Fetch sales data from order_items
  useEffect(() => {
    const fetchSalesData = async () => {
      setIsLoadingSales(true);
      try {
        const { data, error } = await supabase
          .from("order_items")
          .select("item_title, quantity");
        
        if (error) throw error;
        
        // Aggregate sales by normalized item name
        const salesMap: Record<string, number> = {};
        const normalizedToOriginal: Record<string, string> = {};
        
        // Create normalized name map for menu items
        menuItems.forEach(item => {
          const normalized = normalizeName(item.name);
          normalizedToOriginal[normalized] = item.id;
        });
        
        // Count sales
        data?.forEach(row => {
          const normalizedTitle = normalizeName(row.item_title);
          
          // Try exact match first
          if (normalizedToOriginal[normalizedTitle]) {
            const menuItemId = normalizedToOriginal[normalizedTitle];
            salesMap[menuItemId] = (salesMap[menuItemId] || 0) + (row.quantity || 1);
          } else {
            // Fuzzy match: find best matching menu item
            let bestMatch: string | null = null;
            let bestScore = 0;
            
            for (const [normalized, id] of Object.entries(normalizedToOriginal)) {
              // Check if one contains the other or significant overlap
              if (normalizedTitle.includes(normalized) || normalized.includes(normalizedTitle)) {
                const score = Math.min(normalizedTitle.length, normalized.length) / Math.max(normalizedTitle.length, normalized.length);
                if (score > bestScore && score > 0.5) {
                  bestScore = score;
                  bestMatch = id;
                }
              }
            }
            
            if (bestMatch) {
              salesMap[bestMatch] = (salesMap[bestMatch] || 0) + (row.quantity || 1);
            }
          }
        });
        
        setSalesData(salesMap);
      } catch (error) {
        console.error("Error fetching sales data:", error);
      } finally {
        setIsLoadingSales(false);
      }
    };
    
    fetchSalesData();
  }, [menuItems]);

  const eligibleProducts = useMemo(() => {
    return menuItems.filter(
      item => item.price_uber && item.food_cost && item.food_cost > 0 && item.is_active
    );
  }, [menuItems]);

  const selectedProduct = useMemo(() => {
    return eligibleProducts.find(p => p.id === selectedProductId);
  }, [eligibleProducts, selectedProductId]);

  const simulation = useMemo(() => {
    if (!selectedProduct || !selectedProduct.price_uber || !selectedProduct.food_cost) {
      return null;
    }

    const price = selectedProduct.price_uber;
    const foodCost = selectedProduct.food_cost;
    const commission = uberCommission / 100;

    const netMarginPerUnit = price - (price * commission) - foodCost;
    const marginPercentWithoutOffer = (netMarginPerUnit / price) * 100;

    const netMarginBogo = price - (price * commission) - offerFee - (foodCost * 2);
    const marginPercentWithOffer = (netMarginBogo / price) * 100;

    const breakevenMultiplier = netMarginBogo > 0 ? netMarginPerUnit / netMarginBogo : null;
    const breakevenIncreasePercent = breakevenMultiplier ? (breakevenMultiplier - 1) * 100 : null;

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

  const allProductsAnalysis = useMemo(() => {
    const commission = uberCommission / 100;
    
    // Calculate max values for normalization
    const maxSales = Math.max(...eligibleProducts.map(p => salesData[p.id] || 0), 1);
    const maxPrice = Math.max(...eligibleProducts.map(p => p.price_uber || 0), 1);
    
    const products = eligibleProducts.map(product => {
      const price = product.price_uber!;
      const foodCost = product.food_cost!;
      const sales = salesData[product.id] || 0;
      
      const netMarginPerUnit = price - (price * commission) - foodCost;
      const netMarginBogo = price - (price * commission) - offerFee - (foodCost * 2);
      const breakevenMultiplier = netMarginBogo > 0 ? netMarginPerUnit / netMarginBogo : null;
      const breakevenIncreasePercent = breakevenMultiplier ? (breakevenMultiplier - 1) * 100 : null;
      
      // Margin percentages
      const marginPercent = (netMarginPerUnit / price) * 100;
      const marginBogoPercent = (netMarginBogo / price) * 100;
      const foodCostPercent = (foodCost / price) * 100;
      
      // Calculate BOGO Score (composite intelligent score)
      // 40% marge BOGO %, 40% popularité, 20% attractivité prix
      const normalizedMargin = marginBogoPercent > 0 ? Math.min(marginBogoPercent / 40, 1) : 0; // Normalize to ~40% max
      const normalizedSales = maxSales > 0 ? Math.log(sales + 1) / Math.log(maxSales + 1) : 0;
      const normalizedPriceAttractivity = (maxPrice - price) / maxPrice;
      
      const bogoScore = netMarginBogo > 0 
        ? (normalizedMargin * 40) + (normalizedSales * 40) + (normalizedPriceAttractivity * 20)
        : 0;
      
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
        marginBogoPercent,
        breakevenIncreasePercent,
        recommendation,
        sales,
        bogoScore,
      };
    });
    
    // Apply filters
    let filtered = products;
    
    if (filterTopSellers) {
      filtered = filtered.filter(p => p.sales >= 10);
    }
    
    if (filterMaxPrice) {
      filtered = filtered.filter(p => p.price <= maxPriceValue);
    }
    
    if (minMarginPercent > 0) {
      filtered = filtered.filter(p => p.marginBogoPercent >= minMarginPercent);
    }
    
    // Sort based on criteria
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "score":
          return b.bogoScore - a.bogoScore;
        case "margin_percent":
          return b.marginBogoPercent - a.marginBogoPercent;
        case "sales":
          return b.sales - a.sales;
        case "margin_euro":
          return b.netMarginBogo - a.netMarginBogo;
        default:
          return b.bogoScore - a.bogoScore;
      }
    });
  }, [eligibleProducts, uberCommission, offerFee, salesData, sortBy, filterTopSellers, filterMaxPrice, maxPriceValue, minMarginPercent]);

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

  // Get sales badge info
  const getSalesBadge = (sales: number) => {
    if (sales >= 50) return { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/15", label: "Top" };
    if (sales >= 20) return { icon: Flame, color: "text-amber-500", bg: "bg-amber-500/15", label: "Populaire" };
    if (sales >= 10) return { icon: Zap, color: "text-blue-500", bg: "bg-blue-500/15", label: "Bon" };
    return { icon: null, color: "text-muted-foreground", bg: "", label: "" };
  };

  // Get margin color based on percentage
  const getMarginColor = (percent: number, isBogoMargin: boolean = false) => {
    const threshold = isBogoMargin ? { high: 15, medium: 5 } : { high: 30, medium: 15 };
    if (percent >= threshold.high) return "text-emerald-600";
    if (percent >= threshold.medium) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-orange-500/30 rounded-lg pointer-events-none" />
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
                className="p-3 bg-orange-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Gift className="h-6 w-6 text-orange-500" />
              </motion.div>
              <div>
                <CardTitle className="text-xl">1 acheté = 1 offert (BOGO)</CardTitle>
                <CardDescription>
                  Calculez la rentabilité des offres "1 acheté = 1 offert" sur Uber Eats
                </CardDescription>
              </div>
              <Badge className="ml-auto bg-orange-500 text-white">+74% ventes</Badge>
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
                <Calculator className="h-5 w-5 text-orange-500" />
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ventes</span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const sales = salesData[selectedProduct.id] || 0;
                        const badge = getSalesBadge(sales);
                        return (
                          <>
                            <span className="font-mono font-semibold">{sales}</span>
                            {badge.icon && (
                              <badge.icon className={`h-4 w-4 ${badge.color}`} />
                            )}
                          </>
                        );
                      })()}
                    </div>
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
                  <CardContent className="relative pt-0 pb-6">
                    <div className="flex flex-col lg:flex-row items-stretch gap-4 lg:gap-2">
                      {/* Step 1 - Sans offre */}
                      <motion.div 
                        className="flex-1 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-5 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">1</div>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Sans offre</span>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="h-4 w-4 text-emerald-600" />
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <div className="flex flex-col items-center p-3 bg-white/70 dark:bg-white/10 rounded-lg min-w-[60px] shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix</span>
                            <span className="font-bold text-emerald-600 text-lg">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-4 w-4 text-emerald-600/60" />
                          <div className="flex flex-col items-center p-3 bg-white/70 dark:bg-white/10 rounded-lg min-w-[60px] shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Comm.</span>
                            <span className="font-bold text-orange-600 text-lg">{(simulation.price * uberCommission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-4 w-4 text-emerald-600/60" />
                          <div className="flex flex-col items-center p-3 bg-white/70 dark:bg-white/10 rounded-lg min-w-[60px] shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Food Cost</span>
                            <span className="font-bold text-red-500 text-lg">{simulation.foodCost.toFixed(2)}€</span>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-emerald-500/20">
                          <div className="flex items-center justify-center gap-3">
                            <Equal className="h-4 w-4 text-emerald-600" />
                            <div className="px-5 py-2.5 bg-emerald-500/20 rounded-xl border-2 border-emerald-500/40">
                              <span className="text-xs text-emerald-700 dark:text-emerald-400 block text-center mb-0.5">Marge nette</span>
                              <span className="font-black text-emerald-600 text-2xl block text-center">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                              <span className="text-xs text-emerald-600/80 block text-center">({((simulation.netMarginPerUnit / simulation.price) * 100).toFixed(0)}%)</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Arrow 1 */}
                      <div className="hidden lg:flex items-center justify-center">
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="flex items-center"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 flex items-center justify-center shadow-lg">
                            <ArrowRight className="h-5 w-5 text-white" />
                          </div>
                        </motion.div>
                      </div>
                      <div className="flex lg:hidden justify-center">
                        <motion.div
                          animate={{ y: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="w-8 h-8 rounded-full bg-gradient-to-b from-emerald-500 to-amber-500 flex items-center justify-center shadow-lg"
                        >
                          <ChevronDown className="h-5 w-5 text-white" />
                        </motion.div>
                      </div>

                      {/* Step 2 - Avec BOGO */}
                      <motion.div 
                        className={`flex-1 bg-gradient-to-br rounded-xl p-5 border-2 shadow-lg ${
                          simulation.isLoss 
                            ? "from-red-500/10 to-red-600/5 border-red-500/30 shadow-red-500/10" 
                            : "from-amber-500/10 to-orange-500/5 border-amber-500/30 shadow-amber-500/10"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${simulation.isLoss ? "bg-red-500" : "bg-amber-500"}`}>2</div>
                            <span className={`font-semibold ${simulation.isLoss ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>Avec BOGO</span>
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${simulation.isLoss ? "bg-red-500/20" : "bg-amber-500/20"}`}>
                            {simulation.isLoss ? <X className="h-4 w-4 text-red-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <div className="flex flex-col items-center p-2.5 bg-white/70 dark:bg-white/10 rounded-lg min-w-[52px] shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix</span>
                            <span className="font-bold text-emerald-600">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground/60" />
                          <div className="flex flex-col items-center p-2.5 bg-white/70 dark:bg-white/10 rounded-lg min-w-[52px] shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Comm.</span>
                            <span className="font-bold text-orange-600">{(simulation.price * uberCommission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground/60" />
                          <div className="flex flex-col items-center p-2.5 bg-white/70 dark:bg-white/10 rounded-lg min-w-[52px] shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">FC ×2</span>
                            <span className="font-bold text-red-500">{(simulation.foodCost * 2).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-3 w-3 text-muted-foreground/60" />
                          <div className="flex flex-col items-center p-2.5 bg-white/70 dark:bg-white/10 rounded-lg min-w-[52px] shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Frais</span>
                            <span className="font-bold text-purple-600">{offerFee.toFixed(2)}€</span>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-amber-500/20">
                          <div className="flex items-center justify-center gap-3">
                            <Equal className="h-4 w-4 text-amber-600" />
                            <div className={`px-5 py-2.5 rounded-xl border-2 ${
                              simulation.isLoss 
                                ? "bg-red-500/20 border-red-500/40" 
                                : "bg-amber-500/20 border-amber-500/40"
                            }`}>
                              <span className={`text-xs block text-center mb-0.5 ${simulation.isLoss ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>Marge BOGO</span>
                              <span className={`font-black text-2xl block text-center ${simulation.isLoss ? "text-red-600" : "text-amber-600"}`}>{simulation.netMarginBogo.toFixed(2)}€</span>
                              <span className={`text-xs block text-center ${simulation.isLoss ? "text-red-600/80" : "text-amber-600/80"}`}>({((simulation.netMarginBogo / simulation.price) * 100).toFixed(0)}%)</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Arrow 2 */}
                      <div className="hidden lg:flex items-center justify-center">
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                          className="flex items-center"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-blue-500 flex items-center justify-center shadow-lg">
                            <ArrowRight className="h-5 w-5 text-white" />
                          </div>
                        </motion.div>
                      </div>
                      <div className="flex lg:hidden justify-center">
                        <motion.div
                          animate={{ y: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                          className="w-8 h-8 rounded-full bg-gradient-to-b from-amber-500 to-blue-500 flex items-center justify-center shadow-lg"
                        >
                          <ChevronDown className="h-5 w-5 text-white" />
                        </motion.div>
                      </div>

                      {/* Step 3 - Seuil rentabilité */}
                      <motion.div 
                        className={`flex-1 lg:flex-[1.2] rounded-xl p-5 border-2 shadow-xl ${
                          simulation.breakevenIncreasePercent < 50 
                            ? "bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 border-emerald-500/40 shadow-emerald-500/20" 
                            : simulation.breakevenIncreasePercent < 100 
                            ? "bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/40 shadow-amber-500/20"
                            : "bg-gradient-to-br from-red-500/15 to-red-600/10 border-red-500/40 shadow-red-500/20"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                              simulation.breakevenIncreasePercent < 50 ? "bg-emerald-500" :
                              simulation.breakevenIncreasePercent < 100 ? "bg-amber-500" : "bg-red-500"
                            }`}>3</div>
                            <span className={`font-semibold ${
                              simulation.breakevenIncreasePercent < 50 ? "text-emerald-700 dark:text-emerald-400" :
                              simulation.breakevenIncreasePercent < 100 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"
                            }`}>Seuil rentabilité</span>
                          </div>
                          <Badge className={`text-xs font-bold px-3 py-1 ${
                            simulation.breakevenIncreasePercent < 50 
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                              : simulation.breakevenIncreasePercent < 100 
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "bg-red-500 hover:bg-red-600 text-white"
                          }`}>
                            {simulation.breakevenIncreasePercent < 50 ? "🚀 GO !" : 
                             simulation.breakevenIncreasePercent < 100 ? "⚠️ RISQUÉ" : "🛑 STOP"}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <div className="flex flex-col items-center p-3 bg-white/50 dark:bg-white/10 rounded-lg shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Marge normale</span>
                            <span className="font-bold text-lg">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                          </div>
                          <Divide className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col items-center p-3 bg-white/50 dark:bg-white/10 rounded-lg shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Marge BOGO</span>
                            <span className="font-bold text-lg">{simulation.netMarginBogo.toFixed(2)}€</span>
                          </div>
                        </div>

                        <motion.div 
                          className={`mx-auto max-w-[180px] py-4 px-6 rounded-2xl border-2 text-center ${
                            simulation.breakevenIncreasePercent < 50 
                              ? "bg-emerald-500/25 border-emerald-500/50" 
                              : simulation.breakevenIncreasePercent < 100 
                              ? "bg-amber-500/25 border-amber-500/50"
                              : "bg-red-500/25 border-red-500/50"
                          }`}
                          animate={{ 
                            boxShadow: simulation.breakevenIncreasePercent < 50 
                              ? ["0 0 20px rgba(16, 185, 129, 0.3)", "0 0 40px rgba(16, 185, 129, 0.5)", "0 0 20px rgba(16, 185, 129, 0.3)"]
                              : simulation.breakevenIncreasePercent < 100
                              ? ["0 0 20px rgba(245, 158, 11, 0.3)", "0 0 40px rgba(245, 158, 11, 0.5)", "0 0 20px rgba(245, 158, 11, 0.3)"]
                              : ["0 0 20px rgba(239, 68, 68, 0.3)", "0 0 40px rgba(239, 68, 68, 0.5)", "0 0 20px rgba(239, 68, 68, 0.3)"]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <span className="text-xs text-muted-foreground block mb-1">Augmentation requise</span>
                          <span className={`font-black text-4xl ${
                            simulation.breakevenIncreasePercent < 50 ? "text-emerald-600" :
                            simulation.breakevenIncreasePercent < 100 ? "text-amber-600" : "text-red-600"
                          }`}>+{simulation.breakevenIncreasePercent?.toFixed(0) ?? "?"}%</span>
                          <span className="text-xs text-muted-foreground block mt-1">des ventes</span>
                        </motion.div>
                      </motion.div>
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
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="p-2.5 bg-gradient-to-br from-orange-500/20 to-amber-500/20 backdrop-blur-sm rounded-xl"
                    whileHover={{ scale: 1.1 }}
                  >
                    <Sparkles className="h-5 w-5 text-orange-600" />
                  </motion.div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Classement intelligent BOGO
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold mb-1">Score BOGO = </p>
                            <p className="text-xs">40% Marge BOGO % + 40% Popularité + 20% Attractivité prix</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </CardTitle>
                    <CardDescription>
                      {allProductsAnalysis.length} produits analysés • Tri par score intelligent
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
              
              {/* Filters & Sorting */}
              <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Filtres:</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    id="filter-top-sellers"
                    checked={filterTopSellers}
                    onCheckedChange={setFilterTopSellers}
                  />
                  <Label htmlFor="filter-top-sellers" className="text-sm flex items-center gap-1 cursor-pointer">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    Top Sellers (≥10 ventes)
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    id="filter-max-price"
                    checked={filterMaxPrice}
                    onCheckedChange={setFilterMaxPrice}
                  />
                  <Label htmlFor="filter-max-price" className="text-sm cursor-pointer">
                    Prix max {maxPriceValue}€
                  </Label>
                  {filterMaxPrice && (
                    <Slider
                      value={[maxPriceValue]}
                      onValueChange={([v]) => setMaxPriceValue(v)}
                      min={10}
                      max={50}
                      step={5}
                      className="w-20"
                    />
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Marge % min:</Label>
                  <Slider
                    value={[minMarginPercent]}
                    onValueChange={([v]) => setMinMarginPercent(v)}
                    min={0}
                    max={30}
                    step={5}
                    className="w-24"
                  />
                  <Badge variant="outline" className="font-mono text-xs">{minMarginPercent}%</Badge>
                </div>
                
                <div className="h-6 w-px bg-border/50 mx-2" />
                
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Trier par:</span>
                </div>
                
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortCriteria)}>
                  <SelectTrigger className="w-[160px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        Score BOGO
                      </span>
                    </SelectItem>
                    <SelectItem value="margin_percent">
                      <span className="flex items-center gap-2">
                        <Percent className="h-3.5 w-3.5 text-emerald-500" />
                        Marge BOGO %
                      </span>
                    </SelectItem>
                    <SelectItem value="sales">
                      <span className="flex items-center gap-2">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        Ventes
                      </span>
                    </SelectItem>
                    <SelectItem value="margin_euro">
                      <span className="flex items-center gap-2">
                        <Euro className="h-3.5 w-3.5 text-blue-500" />
                        Marge BOGO €
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                    <TableHead className="text-center">Ventes</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">Marge actuelle</TableHead>
                    <TableHead className="text-right">Marge BOGO</TableHead>
                    <TableHead className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        Score
                      </span>
                    </TableHead>
                    <TableHead className="text-center">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSales ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Chargement des données de ventes...
                      </TableCell>
                    </TableRow>
                  ) : allProductsAnalysis.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun produit ne correspond aux filtres sélectionnés
                      </TableCell>
                    </TableRow>
                  ) : (
                    allProductsAnalysis.slice(0, 20).map((product, index) => {
                      const salesBadge = getSalesBadge(product.sales);
                      return (
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
                          <TableCell className="text-center">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${salesBadge.bg}`}>
                              {salesBadge.icon && <salesBadge.icon className={`h-3.5 w-3.5 ${salesBadge.color}`} />}
                              <span className={`font-mono font-semibold ${salesBadge.color}`}>
                                {product.sales}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {product.price.toFixed(2)}€
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono font-semibold text-emerald-600">{product.netMarginPerUnit.toFixed(2)}€</span>
                              <span className={`text-xs font-semibold ${getMarginColor(product.marginPercent)}`}>
                                ({product.marginPercent.toFixed(0)}%)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className={`font-mono font-semibold ${
                                product.netMarginBogo < 0 
                                  ? "text-red-600" 
                                  : product.netMarginBogo < 1 
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                              }`}>
                                {product.netMarginBogo.toFixed(2)}€
                              </span>
                              <span className={`text-xs font-semibold ${getMarginColor(product.marginBogoPercent, true)}`}>
                                ({product.marginBogoPercent.toFixed(0)}%)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`inline-flex items-center justify-center w-12 h-8 rounded-md font-bold text-sm ${
                              product.bogoScore >= 60 
                                ? "bg-purple-500/15 text-purple-600 border border-purple-500/30"
                                : product.bogoScore >= 40
                                  ? "bg-blue-500/15 text-blue-600 border border-blue-500/30"
                                  : product.bogoScore >= 20
                                    ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                                    : "bg-muted/30 text-muted-foreground"
                            }`}>
                              {product.bogoScore.toFixed(0)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-help transition-all hover:scale-105 ${
                                    product.recommendation === "recommended"
                                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                                      : product.recommendation === "moderate"
                                        ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                                        : "bg-red-500/15 text-red-600 border border-red-500/30"
                                  }`}>
                                    {product.recommendation === "recommended" ? (
                                      <ThumbsUp className="h-3.5 w-3.5" />
                                    ) : product.recommendation === "moderate" ? (
                                      <MinusIcon className="h-3.5 w-3.5" />
                                    ) : (
                                      <ThumbsDown className="h-3.5 w-3.5" />
                                    )}
                                    <span className="text-xs font-medium">
                                      {product.recommendation === "recommended" ? "Go" : product.recommendation === "moderate" ? "Risqué" : "Stop"}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <div className="space-y-1.5">
                                    <p className="font-semibold">
                                      {product.recommendation === "recommended" 
                                        ? "✅ BOGO recommandé" 
                                        : product.recommendation === "moderate"
                                          ? "⚠️ Risque modéré"
                                          : "❌ BOGO déconseillé"}
                                    </p>
                                    <div className="text-xs space-y-0.5">
                                      <p>
                                        <span className="text-muted-foreground">Marge BOGO:</span>{" "}
                                        <span className={product.netMarginBogo < 0 ? "text-red-400" : "text-emerald-400"}>
                                          {product.netMarginBogo.toFixed(2)}€ ({product.marginBogoPercent.toFixed(0)}%)
                                        </span>
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">Ventes:</span>{" "}
                                        <span>{product.sales} unités</span>
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">Score BOGO:</span>{" "}
                                        <span className="font-mono">{product.bogoScore.toFixed(0)}/100</span>
                                      </p>
                                      {product.breakevenIncreasePercent !== null && (
                                        <p>
                                          <span className="text-muted-foreground">Seuil:</span>{" "}
                                          <span className="font-mono">+{product.breakevenIncreasePercent.toFixed(0)}%</span> ventes
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {allProductsAnalysis.length > 20 && (
              <p className="text-center text-sm text-muted-foreground mt-3">
                Affichage des 20 premiers produits sur {allProductsAnalysis.length}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
