import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantPrices, ProductPriceAnalysis } from "@/hooks/useRestaurantPrices";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, AlertTriangle, CheckCircle2, Package, TrendingUp, Store } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
}

export function RestaurantPriceComparison() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);

  const { loading, products, restaurants, stats, error } = useRestaurantPrices(selectedRestaurantIds);

  // Fetch all restaurants on mount
  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name");

      if (!error && data) {
        setAllRestaurants(data);
        // Select all by default
        setSelectedRestaurantIds(data.map(r => r.id));
      }
      setLoadingRestaurants(false);
    };

    fetchRestaurants();
  }, []);

  // Filter products based on search and discrepancy filter
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === "" || 
      product.itemTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiscrepancy = !showOnlyDiscrepancies || product.hasDiscrepancy;
    return matchesSearch && matchesDiscrepancy;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const getShortName = (name: string) => {
    // Extract short name for table headers
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return parts.slice(-1)[0]; // Get last word (usually city or identifier)
    }
    return name.slice(0, 10);
  };

  if (loadingRestaurants) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

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
              <Store className="h-5 w-5 text-rose-500" />
              Comparaison des Prix par Restaurant
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Analysez les écarts de prix entre vos restaurants à partir des commandes sans promotion
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
                <p className="text-sm text-muted-foreground">Produits analysés</p>
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

        <Select
          value={selectedRestaurantIds.length === allRestaurants.length ? "all" : "custom"}
          onValueChange={(value) => {
            if (value === "all") {
              setSelectedRestaurantIds(allRestaurants.map(r => r.id));
            }
          }}
        >
          <SelectTrigger className="w-[200px] bg-white/60 dark:bg-white/5 backdrop-blur-xl border-white/20">
            <SelectValue placeholder="Restaurants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les restaurants ({allRestaurants.length})</SelectItem>
          </SelectContent>
        </Select>
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
                    <TableHead className="w-[250px]">Produit</TableHead>
                    {restaurants.map((restaurant) => (
                      <TableHead key={restaurant.id} className="text-center min-w-[100px]">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-medium">{getShortName(restaurant.name)}</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={restaurants.length + 2} className="text-center py-12 text-muted-foreground">
                        {searchQuery || showOnlyDiscrepancies 
                          ? "Aucun produit ne correspond aux critères"
                          : "Aucune donnée disponible. Importez des commandes pour analyser les prix."
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <ProductRow 
                        key={product.itemTitle} 
                        product={product} 
                        restaurants={restaurants}
                        formatPrice={formatPrice}
                      />
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
  product, 
  restaurants, 
  formatPrice 
}: { 
  product: ProductPriceAnalysis;
  restaurants: { id: string; name: string }[];
  formatPrice: (price: number) => string;
}) {
  // Create a map for quick lookup
  const priceMap = new Map(product.prices.map(p => [p.restaurantId, p]));

  // Find the reference price (most common or first)
  const avgPrices = product.prices.map(p => p.averagePrice);
  const referencePrice = avgPrices.length > 0 ? Math.min(...avgPrices) : 0;

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[200px]" title={product.itemTitle}>
            {product.itemTitle}
          </span>
          <Badge variant="outline" className="text-xs shrink-0">
            {product.prices.reduce((sum, p) => sum + p.orderCount, 0)} cmd
          </Badge>
        </div>
      </TableCell>
      
      {restaurants.map((restaurant) => {
        const priceData = priceMap.get(restaurant.id);
        
        if (!priceData) {
          return (
            <TableCell key={restaurant.id} className="text-center">
              <span className="text-muted-foreground text-sm">-</span>
            </TableCell>
          );
        }

        const isDifferent = Math.abs(priceData.averagePrice - referencePrice) > 0.01;
        const isHigher = priceData.averagePrice > referencePrice;

        return (
          <TableCell key={restaurant.id} className="text-center">
            <div className="flex flex-col items-center">
              <span className={`font-mono text-sm ${isDifferent ? (isHigher ? "text-amber-600" : "text-emerald-600") : ""}`}>
                {formatPrice(priceData.averagePrice)}
              </span>
              {isDifferent && (
                <span className={`text-xs ${isHigher ? "text-amber-500" : "text-emerald-500"}`}>
                  {isHigher ? "+" : ""}{((priceData.averagePrice - referencePrice) / referencePrice * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </TableCell>
        );
      })}

      <TableCell className="text-center">
        {product.hasDiscrepancy ? (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            +{product.maxDifferencePercent}%
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
