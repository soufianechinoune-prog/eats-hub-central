import { useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Search, TrendingUp, Minus, MoreHorizontal, Trash2, Link2, Plus, Check, AlertTriangle, Download, FileSpreadsheet, FileText, Package, AlertCircle, Percent } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RestaurantSelector } from "./RestaurantSelector";
import { useRestaurantMenuPrices, MenuItemComparison } from "@/hooks/useRestaurantMenuPrices";
import { extractCityName } from "@/lib/restaurantUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMenuComparisonExport } from "@/hooks/useMenuComparisonExport";
import { Checkbox } from "@/components/ui/checkbox";

type Platform = "uber" | "deliveroo";

const CATEGORY_ORDER = [
  "Menus",
  "Menus enfant",
  "Burgers",
  "Naans",
  "Tenders",
  "Sides",
  "Desserts",
  "Boissons",
  "Sauces",
];

interface EditPriceData {
  menuItemId: string;
  menuItemName: string;
  restaurantId: string;
  restaurantName: string;
  currentPrice: number | null;
  currentTva: number | null;
}

interface MatchProductData {
  menuItemId: string;
  menuItemName: string;
}

interface InterRestaurantComparisonProps {
  selectedRestaurantIds: string[];
  onSelectedRestaurantIdsChange: (ids: string[]) => void;
}

