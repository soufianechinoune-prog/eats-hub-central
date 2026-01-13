import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OffersCampaign } from "./useMarketingCampaigns";
import { calculateSimilarity, normalizeName } from "@/lib/fuzzyMatch";

// Default constants for calculations
const DEFAULT_COMMISSION_RATE = 0.27; // 27%
const DEFAULT_FOOD_COST_RATE = 0.30; // 30% if not available

export interface OfferProfitability {
  id: string;
  // Base offer data
  title: string;
  product: string;
  offer_type: string;
  restaurant_names: string[];
  start_date?: string;
  end_date?: string;
  // Sales metrics
  generated_sales: number;
  orders: number;
  new_customers: number;
  uber_funding_percent: number;
  // Calculated profitability
  estimated_cost: number;
  commission: number;
  uber_cofunding: number;
  net_margin: number;
  roi: number;
  avg_basket: number;
  cost_per_acquisition: number;
  // Profitability status
  is_profitable: boolean;
  profitability_level: "excellent" | "good" | "neutral" | "poor" | "negative";
}

export interface ProfitabilityStats {
  totalCost: number;
  totalCommission: number;
  totalCofunding: number;
  totalNetMargin: number;
  avgRoi: number;
  avgCostPerAcquisition: number;
  profitableCount: number;
  unprofitableCount: number;
}

// Calculate the offer cost based on offer type
const calculateOfferCost = (
  offer: OffersCampaign,
  matchedFoodCost: number | null,
  matchedPrice: number | null
): number => {
  const offerType = (offer.offer_type || "").toLowerCase();
  const orders = offer.orders || 0;
  
  // Use matched food cost or estimate at 30% of sales per order
  const avgOrderValue = orders > 0 ? offer.generated_sales / orders : 0;
  const foodCostPerOrder = matchedFoodCost ?? (avgOrderValue * DEFAULT_FOOD_COST_RATE);
  
  // BOGO: cost is the food cost of the free item
  if (offerType.includes("bogo") || offerType.includes("1+1") || offerType.includes("achetez-en 1")) {
    return foodCostPerOrder * orders;
  }
  
  // Percentage discount: cost is the discount amount
  if (offerType.includes("%") || offerType.includes("réduction")) {
    // Try to extract discount percentage from offer type
    const percentMatch = offerType.match(/(\d+)\s*%/);
    const discountPercent = percentMatch ? parseInt(percentMatch[1]) / 100 : 0.20; // Default 20%
    return avgOrderValue * discountPercent * orders;
  }
  
  // Fixed amount discount
  if (offerType.includes("€") || offerType.includes("remise")) {
    const euroMatch = offerType.match(/(\d+(?:,\d+)?)\s*€/);
    const discountAmount = euroMatch ? parseFloat(euroMatch[1].replace(",", ".")) : 2;
    return discountAmount * orders;
  }
  
  // Free delivery or other - minimal cost
  if (offerType.includes("livraison")) {
    return 0; // Free delivery cost is borne by platform
  }
  
  // Default: estimate 15% of sales as discount cost
  return offer.generated_sales * 0.15;
};

// Match product name to menu items
const findBestMatch = (
  productName: string,
  menuItems: { id: string; name: string; food_cost: number | null; price_uber: number | null }[]
): { food_cost: number | null; price: number | null } | null => {
  if (!productName || menuItems.length === 0) return null;
  
  let bestMatch: typeof menuItems[0] | null = null;
  let bestSimilarity = 0;
  
  for (const item of menuItems) {
    const similarity = calculateSimilarity(productName, item.name);
    if (similarity > bestSimilarity && similarity >= 60) {
      bestSimilarity = similarity;
      bestMatch = item;
    }
  }
  
  return bestMatch ? { food_cost: bestMatch.food_cost, price: bestMatch.price_uber } : null;
};

// Calculate profitability level
const getProfitabilityLevel = (roi: number): OfferProfitability["profitability_level"] => {
  if (roi >= 100) return "excellent";
  if (roi >= 50) return "good";
  if (roi >= 0) return "neutral";
  if (roi >= -25) return "poor";
  return "negative";
};

