import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OfferProfitability } from "@/hooks/useOfferProfitability";
import { normalizeName } from "@/lib/fuzzyMatch";

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
  sales_incl_vat: number;
  commission: number;
  promo_applied: number;
  refund: number;
  net_payout: number;
  items: MatchedOrderItem[];
  has_offer_product: boolean;
  has_promo: boolean;
}

export interface OfferMatchedData {
  matched_orders: MatchedOrder[];
  matched_orders_count: number;
  total_orders_in_period: number;
  matched_sales: number;
  matched_commission: number;
  matched_promos: number;
  matched_refunds: number;
  matched_payout: number;
  match_type: "product" | "promo" | "period" | "none";
  declared_vs_real_diff: number;
  declared_vs_real_percent: number;
}

// Simplified product matching - much faster than full fuzzy match
const isOfferProduct = (itemTitle: string, offerProducts: string[]): boolean => {
  const normalizedItem = normalizeName(itemTitle);
  
  for (const product of offerProducts) {
    const normalizedProduct = normalizeName(product);
    if (!normalizedProduct) continue;
    
    // Simple contains check - fast and effective
    if (normalizedItem.includes(normalizedProduct) || normalizedProduct.includes(normalizedItem)) {
      return true;
    }
    
    // Check if main words match (first 2 significant words)
    const itemWords = normalizedItem.split(" ").filter(w => w.length > 2).slice(0, 3);
    const productWords = normalizedProduct.split(" ").filter(w => w.length > 2).slice(0, 3);
    
    if (productWords.length > 0 && itemWords.length > 0) {
      const matchCount = productWords.filter(pw => itemWords.some(iw => iw.includes(pw) || pw.includes(iw))).length;
      if (matchCount >= Math.min(2, productWords.length)) {
        return true;
      }
    }
  }
  return false;
};

const parseOfferProducts = (offer: OfferProfitability): string[] => {
  const products: string[] = [];
  
  if (offer.product) {
    products.push(...offer.product.split(/[,;]/).map(s => s.trim()).filter(Boolean));
  }
  if (offer.title && !products.length) {
    const titleParts = offer.title.split(/[-–]/).map(s => s.trim()).filter(Boolean);
    if (titleParts.length > 0) {
      products.push(titleParts[0]);
    }
  }
  
  return products.filter(p => p.length > 2);
};

interface OrderWithItems {
  id: string;
  uber_order_id: string;
  order_datetime: string;
  sales_incl_vat: number | null;
  uber_fee_after_promo_incl_vat: number | null;
  item_promo_incl_vat: number | null;
  refund_incl_vat: number | null;
  net_payout: number | null;
  order_items: {
    item_id: string;
    item_title: string;
    quantity: number;
    sales_incl_vat: number | null;
    item_promo_incl_vat: number | null;
  }[];
}

