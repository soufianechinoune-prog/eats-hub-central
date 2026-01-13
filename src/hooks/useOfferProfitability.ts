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
  restaurant_ids?: string[];
  start_date?: string;
  end_date?: string;
  // Sales metrics
  generated_sales: number;
  orders: number;
  new_customers: number;
  uber_funding_percent: number;
  // Estimated profitability (fallback)
  estimated_cost: number;
  commission: number;
  uber_cofunding: number;
  net_margin: number;
  roi: number;
  avg_basket: number;
  cost_per_acquisition: number;
  // Real financial data from orders
  has_real_data: boolean;
  real_sales?: number;
  real_commission?: number;
  real_promos?: number;
  real_refunds?: number;
  real_payout?: number;
  real_meal_voucher?: number;
  real_total_payout?: number;
  real_profitability?: number;
  real_orders_count?: number;
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
  // Real financial totals
  hasRealData: boolean;
  realTotalSales: number;
  realTotalCommission: number;
  realTotalPromos: number;
  realTotalRefunds: number;
  realTotalPayout: number;
  realTotalMealVoucher: number;
  realTotalProfitability: number;
}

interface OrderFinancials {
  restaurant_id: string;
  order_date: string;
  sales_incl_vat: number;
  uber_fee_after_promo_incl_vat: number;
  item_promo_incl_vat: number;
  refund_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
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
  if (offerType.includes("bogo") || offerType.includes("1+1") || offerType.includes("achetez-en 1") || offerType.includes("acheté = un offert")) {
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

// Calculate profitability level based on percentage
const getProfitabilityLevel = (profitPercent: number): OfferProfitability["profitability_level"] => {
  if (profitPercent >= 60) return "excellent";
  if (profitPercent >= 50) return "good";
  if (profitPercent >= 40) return "neutral";
  if (profitPercent >= 30) return "poor";
  return "negative";
};

// Calculate profitability level based on ROI
const getProfitabilityLevelFromRoi = (roi: number): OfferProfitability["profitability_level"] => {
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

  // Extract all restaurant IDs and date ranges from offers
  const offerParams = useMemo(() => {
    return offers
      .filter(o => o.restaurant_ids?.length && (o.start_date || o.end_date))
      .map(o => ({
        id: o.id,
        restaurant_ids: o.restaurant_ids || [],
        start_date: o.start_date,
        end_date: o.end_date,
      }));
  }, [offers]);

  // Fetch real order financials for all offers with dates and restaurants
  const { data: ordersFinancials = [] } = useQuery({
    queryKey: ["offer-orders-financials", offerParams],
    queryFn: async () => {
      if (offerParams.length === 0) return [];

      // Get all unique restaurant IDs and date range
      const allRestaurantIds = new Set<string>();
      let minDate: string | null = null;
      let maxDate: string | null = null;

      offerParams.forEach(p => {
        p.restaurant_ids.forEach(id => allRestaurantIds.add(id));
        if (p.start_date && (!minDate || p.start_date < minDate)) minDate = p.start_date;
        if (p.end_date && (!maxDate || p.end_date > maxDate)) maxDate = p.end_date;
      });

      if (allRestaurantIds.size === 0 || !minDate) return [];

      // Fetch all orders in the date range for these restaurants
      let query = supabase
        .from("orders")
        .select(`
          restaurant_id,
          order_datetime,
          sales_incl_vat,
          uber_fee_after_promo_incl_vat,
          item_promo_incl_vat,
          refund_incl_vat,
          net_payout,
          meal_voucher_amount
        `)
        .in("restaurant_id", Array.from(allRestaurantIds))
        .gte("order_datetime", minDate);

      if (maxDate) {
        // Add one day to max date to include end_date
        const maxDatePlusOne = new Date(maxDate);
        maxDatePlusOne.setDate(maxDatePlusOne.getDate() + 1);
        query = query.lt("order_datetime", maxDatePlusOne.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(order => ({
        restaurant_id: order.restaurant_id,
        order_date: order.order_datetime?.split(' ')[0]?.split('T')[0] || '',
        sales_incl_vat: order.sales_incl_vat || 0,
        uber_fee_after_promo_incl_vat: order.uber_fee_after_promo_incl_vat || 0,
        item_promo_incl_vat: order.item_promo_incl_vat || 0,
        refund_incl_vat: order.refund_incl_vat || 0,
        net_payout: order.net_payout || 0,
        meal_voucher_amount: order.meal_voucher_amount || 0,
      })) as OrderFinancials[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: offerParams.length > 0,
  });

  // Calculate profitability for each offer
  const profitableOffers = useMemo<OfferProfitability[]>(() => {
    return offers.map(offer => {
      const product = offer.items_affected || offer.title || "";
      
      // Try to match product with menu items
      const match = findBestMatch(product, menuItems);
      
      // Calculate estimated metrics (fallback)
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

      // Calculate real financial data if available
      let hasRealData = false;
      let realSales = 0;
      let realCommission = 0;
      let realPromos = 0;
      let realRefunds = 0;
      let realPayout = 0;
      let realMealVoucher = 0;
      let realOrdersCount = 0;

      if (offer.restaurant_ids?.length && (offer.start_date || offer.end_date)) {
        const startDate = offer.start_date || '';
        const endDate = offer.end_date || new Date().toISOString().split('T')[0];
        
        // Filter orders for this offer's restaurants and date range
        const relevantOrders = ordersFinancials.filter(order => {
          const inRestaurant = offer.restaurant_ids?.includes(order.restaurant_id);
          const orderDate = order.order_date.substring(0, 10);
          const inDateRange = orderDate >= startDate && orderDate <= endDate;
          return inRestaurant && inDateRange;
        });

        if (relevantOrders.length > 0) {
          hasRealData = true;
          realOrdersCount = relevantOrders.length;
          realSales = relevantOrders.reduce((sum, o) => sum + o.sales_incl_vat, 0);
          realCommission = relevantOrders.reduce((sum, o) => sum + o.uber_fee_after_promo_incl_vat, 0);
          realPromos = relevantOrders.reduce((sum, o) => sum + o.item_promo_incl_vat, 0);
          realRefunds = relevantOrders.reduce((sum, o) => sum + o.refund_incl_vat, 0);
          realPayout = relevantOrders.reduce((sum, o) => sum + o.net_payout, 0);
          realMealVoucher = relevantOrders.reduce((sum, o) => sum + o.meal_voucher_amount, 0);
        }
      }

      const realTotalPayout = realPayout + realMealVoucher;
      const realProfitability = realSales > 0 ? (realTotalPayout / realSales) * 100 : 0;

      // Use real profitability level if we have real data, otherwise use ROI-based
      const profitabilityLevel = hasRealData 
        ? getProfitabilityLevel(realProfitability)
        : getProfitabilityLevelFromRoi(roi);

      const isProfitable = hasRealData 
        ? realProfitability >= 50
        : netMargin > 0;

      return {
        id: offer.id,
        title: offer.title || "",
        product,
        offer_type: offer.offer_type || "Autre",
        restaurant_names: offer.restaurant_names || [],
        restaurant_ids: offer.restaurant_ids,
        start_date: offer.start_date,
        end_date: offer.end_date,
        generated_sales: offer.generated_sales,
        orders: offer.orders,
        new_customers: offer.new_customers,
        uber_funding_percent: offer.uber_funding_percent,
        // Estimated values
        estimated_cost: estimatedCost,
        commission,
        uber_cofunding: uberCofunding,
        net_margin: netMargin,
        roi,
        avg_basket: avgBasket,
        cost_per_acquisition: costPerAcquisition,
        // Real values
        has_real_data: hasRealData,
        real_sales: realSales,
        real_commission: realCommission,
        real_promos: realPromos,
        real_refunds: realRefunds,
        real_payout: realPayout,
        real_meal_voucher: realMealVoucher,
        real_total_payout: realTotalPayout,
        real_profitability: realProfitability,
        real_orders_count: realOrdersCount,
        // Status
        is_profitable: isProfitable,
        profitability_level: profitabilityLevel,
      };
    });
  }, [offers, menuItems, ordersFinancials]);

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

    // Real financial totals
    const offersWithRealData = profitableOffers.filter(o => o.has_real_data);
    const hasRealData = offersWithRealData.length > 0;
    const realTotalSales = offersWithRealData.reduce((sum, o) => sum + (o.real_sales || 0), 0);
    const realTotalCommission = offersWithRealData.reduce((sum, o) => sum + (o.real_commission || 0), 0);
    const realTotalPromos = offersWithRealData.reduce((sum, o) => sum + (o.real_promos || 0), 0);
    const realTotalRefunds = offersWithRealData.reduce((sum, o) => sum + (o.real_refunds || 0), 0);
    const realTotalPayout = offersWithRealData.reduce((sum, o) => sum + (o.real_payout || 0), 0);
    const realTotalMealVoucher = offersWithRealData.reduce((sum, o) => sum + (o.real_meal_voucher || 0), 0);
    const realTotalProfitability = realTotalSales > 0 
      ? ((realTotalPayout + realTotalMealVoucher) / realTotalSales) * 100 
      : 0;
    
    return {
      totalCost,
      totalCommission,
      totalCofunding,
      totalNetMargin,
      avgRoi,
      avgCostPerAcquisition,
      profitableCount,
      unprofitableCount,
      // Real data
      hasRealData,
      realTotalSales,
      realTotalCommission,
      realTotalPromos,
      realTotalRefunds,
      realTotalPayout,
      realTotalMealVoucher,
      realTotalProfitability,
    };
  }, [profitableOffers]);

  // Rankings
  const topProfitable = useMemo(() => {
    return [...profitableOffers]
      .filter(o => o.is_profitable)
      .sort((a, b) => {
        // Prefer real profitability if available
        if (a.has_real_data && b.has_real_data) {
          return (b.real_profitability || 0) - (a.real_profitability || 0);
        }
        return b.roi - a.roi;
      })
      .slice(0, 5);
  }, [profitableOffers]);

  const bottomProfitable = useMemo(() => {
    return [...profitableOffers]
      .filter(o => o.has_real_data || o.estimated_cost > 0)
      .sort((a, b) => {
        // Prefer real profitability if available
        if (a.has_real_data && b.has_real_data) {
          return (a.real_profitability || 0) - (b.real_profitability || 0);
        }
        return a.roi - b.roi;
      })
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
      // Real data
      realDataCount: number;
      realTotalSales: number;
      realTotalCommission: number;
      realTotalPayout: number;
      realAvgProfitability: number;
    }> = {};

    profitableOffers.forEach(offer => {
      const type = offer.offer_type;
      if (!byType[type]) {
        byType[type] = { 
          count: 0, 
          totalSales: 0, 
          totalCost: 0, 
          totalMargin: 0, 
          avgRoi: 0,
          realDataCount: 0,
          realTotalSales: 0,
          realTotalCommission: 0,
          realTotalPayout: 0,
          realAvgProfitability: 0,
        };
      }
      byType[type].count++;
      byType[type].totalSales += offer.generated_sales;
      byType[type].totalCost += offer.estimated_cost;
      byType[type].totalMargin += offer.net_margin;
      
      if (offer.has_real_data) {
        byType[type].realDataCount++;
        byType[type].realTotalSales += offer.real_sales || 0;
        byType[type].realTotalCommission += offer.real_commission || 0;
        byType[type].realTotalPayout += (offer.real_total_payout || 0);
      }
    });

    // Calculate average ROI and profitability per type
    Object.keys(byType).forEach(type => {
      const data = byType[type];
      data.avgRoi = data.totalCost > 0 ? (data.totalMargin / data.totalCost) * 100 : 0;
      data.realAvgProfitability = data.realTotalSales > 0 
        ? (data.realTotalPayout / data.realTotalSales) * 100 
        : 0;
    });

    return Object.entries(byType)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => {
        // Sort by real profitability if we have data, otherwise by ROI
        if (a.realDataCount > 0 && b.realDataCount > 0) {
          return b.realAvgProfitability - a.realAvgProfitability;
        }
        return b.avgRoi - a.avgRoi;
      });
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
