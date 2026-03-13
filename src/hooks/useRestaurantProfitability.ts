import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RestaurantMargin {
  restaurantId: string;
  restaurantName: string;
  priceUber: number | null;
  priceDeliveroo: number | null;
  marginBrutUber: number | null;
  marginBrutDeliveroo: number | null;
  marginNetUber: number | null;
  marginNetDeliveroo: number | null;
}

export interface ProductProfitability {
  menuItemId: string;
  menuItemName: string;
  category: string | null;
  foodCost: number | null;
  vatRate: number | null;
  restaurants: RestaurantMargin[];
  avgMarginBrut: number | null;
  avgMarginNet: number | null;
  minMarginBrut: { value: number; restaurant: string } | null;
  maxMarginBrut: { value: number; restaurant: string } | null;
  minMarginNet: { value: number; restaurant: string } | null;
  maxMarginNet: { value: number; restaurant: string } | null;
  marginSpreadBrut: number | null;
  marginSpreadNet: number | null;
}

interface Restaurant {
  id: string;
  name: string;
}

interface ProfitabilityStats {
  totalProducts: number;
  productsWithData: number;
  avgMarginBrut: number | null;
  avgMarginNet: number | null;
  alertCountBrut: number;
  alertCountNet: number;
}

export function useRestaurantProfitability(
  selectedRestaurantIds: string[],
  platform: "uber" | "deliveroo" = "uber",
  commissionRate: number = 30 // Commission rate in %
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

        // First: Fetch restaurant prices with pagination to bypass 1000-row limit
        const PAGE_SIZE = 1000;
        let allPricesData: any[] = [];
        let from = 0;
        while (true) {
          const { data: batch, error: batchError } = await supabase
            .from("restaurant_menu_prices")
            .select("menu_item_id, restaurant_id, price_uber, price_deliveroo")
            .in("restaurant_id", selectedRestaurantIds)
            .range(from, from + PAGE_SIZE - 1);
          if (batchError) throw batchError;
          if (!batch || batch.length === 0) break;
          allPricesData = allPricesData.concat(batch);
          if (batch.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        const pricesData = allPricesData;

        // Extract unique menu item IDs that have prices
        const uniqueMenuItemIds = [...new Set(pricesData?.map(p => p.menu_item_id) || [])];

        if (uniqueMenuItemIds.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        // Then: Fetch only menu items that have restaurant prices (include vat_rate)
        const { data: menuItemsData, error: menuItemsError } = await supabase
          .from("menu_items")
          .select("id, name, category, food_cost, vat_rate")
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
          const marginsBrut: number[] = [];
          const marginsNet: number[] = [];
          const marginDetailsBrut: { value: number; restaurant: string }[] = [];
          const marginDetailsNet: { value: number; restaurant: string }[] = [];

          // Get VAT rate (default 10% if not set)
          const vatRate = item.vat_rate ?? 10;

          selectedRestaurantIds.forEach((restaurantId) => {
            const restaurant = restaurantsData?.find((r) => r.id === restaurantId);
            const prices = pricesMap.get(item.id)?.get(restaurantId);
            
            let marginBrutUber: number | null = null;
            let marginBrutDeliveroo: number | null = null;
            let marginNetUber: number | null = null;
            let marginNetDeliveroo: number | null = null;

            if (item.food_cost !== null && item.food_cost >= 0) {
              // Marge Brute = (Prix HT - Food Cost HT) / Prix HT * 100
              // Marge Nette = (Prix HT - Commission - Food Cost HT) / Prix HT * 100
              
              if (prices?.priceUber && prices.priceUber > 0) {
                const prixHT = prices.priceUber / (1 + vatRate / 100);
                marginBrutUber = ((prixHT - item.food_cost) / prixHT) * 100;
                // Commission calculée sur TTC (formule Uber officielle)
                const commissionHT = prices.priceUber * (commissionRate / 100);
                marginNetUber = ((prixHT - commissionHT - item.food_cost) / prixHT) * 100;
                
                marginsBrut.push(marginBrutUber);
                marginsNet.push(marginNetUber);
                marginDetailsBrut.push({ value: marginBrutUber, restaurant: restaurant?.name || restaurantId });
                marginDetailsNet.push({ value: marginNetUber, restaurant: restaurant?.name || restaurantId });
              }
              if (prices?.priceDeliveroo && prices.priceDeliveroo > 0) {
                const prixHT = prices.priceDeliveroo / (1 + vatRate / 100);
                marginBrutDeliveroo = ((prixHT - item.food_cost) / prixHT) * 100;
                // Commission calculée sur TTC (formule Uber officielle)
                const commissionHT = prices.priceDeliveroo * (commissionRate / 100);
                marginNetDeliveroo = ((prixHT - commissionHT - item.food_cost) / prixHT) * 100;
                
                if (platform === "deliveroo") {
                  marginsBrut.push(marginBrutDeliveroo);
                  marginsNet.push(marginNetDeliveroo);
                  marginDetailsBrut.push({ value: marginBrutDeliveroo, restaurant: restaurant?.name || restaurantId });
                  marginDetailsNet.push({ value: marginNetDeliveroo, restaurant: restaurant?.name || restaurantId });
                }
              }
            }

            restaurantMargins.push({
              restaurantId,
              restaurantName: restaurant?.name || restaurantId,
              priceUber: prices?.priceUber || null,
              priceDeliveroo: prices?.priceDeliveroo || null,
              marginBrutUber,
              marginBrutDeliveroo,
              marginNetUber,
              marginNetDeliveroo,
            });
          });

          // Calculate stats for both margin types
          const avgMarginBrut = marginsBrut.length > 0 
            ? marginsBrut.reduce((a, b) => a + b, 0) / marginsBrut.length 
            : null;
          const avgMarginNet = marginsNet.length > 0 
            ? marginsNet.reduce((a, b) => a + b, 0) / marginsNet.length 
            : null;

          const sortedDetailsBrut = marginDetailsBrut.sort((a, b) => a.value - b.value);
          const sortedDetailsNet = marginDetailsNet.sort((a, b) => a.value - b.value);
          
          const minMarginBrut = sortedDetailsBrut.length > 0 ? sortedDetailsBrut[0] : null;
          const maxMarginBrut = sortedDetailsBrut.length > 0 ? sortedDetailsBrut[sortedDetailsBrut.length - 1] : null;
          const minMarginNet = sortedDetailsNet.length > 0 ? sortedDetailsNet[0] : null;
          const maxMarginNet = sortedDetailsNet.length > 0 ? sortedDetailsNet[sortedDetailsNet.length - 1] : null;
          
          const marginSpreadBrut = minMarginBrut && maxMarginBrut 
            ? maxMarginBrut.value - minMarginBrut.value 
            : null;
          const marginSpreadNet = minMarginNet && maxMarginNet 
            ? maxMarginNet.value - minMarginNet.value 
            : null;

          return {
            menuItemId: item.id,
            menuItemName: item.name,
            category: item.category,
            foodCost: item.food_cost,
            vatRate: item.vat_rate,
            restaurants: restaurantMargins,
            avgMarginBrut,
            avgMarginNet,
            minMarginBrut,
            maxMarginBrut,
            minMarginNet,
            maxMarginNet,
            marginSpreadBrut,
            marginSpreadNet,
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
  }, [selectedRestaurantIds, platform, commissionRate]);

  const stats = useMemo<ProfitabilityStats>(() => {
    const productsWithData = items.filter((i) => i.avgMarginBrut !== null).length;
    
    const allMarginsBrut = items
      .filter((i) => i.avgMarginBrut !== null)
      .map((i) => i.avgMarginBrut!);
    const allMarginsNet = items
      .filter((i) => i.avgMarginNet !== null)
      .map((i) => i.avgMarginNet!);
    
    const avgMarginBrut = allMarginsBrut.length > 0
      ? allMarginsBrut.reduce((a, b) => a + b, 0) / allMarginsBrut.length
      : null;
    const avgMarginNet = allMarginsNet.length > 0
      ? allMarginsNet.reduce((a, b) => a + b, 0) / allMarginsNet.length
      : null;

    const alertCountBrut = items.filter((i) => 
      i.marginSpreadBrut !== null && i.marginSpreadBrut > 10
    ).length;
    const alertCountNet = items.filter((i) => 
      i.marginSpreadNet !== null && i.marginSpreadNet > 10
    ).length;

    return {
      totalProducts: items.length,
      productsWithData,
      avgMarginBrut,
      avgMarginNet,
      alertCountBrut,
      alertCountNet,
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
