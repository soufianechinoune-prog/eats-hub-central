import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantPrice {
  restaurantId: string;
  restaurantName: string;
  basePrice: number;
  averagePrice: number;
  orderCount: number;
  lastSeen: string;
  minPrice: number;
  maxPrice: number;
}

export interface ProductPriceAnalysis {
  itemTitle: string;
  prices: RestaurantPrice[];
  hasDiscrepancy: boolean;
  maxDifference: number;
  maxDifferencePercent: number;
}

interface Restaurant {
  id: string;
  name: string;
}

export function useRestaurantPrices(restaurantIds: string[]) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductPriceAnalysis[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantIds.length === 0) {
      setProducts([]);
      setRestaurants([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch restaurant names
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", restaurantIds);

        if (restaurantError) throw restaurantError;
        setRestaurants(restaurantData || []);

        // Fetch order items without promotions
        // We filter for items where promo is 0 or null
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select(`
            item_title,
            sales_incl_vat,
            quantity,
            restaurant_id,
            created_at
          `)
          .in("restaurant_id", restaurantIds)
          .or("item_promo_incl_vat.is.null,item_promo_incl_vat.eq.0")
          .eq("quantity", 1)
          .not("sales_incl_vat", "is", null)
          .gt("sales_incl_vat", 0);

        if (itemsError) throw itemsError;

        // Group by item_title and restaurant_id
        const priceMap: Record<string, Record<string, {
          prices: number[];
          lastSeen: string;
        }>> = {};

        for (const item of itemsData || []) {
          if (!item.item_title || !item.restaurant_id || !item.sales_incl_vat) continue;

          const normalizedTitle = item.item_title.trim();
          
          if (!priceMap[normalizedTitle]) {
            priceMap[normalizedTitle] = {};
          }
          
          if (!priceMap[normalizedTitle][item.restaurant_id]) {
            priceMap[normalizedTitle][item.restaurant_id] = {
              prices: [],
              lastSeen: item.created_at,
            };
          }
          
          priceMap[normalizedTitle][item.restaurant_id].prices.push(Number(item.sales_incl_vat));
          
          // Update lastSeen if this is more recent
          if (item.created_at > priceMap[normalizedTitle][item.restaurant_id].lastSeen) {
            priceMap[normalizedTitle][item.restaurant_id].lastSeen = item.created_at;
          }
        }

        // Build product analysis
        const restaurantMap = new Map((restaurantData || []).map(r => [r.id, r.name]));
        const productAnalysis: ProductPriceAnalysis[] = [];

        for (const [itemTitle, restaurantPrices] of Object.entries(priceMap)) {
          const prices: RestaurantPrice[] = [];
          
          for (const [restaurantId, data] of Object.entries(restaurantPrices)) {
            const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
            const minPrice = Math.min(...data.prices);
            const maxPrice = Math.max(...data.prices);
            
            prices.push({
              restaurantId,
              restaurantName: restaurantMap.get(restaurantId) || "Unknown",
              basePrice: Math.round(minPrice * 100) / 100,
              averagePrice: Math.round(avgPrice * 100) / 100,
              orderCount: data.prices.length,
              lastSeen: data.lastSeen,
              minPrice,
              maxPrice,
            });
          }

          // Calculate discrepancy based on base prices (min price = price without options)
          if (prices.length > 0) {
            const basePrices = prices.map(p => p.basePrice);
            const minBase = Math.min(...basePrices);
            const maxBase = Math.max(...basePrices);
            const maxDifference = Math.round((maxBase - minBase) * 100) / 100;
            const maxDifferencePercent = minBase > 0 
              ? Math.round(((maxBase - minBase) / minBase) * 100 * 10) / 10
              : 0;

            productAnalysis.push({
              itemTitle,
              prices,
              hasDiscrepancy: maxDifference > 0.01,
              maxDifference,
              maxDifferencePercent,
            });
          }
        }

        // Sort by discrepancy (highest first)
        productAnalysis.sort((a, b) => b.maxDifferencePercent - a.maxDifferencePercent);

        setProducts(productAnalysis);
      } catch (err: any) {
        console.error("Error fetching restaurant prices:", err);
        setError(err.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantIds.join(",")]);

  const stats = useMemo(() => {
    const total = products.length;
    const withDiscrepancy = products.filter(p => p.hasDiscrepancy).length;
    const avgDifference = products.length > 0
      ? products.reduce((sum, p) => sum + p.maxDifferencePercent, 0) / products.length
      : 0;
    
    return {
      totalProducts: total,
      productsWithDiscrepancy: withDiscrepancy,
      averageDifferencePercent: Math.round(avgDifference * 10) / 10,
    };
  }, [products]);

  return {
    loading,
    products,
    restaurants,
    stats,
    error,
  };
}