export const useOfferMatchedOrders = (offer: OfferProfitability | null) => {
  return useQuery({
    queryKey: ["offer-matched-orders", offer?.id],
    queryFn: async (): Promise<OfferMatchedData> => {
      if (!offer?.restaurant_ids?.length || !offer.start_date || !offer.end_date) {
        return {
          matched_orders: [],
          matched_orders_count: 0,
          total_orders_in_period: 0,
          matched_sales: 0,
          matched_commission: 0,
          matched_promos: 0,
          matched_refunds: 0,
          matched_payout: 0,
          match_type: "none",
          declared_vs_real_diff: 0,
          declared_vs_real_percent: 0,
        };
      }

      const startDate = new Date(offer.start_date);
      const endDate = new Date(offer.end_date);
      endDate.setDate(endDate.getDate() + 1);

      const offerProducts = parseOfferProducts(offer);

      // Single query with nested relation - much faster!
      const { data: ordersWithItems, error } = await supabase
        .from("orders")
        .select(`
          id,
          uber_order_id,
          order_datetime,
          sales_incl_vat,
          uber_fee_after_promo_incl_vat,
          item_promo_incl_vat,
          refund_incl_vat,
          net_payout,
          order_items (
            item_id,
            item_title,
            quantity,
            sales_incl_vat,
            item_promo_incl_vat
          )
        `)
        .in("restaurant_id", offer.restaurant_ids)
        .gte("order_datetime", startDate.toISOString())
        .lt("order_datetime", endDate.toISOString())
        .order("order_datetime", { ascending: false })
        .limit(150) as { data: OrderWithItems[] | null; error: unknown };

      if (error || !ordersWithItems) {
        console.error("Error fetching orders with items:", error);
        return {
          matched_orders: [],
          matched_orders_count: 0,
          total_orders_in_period: 0,
          matched_sales: 0,
          matched_commission: 0,
          matched_promos: 0,
          matched_refunds: 0,
          matched_payout: 0,
          match_type: "none",
          declared_vs_real_diff: 0,
          declared_vs_real_percent: 0,
        };
      }

      // Get total count for the period (separate lightweight query)
      const { count: totalCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("restaurant_id", offer.restaurant_ids)
        .gte("order_datetime", startDate.toISOString())
        .lt("order_datetime", endDate.toISOString());

      // Process orders and match products
      const matchedOrders: MatchedOrder[] = [];
      let totalMatchedSales = 0;
      let totalMatchedCommission = 0;
      let totalMatchedPromos = 0;
      let totalMatchedRefunds = 0;
      let totalMatchedPayout = 0;

      for (const order of ordersWithItems) {
        const items: MatchedOrderItem[] = (order.order_items || []).map(item => ({
          item_id: item.item_id,
          item_title: item.item_title,
          quantity: item.quantity,
          sales_incl_vat: item.sales_incl_vat || 0,
          item_promo_incl_vat: item.item_promo_incl_vat || 0,
          is_offer_product: offerProducts.length > 0 ? isOfferProduct(item.item_title, offerProducts) : false,
        }));

        const hasOfferProduct = items.some(i => i.is_offer_product);
        const hasPromo = (order.item_promo_incl_vat || 0) < 0;

        // Only include if has offer product OR has promo in period
        if (hasOfferProduct || hasPromo || offerProducts.length === 0) {
          const matchedOrder: MatchedOrder = {
            order_id: order.id,
            uber_order_id: order.uber_order_id,
            order_datetime: order.order_datetime,
            sales_incl_vat: order.sales_incl_vat || 0,
            commission: Math.abs(order.uber_fee_after_promo_incl_vat || 0),
            promo_applied: order.item_promo_incl_vat || 0,
            refund: order.refund_incl_vat || 0,
            net_payout: order.net_payout || 0,
            items,
            has_offer_product: hasOfferProduct,
            has_promo: hasPromo,
          };

          matchedOrders.push(matchedOrder);
          totalMatchedSales += matchedOrder.sales_incl_vat;
          totalMatchedCommission += matchedOrder.commission;
          totalMatchedPromos += matchedOrder.promo_applied;
          totalMatchedRefunds += matchedOrder.refund;
          totalMatchedPayout += matchedOrder.net_payout;
        }
      }

      // Determine match type
      const productMatchedOrders = matchedOrders.filter(o => o.has_offer_product);
      const promoOrders = matchedOrders.filter(o => o.has_promo);

      let matchType: "product" | "promo" | "period" | "none" = "period";
      if (productMatchedOrders.length > 0) {
        matchType = "product";
      } else if (promoOrders.length > 0) {
        matchType = "promo";
      }

      // Compare with declared sales
      const declaredSales = offer.generated_sales || 0;
      const diff = declaredSales - totalMatchedSales;
      const percent = declaredSales > 0 ? ((totalMatchedSales - declaredSales) / declaredSales) * 100 : 0;

      return {
        matched_orders: matchedOrders.slice(0, 100), // Limit display to 100
        matched_orders_count: matchedOrders.length,
        total_orders_in_period: totalCount || ordersWithItems.length,
        matched_sales: totalMatchedSales,
        matched_commission: totalMatchedCommission,
        matched_promos: totalMatchedPromos,
        matched_refunds: totalMatchedRefunds,
        matched_payout: totalMatchedPayout,
        match_type: matchType,
        declared_vs_real_diff: diff,
        declared_vs_real_percent: percent,
      };
    },
    enabled: !!offer,
    staleTime: 5 * 60 * 1000,
  });
};
