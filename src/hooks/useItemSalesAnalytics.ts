import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface ItemSalesData {
  item_id: string;
  item_title: string;
  category: string | null;
  total_quantity: number;
  total_sales: number;
  total_refunds: number;
  total_promos: number;
  net_sales: number;
  order_count: number;
  avg_unit_price: number;
}

export interface ItemSalesEvolution {
  date: string;
  item_id: string;
  item_title: string;
  quantity: number;
  sales: number;
}

export interface RefundAnalysis {
  item_id: string;
  item_title: string;
  refund_count: number;
  refund_amount: number;
  total_orders: number;
  refund_rate: number;
}

export function useItemSalesAnalytics(
  restaurantIds: string[] | undefined,
  startDate: Date,
  endDate: Date
) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Fetch aggregated item sales - filter by order_datetime from orders table
  const { data: itemSales, isLoading: loadingSales } = useQuery({
    queryKey: ["item_sales_analytics", restaurantIds, startStr, endStr],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Empty array = no restaurants in scope → return empty
      if (restaurantIds && restaurantIds.length === 0) return [];

      // First get order_ids from orders within the date range
      let ordersQuery = supabase
        .from("orders")
        .select("id")
        .gte("order_datetime", startStr)
        .lte("order_datetime", endStr + "T23:59:59");

      if (restaurantIds && restaurantIds.length > 0) {
        ordersQuery = ordersQuery.in("restaurant_id", restaurantIds);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;
      
      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map(o => o.id);
      
      // Fetch items for those orders (batch in chunks to avoid query limits)
      const chunkSize = 500;
      const allItems: any[] = [];
      
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select(`
            item_id,
            item_title,
            category,
            quantity,
            unit_price,
            sales_incl_vat,
            refund_incl_vat,
            item_promo_incl_vat,
            order_id
          `)
          .in("order_id", chunk);

        if (itemsError) throw itemsError;
        if (items) allItems.push(...items);
      }

      return allItems;
    },
  });

  // Aggregate item sales
  const aggregatedSales = useMemo((): ItemSalesData[] => {
    if (!itemSales || itemSales.length === 0) return [];

    const itemMap = new Map<string, ItemSalesData>();

    itemSales.forEach((item) => {
      const key = item.item_id || item.item_title;
      
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          item_id: item.item_id,
          item_title: item.item_title,
          category: item.category,
          total_quantity: 0,
          total_sales: 0,
          total_refunds: 0,
          total_promos: 0,
          net_sales: 0,
          order_count: 0,
          avg_unit_price: 0,
        });
      }

      const agg = itemMap.get(key)!;
      agg.total_quantity += item.quantity || 0;
      agg.total_sales += item.sales_incl_vat || 0;
      agg.total_refunds += Math.abs(item.refund_incl_vat || 0);
      agg.total_promos += Math.abs(item.item_promo_incl_vat || 0);
      agg.order_count += 1;
      agg.avg_unit_price = item.unit_price || agg.avg_unit_price;
    });

    return Array.from(itemMap.values()).map((item) => ({
      ...item,
      net_sales: item.total_sales - item.total_refunds - item.total_promos,
    }));
  }, [itemSales]);

  // Top products by sales
  const topProducts = useMemo(() => {
    return [...aggregatedSales]
      .filter((item) => item.net_sales > 0)
      .sort((a, b) => b.net_sales - a.net_sales)
      .slice(0, 10);
  }, [aggregatedSales]);

  // Flop products by net sales (could be negative or low)
  const flopProducts = useMemo(() => {
    return [...aggregatedSales]
      .filter((item) => item.total_quantity > 5) // Minimum orders to be relevant
      .sort((a, b) => a.net_sales - b.net_sales)
      .slice(0, 10);
  }, [aggregatedSales]);

  // Products with highest refund rate
  const refundAnalysis = useMemo((): RefundAnalysis[] => {
    return aggregatedSales
      .filter((item) => item.order_count >= 3) // Min orders for relevance
      .map((item) => ({
        item_id: item.item_id,
        item_title: item.item_title,
        refund_count: item.total_refunds > 0 ? 1 : 0, // Simplified - count of refunds
        refund_amount: item.total_refunds,
        total_orders: item.order_count,
        refund_rate: item.total_sales > 0 
          ? (item.total_refunds / item.total_sales) * 100 
          : 0,
      }))
      .filter((item) => item.refund_amount > 0)
      .sort((a, b) => b.refund_rate - a.refund_rate);
  }, [aggregatedSales]);

  // Monthly evolution for top products - filter by order_datetime
  const { data: monthlyEvolution, isLoading: loadingEvolution } = useQuery({
    queryKey: ["item_sales_evolution", restaurantIds, startStr, endStr],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Empty array = no restaurants in scope → return empty
      if (restaurantIds && restaurantIds.length === 0) return [];

      // Get orders with their dates
      let ordersQuery = supabase
        .from("orders")
        .select("id, order_datetime")
        .gte("order_datetime", startStr)
        .lte("order_datetime", endStr + "T23:59:59");

      if (restaurantIds && restaurantIds.length > 0) {
        ordersQuery = ordersQuery.in("restaurant_id", restaurantIds);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;
      
      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map(o => o.id);
      const orderDateMap = new Map(orders.map(o => [o.id, o.order_datetime]));
      
      // Fetch items in chunks
      const chunkSize = 500;
      const allItems: any[] = [];
      
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select(`
            item_id,
            item_title,
            quantity,
            sales_incl_vat,
            order_id
          `)
          .in("order_id", chunk);

        if (itemsError) throw itemsError;
        if (items) allItems.push(...items);
      }

      // Group by month (based on order_datetime) and item
      const monthlyMap = new Map<string, ItemSalesEvolution>();
      
      allItems.forEach((item) => {
        const orderDate = orderDateMap.get(item.order_id);
        if (!orderDate) return;
        
        const month = format(new Date(orderDate), "yyyy-MM");
        const key = `${month}-${item.item_id || item.item_title}`;
        
        if (!monthlyMap.has(key)) {
          monthlyMap.set(key, {
            date: month,
            item_id: item.item_id,
            item_title: item.item_title,
            quantity: 0,
            sales: 0,
          });
        }
        
        const agg = monthlyMap.get(key)!;
        agg.quantity += item.quantity || 0;
        agg.sales += item.sales_incl_vat || 0;
      });

      return Array.from(monthlyMap.values());
    },
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalSales = aggregatedSales.reduce((sum, item) => sum + item.total_sales, 0);
    const totalRefunds = aggregatedSales.reduce((sum, item) => sum + item.total_refunds, 0);
    const totalQuantity = aggregatedSales.reduce((sum, item) => sum + item.total_quantity, 0);
    const uniqueProducts = aggregatedSales.length;
    const avgBasketContribution = totalQuantity > 0 ? totalSales / totalQuantity : 0;

    return {
      totalSales,
      totalRefunds,
      totalQuantity,
      uniqueProducts,
      avgBasketContribution,
      refundRate: totalSales > 0 ? (totalRefunds / totalSales) * 100 : 0,
    };
  }, [aggregatedSales]);

  return {
    itemSales: aggregatedSales,
    topProducts,
    flopProducts,
    refundAnalysis,
    monthlyEvolution: monthlyEvolution || [],
    kpis,
    isLoading: loadingSales || loadingEvolution,
  };
}
