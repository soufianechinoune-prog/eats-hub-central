import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format, startOfWeek, startOfMonth, endOfMonth, differenceInDays, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";

// Utility to get date key in Europe/Paris timezone (YYYY-MM-DD format)
const getParisDateKey = (dateStr: string): string => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

// Utility to get hour in Europe/Paris timezone (0-23)
const getParisHour = (dateStr: string): number => {
  const date = new Date(dateStr);
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(date);
  return parseInt(hourStr, 10);
};

// Check if a Paris date key is within the target range
const isDateInRange = (parisDateKey: string, startStr: string, endStr: string): boolean => {
  return parisDateKey >= startStr && parisDateKey <= endStr;
};
export type DrilldownGranularity = "daily" | "hourly" | "product" | "order";

interface DailyFinanceData {
  date: string;
  label: string;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_basket: number;
  // Additional financial fields
  uber_fee_incl_vat: number;
  promo_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
  total_payout: number;
}

interface HourlyFinanceData {
  hour: number;
  label: string;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_basket: number;
  // Additional financial fields
  uber_fee_incl_vat: number;
  promo_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
  total_payout: number;
}

interface ProductFinanceData {
  item_id: string;
  item_title: string;
  category: string | null;
  quantity: number;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_unit_price: number;
  refund_rate: number;
  // Additional financial field
  promo_incl_vat: number;
}

export interface OrderFinanceData {
  id: string;
  uber_order_id: string;
  order_datetime: string;
  sales_incl_vat: number;
  uber_fee_incl_vat: number;
  promo_incl_vat: number;
  refund_incl_vat: number;
  net_payout: number;
  meal_voucher_amount: number;
  total_payout: number;
  profitability: number;
}

export type OrderSortField = "order_datetime" | "sales_incl_vat" | "profitability" | "uber_fee" | "promo" | "refund" | "net_payout" | "meal_voucher" | "total_payout";
export type SortDirection = "asc" | "desc";

interface UseFinancesDrilldownParams {
  restaurantIds?: string[];
  startDate: Date;
  endDate: Date;
  granularity: DrilldownGranularity;
  enabled?: boolean;
  orderSearchQuery?: string;
  orderLimit?: number;
  orderSortField?: OrderSortField;
  orderSortDirection?: SortDirection;
}

