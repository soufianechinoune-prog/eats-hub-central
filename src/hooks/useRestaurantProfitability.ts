import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RestaurantMargin {
  restaurantId: string;
  restaurantName: string;
  priceUber: number | null;
  priceDeliveroo: number | null;
  marginUber: number | null;
  marginDeliveroo: number | null;
}

export interface ProductProfitability {
  menuItemId: string;
  menuItemName: string;
  category: string | null;
  foodCost: number | null;
  restaurants: RestaurantMargin[];
  avgMargin: number | null;
  minMargin: { value: number; restaurant: string } | null;
  maxMargin: { value: number; restaurant: string } | null;
  marginSpread: number | null; // Écart entre min et max
}

interface Restaurant {
  id: string;
  name: string;
}

interface ProfitabilityStats {
  totalProducts: number;
  productsWithData: number;
  avgMargin: number | null;
  alertCount: number; // Produits avec écart > 10%
}

export function useRestaurantProfitability(
  selectedRestaurantIds: string[],
  platform: "uber" | "deliveroo" = "uber"
) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductProfitability[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (selectedRestaurantIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch restaurants
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", selectedRestaurantIds);

        if (restaurantsError) throw restaurantsError;
        setRestaurants(restaurantsData || []);

        // First: Fetch restaurant prices to get only products with prices
        const { data: pricesData, error: pricesError } = await supabase
          .from("restaurant_menu_prices")
          .select("menu_item_id, restaurant_id, price_uber, price_deliveroo")
          .in("restaurant_id", selectedRestaurantIds);

        if (pricesError) throw pricesError;

        // Extract unique menu item IDs that have prices
        const uniqueMenuItemIds = [...new Set(pricesData?.map(p => p.menu_item_id) || [])];

        if (uniqueMenuItemIds.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        // Then: Fetch only menu items that have restaurant prices
        const { data: menuItemsData, error: menuItemsError } = await supabase
          .from("menu_items")
          .select("id, name, category, food_cost")
          .in("id", uniqueMenuItemIds)
          .eq("is_active", true)
          .order("category")
          .order("name");

        if (menuItemsError) throw menuItemsError;

        // Build lookup map for prices
        const pricesMap = new Map<string, Map<string, { priceUber: number | null; priceDeliveroo: number | null }>>();
        
        pricesData?.forEach((price) => {
          const key = price.menu_item_id;
          if (!pricesMap.has(key)) {
            pricesMap.set(key, new Map());
          }
          pricesMap.get(key)!.set(price.restaurant_id, {
            priceUber: price.price_uber,
            priceDeliveroo: price.price_deliveroo,
          });
        });

        // Calculate margins for each product/restaurant combination
        const profitabilityItems: ProductProfitability[] = (menuItemsData || []).map((item) => {
          const restaurantMargins: RestaurantMargin[] = [];
          const margins: number[] = [];
          const marginDetails: { value: number; restaurant: string }[] = [];

          selectedRestaurantIds.forEach((restaurantId) => {
            const restaurant = restaurantsData?.find((r) => r.id === restaurantId);
            const prices = pricesMap.get(item.id)?.get(restaurantId);
            
            let marginUber: number | null = null;
            let marginDeliveroo: number | null = null;

            if (item.food_cost !== null && item.food_cost > 0) {
              // Calculate margin: ((Price - FoodCost) / Price) * 100
              if (prices?.priceUber && prices.priceUber > 0) {
                marginUber = ((prices.priceUber - item.food_cost) / prices.priceUber) * 100;
                margins.push(marginUber);
                marginDetails.push({ value: marginUber, restaurant: restaurant?.name || restaurantId });
              }
              if (prices?.priceDeliveroo && prices.priceDeliveroo > 0) {
                marginDeliveroo = ((prices.priceDeliveroo - item.food_cost) / prices.priceDeliveroo) * 100;
                if (platform === "deliveroo") {
                  margins.push(marginDeliveroo);
                  marginDetails.push({ value: marginDeliveroo, restaurant: restaurant?.name || restaurantId });
                }
              }
            }

            restaurantMargins.push({
              restaurantId,
              restaurantName: restaurant?.name || restaurantId,
              priceUber: prices?.priceUber || null,
              priceDeliveroo: prices?.priceDeliveroo || null,
              marginUber,
              marginDeliveroo,
            });
          });

          // Calculate stats
          const avgMargin = margins.length > 0 
            ? margins.reduce((a, b) => a + b, 0) / margins.length 
            : null;

          const sortedDetails = marginDetails.sort((a, b) => a.value - b.value);
          const minMargin = sortedDetails.length > 0 ? sortedDetails[0] : null;
          const maxMargin = sortedDetails.length > 0 ? sortedDetails[sortedDetails.length - 1] : null;
          
          const marginSpread = minMargin && maxMargin 
            ? maxMargin.value - minMargin.value 
            : null;

          return {
            menuItemId: item.id,
            menuItemName: item.name,
            category: item.category,
            foodCost: item.food_cost,
            restaurants: restaurantMargins,
            avgMargin,
            minMargin,
            maxMargin,
            marginSpread,
          };
        });

        setItems(profitabilityItems);
      } catch (err) {
        console.error("Error fetching profitability data:", err);
        setError(err instanceof Error ? err.message : "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedRestaurantIds, platform]);

  const stats = useMemo<ProfitabilityStats>(() => {
    const productsWithData = items.filter((i) => i.avgMargin !== null).length;
    const allMargins = items
      .filter((i) => i.avgMargin !== null)
      .map((i) => i.avgMargin!);
    
    const avgMargin = allMargins.length > 0
      ? allMargins.reduce((a, b) => a + b, 0) / allMargins.length
      : null;

    const alertCount = items.filter((i) => 
      i.marginSpread !== null && i.marginSpread > 10
    ).length;

    return {
      totalProducts: items.length,
      productsWithData,
      avgMargin,
      alertCount,
    };
  }, [items]);

  return {
    loading,
    items,
    restaurants,
    stats,
    error,
  };
}
