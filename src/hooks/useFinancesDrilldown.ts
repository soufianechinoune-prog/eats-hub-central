import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format, startOfWeek, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

export type DrilldownGranularity = "daily" | "hourly" | "product";

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

interface UseFinancesDrilldownParams {
  restaurantIds?: string[];
  startDate: Date;
  endDate: Date;
  granularity: DrilldownGranularity;
  enabled?: boolean;
}

export function useFinancesDrilldown({
  restaurantIds,
  startDate,
  endDate,
  granularity,
  enabled = true,
}: UseFinancesDrilldownParams) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Fetch orders data for daily/hourly breakdown - include financial fields
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ["finances-drilldown-orders", restaurantIds, startStr, endStr, granularity],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("order_datetime, sales_incl_vat, refund_incl_vat, uber_fee_after_promo_incl_vat, item_promo_incl_vat, net_payout, restaurant_id")
        .gte("order_datetime", `${startStr}T00:00:00`)
        .lte("order_datetime", `${endStr}T23:59:59`);

      if (restaurantIds && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && (granularity === "daily" || granularity === "hourly"),
  });

  // Fetch order items for product breakdown
  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ["finances-drilldown-items", restaurantIds, startStr, endStr],
    queryFn: async () => {
      // First get orders in date range
      let ordersQuery = supabase
        .from("orders")
        .select("id")
        .gte("order_datetime", `${startStr}T00:00:00`)
        .lte("order_datetime", `${endStr}T23:59:59`);

      if (restaurantIds && restaurantIds.length > 0) {
        ordersQuery = ordersQuery.in("restaurant_id", restaurantIds);
      }

      const { data: ordersInRange, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      if (!ordersInRange?.length) return [];

      const orderIds = ordersInRange.map(o => o.id);

      // Fetch items in batches if needed
      const BATCH_SIZE = 500;
      const allItems: any[] = [];

      for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batchIds = orderIds.slice(i, i + BATCH_SIZE);
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
    }> = {};

    ordersData.forEach(order => {
      if (!order.order_datetime) return;
      const date = order.order_datetime.split("T")[0];
      
      if (!byDate[date]) {
        byDate[date] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0 };
      }
      
      byDate[date].sales += Math.abs(Number(order.sales_incl_vat) || 0);
      byDate[date].refund += Math.abs(Number(order.refund_incl_vat) || 0);
      byDate[date].uberFee += Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      byDate[date].promo += Math.abs(Number(order.item_promo_incl_vat) || 0);
      byDate[date].netPayout += Number(order.net_payout) || 0;
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
    }> = {};

    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      byHour[h] = { sales: 0, refund: 0, count: 0, uberFee: 0, promo: 0, netPayout: 0 };
    }

    ordersData.forEach(order => {
      if (!order.order_datetime) return;
      const hour = new Date(order.order_datetime).getHours();
      
      byHour[hour].sales += Math.abs(Number(order.sales_incl_vat) || 0);
      byHour[hour].refund += Math.abs(Number(order.refund_incl_vat) || 0);
      byHour[hour].uberFee += Math.abs(Number(order.uber_fee_after_promo_incl_vat) || 0);
      byHour[hour].promo += Math.abs(Number(order.item_promo_incl_vat) || 0);
      byHour[hour].netPayout += Number(order.net_payout) || 0;
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

  return {
    dailyData,
    hourlyData,
    productData,
    summary,
    isLoading: loadingOrders || loadingItems,
  };
}
