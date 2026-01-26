import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Restaurant {
  id: string;
  name: string;
  is_pinned?: boolean;
}

export interface RestaurantMenuPrice {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  price_uber: number | null;
  price_deliveroo: number | null;
}

export interface EnrichedMenuItemPrice {
  restaurantId: string;
  restaurantName: string;
  price: number | null;
  catalogPrice: number | null;
  usedPrice: number | null;
  hasDifference: boolean;
}

export interface EnrichedMenuItem {
  id: string;
  name: string;
  category: string | null;
  food_cost: number | null;
  is_active: boolean;
  price_uber: number | null;
  price_deliveroo: number | null;
  // Prix par restaurant sélectionné
  restaurantPrices: EnrichedMenuItemPrice[];
}

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
}

export function useSimulatorRestaurantPrices(
  menuItems: MenuItem[],
  restaurantIds: string[],
  platform: "uber" | "deliveroo"
) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantPrices, setRestaurantPrices] = useState<RestaurantMenuPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, is_pinned")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching restaurants:", error);
        return;
      }
      setRestaurants(data || []);
    };

    fetchRestaurants();
  }, []);

  // Fetch restaurant menu prices for selected restaurants
  useEffect(() => {
    const fetchPrices = async () => {
      if (restaurantIds.length === 0) {
        setRestaurantPrices([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from("restaurant_menu_prices")
        .select("id, restaurant_id, menu_item_id, price_uber, price_deliveroo")
        .in("restaurant_id", restaurantIds);

      if (error) {
        console.error("Error fetching restaurant menu prices:", error);
        setIsLoading(false);
        return;
      }

      setRestaurantPrices(data || []);
      setIsLoading(false);
    };

    fetchPrices();
  }, [restaurantIds]);

  // Create a map for quick restaurant name lookup
  const restaurantNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    restaurants.forEach((r) => {
      map[r.id] = r.name;
    });
    return map;
  }, [restaurants]);

  // Enrich menu items with restaurant-specific prices
  const enrichedMenuItems: EnrichedMenuItem[] = useMemo(() => {
    return menuItems.map((item) => {
      const catalogPrice = platform === "uber" ? item.price_uber : item.price_deliveroo;

      // For each selected restaurant, find the specific price
      const restaurantPricesForItem: EnrichedMenuItemPrice[] = restaurantIds.map((restId) => {
        const specificPrice = restaurantPrices.find(
          (rp) => rp.menu_item_id === item.id && rp.restaurant_id === restId
        );

        const price = specificPrice
          ? platform === "uber"
            ? specificPrice.price_uber
            : specificPrice.price_deliveroo
          : null;

        const usedPrice = price !== null ? price : catalogPrice;
        const hasDifference = price !== null && catalogPrice !== null && price !== catalogPrice;

        return {
          restaurantId: restId,
          restaurantName: restaurantNameMap[restId] || "Restaurant",
          price,
          catalogPrice,
          usedPrice,
          hasDifference,
        };
      });

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        food_cost: item.food_cost,
        is_active: item.is_active,
        price_uber: item.price_uber,
        price_deliveroo: item.price_deliveroo,
        restaurantPrices: restaurantPricesForItem,
      };
    });
  }, [menuItems, restaurantIds, restaurantPrices, restaurantNameMap, platform]);

  // Helper function to get the price for a specific restaurant
  const getRestaurantPrice = (
    menuItemId: string,
    restaurantId: string
  ): { price: number | null; source: "restaurant" | "catalog" } => {
    const item = menuItems.find((m) => m.id === menuItemId);
    if (!item) return { price: null, source: "catalog" };

    const catalogPrice = platform === "uber" ? item.price_uber : item.price_deliveroo;

    const specificPrice = restaurantPrices.find(
      (rp) => rp.menu_item_id === menuItemId && rp.restaurant_id === restaurantId
    );

    if (specificPrice) {
      const price = platform === "uber" ? specificPrice.price_uber : specificPrice.price_deliveroo;
      if (price !== null) {
        return { price, source: "restaurant" };
      }
    }

    return { price: catalogPrice, source: "catalog" };
  };

  return {
    restaurants,
    enrichedMenuItems,
    isLoading,
    getRestaurantPrice,
    restaurantNameMap,
  };
}