export const useOfferProfitability = (offers: OffersCampaign[]) => {
  // Fetch menu items for food cost matching
  const { data: menuItems = [] } = useQuery({
    queryKey: ["menu-items-for-profitability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, food_cost, price_uber");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Calculate profitability for each offer
  const profitableOffers = useMemo<OfferProfitability[]>(() => {
    return offers.map(offer => {
      const product = offer.items_affected || offer.title || "";
      
      // Try to match product with menu items
      const match = findBestMatch(product, menuItems);
      
      // Calculate metrics
      const estimatedCost = calculateOfferCost(offer, match?.food_cost ?? null, match?.price ?? null);
      const commission = offer.generated_sales * DEFAULT_COMMISSION_RATE;
      const uberCofunding = offer.generated_sales * ((offer.uber_funding_percent || 0) / 100);
      
      // Net margin = Sales - Commission - Offer Cost + Uber Co-funding
      const netMargin = offer.generated_sales - commission - estimatedCost + uberCofunding;
      
      // ROI = (Net Margin / Offer Cost) × 100
      const roi = estimatedCost > 0 ? (netMargin / estimatedCost) * 100 : 0;
      
      // Average basket
      const avgBasket = offer.orders > 0 ? offer.generated_sales / offer.orders : 0;
      
      // Cost per acquisition
      const costPerAcquisition = offer.new_customers > 0 
        ? (estimatedCost - uberCofunding) / offer.new_customers 
        : 0;
      
      return {
        id: offer.id,
        title: offer.title || "",
        product,
        offer_type: offer.offer_type || "Autre",
        restaurant_names: offer.restaurant_names || [],
        start_date: offer.start_date,
        end_date: offer.end_date,
        generated_sales: offer.generated_sales,
        orders: offer.orders,
        new_customers: offer.new_customers,
        uber_funding_percent: offer.uber_funding_percent,
        estimated_cost: estimatedCost,
        commission,
        uber_cofunding: uberCofunding,
        net_margin: netMargin,
        roi,
        avg_basket: avgBasket,
        cost_per_acquisition: costPerAcquisition,
        is_profitable: netMargin > 0,
        profitability_level: getProfitabilityLevel(roi),
      };
    });
  }, [offers, menuItems]);

  // Calculate aggregate stats
  const stats = useMemo<ProfitabilityStats>(() => {
    const totalCost = profitableOffers.reduce((sum, o) => sum + o.estimated_cost, 0);
    const totalCommission = profitableOffers.reduce((sum, o) => sum + o.commission, 0);
    const totalCofunding = profitableOffers.reduce((sum, o) => sum + o.uber_cofunding, 0);
    const totalNetMargin = profitableOffers.reduce((sum, o) => sum + o.net_margin, 0);
    const totalNewCustomers = profitableOffers.reduce((sum, o) => sum + o.new_customers, 0);
    
    const offersWithRoi = profitableOffers.filter(o => o.estimated_cost > 0);
    const avgRoi = offersWithRoi.length > 0 
      ? offersWithRoi.reduce((sum, o) => sum + o.roi, 0) / offersWithRoi.length 
      : 0;
    
    const avgCostPerAcquisition = totalNewCustomers > 0 
      ? (totalCost - totalCofunding) / totalNewCustomers 
      : 0;
    
    const profitableCount = profitableOffers.filter(o => o.is_profitable).length;
    const unprofitableCount = profitableOffers.filter(o => !o.is_profitable).length;
    
    return {
      totalCost,
      totalCommission,
      totalCofunding,
      totalNetMargin,
      avgRoi,
      avgCostPerAcquisition,
      profitableCount,
      unprofitableCount,
    };
  }, [profitableOffers]);

  // Rankings
  const topProfitable = useMemo(() => {
    return [...profitableOffers]
      .filter(o => o.is_profitable)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);
  }, [profitableOffers]);

  const bottomProfitable = useMemo(() => {
    return [...profitableOffers]
      .filter(o => o.estimated_cost > 0)
      .sort((a, b) => a.roi - b.roi)
      .slice(0, 5);
  }, [profitableOffers]);

  // Profitability by type
  const profitabilityByType = useMemo(() => {
    const byType: Record<string, {
      count: number;
      totalSales: number;
      totalCost: number;
      totalMargin: number;
      avgRoi: number;
    }> = {};

    profitableOffers.forEach(offer => {
      const type = offer.offer_type;
      if (!byType[type]) {
        byType[type] = { count: 0, totalSales: 0, totalCost: 0, totalMargin: 0, avgRoi: 0 };
      }
      byType[type].count++;
      byType[type].totalSales += offer.generated_sales;
      byType[type].totalCost += offer.estimated_cost;
      byType[type].totalMargin += offer.net_margin;
    });

    // Calculate average ROI per type
    Object.keys(byType).forEach(type => {
      const data = byType[type];
      data.avgRoi = data.totalCost > 0 ? (data.totalMargin / data.totalCost) * 100 : 0;
    });

    return Object.entries(byType)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.avgRoi - a.avgRoi);
  }, [profitableOffers]);

  return {
    offers: profitableOffers,
    stats,
    topProfitable,
    bottomProfitable,
    profitabilityByType,
    isLoading: false,
  };
};
