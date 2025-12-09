import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { subDays, startOfYear } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
  HelpCircle,
  BookOpen,
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
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName } from "@/lib/fuzzyMatch";

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

interface BogoSimulatorProps {
  menuItems: MenuItem[];
  onBack: () => void;
  platform: Platform;
  commission: number;
  onCommissionChange: (value: number) => void;
}

type SortCriteria = "score" | "margin_percent" | "sales" | "margin_euro";
type SalesPeriod = "30days" | "90days" | "year" | "all";

const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  "30days": "30 derniers jours",
  "90days": "90 derniers jours",
  "year": "Cette année",
  "all": "Tout l'historique",
};

// Platform-specific defaults
const PLATFORM_CONFIG = {
  uber: { defaultCommission: 30, defaultOfferFee: 0.89, color: "orange", name: "Uber Eats" },
  deliveroo: { defaultCommission: 25, defaultOfferFee: 0, color: "cyan", name: "Deliveroo" },
};

export function BogoSimulator({ menuItems, onBack, platform, commission, onCommissionChange }: BogoSimulatorProps) {
  const config = PLATFORM_CONFIG[platform];
  const isUber = platform === "uber";
  const PlatformIcon = isUber ? UberEatsIcon : DeliverooIcon;
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [offerFee, setOfferFee] = useState<number>(config.defaultOfferFee);
  const [uberEstimatedIncrease, setUberEstimatedIncrease] = useState<string>("");
  const [showCalculationDetails, setShowCalculationDetails] = useState<boolean>(false);
  
  // Sales data from order_items
  const [salesData, setSalesData] = useState<Record<string, number>>({});
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  
  // Filters & Sorting
  const [sortBy, setSortBy] = useState<SortCriteria>("score");
  const [filterTopSellers, setFilterTopSellers] = useState(false);
  const [filterMaxPrice, setFilterMaxPrice] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("30days");
  const [maxPriceValue, setMaxPriceValue] = useState(20);
  const [minMarginPercent, setMinMarginPercent] = useState(0);

  // Get start date based on period selection
  const getStartDate = (period: SalesPeriod): string | null => {
    const now = new Date();
    switch (period) {
      case "30days": return subDays(now, 30).toISOString();
      case "90days": return subDays(now, 90).toISOString();
      case "year": return startOfYear(now).toISOString();
      default: return null;
    }
  };

  // Fetch sales data from order_items via orders join
  useEffect(() => {
    const fetchSalesData = async () => {
      setIsLoadingSales(true);
      try {
        const startDate = getStartDate(salesPeriod);
        
        let allItems: Array<{ item_title: string; quantity: number }> = [];
        
        if (startDate) {
          // Fetch via orders join to filter by date
          const { data, error } = await supabase
            .from("orders")
            .select(`
              order_datetime,
              order_items (
                item_title,
                quantity
              )
            `)
            .gte("order_datetime", startDate);
          
          if (error) throw error;
          
          // Flatten results
          allItems = data?.flatMap(order => order.order_items || []) || [];
        } else {
          // Fetch all order_items without date filter
          const { data, error } = await supabase
            .from("order_items")
            .select("item_title, quantity");
          
          if (error) throw error;
          allItems = data || [];
        }
        
        // Aggregate sales by normalized item name
        const salesMap: Record<string, number> = {};
        const normalizedToOriginal: Record<string, string> = {};
        
        // Create normalized name map for menu items
        menuItems.forEach(item => {
          const normalized = normalizeName(item.name);
          normalizedToOriginal[normalized] = item.id;
        });
        
        // Count sales
        allItems.forEach(row => {
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
        
        console.log(`[BOGO] Période: ${salesPeriod}, Items: ${allItems.length}, Produits matchés: ${Object.keys(salesMap).length}`);
        setSalesData(salesMap);
      } catch (error) {
        console.error("Error fetching sales data:", error);
      } finally {
        setIsLoadingSales(false);
      }
    };
    
    fetchSalesData();
  }, [menuItems, salesPeriod]);

  // Use platform-specific price field
  const priceField = isUber ? 'price_uber' : 'price_deliveroo';
  
  const eligibleProducts = useMemo(() => {
    return menuItems.filter(
      item => (isUber ? item.price_uber : item.price_deliveroo) && item.food_cost && item.food_cost > 0 && item.is_active
    );
  }, [menuItems, isUber]);

  const selectedProduct = useMemo(() => {
    return eligibleProducts.find(p => p.id === selectedProductId);
  }, [eligibleProducts, selectedProductId]);

  const simulation = useMemo(() => {
    const productPrice = isUber ? selectedProduct?.price_uber : selectedProduct?.price_deliveroo;
    if (!selectedProduct || !productPrice || !selectedProduct.food_cost) {
      return null;
    }

    const price = productPrice;
    const foodCost = selectedProduct.food_cost;
    const commissionRate = commission / 100;

    const netMarginPerUnit = price - (price * commissionRate) - foodCost;
    const marginPercentWithoutOffer = (netMarginPerUnit / price) * 100;

    const netMarginBogo = price - (price * commissionRate) - offerFee - (foodCost * 2);
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
  }, [selectedProduct, commission, offerFee, uberEstimatedIncrease, isUber]);

  const allProductsAnalysis = useMemo(() => {
    const commissionRate = commission / 100;
    
    // Calculate max values for normalization
    const maxSales = Math.max(...eligibleProducts.map(p => salesData[p.id] || 0), 1);
    const maxPrice = Math.max(...eligibleProducts.map(p => (isUber ? p.price_uber : p.price_deliveroo) || 0), 1);
    
    const products = eligibleProducts.map(product => {
      const price = (isUber ? product.price_uber : product.price_deliveroo)!;
      const foodCost = product.food_cost!;
      const sales = salesData[product.id] || 0;
      
      const netMarginPerUnit = price - (price * commissionRate) - foodCost;
      const netMarginBogo = price - (price * commissionRate) - offerFee - (foodCost * 2);
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
  }, [eligibleProducts, commission, offerFee, salesData, sortBy, filterTopSellers, filterMaxPrice, maxPriceValue, minMarginPercent, isUber]);

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
                  <SelectTrigger className="bg-white/60 dark:bg-white/5 border-orange-500/30">
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

              {/* Commission */}
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Commission {config.name}
                  </span>
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
                <Label className="flex items-center gap-2">
                  Frais d'utilisation de l'offre
                </Label>
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

              {/* Estimation */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PlatformIcon className="h-4 w-4" />
                  Estimation {config.name} (augmentation commandes)
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Ex: 74"
                    value={uberEstimatedIncrease}
                    onChange={(e) => setUberEstimatedIncrease(e.target.value)}
                    className="bg-white/60 dark:bg-white/5 border-primary/30 pr-8"
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
                  <CardContent className="relative pt-0 pb-3">
                    <div className="flex flex-col lg:flex-row items-stretch gap-2 lg:gap-1">
                      {/* Step 1 - Sans offre */}
                      <motion.div 
                        className="flex-1 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-lg p-3 border border-emerald-500/30"
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-[10px]">1</div>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">Sans offre</span>
                          </div>
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-emerald-600" />
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <div className="flex flex-col items-center p-1.5 bg-white/70 dark:bg-white/10 rounded min-w-[42px]">
                            <span className="text-[8px] text-muted-foreground uppercase">Prix</span>
                            <span className="font-bold text-emerald-600 text-sm">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-2.5 w-2.5 text-emerald-600/60" />
                          <div className="flex flex-col items-center p-1.5 bg-white/70 dark:bg-white/10 rounded min-w-[42px]">
                            <span className="text-[8px] text-muted-foreground uppercase">Comm.</span>
                            <span className="font-bold text-orange-600 text-sm">{(simulation.price * commission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-2.5 w-2.5 text-emerald-600/60" />
                          <div className="flex flex-col items-center p-1.5 bg-white/70 dark:bg-white/10 rounded min-w-[42px]">
                            <span className="text-[8px] text-muted-foreground uppercase">FC</span>
                            <span className="font-bold text-red-500 text-sm">{simulation.foodCost.toFixed(2)}€</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-emerald-500/20">
                          <div className="flex items-center justify-center gap-2">
                            <Equal className="h-3 w-3 text-emerald-600" />
                            <div className="px-3 py-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/40">
                              <span className="text-[9px] text-emerald-700 dark:text-emerald-400 block text-center">Marge</span>
                              <span className="font-black text-emerald-600 text-base block text-center">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                              <span className="text-[9px] text-emerald-600/80 block text-center">({((simulation.netMarginPerUnit / simulation.price) * 100).toFixed(0)}%)</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Arrow 1 */}
                      <div className="hidden lg:flex items-center justify-center px-0.5">
                        <motion.div
                          animate={{ x: [0, 3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 flex items-center justify-center">
                            <ArrowRight className="h-3 w-3 text-white" />
                          </div>
                        </motion.div>
                      </div>
                      <div className="flex lg:hidden justify-center py-0.5">
                        <motion.div
                          animate={{ y: [0, 3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="w-5 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-amber-500 flex items-center justify-center"
                        >
                          <ChevronDown className="h-3 w-3 text-white" />
                        </motion.div>
                      </div>

                      {/* Step 2 - Avec BOGO */}
                      <motion.div 
                        className={`flex-1 bg-gradient-to-br rounded-lg p-3 border ${
                          simulation.isLoss 
                            ? "from-red-500/10 to-red-600/5 border-red-500/30" 
                            : "from-amber-500/10 to-orange-500/5 border-amber-500/30"
                        }`}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[10px] ${simulation.isLoss ? "bg-red-500" : "bg-amber-500"}`}>2</div>
                            <span className={`font-semibold text-xs ${simulation.isLoss ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>Avec BOGO</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${simulation.isLoss ? "bg-red-500/20" : "bg-amber-500/20"}`}>
                            {simulation.isLoss ? <X className="h-2.5 w-2.5 text-red-600" /> : <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <div className="flex flex-col items-center p-1.5 bg-white/70 dark:bg-white/10 rounded min-w-[38px]">
                            <span className="text-[8px] text-muted-foreground uppercase">Prix</span>
                            <span className="font-bold text-emerald-600 text-xs">{simulation.price.toFixed(2)}€</span>
                          </div>
                          <Minus className="h-2 w-2 text-muted-foreground/60" />
                          <div className="flex flex-col items-center p-1.5 bg-white/70 dark:bg-white/10 rounded min-w-[38px]">
                            <span className="text-[8px] text-muted-foreground uppercase">Comm.</span>
                            <span className="font-bold text-orange-600 text-xs">{(simulation.price * commission / 100).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-2 w-2 text-muted-foreground/60" />
                          <div className="flex flex-col items-center p-1.5 bg-white/70 dark:bg-white/10 rounded min-w-[38px]">
                            <span className="text-[8px] text-muted-foreground uppercase">FC×2</span>
                            <span className="font-bold text-red-500 text-xs">{(simulation.foodCost * 2).toFixed(2)}€</span>
                          </div>
                          <Minus className="h-2 w-2 text-muted-foreground/60" />
                          <div className="flex flex-col items-center p-1.5 bg-white/70 dark:bg-white/10 rounded min-w-[38px]">
                            <span className="text-[8px] text-muted-foreground uppercase">Frais</span>
                            <span className="font-bold text-purple-600 text-xs">{offerFee.toFixed(2)}€</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-amber-500/20">
                          <div className="flex items-center justify-center gap-2">
                            <Equal className="h-3 w-3 text-amber-600" />
                            <div className={`px-3 py-1.5 rounded-lg border ${
                              simulation.isLoss 
                                ? "bg-red-500/20 border-red-500/40" 
                                : "bg-amber-500/20 border-amber-500/40"
                            }`}>
                              <span className={`text-[9px] block text-center ${simulation.isLoss ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>Marge BOGO</span>
                              <span className={`font-black text-base block text-center ${simulation.isLoss ? "text-red-600" : "text-amber-600"}`}>{simulation.netMarginBogo.toFixed(2)}€</span>
                              <span className={`text-[9px] block text-center ${simulation.isLoss ? "text-red-600/80" : "text-amber-600/80"}`}>({((simulation.netMarginBogo / simulation.price) * 100).toFixed(0)}%)</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Arrow 2 */}
                      <div className="hidden lg:flex items-center justify-center px-0.5">
                        <motion.div
                          animate={{ x: [0, 3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                        >
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-500 to-blue-500 flex items-center justify-center">
                            <ArrowRight className="h-3 w-3 text-white" />
                          </div>
                        </motion.div>
                      </div>
                      <div className="flex lg:hidden justify-center py-0.5">
                        <motion.div
                          animate={{ y: [0, 3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                          className="w-5 h-5 rounded-full bg-gradient-to-b from-amber-500 to-blue-500 flex items-center justify-center"
                        >
                          <ChevronDown className="h-3 w-3 text-white" />
                        </motion.div>
                      </div>

                      {/* Step 3 - Seuil rentabilité */}
                      <motion.div 
                        className={`flex-1 rounded-lg p-3 border ${
                          simulation.breakevenIncreasePercent < 50 
                            ? "bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 border-emerald-500/40" 
                            : simulation.breakevenIncreasePercent < 100 
                            ? "bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/40"
                            : "bg-gradient-to-br from-red-500/15 to-red-600/10 border-red-500/40"
                        }`}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[10px] ${
                              simulation.breakevenIncreasePercent < 50 ? "bg-emerald-500" :
                              simulation.breakevenIncreasePercent < 100 ? "bg-amber-500" : "bg-red-500"
                            }`}>3</div>
                            <span className={`font-semibold text-xs ${
                              simulation.breakevenIncreasePercent < 50 ? "text-emerald-700 dark:text-emerald-400" :
                              simulation.breakevenIncreasePercent < 100 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"
                            }`}>Seuil</span>
                          </div>
                          <Badge className={`text-[9px] font-bold px-1.5 py-0.5 ${
                            simulation.breakevenIncreasePercent < 50 
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                              : simulation.breakevenIncreasePercent < 100 
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "bg-red-500 hover:bg-red-600 text-white"
                          }`}>
                            {simulation.breakevenIncreasePercent < 50 ? "GO!" : 
                             simulation.breakevenIncreasePercent < 100 ? "RISQUÉ" : "STOP"}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div className="flex flex-col items-center p-1.5 bg-white/50 dark:bg-white/10 rounded">
                            <span className="text-[8px] text-muted-foreground uppercase">Normal</span>
                            <span className="font-bold text-xs">{simulation.netMarginPerUnit.toFixed(2)}€</span>
                          </div>
                          <Divide className="h-2.5 w-2.5 text-muted-foreground" />
                          <div className="flex flex-col items-center p-1.5 bg-white/50 dark:bg-white/10 rounded">
                            <span className="text-[8px] text-muted-foreground uppercase">BOGO</span>
                            <span className="font-bold text-xs">{simulation.netMarginBogo.toFixed(2)}€</span>
                          </div>
                        </div>

                        <motion.div 
                          className={`mx-auto max-w-[120px] py-2 px-3 rounded-lg border text-center ${
                            simulation.breakevenIncreasePercent < 50 
                              ? "bg-emerald-500/25 border-emerald-500/50" 
                              : simulation.breakevenIncreasePercent < 100 
                              ? "bg-amber-500/25 border-amber-500/50"
                              : "bg-red-500/25 border-red-500/50"
                          }`}
                          animate={{ 
                            boxShadow: simulation.breakevenIncreasePercent < 50 
                              ? ["0 0 10px rgba(16, 185, 129, 0.2)", "0 0 20px rgba(16, 185, 129, 0.4)", "0 0 10px rgba(16, 185, 129, 0.2)"]
                              : simulation.breakevenIncreasePercent < 100
                              ? ["0 0 10px rgba(245, 158, 11, 0.2)", "0 0 20px rgba(245, 158, 11, 0.4)", "0 0 10px rgba(245, 158, 11, 0.2)"]
                              : ["0 0 10px rgba(239, 68, 68, 0.2)", "0 0 20px rgba(239, 68, 68, 0.4)", "0 0 10px rgba(239, 68, 68, 0.2)"]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <span className={`font-black text-xl ${
                            simulation.breakevenIncreasePercent < 50 ? "text-emerald-600" :
                            simulation.breakevenIncreasePercent < 100 ? "text-amber-600" : "text-red-600"
                          }`}>+{simulation.breakevenIncreasePercent?.toFixed(0) ?? "?"}%</span>
                          <span className="text-[9px] text-muted-foreground block">ventes requises</span>
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
                
                {/* Sales Period Selector */}
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Période utilisée pour calculer la popularité des produits (données de ventes réseau)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Select value={salesPeriod} onValueChange={(v) => setSalesPeriod(v as SalesPeriod)}>
                    <SelectTrigger className="w-[160px] h-8 text-sm bg-white/60 dark:bg-white/5 border-orange-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30days">30 derniers jours</SelectItem>
                      <SelectItem value="90days">90 derniers jours</SelectItem>
                      <SelectItem value="year">Cette année</SelectItem>
                      <SelectItem value="all">Tout l'historique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="h-6 w-px bg-border/50" />
                
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
                  <SelectTrigger className="w-[160px] h-8 text-sm bg-white/60 dark:bg-white/5 border-orange-500/30">
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
                
                <HoverCard openDelay={100} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <button 
                      type="button"
                      className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors cursor-help"
                    >
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent 
                    side="bottom" 
                    align="start" 
                    className="w-[320px] p-4"
                    sideOffset={8}
                  >
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Critères de tri disponibles :</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                          <span className="font-semibold text-sm">Score BOGO</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">
                          Score composite : 40% marge + 40% ventes + 20% prix. Recommandé.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Percent className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="font-semibold text-sm">Marge BOGO %</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">
                          Marge nette en % du prix. Privilégie la rentabilité pure.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Flame className="h-3.5 w-3.5 text-orange-500" />
                          <span className="font-semibold text-sm">Ventes</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">
                          Volume de ventes historiques. Privilégie les best-sellers.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Euro className="h-3.5 w-3.5 text-blue-500" />
                          <span className="font-semibold text-sm">Marge BOGO €</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">
                          Gain absolu en euros par vente BOGO.
                        </p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              
              {/* Collapsible Help Section */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between px-4 py-3 h-auto bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg hover:from-purple-500/15 hover:to-blue-500/15"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Comprendre les indicateurs</span>
                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                        Guide
                      </Badge>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-4">
                    {/* Score BOGO Explanation */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        <h4 className="font-semibold text-sm">Score BOGO Intelligent</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Le score combine 3 facteurs pour identifier les produits les plus adaptés au BOGO :
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Percent className="h-4 w-4 text-emerald-500" />
                            <span className="font-medium text-sm">Marge BOGO (40%)</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Le % de profit net par vente BOGO. Plus c'est élevé, plus le produit reste rentable.
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span className="font-medium text-sm">Popularité (40%)</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Volume de ventes sur la période sélectionnée (par défaut : <strong>30 derniers jours</strong>). Données de l'ensemble du réseau. Un produit populaire génère plus de volume avec le BOGO.
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Euro className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-sm">Attractivité prix (20%)</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Prix relatif du produit. Les prix moyens sont plus attractifs pour les clients.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Concrete Example */}
                    <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="h-4 w-4 text-purple-500" />
                        <h4 className="font-semibold text-sm">Exemple concret</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Piège à éviter</Badge>
                          </div>
                          <p className="font-medium">Burger Premium à 18€</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Marge BOGO : 35% <span className="text-emerald-500">✓</span></li>
                            <li>• Ventes : 5/mois <span className="text-red-500">✗</span></li>
                            <li>• Score final : <strong>45/100</strong></li>
                          </ul>
                          <p className="text-xs text-red-500 italic">
                            → Bonne marge mais trop peu de ventes pour générer du volume
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Bon choix</Badge>
                          </div>
                          <p className="font-medium">Wrap Classique à 9€</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Marge BOGO : 22% <span className="text-orange-500">~</span></li>
                            <li>• Ventes : 85/mois <span className="text-emerald-500">✓✓</span></li>
                            <li>• Score final : <strong>78/100</strong></li>
                          </ul>
                          <p className="text-xs text-emerald-500 italic">
                            → Marge correcte + fort volume = profit total élevé
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Indicators Legend */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <ThumbsUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-muted-foreground">Marge ≥ 25%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MinusIcon className="h-4 w-4 text-orange-500" />
                        <span className="text-muted-foreground">Marge 15-25%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <ThumbsDown className="h-4 w-4 text-red-500" />
                        <span className="text-muted-foreground">Marge &lt; 15%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="text-muted-foreground">Top Seller ≥ 10 ventes</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-center gap-1 cursor-help">
                              <Flame className="h-3.5 w-3.5 text-orange-500" />
                              Ventes
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-500/10 text-orange-600 border-orange-500/30">
                                {salesPeriod === "30days" ? "30j" : salesPeriod === "90days" ? "90j" : salesPeriod === "year" ? "Année" : "Total"}
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Nombre de ventes sur <strong>{SALES_PERIOD_LABELS[salesPeriod]}</strong> (données réseau, tous restaurants)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">Marge actuelle</TableHead>
                    <TableHead className="text-right">Marge BOGO</TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-center gap-1 cursor-help">
                              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                              Score
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-3">
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">Score BOGO Intelligent</p>
                              <ul className="text-xs space-y-1">
                                <li>• <strong>40%</strong> Marge BOGO %</li>
                                <li>• <strong>40%</strong> Popularité (ventes)</li>
                                <li>• <strong>20%</strong> Attractivité prix</li>
                              </ul>
                              <p className="text-xs text-muted-foreground pt-1">
                                Plus le score est élevé, plus le produit est adapté au BOGO
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
