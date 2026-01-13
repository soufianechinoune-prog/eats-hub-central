import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OfferProfitability } from "./useOfferProfitability";
import { calculateSimilarity, containsSameKeywords, normalizeName } from "@/lib/fuzzyMatch";

export interface MatchedOrderItem {
  item_id: string;
  item_title: string;
  quantity: number;
  sales_incl_vat: number;
  item_promo_incl_vat: number;
  is_offer_product: boolean;
}

export interface MatchedOrder {
  order_id: string;
  uber_order_id: string;
  order_datetime: string;
  order_total: number;
  commission: number;
  promo_applied: number;
  refunds: number;
  net_payout: number;
  items: MatchedOrderItem[];
  has_offer_product: boolean;
}

export interface OfferMatchedData {
  matched_orders: MatchedOrder[];
  matched_orders_count: number;
  matched_sales: number;
  matched_commission: number;
  matched_promos: number;
  matched_refunds: number;
  matched_payout: number;
  has_matched_data: boolean;
  match_type: "product" | "promo" | "period" | "none";
  declared_vs_real_diff: number;
  declared_vs_real_percent: number;
}

// Check if an item title matches the offer products
const isOfferProduct = (itemTitle: string, offerProducts: string[]): boolean => {
  const normalizedItem = normalizeName(itemTitle);
  
  for (const product of offerProducts) {
    const normalizedProduct = normalizeName(product);
    
    // Exact match
    if (normalizedItem === normalizedProduct) return true;
    
    // Contains match
    if (normalizedItem.includes(normalizedProduct) || normalizedProduct.includes(normalizedItem)) return true;
    
    // Fuzzy match
    const similarity = calculateSimilarity(itemTitle, product);
    if (similarity >= 70) return true;
    
    // Keyword match
    if (containsSameKeywords(itemTitle, product)) return true;
  }
  
  return false;
};

// Parse offer products from different possible fields
const parseOfferProducts = (offer: OfferProfitability): string[] => {
  const products: string[] = [];
  
  // From items_affected or product field
  const source = offer.product || offer.title || "";
  
  // Split by comma or other delimiters
  const parts = source.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  products.push(...parts);
  
  // Also try to extract from title if different
  if (offer.title && offer.title !== offer.product) {
    const titleParts = offer.title.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    products.push(...titleParts);
  }
  
  return [...new Set(products)]; // Remove duplicates
};

