import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
  Percent,
  Save,
  CheckCircle2,
  AlertCircle,
  PieChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { RestaurantSelector } from "@/components/menu/RestaurantSelector";
import { useToast } from "@/hooks/use-toast";
import { useRestaurantProfitability, ProductProfitability } from "@/hooks/useRestaurantProfitability";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx-js-style";
import { extractCityName } from "@/lib/restaurantUtils";

// Helper to transform "CHICKEN STREET ANTONY" -> "CS Antony"
const getShortRestaurantName = (name: string): string => {
  return `CS ${extractCityName(name)}`;
};

interface Restaurant {
  id: string;
  name: string;
  is_pinned?: boolean;
}

type SortField = "name" | "category" | "foodCost" | "avgMargin" | "spread" | "avgFoodCostPercent" | "fcSpread";
type SortDirection = "asc" | "desc";
type ViewMode = "foodCost" | "margin";

// Default commission rates per platform
const DEFAULT_COMMISSION: Record<"uber" | "deliveroo", number> = { uber: 30, deliveroo: 35 };
const COMMISSION_STORAGE_KEY = "profitability-commission";

export function ProfitabilityComparison() {
  const { toast } = useToast();
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [platform, setPlatform] = useState<"uber" | "deliveroo">("uber");
  
  // Initialize commission from localStorage
  const [commissionRate, setCommissionRate] = useState<number>(() => {
    const saved = localStorage.getItem(`${COMMISSION_STORAGE_KEY}-uber`);
    return saved ? parseFloat(saved) : DEFAULT_COMMISSION.uber;
  });
  const [commissionInput, setCommissionInput] = useState<string>(() => {
    const saved = localStorage.getItem(`${COMMISSION_STORAGE_KEY}-uber`);
    return saved || String(DEFAULT_COMMISSION.uber);
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>("margin");
  const [marginType, setMarginType] = useState<"brut" | "net">("brut");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { loading, items, stats, error } = useRestaurantProfitability(
    selectedRestaurantIds,
    platform,
    commissionRate
  );

  // Load commission from localStorage when platform changes
  useEffect(() => {
    const saved = localStorage.getItem(`${COMMISSION_STORAGE_KEY}-${platform}`);
    const rate = saved ? parseFloat(saved) : DEFAULT_COMMISSION[platform];
    setCommissionRate(rate);
    setCommissionInput(String(rate));
  }, [platform]);

  // Save commission to localStorage
  const handleCommissionSave = () => {
    const value = parseFloat(commissionInput);
    if (!isNaN(value) && value >= 0 && value <= 50) {
      setCommissionRate(value);
      localStorage.setItem(`${COMMISSION_STORAGE_KEY}-${platform}`, String(value));
      toast({
        title: "Commission sauvegardée",
        description: `Taux de ${value}% enregistré pour ${platform === "uber" ? "Uber Eats" : "Deliveroo"}`,
      });
    }
  };

  // Handle input change with validation
  const handleCommissionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setCommissionInput(rawValue);
    
    const value = parseFloat(rawValue);
    if (!isNaN(value) && value >= 0 && value <= 50) {
      setCommissionRate(value);
    }
  };

  // Save on blur if valid
  const handleCommissionBlur = () => {
    const value = parseFloat(commissionInput);
    if (!isNaN(value) && value >= 0 && value <= 50) {
      localStorage.setItem(`${COMMISSION_STORAGE_KEY}-${platform}`, String(value));
    } else {
      // Reset to saved value if invalid
      const saved = localStorage.getItem(`${COMMISSION_STORAGE_KEY}-${platform}`);
      const rate = saved ? parseFloat(saved) : DEFAULT_COMMISSION[platform];
      setCommissionInput(String(rate));
      setCommissionRate(rate);
    }
  };

  // Helper to get current margin based on marginType
  const getMargin = (item: ProductProfitability) => marginType === "brut" ? item.avgMarginBrut : item.avgMarginNet;
  const getSpread = (item: ProductProfitability) => marginType === "brut" ? item.marginSpreadBrut : item.marginSpreadNet;
  const getRestaurantMargin = (r: { marginBrutUber: number | null; marginBrutDeliveroo: number | null; marginNetUber: number | null; marginNetDeliveroo: number | null }) => {
    if (marginType === "brut") {
      return platform === "uber" ? r.marginBrutUber : r.marginBrutDeliveroo;
    }
    return platform === "uber" ? r.marginNetUber : r.marginNetDeliveroo;
  };
  const avgMargin = marginType === "brut" ? stats.avgMarginBrut : stats.avgMarginNet;
  const alertCount = marginType === "brut" ? stats.alertCountBrut : stats.alertCountNet;

  // Calculate Food Cost % for a specific restaurant
  // Brut: Food Cost / Prix HT
  // Net: Food Cost / (Prix HT - Commission) => ce qui reste vraiment
  const getRestaurantFoodCostPercent = (item: ProductProfitability, restaurantId: string): number | null => {
    if (item.foodCost === null) return null;
    const r = item.restaurants.find(rest => rest.restaurantId === restaurantId);
    if (!r) return null;
    const price = platform === "uber" ? r.priceUber : r.priceDeliveroo;
    if (!price) return null;
    const vatRate = item.vatRate ?? 10;
    const prixHT = price / (1 + vatRate / 100);
    if (prixHT === 0) return null;
    
    if (marginType === "brut") {
      // FC % Brut = Food Cost / Prix HT
      return (item.foodCost / prixHT) * 100;
    } else {
      // FC % Net = Food Cost / (Prix HT - Commission)
      const commissionAmount = prixHT * (commissionRate / 100);
      const netRevenue = prixHT - commissionAmount;
      if (netRevenue <= 0) return null;
      return (item.foodCost / netRevenue) * 100;
    }
  };

  // Calculate average Food Cost % across all selected restaurants
  const getAvgFoodCostPercent = (item: ProductProfitability): number | null => {
    if (item.foodCost === null) return null;
    
    const percentages = selectedRestaurantIds
      .map(id => getRestaurantFoodCostPercent(item, id))
      .filter((p): p is number => p !== null);
    
    if (percentages.length === 0) return null;
    return percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
  };

  // Calculate Food Cost % spread (max - min)
  const getFoodCostSpread = (item: ProductProfitability): number | null => {
    const percentages = selectedRestaurantIds
      .map(id => getRestaurantFoodCostPercent(item, id))
      .filter((p): p is number => p !== null);
    if (percentages.length < 2) return null;
    return Math.max(...percentages) - Math.min(...percentages);
  };

  // Get Food Cost % color and status
  const getFoodCostStatus = (percent: number | null): { color: string; bgColor: string; isGood: boolean } => {
    if (percent === null) return { color: "text-muted-foreground", bgColor: "", isGood: true };
    if (percent < 30) return { color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/30", isGood: true };
    if (percent <= 35) return { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/30", isGood: false };
    return { color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/30", isGood: false };
  };

  // Fetch all restaurants on mount
  useEffect(() => {
    async function fetchRestaurants() {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, is_pinned")
        .order("name");
      if (data) {
        setAllRestaurants(data);
      }
    }
    fetchRestaurants();
  }, []);

  // Auto-select pinned restaurants by default
  useEffect(() => {
    if (allRestaurants.length > 0 && selectedRestaurantIds.length === 0) {
      const pinnedRestaurants = allRestaurants.filter((r) => r.is_pinned);
      if (pinnedRestaurants.length > 0) {
        setSelectedRestaurantIds(pinnedRestaurants.map((r) => r.id));
      } else {
        // Fallback: first 3 restaurants if none are pinned
        setSelectedRestaurantIds(allRestaurants.slice(0, 3).map((r) => r.id));
      }
    }
  }, [allRestaurants]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [items]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = items;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.menuItemName.toLowerCase().includes(query) ||
          i.category?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((i) => i.category === categoryFilter);
    }

    // Alerts only filter (depends on view mode)
    if (showAlertsOnly) {
      if (viewMode === "foodCost") {
        result = result.filter((i) => {
          const fcSpread = getFoodCostSpread(i);
          return fcSpread !== null && fcSpread > 5;
        });
      } else {
        result = result.filter((i) => {
          const spread = getSpread(i);
          return spread !== null && spread > 10;
        });
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.menuItemName.localeCompare(b.menuItemName);
          break;
        case "category":
          comparison = (a.category || "").localeCompare(b.category || "");
          break;
        case "foodCost":
          comparison = (a.foodCost || 0) - (b.foodCost || 0);
          break;
        case "avgMargin":
          comparison = (getMargin(a) || 0) - (getMargin(b) || 0);
          break;
        case "spread":
          comparison = (getSpread(a) || 0) - (getSpread(b) || 0);
          break;
        case "avgFoodCostPercent":
          comparison = (getAvgFoodCostPercent(a) || 0) - (getAvgFoodCostPercent(b) || 0);
          break;
        case "fcSpread":
          comparison = (getFoodCostSpread(a) || 0) - (getFoodCostSpread(b) || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [items, searchQuery, categoryFilter, showAlertsOnly, sortField, sortDirection, marginType, viewMode, selectedRestaurantIds, platform]);

  // Count alerts based on view mode
  const fcAlertCount = useMemo(() => {
    return items.filter(i => {
      const fcSpread = getFoodCostSpread(i);
      return fcSpread !== null && fcSpread > 5;
    }).length;
  }, [items, selectedRestaurantIds, platform]);

  // Average Food Cost % across all products
  const avgFoodCostPercent = useMemo(() => {
    const percentages = items
      .map(i => getAvgFoodCostPercent(i))
      .filter((p): p is number => p !== null);
    if (percentages.length === 0) return null;
    return percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
  }, [items, selectedRestaurantIds, platform]);

  // Get margin color class
  const getMarginColor = (margin: number | null): string => {
    if (margin === null) return "text-muted-foreground";
    if (margin >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (margin >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMarginBgColor = (margin: number | null): string => {
    if (margin === null) return "";
    if (margin >= 70) return "bg-emerald-50 dark:bg-emerald-950/30";
    if (margin >= 50) return "bg-amber-50 dark:bg-amber-950/30";
    return "bg-red-50 dark:bg-red-950/30";
  };

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  };

  // Export to Excel
  const exportToExcel = () => {
    const headers = viewMode === "foodCost" 
      ? [
          "Produit",
          "Catégorie",
          "Food Cost (€)",
          ...selectedRestaurantIds.map((id) => {
            const restaurant = allRestaurants.find((r) => r.id === id);
            return `${restaurant ? getShortRestaurantName(restaurant.name) : id} - % FC`;
          }),
          "% FC Moyen",
          "Écart %",
        ]
      : [
          "Produit",
          "Catégorie",
          "Food Cost (€)",
          ...selectedRestaurantIds.map((id) => {
            const restaurant = allRestaurants.find((r) => r.id === id);
            return `${restaurant ? getShortRestaurantName(restaurant.name) : id} - Prix`;
          }),
          ...selectedRestaurantIds.map((id) => {
            const restaurant = allRestaurants.find((r) => r.id === id);
            return `${restaurant ? getShortRestaurantName(restaurant.name) : id} - Marge %`;
          }),
          "Marge Moyenne %",
          "Écart %",
        ];

    const data = filteredItems.map((item) => {
      if (viewMode === "foodCost") {
        const fcPercentages = selectedRestaurantIds.map((id) => {
          const fc = getRestaurantFoodCostPercent(item, id);
          return fc !== null ? fc.toFixed(1) : "";
        });

        const avgFc = getAvgFoodCostPercent(item);
        const fcSpread = getFoodCostSpread(item);

        return [
          item.menuItemName,
          item.category || "",
          item.foodCost !== null ? item.foodCost.toFixed(2) : "",
          ...fcPercentages,
          avgFc !== null ? avgFc.toFixed(1) : "",
          fcSpread !== null ? fcSpread.toFixed(1) : "",
        ];
      } else {
        const prices = selectedRestaurantIds.map((id) => {
          const r = item.restaurants.find((rest) => rest.restaurantId === id);
          return platform === "uber" ? r?.priceUber : r?.priceDeliveroo;
        });

        const margins = selectedRestaurantIds.map((id) => {
          const r = item.restaurants.find((rest) => rest.restaurantId === id);
          if (!r) return null;
          const margin = getRestaurantMargin(r);
          return margin !== null ? Math.round(margin * 10) / 10 : null;
        });

        const itemAvgMargin = getMargin(item);
        const itemSpread = getSpread(item);

        return [
          item.menuItemName,
          item.category || "",
          item.foodCost !== null ? item.foodCost.toFixed(2) : "",
          ...prices.map((p) => (p !== null ? p.toFixed(2) : "")),
          ...margins.map((m) => (m !== null ? m.toFixed(1) : "")),
          itemAvgMargin !== null ? itemAvgMargin.toFixed(1) : "",
          itemSpread !== null ? itemSpread.toFixed(1) : "",
        ];
      }
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Style headers
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: viewMode === "foodCost" ? "D97706" : "4F46E5" } },
      alignment: { horizontal: "center" },
    };

    headers.forEach((_, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
      if (cell) cell.s = headerStyle;
    });

    // Set column widths
    const colCount = viewMode === "foodCost" 
      ? 3 + selectedRestaurantIds.length + 2
      : 3 + selectedRestaurantIds.length * 2 + 2;
    
    ws["!cols"] = Array(colCount).fill({ wch: 15 });
    ws["!cols"][0] = { wch: 30 }; // Produit

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, viewMode === "foodCost" ? "Food Cost %" : "Rentabilité");
    XLSX.writeFile(wb, `${viewMode === "foodCost" ? "food_cost" : "rentabilite"}_${platform}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background border-indigo-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Produits analysés</span>
            </div>
            <div className="text-2xl font-bold">{stats.productsWithData}</div>
            <div className="text-xs text-muted-foreground">
              sur {stats.totalProducts} produits
            </div>
          </CardContent>
        </Card>

        {viewMode === "foodCost" ? (
          <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-background border-orange-200/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                <PieChart className="h-4 w-4" />
                <span className="text-xs font-medium">% Food Cost moyen</span>
              </div>
              <div className="text-2xl font-bold">
                {avgFoodCostPercent !== null ? `${avgFoodCostPercent.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                objectif &lt; 30%
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background border-emerald-200/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Marge {marginType === "brut" ? "brute" : "nette"} moy.</span>
              </div>
              <div className="text-2xl font-bold">
                {avgMargin !== null ? `${avgMargin.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                tous restaurants
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Alertes écart</span>
            </div>
            <div className="text-2xl font-bold">
              {viewMode === "foodCost" ? fcAlertCount : alertCount}
            </div>
            <div className="text-xs text-muted-foreground">
              écart &gt; {viewMode === "foodCost" ? "5%" : "10%"} entre restaurants
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-background border-violet-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-1">
              <Filter className="h-4 w-4" />
              <span className="text-xs font-medium">Restaurants</span>
            </div>
            <div className="text-2xl font-bold">{selectedRestaurantIds.length}</div>
            <div className="text-xs text-muted-foreground">
              sélectionnés
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters - Two distinct zones */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            {/* Row 1: Data filters (left) and Display controls (right) */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              
              {/* LEFT ZONE: Données */}
              <div className="flex flex-col gap-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Filter className="h-3 w-3" />
                  Données
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Restaurant Selector */}
                  <div className="min-w-[280px]">
                    <RestaurantSelector
                      restaurants={allRestaurants}
                      selectedIds={selectedRestaurantIds}
                      onSelectionChange={setSelectedRestaurantIds}
                      maxSelection={6}
                      placeholder="Sélectionner les restaurants..."
                    />
                  </div>

                  {/* Platform Toggle */}
                  <Select value={platform} onValueChange={(v) => setPlatform(v as "uber" | "deliveroo")}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uber">Uber Eats</SelectItem>
                      <SelectItem value="deliveroo">Deliveroo</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Search */}
                  <div className="relative w-52">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Category Filter */}
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat!}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* RIGHT ZONE: Affichage */}
              <div className="flex flex-col gap-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  Affichage
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
                    <Button
                      variant={viewMode === "foodCost" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("foodCost")}
                      className={cn(
                        "h-7 px-3 text-xs",
                        viewMode === "foodCost" && "bg-orange-600 hover:bg-orange-700"
                      )}
                    >
                      % Food Cost
                    </Button>
                    <Button
                      variant={viewMode === "margin" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("margin")}
                      className="h-7 px-3 text-xs"
                    >
                      Marge
                    </Button>
                  </div>
                  
                  {/* Margin Type Toggle */}
                  <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
                    <Button
                      variant={marginType === "brut" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMarginType("brut")}
                      className="h-7 px-3 text-xs"
                    >
                      Brut{viewMode === "margin" ? "e" : ""}
                    </Button>
                    <Button
                      variant={marginType === "net" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMarginType("net")}
                      className={cn(
                        "h-7 px-3 text-xs",
                        marginType === "net" && viewMode === "foodCost" && "bg-orange-600 hover:bg-orange-700"
                      )}
                    >
                      Net{viewMode === "margin" ? "te" : ""}
                    </Button>
                  </div>

                  {/* Commission Rate Input - always visible, disabled when brut mode */}
                  <div className={cn(
                    "flex items-center gap-1.5 border rounded-md px-2 py-1 bg-muted/30",
                    marginType === "brut" && "opacity-50 pointer-events-none"
                  )}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-help">
                            <Percent className="h-3 w-3" />
                            <span>Com.</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Taux de commission plateforme (0-50%)</p>
                          <p className="text-xs text-muted-foreground mt-1">Mémorisé par plateforme</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="relative">
                      <Input
                        type="number"
                        value={commissionInput}
                        onChange={handleCommissionInputChange}
                        onBlur={handleCommissionBlur}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCommissionSave();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        step="0.01"
                        min="0"
                        max="50"
                        disabled={marginType === "brut"}
                        className="w-20 pr-5 text-right h-7 text-xs"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        %
                      </span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={handleCommissionSave}
                            disabled={marginType === "brut"}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sauvegarder</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {/* Info Tooltip */}
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="w-80 p-4">
                        {viewMode === "margin" ? (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center gap-2 text-emerald-600 font-medium">
                                <TrendingUp className="h-4 w-4" />
                                Marge Brute
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 font-mono">
                                = (Prix HT − Food Cost) / Prix HT
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Ce que vous gardez avant les commissions plateforme
                              </p>
                            </div>
                            
                            <div className="border-t pt-3">
                              <div className="flex items-center gap-2 text-violet-600 font-medium">
                                <TrendingDown className="h-4 w-4" />
                                Marge Nette
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 font-mono">
                                = (Prix HT − Commission − Food Cost) / Prix HT
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Ce qui reste vraiment après Uber/Deliveroo
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center gap-2 text-orange-600 font-medium">
                                <PieChart className="h-4 w-4" />
                                % Food Cost Brut
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 font-mono">
                                = Food Cost HT / Prix HT × 100
                              </p>
                              <p className="text-xs text-muted-foreground">
                                La règle des 30% : inférieur à 30% du prix HT est optimal
                              </p>
                            </div>
                            
                            <div className="border-t pt-3">
                              <div className="flex items-center gap-2 text-red-600 font-medium">
                                <AlertTriangle className="h-4 w-4" />
                                % Food Cost Net
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 font-mono">
                                = Food Cost HT / (Prix HT − Commission) × 100
                              </p>
                              <p className="text-xs text-muted-foreground">
                                L'impact réel sur ce que vous touchez vraiment
                              </p>
                            </div>
                            
                            <div className="border-t pt-3 text-xs text-muted-foreground">
                              <strong>Exemple:</strong> FC 3€, Prix HT 10€, Commission 30%
                              <br />→ FC Brut = 30%, FC Net = 3€ / 7€ = <strong>42.8%</strong>
                            </div>
                          </div>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Divider */}
                  <div className="h-6 w-px bg-border" />

                  {/* Alerts Toggle */}
                  <Button
                    variant={showAlertsOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAlertsOnly(!showAlertsOnly)}
                    className="gap-1.5 h-8"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Alertes
                    {(viewMode === "foodCost" ? fcAlertCount : alertCount) > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {viewMode === "foodCost" ? fcAlertCount : alertCount}
                      </Badge>
                    )}
                  </Button>

                  {/* Export */}
                  <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5 h-8">
                    <Download className="h-3.5 w-3.5" />
                    Excel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Aucun produit à afficher</p>
              <p className="text-sm mt-1">
                Sélectionnez des restaurants pour voir les {viewMode === "foodCost" ? "% food cost" : "marges"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      Produit <SortIcon field="name" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleSort("category")}
                    >
                      Catégorie <SortIcon field="category" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors text-right"
                      onClick={() => handleSort("foodCost")}
                    >
                      Food Cost <SortIcon field="foodCost" />
                    </TableHead>
                    {selectedRestaurantIds.map((id) => {
                      const restaurant = allRestaurants.find((r) => r.id === id);
                      return (
                        <TableHead key={id} className="text-center min-w-[100px]">
                          <div className="text-xs font-medium truncate max-w-[100px]">
                            {restaurant ? getShortRestaurantName(restaurant.name) : id}
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors text-center"
                      onClick={() => handleSort(viewMode === "foodCost" ? "avgFoodCostPercent" : "avgMargin")}
                    >
                      Moy. <SortIcon field={viewMode === "foodCost" ? "avgFoodCostPercent" : "avgMargin"} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors text-center"
                      onClick={() => handleSort(viewMode === "foodCost" ? "fcSpread" : "spread")}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            Écart <Info className="h-3 w-3" />
                            <SortIcon field={viewMode === "foodCost" ? "fcSpread" : "spread"} />
                          </TooltipTrigger>
                          <TooltipContent>
                            Différence entre {viewMode === "foodCost" ? "% FC" : "marge"} min et max
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const itemSpread = viewMode === "foodCost" ? getFoodCostSpread(item) : getSpread(item);
                    const alertThreshold = viewMode === "foodCost" ? 5 : 10;
                    
                    return (
                      <motion.tr
                        key={item.menuItemId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={cn(
                          "border-b hover:bg-muted/30 transition-colors",
                          itemSpread !== null && itemSpread > alertThreshold && "bg-amber-50/50 dark:bg-amber-950/10"
                        )}
                      >
                        <TableCell className="font-medium">{item.menuItemName}</TableCell>
                        <TableCell>
                          {item.category && (
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.foodCost !== null ? `${item.foodCost.toFixed(2)}€` : "—"}
                        </TableCell>
                        
                        {/* Restaurant columns - conditional based on viewMode */}
                        {selectedRestaurantIds.map((id) => {
                          const r = item.restaurants.find((rest) => rest.restaurantId === id);
                          
                          if (viewMode === "foodCost") {
                            // Show Food Cost %
                            const fcPercent = getRestaurantFoodCostPercent(item, id);
                            const { color, bgColor, isGood } = getFoodCostStatus(fcPercent);
                            const price = platform === "uber" ? r?.priceUber : r?.priceDeliveroo;
                            const vatRate = item.vatRate ?? 10;
                            const prixHT = price ? price / (1 + vatRate / 100) : null;
                            
                            return (
                              <TableCell
                                key={id}
                                className={cn("text-center font-mono", bgColor)}
                              >
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className="flex items-center justify-center gap-1">
                                        <span className={cn("font-semibold", color)}>
                                          {fcPercent !== null ? `${fcPercent.toFixed(0)}%` : "—"}
                                        </span>
                                        {fcPercent !== null && (
                                          isGood ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                          ) : fcPercent <= 35 ? (
                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                          ) : (
                                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                          )
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs space-y-1">
                                        <div>Prix TTC: {price !== null ? `${price.toFixed(2)}€` : "—"}</div>
                                        {prixHT !== null && (
                                          <div>Prix HT: {prixHT.toFixed(2)}€ <span className="text-muted-foreground">(TVA {vatRate}%)</span></div>
                                        )}
                                        <div>Food Cost HT: {item.foodCost !== null ? `${item.foodCost.toFixed(2)}€` : "—"}</div>
                                        {fcPercent !== null && (
                                          <div className="border-t pt-1 mt-1">
                                            % Food Cost: {fcPercent.toFixed(1)}%
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            );
                          } else {
                            // Show Margin (existing behavior)
                            const margin = r ? getRestaurantMargin(r) : null;
                            const price = platform === "uber" ? r?.priceUber : r?.priceDeliveroo;
                            const vatRate = item.vatRate ?? 10;
                            const prixHT = price ? price / (1 + vatRate / 100) : null;

                            return (
                              <TableCell
                                key={id}
                                className={cn(
                                  "text-center font-mono",
                                  getMarginBgColor(margin)
                                )}
                              >
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className={cn("font-semibold", getMarginColor(margin))}>
                                        {margin !== null ? `${margin.toFixed(1)}%` : "—"}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs space-y-1">
                                        <div>Prix TTC: {price !== null ? `${price.toFixed(2)}€` : "—"}</div>
                                        {prixHT !== null && (
                                          <div>Prix HT: {prixHT.toFixed(2)}€ <span className="text-muted-foreground">(TVA {vatRate}%)</span></div>
                                        )}
                                        <div>Food Cost HT: {item.foodCost !== null ? `${item.foodCost.toFixed(2)}€` : "—"}</div>
                                        {marginType === "net" && (
                                          <div>Commission: {commissionRate}%</div>
                                        )}
                                        {margin !== null && (
                                          <div className="border-t pt-1 mt-1">
                                            Marge {marginType === "brut" ? "brute" : "nette"}: {margin.toFixed(1)}%
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            );
                          }
                        })}
                        
                        {/* Average column */}
                        <TableCell className="text-center">
                          {viewMode === "foodCost" ? (
                            (() => {
                              const avgFc = getAvgFoodCostPercent(item);
                              const { color } = getFoodCostStatus(avgFc);
                              return (
                                <span className={cn("font-semibold", color)}>
                                  {avgFc !== null ? `${avgFc.toFixed(1)}%` : "—"}
                                </span>
                              );
                            })()
                          ) : (
                            (() => {
                              const itemAvgMargin = getMargin(item);
                              return (
                                <span className={cn("font-semibold", getMarginColor(itemAvgMargin))}>
                                  {itemAvgMargin !== null ? `${itemAvgMargin.toFixed(1)}%` : "—"}
                                </span>
                              );
                            })()
                          )}
                        </TableCell>
                        
                        {/* Spread column */}
                        <TableCell className="text-center">
                          {itemSpread !== null ? (
                            <Badge
                              variant={itemSpread > alertThreshold ? "destructive" : "secondary"}
                              className="font-mono"
                            >
                              {itemSpread.toFixed(1)}%
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend - adapts to view mode */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        {viewMode === "foodCost" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>&lt; 30% (Excellent)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>30-35% (Acceptable)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>&gt; 35% (À surveiller)</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>≥ 70% (Excellente)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>50-70% (Correcte)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>&lt; 50% (Faible)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
