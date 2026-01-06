import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantPrice {
  restaurantId: string;
  restaurantName: string;
  priceUber: number | null;
  priceDeliveroo: number | null;
  descriptionOverride: string | null;
  isAvailable: boolean;
}

export interface MenuItemWithPrices {
  menuItemId: string;
  menuItemName: string;
  category: string;
  masterPriceUber: number | null;
  masterPriceDeliveroo: number | null;
  restaurantPrices: RestaurantPrice[];
}

export interface PriceDifference {
  min: number;
  max: number;
  percent: number;
  minRestaurant: string;
  maxRestaurant: string;
}

export interface MenuItemComparison extends MenuItemWithPrices {
  uberDifference: PriceDifference | null;
  deliverooDifference: PriceDifference | null;
}

export interface Restaurant {
  id: string;
  name: string;
}

export function useRestaurantMenuPrices(
  selectedRestaurantIds: string[],
  refreshKey: number = 0
) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MenuItemComparison[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("Error fetching restaurants:", error);
        return;
      }

      setRestaurants(data || []);
    };

    fetchRestaurants();
  }, []);

  useEffect(() => {
    const fetchPrices = async () => {
      if (selectedRestaurantIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch menu items (master catalog)
        const { data: menuItems, error: menuError } = await supabase
          .from("menu_items")
          .select("id, name, category, price_uber, price_deliveroo")
          .eq("is_active", true)
          .order("category")
          .order("name");

        if (menuError) throw menuError;

        // Fetch restaurant-specific prices
        const { data: restaurantPrices, error: pricesError } = await supabase
          .from("restaurant_menu_prices")
          .select(`
            id,
            restaurant_id,
            menu_item_id,
            price_uber,
            price_deliveroo,
            description_override,
            is_available,
            restaurants!inner(id, name)
          `)
          .in("restaurant_id", selectedRestaurantIds);

        if (pricesError) throw pricesError;

        // Get restaurant names for selected restaurants
        const { data: selectedRestaurantsData } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", selectedRestaurantIds);

        const restaurantNameMap = new Map<string, string>();
        selectedRestaurantsData?.forEach((r) => {
          restaurantNameMap.set(r.id, r.name);
        });

        // Group prices by menu item
        const pricesByMenuItem = new Map<string, RestaurantPrice[]>();
        
        restaurantPrices?.forEach((rp: any) => {
          const menuItemId = rp.menu_item_id;
          if (!pricesByMenuItem.has(menuItemId)) {
            pricesByMenuItem.set(menuItemId, []);
          }
          pricesByMenuItem.get(menuItemId)!.push({
            restaurantId: rp.restaurant_id,
            restaurantName: rp.restaurants?.name || restaurantNameMap.get(rp.restaurant_id) || "Unknown",
            priceUber: rp.price_uber,
            priceDeliveroo: rp.price_deliveroo,
            descriptionOverride: rp.description_override,
            isAvailable: rp.is_available,
          });
        });

        // Build comparison data
        const comparisonItems: MenuItemComparison[] = (menuItems || []).map((item) => {
          const restaurantPricesList = pricesByMenuItem.get(item.id) || [];

          // Ensure all selected restaurants are represented
          const fullPricesList = selectedRestaurantIds.map((restId) => {
            const existing = restaurantPricesList.find((p) => p.restaurantId === restId);
            if (existing) return existing;
            return {
              restaurantId: restId,
              restaurantName: restaurantNameMap.get(restId) || "Unknown",
              priceUber: null,
              priceDeliveroo: null,
              descriptionOverride: null,
              isAvailable: true,
            };
          });

          // Calculate differences
          const uberPrices = fullPricesList
            .filter((p) => p.priceUber !== null)
            .map((p) => ({ price: p.priceUber!, name: p.restaurantName }));
          
          const deliverooPrices = fullPricesList
            .filter((p) => p.priceDeliveroo !== null)
            .map((p) => ({ price: p.priceDeliveroo!, name: p.restaurantName }));

          const calculateDifference = (
            prices: { price: number; name: string }[]
          ): PriceDifference | null => {
            if (prices.length < 2) return null;
            const sorted = [...prices].sort((a, b) => a.price - b.price);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            if (min.price === 0) return null;
            return {
              min: min.price,
              max: max.price,
              percent: Math.round(((max.price - min.price) / min.price) * 100),
              minRestaurant: min.name,
              maxRestaurant: max.name,
            };
          };

          return {
            menuItemId: item.id,
            menuItemName: item.name,
            category: item.category || "Sans catégorie",
            masterPriceUber: item.price_uber,
            masterPriceDeliveroo: item.price_deliveroo,
            restaurantPrices: fullPricesList,
            uberDifference: calculateDifference(uberPrices),
            deliverooDifference: calculateDifference(deliverooPrices),
          };
        });

        // Filter to only show items that have at least one restaurant price
        const itemsWithPrices = comparisonItems.filter((item) =>
          item.restaurantPrices.some((p) => p.priceUber !== null || p.priceDeliveroo !== null)
        );

        setItems(itemsWithPrices);
      } catch (err) {
        console.error("Error fetching prices:", err);
        setError("Erreur lors du chargement des prix");
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [selectedRestaurantIds, refreshKey]);

  const stats = useMemo(() => {
    const itemsWithUberDiff = items.filter((i) => i.uberDifference && i.uberDifference.percent > 0);
    const itemsWithDeliverooDiff = items.filter((i) => i.deliverooDifference && i.deliverooDifference.percent > 0);

    const avgUberDiff = itemsWithUberDiff.length > 0
      ? Math.round(itemsWithUberDiff.reduce((acc, i) => acc + (i.uberDifference?.percent || 0), 0) / itemsWithUberDiff.length)
      : 0;

    const avgDeliverooDiff = itemsWithDeliverooDiff.length > 0
      ? Math.round(itemsWithDeliverooDiff.reduce((acc, i) => acc + (i.deliverooDifference?.percent || 0), 0) / itemsWithDeliverooDiff.length)
      : 0;

    return {
      totalProducts: items.length,
      productsWithUberDiff: itemsWithUberDiff.length,
      productsWithDeliverooDiff: itemsWithDeliverooDiff.length,
      avgUberDiff,
      avgDeliverooDiff,
    };
  }, [items]);

  return { loading, items, restaurants, stats, error };
}
