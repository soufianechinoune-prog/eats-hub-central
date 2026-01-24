import React, { useState, useMemo } from "react";
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
import { Slider } from "@/components/ui/slider";
import { RestaurantSelector } from "@/components/menu/RestaurantSelector";
import { useRestaurantProfitability, ProductProfitability } from "@/hooks/useRestaurantProfitability";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
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

type SortField = "name" | "category" | "foodCost" | "avgMargin" | "spread";
type SortDirection = "asc" | "desc";

// Default commission rates per platform
const DEFAULT_COMMISSION = { uber: 30, deliveroo: 35 };

export function ProfitabilityComparison() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [platform, setPlatform] = useState<"uber" | "deliveroo">("uber");
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION.uber);
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

  // Update commission when platform changes
  useEffect(() => {
    setCommissionRate(DEFAULT_COMMISSION[platform]);
  }, [platform]);

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

    // Alerts only filter
    if (showAlertsOnly) {
      result = result.filter((i) => {
        const spread = getSpread(i);
        return spread !== null && spread > 10;
      });
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
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [items, searchQuery, categoryFilter, showAlertsOnly, sortField, sortDirection, marginType]);

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
    const headers = [
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
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Style headers
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F46E5" } },
      alignment: { horizontal: "center" },
    };

    headers.forEach((_, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
      if (cell) cell.s = headerStyle;
    });

    // Set column widths
    ws["!cols"] = [
      { wch: 30 }, // Produit
      { wch: 15 }, // Catégorie
      { wch: 12 }, // Food Cost
      ...selectedRestaurantIds.map(() => ({ wch: 15 })), // Prix
      ...selectedRestaurantIds.map(() => ({ wch: 15 })), // Marges
      { wch: 15 }, // Moyenne
      { wch: 10 }, // Écart
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rentabilité");
    XLSX.writeFile(wb, `rentabilite_${platform}_${new Date().toISOString().split("T")[0]}.xlsx`);
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

        <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Alertes écart</span>
            </div>
            <div className="text-2xl font-bold">{alertCount}</div>
            <div className="text-xs text-muted-foreground">
              écart &gt; 10% entre restaurants
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Restaurant Selector */}
            <div className="flex-1">
              <RestaurantSelector
                restaurants={allRestaurants}
                selectedIds={selectedRestaurantIds}
                onSelectionChange={setSelectedRestaurantIds}
                maxSelection={6}
                placeholder="Sélectionner les restaurants à comparer..."
              />
            </div>

            {/* Platform Toggle */}
            <Select value={platform} onValueChange={(v) => setPlatform(v as "uber" | "deliveroo")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uber">Uber Eats</SelectItem>
                <SelectItem value="deliveroo">Deliveroo</SelectItem>
              </SelectContent>
            </Select>

            {/* Commission Rate Slider */}
            <div className="flex items-center gap-3 min-w-[180px]">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      <Percent className="h-3.5 w-3.5" />
                      <span>Commission</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Taux de commission plateforme appliqué sur le prix HT</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Slider
                value={[commissionRate]}
                onValueChange={([v]) => setCommissionRate(v)}
                min={15}
                max={45}
                step={1}
                className="w-24"
              />
              <span className="text-sm font-medium w-10 text-right">{commissionRate}%</span>
            </div>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
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

            {/* Margin Type Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant={marginType === "brut" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMarginType("brut")}
                className="h-7 px-3 text-xs"
              >
                Brute
              </Button>
              <Button
                variant={marginType === "net" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMarginType("net")}
                className="h-7 px-3 text-xs"
              >
                Nette
              </Button>
            </div>

            {/* Alerts Toggle */}
            <Button
              variant={showAlertsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAlertsOnly(!showAlertsOnly)}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Alertes
              {alertCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {alertCount}
                </Badge>
              )}
            </Button>

            {/* Export */}
            <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Excel
            </Button>
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
                Sélectionnez des restaurants pour voir les marges
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
                      onClick={() => handleSort("avgMargin")}
                    >
                      Moy. <SortIcon field="avgMargin" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors text-center"
                      onClick={() => handleSort("spread")}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            Écart <Info className="h-3 w-3" />
                            <SortIcon field="spread" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Différence entre marge min et max
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const itemSpread = getSpread(item);
                    const itemAvgMargin = getMargin(item);
                    
                    return (
                      <motion.tr
                        key={item.menuItemId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={cn(
                          "border-b hover:bg-muted/30 transition-colors",
                          itemSpread !== null && itemSpread > 10 && "bg-amber-50/50 dark:bg-amber-950/10"
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
                        {selectedRestaurantIds.map((id) => {
                          const r = item.restaurants.find((rest) => rest.restaurantId === id);
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
                        })}
                        <TableCell className="text-center">
                          <span className={cn("font-semibold", getMarginColor(itemAvgMargin))}>
                            {itemAvgMargin !== null ? `${itemAvgMargin.toFixed(1)}%` : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {itemSpread !== null ? (
                            <Badge
                              variant={itemSpread > 10 ? "destructive" : "secondary"}
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

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
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
      </div>
    </div>
  );
}