export const useOfferMatchedOrders = (offer: OfferProfitability | null) => {
  const query = useQuery({
    queryKey: ["offer-matched-orders", offer?.id],
    queryFn: async (): Promise<OfferMatchedData> => {
      if (!offer || !offer.restaurant_ids?.length || !offer.start_date) {
        return {
          matched_orders: [],
          matched_orders_count: 0,
          matched_sales: 0,
          matched_commission: 0,
          matched_promos: 0,
          matched_refunds: 0,
          matched_payout: 0,
          has_matched_data: false,
          match_type: "none",
          declared_vs_real_diff: 0,
          declared_vs_real_percent: 0,
        };
      }

      const startDate = offer.start_date;
      const endDate = offer.end_date || new Date().toISOString().split('T')[0];
      
      // Add one day to end date to include it
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

      // Fetch orders with their items
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          uber_order_id,
          order_datetime,
          sales_incl_vat,
          uber_fee_after_promo_incl_vat,
          item_promo_incl_vat,
          refund_incl_vat,
          net_payout
        `)
        .in("restaurant_id", offer.restaurant_ids)
        .gte("order_datetime", startDate)
        .lt("order_datetime", endDatePlusOne.toISOString().split('T')[0])
        .order("order_datetime", { ascending: false });

      if (ordersError) throw ordersError;
      if (!ordersData || ordersData.length === 0) {
        return {
          matched_orders: [],
          matched_orders_count: 0,
          matched_sales: 0,
          matched_commission: 0,
          matched_promos: 0,
          matched_refunds: 0,
          matched_payout: 0,
          has_matched_data: false,
          match_type: "none",
          declared_vs_real_diff: 0,
          declared_vs_real_percent: 0,
        };
      }

      // Fetch order items for these orders
      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          order_id,
          item_id,
          item_title,
          quantity,
          sales_incl_vat,
          item_promo_incl_vat
        `)
        .in("order_id", orderIds);

      if (itemsError) throw itemsError;

      // Group items by order
      const itemsByOrder = new Map<string, MatchedOrderItem[]>();
      const offerProducts = parseOfferProducts(offer);
      
      (itemsData || []).forEach(item => {
        const orderId = item.order_id;
        if (!itemsByOrder.has(orderId)) {
          itemsByOrder.set(orderId, []);
        }
        
        const isMatch = isOfferProduct(item.item_title || "", offerProducts);
        
        itemsByOrder.get(orderId)!.push({
          item_id: item.item_id || "",
          item_title: item.item_title || "",
          quantity: item.quantity || 0,
          sales_incl_vat: item.sales_incl_vat || 0,
          item_promo_incl_vat: item.item_promo_incl_vat || 0,
          is_offer_product: isMatch,
        });
      });

      // Build matched orders
      const matchedOrders: MatchedOrder[] = [];
      let productMatchCount = 0;
      let promoMatchCount = 0;

      ordersData.forEach(order => {
        const items = itemsByOrder.get(order.id) || [];
        const hasOfferProduct = items.some(i => i.is_offer_product);
        const hasPromo = (order.item_promo_incl_vat || 0) < 0;
        
        if (hasOfferProduct) productMatchCount++;
        if (hasPromo) promoMatchCount++;

        matchedOrders.push({
          order_id: order.id,
          uber_order_id: order.uber_order_id || "",
          order_datetime: order.order_datetime || "",
          order_total: order.sales_incl_vat || 0,
          commission: order.uber_fee_after_promo_incl_vat || 0,
          promo_applied: order.item_promo_incl_vat || 0,
          refunds: order.refund_incl_vat || 0,
          net_payout: order.net_payout || 0,
          items,
          has_offer_product: hasOfferProduct,
        });
      });

      // Determine match type
      let matchType: OfferMatchedData["match_type"] = "period";
      if (productMatchCount > 0) {
        matchType = "product";
      } else if (promoMatchCount > 0) {
        matchType = "promo";
      }

      // Filter to orders that match by product if we have matches
      const filteredOrders = matchType === "product" 
        ? matchedOrders.filter(o => o.has_offer_product)
        : matchType === "promo"
        ? matchedOrders.filter(o => o.promo_applied < 0)
        : matchedOrders;

      // Calculate totals
      const totals = filteredOrders.reduce((acc, order) => ({
        sales: acc.sales + order.order_total,
        commission: acc.commission + order.commission,
        promos: acc.promos + Math.abs(order.promo_applied),
        refunds: acc.refunds + Math.abs(order.refunds),
        payout: acc.payout + order.net_payout,
      }), { sales: 0, commission: 0, promos: 0, refunds: 0, payout: 0 });

      // Compare with declared sales
      const declaredSales = offer.generated_sales || 0;
      const diff = declaredSales - totals.sales;
      const diffPercent = declaredSales > 0 ? (diff / declaredSales) * 100 : 0;

      return {
        matched_orders: filteredOrders.slice(0, 100), // Limit to 100 orders for performance
        matched_orders_count: filteredOrders.length,
        matched_sales: totals.sales,
        matched_commission: totals.commission,
        matched_promos: totals.promos,
        matched_refunds: totals.refunds,
        matched_payout: totals.payout,
        has_matched_data: filteredOrders.length > 0,
        match_type: matchType,
        declared_vs_real_diff: diff,
        declared_vs_real_percent: diffPercent,
      };
    },
    enabled: !!offer,
    staleTime: 5 * 60 * 1000,
  });

  return query;
};
