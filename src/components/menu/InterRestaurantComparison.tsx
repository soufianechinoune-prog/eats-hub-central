import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { RestaurantSelector } from "./RestaurantSelector";
import { useRestaurantMenuPrices, MenuItemComparison } from "@/hooks/useRestaurantMenuPrices";

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

export function InterRestaurantComparison() {
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [platform, setPlatform] = useState<Platform>("uber");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(false);

  const { loading, items, restaurants, stats } = useRestaurantMenuPrices(selectedRestaurantIds);

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.menuItemName.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
      );
    }

    // Filter by discrepancies
    if (showOnlyDiscrepancies) {
      filtered = filtered.filter((item) => {
        const diff = platform === "uber" ? item.uberDifference : item.deliverooDifference;
        return diff && diff.percent > 0;
      });
    }

    return filtered;
  }, [items, searchQuery, showOnlyDiscrepancies, platform]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, MenuItemComparison[]>();

    filteredItems.forEach((item) => {
      const category = item.category || "Sans catégorie";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(item);
    });

    // Sort by category order
    const sortedGroups = new Map<string, MenuItemComparison[]>();
    CATEGORY_ORDER.forEach((cat) => {
      if (groups.has(cat)) {
        sortedGroups.set(cat, groups.get(cat)!);
        groups.delete(cat);
      }
    });
    // Add remaining categories
    groups.forEach((items, cat) => {
      sortedGroups.set(cat, items);
    });

    return sortedGroups;
  }, [filteredItems]);

  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return `${price.toFixed(2)} €`;
  };

  const getShortRestaurantName = (name: string) => {
    return name.replace(/^CHICKEN STREET\s*/i, "").split(/[-\s]/)[0];
  };

  const selectedRestaurants = restaurants.filter((r) =>
    selectedRestaurantIds.includes(r.id)
  );

  const currentStats = platform === "uber"
    ? { withDiff: stats.productsWithUberDiff, avgDiff: stats.avgUberDiff }
    : { withDiff: stats.productsWithDeliverooDiff, avgDiff: stats.avgDeliverooDiff };

  return (
    <div className="space-y-6">
      {/* Platform Toggle */}
      <div className="flex items-center justify-between">
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
          <TabsList>
            <TabsTrigger value="uber" className="gap-2">
              <img src="/src/assets/uber-eats-logo.png" alt="Uber Eats" className="h-4 w-4" />
              Uber Eats
            </TabsTrigger>
            <TabsTrigger value="deliveroo" className="gap-2">
              <img src="/src/assets/deliveroo-logo.png" alt="Deliveroo" className="h-4 w-4" />
              Deliveroo
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Restaurant Selector */}
      <div className="max-w-xl">
        <label className="text-sm font-medium mb-2 block">
          Restaurants à comparer (max. 6)
        </label>
        <RestaurantSelector
          restaurants={restaurants}
          selectedIds={selectedRestaurantIds}
          onSelectionChange={setSelectedRestaurantIds}
          maxSelection={6}
        />
      </div>

      {selectedRestaurantIds.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Sélectionnez au moins un restaurant pour voir les prix
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Produits</div>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Avec écarts</div>
              <div className="text-2xl font-bold text-amber-600">
                {currentStats.withDiff}
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Écart moyen</div>
              <div className="text-2xl font-bold">
                {currentStats.avgDiff > 0 ? `+${currentStats.avgDiff}%` : "0%"}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyDiscrepancies}
                onChange={(e) => setShowOnlyDiscrepancies(e.target.checked)}
                className="rounded border-input"
              />
              Écarts uniquement
            </label>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[250px]">Produit</TableHead>
                    {selectedRestaurants.map((restaurant) => (
                      <TableHead key={restaurant.id} className="text-center min-w-[100px]">
                        {getShortRestaurantName(restaurant.name)}
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-[120px]">Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(groupedItems.entries()).map(([category, categoryItems]) => (
                    <>
                      <TableRow key={`cat-${category}`} className="bg-muted/30">
                        <TableCell
                          colSpan={selectedRestaurants.length + 2}
                          className="font-semibold text-sm py-2"
                        >
                          {category}
                        </TableCell>
                      </TableRow>
                      {categoryItems.map((item) => {
                        const diff = platform === "uber"
                          ? item.uberDifference
                          : item.deliverooDifference;

                        // Find min/max prices for highlighting
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
                          <TableRow key={item.menuItemId}>
                            <TableCell className="font-medium">
                              {item.menuItemName}
                            </TableCell>
                            {selectedRestaurants.map((restaurant) => {
                              const rp = item.restaurantPrices.find(
                                (p) => p.restaurantId === restaurant.id
                              );
                              const price = platform === "uber"
                                ? rp?.priceUber
                                : rp?.priceDeliveroo;

                              const isMin = price !== null && price === minPrice && minPrice !== maxPrice;
                              const isMax = price !== null && price === maxPrice && minPrice !== maxPrice;

                              return (
                                <TableCell
                                  key={restaurant.id}
                                  className={cn(
                                    "text-center font-mono",
                                    isMin && "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
                                    isMax && "text-red-600 bg-red-50 dark:bg-red-950/20"
                                  )}
                                >
                                  {formatPrice(price ?? null)}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              {diff && diff.percent > 0 ? (
                                <Badge
                                  variant={diff.percent > 10 ? "destructive" : "secondary"}
                                  className="gap-1"
                                >
                                  <TrendingUp className="h-3 w-3" />
                                  +{diff.percent}%
                                </Badge>
                              ) : prices.length >= 2 ? (
                                <Badge variant="outline" className="gap-1">
                                  <Minus className="h-3 w-3" />
                                  0%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
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
    </div>
  );
}