export function InterRestaurantComparison({
  selectedRestaurantIds,
  onSelectedRestaurantIdsChange,
}: InterRestaurantComparisonProps) {
  const [platform, setPlatform] = useState<Platform>("uber");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(false);
  const [showOnlyTvaDiscrepancies, setShowOnlyTvaDiscrepancies] = useState(false);
  const [showTvaColumn, setShowTvaColumn] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  // Export hook
  const { exportToPdf, exportToExcel, exportToCsv, isExporting } = useMenuComparisonExport();

  // Edit price state
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [editPriceData, setEditPriceData] = useState<EditPriceData | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [editTvaValue, setEditTvaValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Match product state
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchSource, setMatchSource] = useState<MatchProductData | null>(null);
  const [matchTargetId, setMatchTargetId] = useState("");

  // Delete product state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteData, setDeleteData] = useState<{ id: string; name: string } | null>(null);

  // Add product state
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductPrices, setNewProductPrices] = useState<Record<string, string>>({});

  const { loading, items, restaurants, stats } = useRestaurantMenuPrices(
    selectedRestaurantIds,
    refreshKey
  );

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.menuItemName.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
      );
    }

    if (showOnlyDiscrepancies) {
      filtered = filtered.filter((item) => {
        const diff = platform === "uber" ? item.uberDifference : item.deliverooDifference;
        return diff && diff.percent > 0;
      });
    }

    if (showOnlyTvaDiscrepancies) {
      filtered = filtered.filter((item) => {
        const tvaDiff = platform === "uber" ? item.uberTvaDifference : item.deliverooTvaDifference;
        return tvaDiff?.hasDifference;
      });
    }

    return filtered;
  }, [items, searchQuery, showOnlyDiscrepancies, showOnlyTvaDiscrepancies, platform]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, MenuItemComparison[]>();

    filteredItems.forEach((item) => {
      const category = item.category || "Sans catégorie";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(item);
    });

    const sortedGroups = new Map<string, MenuItemComparison[]>();
    CATEGORY_ORDER.forEach((cat) => {
      if (groups.has(cat)) {
        sortedGroups.set(cat, groups.get(cat)!);
        groups.delete(cat);
      }
    });
    groups.forEach((items, cat) => {
      sortedGroups.set(cat, items);
    });

    return sortedGroups;
  }, [filteredItems]);

  // All items for matching dropdown
  const allMenuItems = useMemo(() => {
    return items.map((i) => ({ id: i.menuItemId, name: i.menuItemName, category: i.category }));
  }, [items]);

  const formatPrice = (price: number | null) => {
    if (price === null) return "Manquant";
    if (price === 0) return "Gratuit";
    return `${price.toFixed(2)} €`;
  };

  const getShortRestaurantName = (name: string) => {
    return extractCityName(name);
  };

  const selectedRestaurants = restaurants.filter((r) =>
    selectedRestaurantIds.includes(r.id)
  );

  const currentStats = platform === "uber"
    ? { withDiff: stats.productsWithUberDiff, avgDiff: stats.avgUberDiff, withTvaDiff: stats.productsWithUberTvaDiff }
    : { withDiff: stats.productsWithDeliverooDiff, avgDiff: stats.avgDeliverooDiff, withTvaDiff: stats.productsWithDeliverooTvaDiff };

  const formatTva = (tva: number | null | undefined) => {
    if (tva === null || tva === undefined) return null;
    return `${tva}%`;
  };

  // Build export data for selected or all restaurants
  const buildExportData = (useAll = false) => {
    const exportRestaurants = useAll ? restaurants : selectedRestaurants;
    const rows = filteredItems.map((item) => {
      const diff = platform === "uber" ? item.uberDifference : item.deliverooDifference;
      return {
        product: item.menuItemName,
        category: item.category,
        prices: exportRestaurants.map((r) => {
          const rp = item.restaurantPrices.find((p) => p.restaurantId === r.id);
          const price = platform === "uber" ? rp?.priceUber : rp?.priceDeliveroo;
          return {
            restaurant: getShortRestaurantName(r.name),
            price: formatPrice(price ?? null),
          };
        }),
        difference: diff ? `+${diff.percent}%` : "0%",
      };
    });

    return {
      platform: platform === "uber" ? "Uber Eats" : "Deliveroo",
      restaurants: exportRestaurants.map((r) => getShortRestaurantName(r.name)),
      rows,
      stats: {
        totalProducts: stats.totalProducts,
        productsWithDiff: currentStats.withDiff,
        avgDiff: currentStats.avgDiff,
      },
    };
  };

  const handleExportPdf = () => {
    exportToPdf(tableRef.current, buildExportData());
  };

  const handleExportExcel = (useAll = false) => {
    exportToExcel(buildExportData(useAll));
  };

  const handleExportCsv = (useAll = false) => {
    exportToCsv(buildExportData(useAll));
  };

  // ---- Edit price handlers ----
  const openEditPrice = (
    menuItemId: string,
    menuItemName: string,
    restaurantId: string,
    restaurantName: string,
    currentPrice: number | null,
    currentTva: number | null
  ) => {
    setEditPriceData({ menuItemId, menuItemName, restaurantId, restaurantName, currentPrice, currentTva });
    setEditPriceValue(currentPrice !== null ? currentPrice.toString() : "");
    setEditTvaValue(currentTva !== null ? currentTva.toString() : "");
    setEditPriceOpen(true);
  };

  const handleSavePrice = async () => {
    if (!editPriceData) return;
    setSaving(true);

    const priceField = platform === "uber" ? "price_uber" : "price_deliveroo";
    const tvaField = platform === "uber" ? "tva_uber" : "tva_deliveroo";
    const priceValue = editPriceValue ? parseFloat(editPriceValue) : null;
    const tvaValue = editTvaValue ? parseFloat(editTvaValue) : null;

    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from("restaurant_menu_prices")
        .select("id")
        .eq("menu_item_id", editPriceData.menuItemId)
        .eq("restaurant_id", editPriceData.restaurantId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("restaurant_menu_prices")
          .update({ [priceField]: priceValue, [tvaField]: tvaValue })
          .eq("id", existing.id);
      } else {
        await supabase.from("restaurant_menu_prices").insert({
          menu_item_id: editPriceData.menuItemId,
          restaurant_id: editPriceData.restaurantId,
          [priceField]: priceValue,
          [tvaField]: tvaValue,
          is_available: true,
        });
      }

      toast.success("Prix et TVA mis à jour");
      setEditPriceOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  // ---- Match product handlers ----
  const openMatchDialog = (menuItemId: string, menuItemName: string) => {
    setMatchSource({ menuItemId, menuItemName });
    setMatchTargetId("");
    setMatchOpen(true);
  };

  const handleMatchProducts = async () => {
    if (!matchSource || !matchTargetId) return;
    setSaving(true);

    try {
      // Transfer all prices from source to target
      const { data: sourcePrices } = await supabase
        .from("restaurant_menu_prices")
        .select("*")
        .eq("menu_item_id", matchSource.menuItemId);

      if (sourcePrices && sourcePrices.length > 0) {
        for (const sp of sourcePrices) {
          // Check if target already has a price for this restaurant
          const { data: existing } = await supabase
            .from("restaurant_menu_prices")
            .select("id, price_uber, price_deliveroo")
            .eq("menu_item_id", matchTargetId)
            .eq("restaurant_id", sp.restaurant_id)
            .maybeSingle();

          if (existing) {
            // Merge prices (keep existing if not null, otherwise use source)
            await supabase
              .from("restaurant_menu_prices")
              .update({
                price_uber: existing.price_uber ?? sp.price_uber,
                price_deliveroo: existing.price_deliveroo ?? sp.price_deliveroo,
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("restaurant_menu_prices").insert({
              menu_item_id: matchTargetId,
              restaurant_id: sp.restaurant_id,
              price_uber: sp.price_uber,
              price_deliveroo: sp.price_deliveroo,
              is_available: sp.is_available,
            });
          }
        }

        // Delete source prices
        await supabase
          .from("restaurant_menu_prices")
          .delete()
          .eq("menu_item_id", matchSource.menuItemId);
      }

      // Deactivate source menu item
      await supabase
        .from("menu_items")
        .update({ is_active: false })
        .eq("id", matchSource.menuItemId);

      toast.success("Produits fusionnés avec succès");
      setMatchOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la fusion");
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete product handlers ----
  const openDeleteDialog = (id: string, name: string) => {
    setDeleteData({ id, name });
    setDeleteOpen(true);
  };

  // ---- Add product handlers ----
  const openAddProductDialog = () => {
    setNewProductName("");
    setNewProductCategory("");
    // Initialize prices for selected restaurants
    const initialPrices: Record<string, string> = {};
    selectedRestaurantIds.forEach((id) => {
      initialPrices[id] = "";
    });
    setNewProductPrices(initialPrices);
    setAddProductOpen(true);
  };

  const handleAddProduct = async () => {
    if (!newProductName.trim()) {
      toast.error("Veuillez entrer un nom de produit");
      return;
    }
    setSaving(true);

    try {
      // Create menu item
      const { data: menuItem, error: menuError } = await supabase
        .from("menu_items")
        .insert({
          name: newProductName.trim(),
          category: newProductCategory || null,
          is_active: true,
        })
        .select()
        .single();

      if (menuError) throw menuError;

      // Create prices for each restaurant
      const pricesToInsert = Object.entries(newProductPrices)
        .filter(([_, price]) => price !== "")
        .map(([restaurantId, price]) => ({
          menu_item_id: menuItem.id,
          restaurant_id: restaurantId,
          [platform === "uber" ? "price_uber" : "price_deliveroo"]: parseFloat(price),
          is_available: true,
        }));

      if (pricesToInsert.length > 0) {
        const { error: pricesError } = await supabase
          .from("restaurant_menu_prices")
          .insert(pricesToInsert);

        if (pricesError) throw pricesError;
      }

      toast.success("Produit ajouté avec succès");
      setAddProductOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'ajout du produit");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteData) return;
    setSaving(true);

    try {
      // Delete prices first
      const { error: pricesDeleteError } = await supabase
        .from("restaurant_menu_prices")
        .delete()
        .eq("menu_item_id", deleteData.id);

      if (pricesDeleteError) throw pricesDeleteError;

      // Deactivate item (soft delete)
      const { error: deactivateError } = await supabase
        .from("menu_items")
        .update({ is_active: false })
        .eq("id", deleteData.id);

      if (deactivateError) throw deactivateError;

      toast.success("Produit supprimé");
      setDeleteOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setSaving(false);
    }
  };

  // ---- Toggle validation handler ----
  const handleToggleValidation = async (
    menuItemId: string,
    restaurantId: string,
    validated: boolean
  ) => {
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from("restaurant_menu_prices")
        .select("id")
        .eq("menu_item_id", menuItemId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("restaurant_menu_prices")
          .update({
            validated,
            validated_at: validated ? new Date().toISOString() : null,
          })
          .eq("id", existing.id);
      } else {
        // Create record if it doesn't exist
        await supabase.from("restaurant_menu_prices").insert({
          menu_item_id: menuItemId,
          restaurant_id: restaurantId,
          validated,
          validated_at: validated ? new Date().toISOString() : null,
          is_available: true,
        });
      }

      setRefreshKey((k) => k + 1);
      toast.success(validated ? "Prix validé" : "Validation retirée");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la validation");
    }
  };

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Header with Platform Toggle and Export */}
      <div className="flex items-center justify-between">
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="uber" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <img src="/src/assets/uber-eats-logo.png" alt="Uber Eats" className="h-4 w-4" />
              Uber Eats
            </TabsTrigger>
            <TabsTrigger value="deliveroo" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <img src="/src/assets/deliveroo-logo.png" alt="Deliveroo" className="h-4 w-4" />
              Deliveroo
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {selectedRestaurantIds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={isExporting}>
                <Download className="h-4 w-4" />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Exporter en Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} className="gap-2">
                <FileText className="h-4 w-4 text-red-600" />
                Exporter en PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Restaurant Selector */}
      <div className="max-w-xl">
        <label className="text-sm font-medium mb-2 block text-muted-foreground">
          Restaurants à comparer (max. 6)
        </label>
        <RestaurantSelector
          restaurants={restaurants}
          selectedIds={selectedRestaurantIds}
          onSelectionChange={onSelectedRestaurantIdsChange}
          maxSelection={6}
        />
      </div>

      {selectedRestaurantIds.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Sélectionnez au moins un restaurant pour voir les prix</p>
        </div>
      ) : (
        <>
          {/* Modern KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-background to-muted/30">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Produits</p>
                    <p className="text-2xl font-bold tracking-tight">{stats.totalProducts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-background to-amber-50/30 dark:to-amber-950/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Écarts prix</p>
                    <p className="text-2xl font-bold tracking-tight text-amber-600">{currentStats.withDiff}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-background to-orange-50/30 dark:to-orange-950/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Écarts TVA</p>
                    <p className="text-2xl font-bold tracking-tight text-orange-600">{currentStats.withTvaDiff}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-background to-muted/30">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Percent className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Écart moyen</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {currentStats.avgDiff > 0 ? `+${currentStats.avgDiff}%` : "0%"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="discrepancies"
                checked={showOnlyDiscrepancies}
                onCheckedChange={(checked) => setShowOnlyDiscrepancies(checked === true)}
              />
              <label
                htmlFor="discrepancies"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Écarts prix
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tva-discrepancies"
                checked={showOnlyTvaDiscrepancies}
                onCheckedChange={(checked) => setShowOnlyTvaDiscrepancies(checked === true)}
              />
              <label
                htmlFor="tva-discrepancies"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-orange-600"
              >
                Écarts TVA
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-tva"
                checked={showTvaColumn}
                onCheckedChange={(checked) => setShowTvaColumn(checked === true)}
              />
              <label
                htmlFor="show-tva"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Afficher TVA
              </label>
            </div>
            <Button onClick={openAddProductDialog} size="sm" className="gap-2 ml-auto">
              <Plus className="h-4 w-4" />
              Ajouter un produit
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div ref={tableRef} className="border rounded-xl overflow-hidden shadow-sm bg-background max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[250px] font-semibold bg-muted/30">Produit</TableHead>
                    {selectedRestaurants.map((restaurant) => (
                      <TableHead key={restaurant.id} className="text-center min-w-[120px] font-semibold">
                        {getShortRestaurantName(restaurant.name)}
                      </TableHead>
                    ))}
                    {selectedRestaurants.length === 2 && (
                      <TableHead className="text-center w-[120px] font-semibold">Écart</TableHead>
                    )}
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(groupedItems.entries()).map(([category, categoryItems]) => (
                    <>
                      <TableRow key={`cat-${category}`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell
                          colSpan={selectedRestaurants.length + (selectedRestaurants.length === 2 ? 3 : 2)}
                          className="font-bold text-sm py-2.5 text-foreground/80"
                        >
                          {category}
                        </TableCell>
                      </TableRow>
                      {categoryItems.map((item) => {
                        const diff = platform === "uber"
                          ? item.uberDifference
                          : item.deliverooDifference;
                        const tvaDiff = platform === "uber"
                          ? item.uberTvaDifference
                          : item.deliverooTvaDifference;

                        const prices = item.restaurantPrices
                          .map((rp) => ({
                            id: rp.restaurantId,
                            price: platform === "uber" ? rp.priceUber : rp.priceDeliveroo,
                          }))
                          .filter((p) => p.price !== null);

                        const minPrice = prices.length > 0
                          ? Math.min(...prices.map((p) => p.price!))
                          : null;
                        const maxPrice = prices.length > 0
                          ? Math.max(...prices.map((p) => p.price!))
                          : null;

                        return (
                          <TableRow key={item.menuItemId} className="group transition-colors hover:bg-muted/40">
                            <TableCell className="font-medium text-foreground/90">
                              <div className="flex items-center gap-2">
                                {item.menuItemName}
                                {tvaDiff?.hasDifference && (
                                  <span 
                                    className="inline-flex items-center gap-0.5 text-orange-600"
                                    title={`TVA différente: ${tvaDiff.min}% (${tvaDiff.minRestaurant}) vs ${tvaDiff.max}% (${tvaDiff.maxRestaurant})`}
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            {selectedRestaurants.map((restaurant) => {
                              const rp = item.restaurantPrices.find(
                                (p) => p.restaurantId === restaurant.id
                              );
                              const price = platform === "uber"
                                ? rp?.priceUber
                                : rp?.priceDeliveroo;
                              const tva = platform === "uber"
                                ? rp?.tvaUber
                                : rp?.tvaDeliveroo;
                              const isValidated = rp?.validated ?? false;

                              const isMin = price !== null && price === minPrice && minPrice !== maxPrice;
                              const isMax = price !== null && price === maxPrice && minPrice !== maxPrice;
                              
                              // Check if this restaurant's TVA differs from others
                              const hasTvaIssue = tvaDiff?.hasDifference && tva !== null;

                              return (
                                <TableCell
                                  key={restaurant.id}
                                  className={cn(
                                    "text-center font-mono relative group/cell",
                                    isMin && "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
                                    isMax && "text-red-600 bg-red-50 dark:bg-red-950/20"
                                  )}
                                >
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleValidation(
                                            item.menuItemId,
                                            restaurant.id,
                                            !isValidated
                                          );
                                        }}
                                        className={cn(
                                          "h-4 w-4 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                                          isValidated
                                            ? "bg-emerald-500 text-white"
                                            : "border border-muted-foreground/30 hover:border-emerald-500 text-transparent hover:text-emerald-500"
                                        )}
                                        title={isValidated ? "Prix validé" : "Cliquer pour valider"}
                                      >
                                        <Check className="h-3 w-3" />
                                      </button>
                                      <span
                                        className="cursor-pointer hover:bg-muted/50 px-1 rounded transition-colors"
                                        onClick={() =>
                                          openEditPrice(
                                            item.menuItemId,
                                            item.menuItemName,
                                            restaurant.id,
                                            restaurant.name,
                                            price ?? null,
                                            tva ?? null
                                          )
                                        }
                                      >
                                        {formatPrice(price ?? null)}
                                      </span>
                                    </div>
                                    {showTvaColumn && tva !== null && tva !== undefined && (
                                      <span className={cn(
                                        "text-[10px] leading-tight",
                                        hasTvaIssue ? "text-orange-600 font-semibold" : "text-muted-foreground"
                                      )}>
                                        TVA {tva}%
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                            {selectedRestaurants.length === 2 && (
                              <TableCell className="text-center">
                                {(() => {
                                  // Detect free vs paid issue
                                  const hasFreePrice = prices.some(p => p.price === 0);
                                  const hasPaidPrice = prices.some(p => p.price !== null && p.price > 0);
                                  const hasFreeVsPaidIssue = hasFreePrice && hasPaidPrice;

                                  // Calculate monetary difference for 2 restaurants
                                  const monetaryDiff = minPrice !== null && maxPrice !== null
                                    ? maxPrice - minPrice
                                    : null;

                                  if (hasFreeVsPaidIssue) {
                                    return (
                                      <Badge
                                        variant="destructive"
                                        className="gap-1"
                                      >
                                        <AlertTriangle className="h-3 w-3" />
                                        Gratuit
                                      </Badge>
                                    );
                                  }

                                  if (diff && diff.percent > 0 && monetaryDiff !== null) {
                                    return (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <Badge
                                          variant={diff.percent > 10 ? "destructive" : "secondary"}
                                          className="gap-1"
                                        >
                                          <TrendingUp className="h-3 w-3" />
                                          +{diff.percent}%
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          +{monetaryDiff.toFixed(2)} €
                                        </span>
                                      </div>
                                    );
                                  }

                                  if (prices.length >= 2) {
                                    return (
                                      <Badge variant="outline" className="gap-1">
                                        <Minus className="h-3 w-3" />
                                        0%
                                      </Badge>
                                    );
                                  }

                                  return <span className="text-muted-foreground text-sm">-</span>;
                                })()}
                              </TableCell>
                            )}
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openMatchDialog(item.menuItemId, item.menuItemName)
                                    }
                                  >
                                    <Link2 className="h-4 w-4 mr-2" />
                                    Fusionner avec...
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openDeleteDialog(item.menuItemId, item.menuItemName)
                                    }
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Edit Price Dialog */}
      <Dialog open={editPriceOpen} onOpenChange={setEditPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le prix</DialogTitle>
            <DialogDescription>
              {editPriceData?.menuItemName} - {editPriceData?.restaurantName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Prix {platform === "uber" ? "Uber Eats" : "Deliveroo"} (€)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editPriceValue}
                onChange={(e) => setEditPriceValue(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                TVA (%)
              </label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="10"
                value={editTvaValue}
                onChange={(e) => setEditTvaValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Taux courants : 5.5%, 10%, 20%</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPriceOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSavePrice} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Product Dialog */}
      <Dialog open={matchOpen} onOpenChange={setMatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fusionner avec un autre produit</DialogTitle>
            <DialogDescription>
              Fusionner "{matchSource?.menuItemName}" avec un autre produit. Les prix seront transférés
              et le produit source sera désactivé.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Produit cible
            </label>
            <select
              className="w-full border rounded-md px-3 py-2 bg-background"
              value={matchTargetId}
              onChange={(e) => setMatchTargetId(e.target.value)}
            >
              <option value="">Sélectionner un produit...</option>
              {allMenuItems
                .filter((m) => m.id !== matchSource?.menuItemId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.category})
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleMatchProducts} disabled={saving || !matchTargetId}>
              {saving ? "Fusion..." : "Fusionner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le produit "{deleteData?.name}" sera désactivé et ses prix supprimés.
              Cette action peut être annulée depuis le catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} disabled={saving}>
              {saving ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un produit</DialogTitle>
            <DialogDescription>
              Créez un nouveau produit et définissez ses prix par restaurant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Nom du produit *</Label>
              <Input
                id="productName"
                placeholder="Ex: Burger Classic"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productCategory">Catégorie</Label>
              <Select value={newProductCategory} onValueChange={setNewProductCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRestaurantIds.length > 0 && (
              <div className="space-y-2">
                <Label>Prix {platform === "uber" ? "Uber Eats" : "Deliveroo"} par restaurant</Label>
                <div className="space-y-2">
                  {selectedRestaurants.map((restaurant) => (
                    <div key={restaurant.id} className="flex items-center gap-2">
                      <span className="text-sm w-24 truncate">
                        {getShortRestaurantName(restaurant.name)}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={newProductPrices[restaurant.id] || ""}
                        onChange={(e) =>
                          setNewProductPrices((prev) => ({
                            ...prev,
                            [restaurant.id]: e.target.value,
                          }))
                        }
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">€</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddProduct} disabled={saving || !newProductName.trim()}>
              {saving ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
