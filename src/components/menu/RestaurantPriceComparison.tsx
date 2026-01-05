import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMenuCatalogPrices, CatalogItem } from "@/hooks/useMenuCatalogPrices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, AlertTriangle, CheckCircle2, Package, TrendingUp, UtensilsCrossed } from "lucide-react";
import { DeliverooIcon, UberEatsIcon } from "@/components/icons/PlatformIcons";

const CATEGORIES_ORDER = [
  "Menu Enfant",
  "Menus Raclettes",
  "Sandwichs Raclettes",
  "Menus Naans",
  "Menus Burgers Naan",
  "Menus Fried Chicken",
  "Menus Wraps",
  "Menus Burgers",
  "Menus Xtra",
  "Fried Chicken",
  "Bowls",
  "Burgers",
  "Naans",
  "Burgers Naan",
  "Wraps",
  "À partager",
  "Desserts Glacés",
  "Desserts",
  "À la carte",
  "Salades",
  "Boissons",
];

export function RestaurantPriceComparison() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(false);

  const { loading, items, stats, error } = useMenuCatalogPrices();

  // Filter products based on search and discrepancy filter
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiscrepancy = !showOnlyDiscrepancies || item.hasDiscrepancy;
    return matchesSearch && matchesDiscrepancy;
  });

  // Group products by category in the exact order
  const groupedProducts = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};

    for (const item of filteredItems) {
      const category = CATEGORIES_ORDER.includes(item.category)
        ? item.category
        : null;
      if (category) {
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(item);
      }
    }

    // Build ordered result
    const result: { category: string; products: CatalogItem[] }[] = [];
    for (const category of CATEGORIES_ORDER) {
      if (groups[category] && groups[category].length > 0) {
        result.push({ category, products: groups[category] });
      }
    }

    return result;
  }, [filteredItems]);

  const formatPrice = (price: number | null) => {
    if (price == null) return "-";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UtensilsCrossed className="h-5 w-5 text-rose-500" />
              Comparaison des Prix Catalogue
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Comparez les prix entre Uber Eats et Deliveroo pour chaque produit du catalogue
            </p>
          </CardHeader>
        </Card>
      </motion.div>

      {/* KPIs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Produits au catalogue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.productsWithDiscrepancy}</p>
                <p className="text-sm text-muted-foreground">Avec écarts de prix</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <TrendingUp className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageDifferencePercent}%</p>
                <p className="text-sm text-muted-foreground">Écart moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col md:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/60 dark:bg-white/5 backdrop-blur-xl border-white/20"
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="show-discrepancies"
            checked={showOnlyDiscrepancies}
            onCheckedChange={setShowOnlyDiscrepancies}
          />
          <Label htmlFor="show-discrepancies" className="text-sm cursor-pointer">
            Afficher uniquement les écarts
          </Label>
        </div>
      </motion.div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px]">Produit</TableHead>
                    <TableHead className="text-center min-w-[120px]">
                      <div className="flex items-center justify-center gap-2">
                        <UberEatsIcon className="h-4 w-4" />
                        <span>Uber Eats</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center min-w-[120px]">
                      <div className="flex items-center justify-center gap-2">
                        <DeliverooIcon className="h-4 w-4" />
                        <span>Deliveroo</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        {searchQuery || showOnlyDiscrepancies
                          ? "Aucun produit ne correspond aux critères"
                          : "Aucun produit actif dans le catalogue"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedProducts.map((group) => (
                      <>
                        {/* Category header row */}
                        <TableRow
                          key={`cat-${group.category}`}
                          className="bg-primary/10 dark:bg-primary/20 hover:bg-primary/10 dark:hover:bg-primary/20 border-l-4 border-l-primary"
                        >
                          <TableCell colSpan={4} className="font-bold text-sm py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-primary">{group.category}</span>
                              <Badge className="bg-primary/20 text-primary border-0 text-xs font-medium">
                                {group.products.length} produit{group.products.length > 1 ? "s" : ""}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* Products in this category */}
                        {group.products.map((item) => (
                          <ProductRow key={item.id} item={item} formatPrice={formatPrice} />
                        ))}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function ProductRow({
  item,
  formatPrice,
}: {
  item: CatalogItem;
  formatPrice: (price: number | null) => string;
}) {
  const { priceUber, priceDeliveroo } = item;

  // Determine which is higher
  let uberClass = "";
  let deliverooClass = "";

  if (priceUber != null && priceDeliveroo != null && priceUber > 0 && priceDeliveroo > 0) {
    if (priceUber > priceDeliveroo) {
      uberClass = "text-amber-600";
      deliverooClass = "text-emerald-600";
    } else if (priceDeliveroo > priceUber) {
      uberClass = "text-emerald-600";
      deliverooClass = "text-amber-600";
    }
  }

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="font-medium">
        <span className="truncate max-w-[300px] block" title={item.name}>
          {item.name}
        </span>
      </TableCell>

      <TableCell className="text-center">
        <span className={`font-mono text-sm ${uberClass}`}>
          {formatPrice(priceUber)}
        </span>
      </TableCell>

      <TableCell className="text-center">
        <span className={`font-mono text-sm ${deliverooClass}`}>
          {formatPrice(priceDeliveroo)}
        </span>
      </TableCell>

      <TableCell className="text-center">
        {item.hasDiscrepancy ? (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {item.differencePercent}%
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Identique
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