export function useFinancesDrilldown({
  restaurantIds,
  startDate,
  endDate,
  granularity,
  enabled = true,
  orderSearchQuery = "",
  orderLimit = 50,
  orderSortField = "order_datetime",
  orderSortDirection = "desc",
}: UseFinancesDrilldownParams) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Fetch orders data for daily/hourly breakdown - include financial fields with pagination
  // Expand the query window by 1 day on each side to handle timezone edge cases
  const expandedStartStr = format(subDays(startDate, 1), "yyyy-MM-dd");
  const expandedEndStr = format(addDays(endDate, 1), "yyyy-MM-dd");
  
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ["finances-drilldown-orders", restaurantIds, startStr, endStr, granularity],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const allOrders: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("orders")
          .select("order_datetime, sales_incl_vat, refund_incl_vat, uber_fee_after_promo_incl_vat, item_promo_incl_vat, net_payout, meal_voucher_amount, restaurant_id")
          .gte("order_datetime", `${expandedStartStr}T00:00:00`)
          .lte("order_datetime", `${expandedEndStr}T23:59:59`)
          .range(from, from + PAGE_SIZE - 1);

        if (restaurantIds && restaurantIds.length > 0) {
          query = query.in("restaurant_id", restaurantIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data) {
          allOrders.push(...data);
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Filter orders by Paris timezone date to match RPC behavior
      return allOrders.filter(order => {
        if (!order.order_datetime) return false;
        const parisDate = getParisDateKey(order.order_datetime);
        return isDateInRange(parisDate, startStr, endStr);
      });
    },
    enabled: enabled && (granularity === "daily" || granularity === "hourly"),
  });

  // Fetch order items for product breakdown with pagination
  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ["finances-drilldown-items", restaurantIds, startStr, endStr],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const allOrderIds: string[] = [];
      let from = 0;
      let hasMore = true;

      // First get ALL orders in date range with pagination
      while (hasMore) {
        let ordersQuery = supabase
          .from("orders")
          .select("id")
          .gte("order_datetime", `${startStr}T00:00:00`)
          .lte("order_datetime", `${endStr}T23:59:59`)
          .range(from, from + PAGE_SIZE - 1);

        if (restaurantIds && restaurantIds.length > 0) {
          ordersQuery = ordersQuery.in("restaurant_id", restaurantIds);
        }

        const { data: ordersInRange, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;

        if (ordersInRange) {
          allOrderIds.push(...ordersInRange.map(o => o.id));
          hasMore = ordersInRange.length === PAGE_SIZE;
          from += PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      if (!allOrderIds.length) return [];

      // Fetch items in batches
      const BATCH_SIZE = 500;
      const allItems: any[] = [];

      for (let i = 0; i < allOrderIds.length; i += BATCH_SIZE) {
        const batchIds = allOrderIds.slice(i, i + BATCH_SIZE);
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select("item_id, item_title, category, quantity, sales_incl_vat, refund_incl_vat, item_promo_incl_vat, order_id")
          .in("order_id", batchIds);

        if (itemsError) throw itemsError;
        if (items) allItems.push(...items);
      }

      return allItems;
    },
    enabled: enabled && granularity === "product",
  });

  // Fetch individual orders for order breakdown with infinite scroll
  const { data: individualOrdersData, isLoading: loadingIndividualOrders } = useQuery({
    queryKey: ["finances-drilldown-individual-orders", restaurantIds, startStr, endStr, orderSearchQuery, orderLimit, orderSortField, orderSortDirection],
    queryFn: async () => {
      // Map sort field to actual database column
      const sortColumnMap: Record<OrderSortField, string> = {
        order_datetime: "order_datetime",
        sales_incl_vat: "sales_incl_vat",
        profitability: "sales_incl_vat",
        uber_fee: "uber_fee_after_promo_incl_vat",
        promo: "item_promo_incl_vat",
        refund: "refund_incl_vat",
        net_payout: "net_payout",
        meal_voucher: "meal_voucher_amount",
        total_payout: "net_payout",
      };

      const dbSortColumn = sortColumnMap[orderSortField];
      const isAscending = orderSortDirection === "asc";

      // Check if we need to search by item title
      let orderIdsFromItemSearch: string[] | null = null;
      
      if (orderSearchQuery) {
        // First, get order IDs in the date range to limit the item search scope
        let orderIdsInRange: string[] = [];
        let orderQuery = supabase
          .from("orders")
          .select("id")
          .gte("order_datetime", `${startStr}T00:00:00`)
          .lte("order_datetime", `${endStr}T23:59:59`);
        
        if (restaurantIds && restaurantIds.length > 0) {
          orderQuery = orderQuery.in("restaurant_id", restaurantIds);
        }
        
        const { data: ordersInRange } = await orderQuery;
        if (ordersInRange) {
          orderIdsInRange = ordersInRange.map(o => o.id);
        }
        
        // Only search items within those orders (much faster)
        if (orderIdsInRange.length > 0) {
          // Search in batches to avoid query size limits
          const BATCH_SIZE = 500;
          const matchingOrderIds: Set<string> = new Set();
          
          for (let i = 0; i < orderIdsInRange.length; i += BATCH_SIZE) {
            const batchIds = orderIdsInRange.slice(i, i + BATCH_SIZE);
            const { data: matchingItems } = await supabase
              .from("order_items")
              .select("order_id")
              .in("order_id", batchIds)
              .ilike("item_title", `%${orderSearchQuery}%`);
            
            if (matchingItems) {
              matchingItems.forEach(item => matchingOrderIds.add(item.order_id));
            }
          }
          
          if (matchingOrderIds.size > 0) {
            orderIdsFromItemSearch = [...matchingOrderIds];
          }
        }
      }

      // Build the base query for counting
      let countQuery = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("order_datetime", `${startStr}T00:00:00`)
        .lte("order_datetime", `${endStr}T23:59:59`);

      if (restaurantIds && restaurantIds.length > 0) {
        countQuery = countQuery.in("restaurant_id", restaurantIds);
      }

      // Add search filter: search by uber_order_id OR by item title (via order IDs)
      if (orderSearchQuery) {
        if (orderIdsFromItemSearch && orderIdsFromItemSearch.length > 0) {
          // Use OR filter: uber_order_id matches OR order is in the item search results
          countQuery = countQuery.or(`uber_order_id.ilike.%${orderSearchQuery}%,id.in.(${orderIdsFromItemSearch.join(",")})`);
        } else {
          // Only search by uber_order_id
          countQuery = countQuery.ilike("uber_order_id", `%${orderSearchQuery}%`);
        }
      }

      const { count } = await countQuery;

      // Fetch orders up to the limit
      let query = supabase
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
          meal_voucher_amount
        `)
        .gte("order_datetime", `${startStr}T00:00:00`)
        .lte("order_datetime", `${endStr}T23:59:59`)
        .order(dbSortColumn, { ascending: isAscending })
        .range(0, orderLimit - 1);

      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      // Add search filter
      if (orderSearchQuery) {
        if (orderIdsFromItemSearch && orderIdsFromItemSearch.length > 0) {
          query = query.or(`uber_order_id.ilike.%${orderSearchQuery}%,id.in.(${orderIdsFromItemSearch.join(",")})`);
        } else {
          query = query.ilike("uber_order_id", `%${orderSearchQuery}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch order IDs that have items
      const orderIds = data?.map(o => o.id) || [];
      let orderIdsWithItems: string[] = [];
      
      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("order_id")
          .in("order_id", orderIds);
        
        if (itemsData) {
          orderIdsWithItems = [...new Set(itemsData.map(i => i.order_id))];
        }
      }

      return {
        orders: data || [],
        totalCount: count || 0,
        hasMore: (data?.length || 0) < (count || 0),
        orderIdsWithItems,
      };
    },
    enabled: enabled && granularity === "order",
  });

  // Process daily data with additional financial columns
  const dailyData = useMemo((): DailyFinanceData[] => {
    if (granularity !== "daily" || !ordersData?.length) return [];

    const byDate: Record<string, { 
      sales: number; 
      refund: number; 
      count: number;
      uberFee: number;
      promo: number;
      netPayout: number;
      mealVoucher: number;
    }> = {};

    ordersData.forEach(order => {
      if (!order.order_datetime) return;
      // Use Paris timezone for date grouping (consistent with RPC get_profitability_daily)
      const date = getParisDateKey(order.order_datetime);
      
      if (!byDate[date]) {
        byDate[date] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
      }
      
      byDate[date].sales += Math.abs(Number(order.sales_incl_vat) || 0);
      byDate[date].refund += Math.abs(Number(order.refund_incl_vat) || 0);
      byDate[date].uberFee += Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      byDate[date].promo += Math.abs(Number(order.item_promo_incl_vat) || 0);
      byDate[date].netPayout += Number(order.net_payout) || 0;
      byDate[date].mealVoucher += Number(order.meal_voucher_amount) || 0;
      byDate[date].count += 1;
    });

    return Object.entries(byDate)
      .map(([date, stats]) => ({
        date,
        label: format(new Date(date), "EEE dd MMM", { locale: fr }),
        sales_incl_vat: stats.sales,
        refund_incl_vat: stats.refund,
        order_count: stats.count,
        avg_basket: stats.count > 0 ? stats.sales / stats.count : 0,
        uber_fee_incl_vat: stats.uberFee,
        promo_incl_vat: stats.promo,
        net_payout: stats.netPayout,
        meal_voucher_amount: stats.mealVoucher,
        total_payout: stats.netPayout + stats.mealVoucher,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [ordersData, granularity]);

  // Process hourly data with additional financial columns
  const hourlyData = useMemo((): HourlyFinanceData[] => {
    if (granularity !== "hourly" || !ordersData?.length) return [];

    const byHour: Record<number, { 
      sales: number; 
      refund: number; 
      count: number;
      uberFee: number;
      promo: number;
      netPayout: number;
      mealVoucher: number;
    }> = {};

    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      byHour[h] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0, mealVoucher: 0 };
    }

    ordersData.forEach(order => {
      if (!order.order_datetime) return;
      // Use Paris timezone for hour grouping (consistent timezone handling)
      const hour = getParisHour(order.order_datetime);
      
      byHour[hour].sales += Math.abs(Number(order.sales_incl_vat) || 0);
      byHour[hour].refund += Math.abs(Number(order.refund_incl_vat) || 0);
      byHour[hour].uberFee += Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      byHour[hour].promo += Math.abs(Number(order.item_promo_incl_vat) || 0);
      byHour[hour].netPayout += Number(order.net_payout) || 0;
      byHour[hour].mealVoucher += Number(order.meal_voucher_amount) || 0;
      byHour[hour].count += 1;
    });

    return Object.entries(byHour)
      .map(([hour, stats]) => ({
        hour: Number(hour),
        label: `${hour}h`,
        sales_incl_vat: stats.sales,
        refund_incl_vat: stats.refund,
        order_count: stats.count,
        avg_basket: stats.count > 0 ? stats.sales / stats.count : 0,
        uber_fee_incl_vat: stats.uberFee,
        promo_incl_vat: stats.promo,
        net_payout: stats.netPayout,
        meal_voucher_amount: stats.mealVoucher,
        total_payout: stats.netPayout + stats.mealVoucher,
      }))
      .filter(h => h.order_count > 0) // Only show hours with orders
      .sort((a, b) => a.hour - b.hour);
  }, [ordersData, granularity]);

  // Process product data with promo field
  const productData = useMemo((): ProductFinanceData[] => {
    if (granularity !== "product" || !itemsData?.length) return [];

    const byProduct: Record<string, {
      item_title: string;
      category: string | null;
      quantity: number;
      sales: number;
      refund: number;
      promo: number;
      orderIds: Set<string>;
    }> = {};

    itemsData.forEach(item => {
      const key = item.item_id;
      
      if (!byProduct[key]) {
        byProduct[key] = {
          item_title: item.item_title || "Produit inconnu",
          category: item.category,
          quantity: 0,
          sales: 0,
          refund: 0,
          promo: 0,
          orderIds: new Set(),
        };
      }
      
      byProduct[key].quantity += Number(item.quantity) || 1;
      byProduct[key].sales += Math.abs(Number(item.sales_incl_vat) || 0);
      byProduct[key].refund += Math.abs(Number(item.refund_incl_vat) || 0);
      byProduct[key].promo += Math.abs(Number(item.item_promo_incl_vat) || 0);
      byProduct[key].orderIds.add(item.order_id);
    });

    return Object.entries(byProduct)
      .map(([item_id, stats]) => ({
        item_id,
        item_title: stats.item_title,
        category: stats.category,
        quantity: stats.quantity,
        sales_incl_vat: stats.sales,
        refund_incl_vat: stats.refund,
        promo_incl_vat: stats.promo,
        order_count: stats.orderIds.size,
        avg_unit_price: stats.quantity > 0 ? stats.sales / stats.quantity : 0,
        refund_rate: stats.sales > 0 ? (stats.refund / stats.sales) * 100 : 0,
      }))
      .sort((a, b) => b.sales_incl_vat - a.sales_incl_vat);
  }, [itemsData, granularity]);

  // Summary stats
  const summary = useMemo(() => {
    if (granularity === "daily" && dailyData.length > 0) {
      const totalSales = dailyData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalRefund = dailyData.reduce((sum, d) => sum + d.refund_incl_vat, 0);
      const totalOrders = dailyData.reduce((sum, d) => sum + d.order_count, 0);
      
      return {
        totalSales,
        totalRefund,
        totalOrders,
        avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
        periodCount: dailyData.length,
      };
    }

    if (granularity === "hourly" && hourlyData.length > 0) {
      const totalSales = hourlyData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalRefund = hourlyData.reduce((sum, d) => sum + d.refund_incl_vat, 0);
      const totalOrders = hourlyData.reduce((sum, d) => sum + d.order_count, 0);
      const peakHour = hourlyData.reduce((max, d) => d.order_count > max.order_count ? d : max, hourlyData[0]);
      
      return {
        totalSales,
        totalRefund,
        totalOrders,
        avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
        peakHour: peakHour?.hour,
        peakHourOrders: peakHour?.order_count,
      };
    }

    if (granularity === "product" && productData.length > 0) {
      const totalSales = productData.reduce((sum, d) => sum + d.sales_incl_vat, 0);
      const totalRefund = productData.reduce((sum, d) => sum + d.refund_incl_vat, 0);
      const totalQuantity = productData.reduce((sum, d) => sum + d.quantity, 0);
      const topProduct = productData[0];
      
      return {
        totalSales,
        totalRefund,
        totalQuantity,
        productCount: productData.length,
        topProduct: topProduct?.item_title,
        topProductSales: topProduct?.sales_incl_vat,
      };
    }

    return null;
  }, [granularity, dailyData, hourlyData, productData]);

  // Process order data
  const orderData = useMemo((): OrderFinanceData[] => {
    if (granularity !== "order" || !individualOrdersData?.orders?.length) return [];

    return individualOrdersData.orders.map(order => {
      const salesInclVat = Math.abs(Number(order.sales_incl_vat) || 0);
      const uberFeeInclVat = Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      const promoInclVat = Math.abs(Number(order.item_promo_incl_vat) || 0);
      const refundInclVat = Math.abs(Number(order.refund_incl_vat) || 0);
      const netPayout = Number(order.net_payout) || 0;
      const mealVoucherAmount = Number(order.meal_voucher_amount) || 0;
      const totalPayout = netPayout + mealVoucherAmount;
      const profitability = salesInclVat > 0 ? (totalPayout / salesInclVat) * 100 : 0;

      return {
        id: order.id,
        uber_order_id: order.uber_order_id,
        order_datetime: order.order_datetime,
        sales_incl_vat: salesInclVat,
        uber_fee_incl_vat: uberFeeInclVat,
        promo_incl_vat: promoInclVat,
        refund_incl_vat: refundInclVat,
        net_payout: netPayout,
        meal_voucher_amount: mealVoucherAmount,
        total_payout: totalPayout,
        profitability,
      };
    });
  }, [individualOrdersData, granularity]);

  return {
    dailyData,
    hourlyData,
    productData,
    orderData,
    orderPagination: individualOrdersData ? {
      totalCount: individualOrdersData.totalCount,
      hasMore: individualOrdersData.hasMore,
    } : null,
    orderIdsWithItems: individualOrdersData?.orderIdsWithItems || [],
    summary,
    isLoading: loadingOrders || loadingItems || loadingIndividualOrders,
  };
}
