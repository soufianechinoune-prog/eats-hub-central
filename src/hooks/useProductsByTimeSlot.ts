import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

export interface ProductData {
  title: string;
  quantity: number;
  revenue: number;
  percentOfSlot: number;
  rank: number;
}

export interface ProductSlotData {
  slotLabel: string;
  slotHours: number[];
  slotRange: string;
  topProducts: ProductData[];
  totalOrders: number;
  totalRevenue: number;
}

export const TIME_SLOTS = [
  { label: "Déjeuner", hours: [11, 12, 13, 14], range: "11h-15h" },
  { label: "Après-midi", hours: [15, 16, 17], range: "15h-18h" },
  { label: "Dîner", hours: [18, 19, 20, 21], range: "18h-22h" },
  { label: "Soirée", hours: [22, 23], range: "22h-00h" },
  { label: "Late-night", hours: [0, 1, 2, 3], range: "00h-04h" },
];

export function useProductsByTimeSlot(
  restaurantIds: string[] | undefined,
  startDate: string,
  endDate: string,
  topN: number = 3
) {
  // Step 1: Fetch orders with their datetime to map order_id -> hour
  const { data: ordersWithHour, isLoading: loadingOrders } = useQuery({
    queryKey: ["products-by-slot-orders", restaurantIds, startDate, endDate],
    queryFn: async () => {
      if (!restaurantIds?.length) return [];

      // Pagination loop to bypass 1000 row limit
      const allOrders: { id: string; order_datetime: string }[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("orders")
          .select("id, order_datetime")
          .gte("order_datetime", startDate)
          .lte("order_datetime", endDate + "T23:59:59")
          .in("restaurant_id", restaurantIds)
          .range(offset, offset + pageSize - 1)
          .order("id");

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allOrders.push(...data);
          offset += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allOrders;
    },
    enabled: !!restaurantIds?.length,
  });

  // Create order_id -> hour map
  const orderHourMap = useMemo(() => {
    if (!ordersWithHour?.length) return new Map<string, number>();
    
    return new Map(
      ordersWithHour.map((o) => [
        o.id,
        parseISO(o.order_datetime).getHours(),
      ])
    );
  }, [ordersWithHour]);

  // Step 2: Fetch order_items for those orders
  const { data: orderItems, isLoading: loadingItems } = useQuery({
    queryKey: ["products-by-slot-items", restaurantIds, startDate, endDate],
    queryFn: async () => {
      if (!ordersWithHour?.length) return [];

      const orderIds = ordersWithHour.map((o) => o.id);
      const chunkSize = 500;
      const allItems: {
        order_id: string;
        item_title: string;
        quantity: number;
        sales_incl_vat: number;
      }[] = [];

      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("order_items")
          .select("order_id, item_title, quantity, sales_incl_vat")
          .in("order_id", chunk);

        if (error) throw error;
        if (data) allItems.push(...data);
      }

      return allItems;
    },
    enabled: !!ordersWithHour?.length,
  });

  // Step 3: Aggregate by slot and product
  const slotData = useMemo((): ProductSlotData[] => {
    if (!orderItems?.length || !orderHourMap.size) return [];

    // Map: slotLabel -> Map<productTitle, {qty, revenue}>
    const slotProductMap = new Map<
      string,
      Map<string, { quantity: number; revenue: number }>
    >();
    const slotOrderCounts = new Map<string, Set<string>>();

    orderItems.forEach((item) => {
      const hour = orderHourMap.get(item.order_id);
      if (hour === undefined) return;

      const slot = TIME_SLOTS.find((s) => s.hours.includes(hour));
      if (!slot) return;

      // Initialize slot maps if needed
      if (!slotProductMap.has(slot.label)) {
        slotProductMap.set(slot.label, new Map());
        slotOrderCounts.set(slot.label, new Set());
      }

      const productMap = slotProductMap.get(slot.label)!;
      slotOrderCounts.get(slot.label)!.add(item.order_id);

      // Aggregate product data
      if (!productMap.has(item.item_title)) {
        productMap.set(item.item_title, { quantity: 0, revenue: 0 });
      }

      const product = productMap.get(item.item_title)!;
      product.quantity += item.quantity || 0;
      product.revenue += item.sales_incl_vat || 0;
    });

    // Build final structure
    return TIME_SLOTS.map((slot) => {
      const productMap = slotProductMap.get(slot.label);
      const orderSet = slotOrderCounts.get(slot.label);

      if (!productMap || !orderSet) {
        return {
          slotLabel: slot.label,
          slotHours: slot.hours,
          slotRange: slot.range,
          topProducts: [],
          totalOrders: 0,
          totalRevenue: 0,
        };
      }

      const totalRevenue = Array.from(productMap.values()).reduce(
        (sum, p) => sum + p.revenue,
        0
      );

      // Sort by revenue and take top N
      const sortedProducts = Array.from(productMap.entries())
        .map(([title, data]) => ({
          title,
          quantity: data.quantity,
          revenue: data.revenue,
          percentOfSlot:
            totalRevenue > 0
              ? Math.round((data.revenue / totalRevenue) * 100)
              : 0,
          rank: 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, topN)
        .map((p, idx) => ({ ...p, rank: idx + 1 }));

      return {
        slotLabel: slot.label,
        slotHours: slot.hours,
        slotRange: slot.range,
        topProducts: sortedProducts,
        totalOrders: orderSet.size,
        totalRevenue: Math.round(totalRevenue),
      };
    }).filter((slot) => slot.totalOrders > 0);
  }, [orderItems, orderHourMap, topN]);

  // Global top products (across all slots)
  const globalTopProducts = useMemo(() => {
    if (!orderItems?.length) return [];

    const productMap = new Map<string, { quantity: number; revenue: number }>();

    orderItems.forEach((item) => {
      if (!productMap.has(item.item_title)) {
        productMap.set(item.item_title, { quantity: 0, revenue: 0 });
      }
      const product = productMap.get(item.item_title)!;
      product.quantity += item.quantity || 0;
      product.revenue += item.sales_incl_vat || 0;
    });

    const totalRevenue = Array.from(productMap.values()).reduce(
      (sum, p) => sum + p.revenue,
      0
    );

    return Array.from(productMap.entries())
      .map(([title, data]) => ({
        title,
        quantity: data.quantity,
        revenue: data.revenue,
        percentOfSlot:
          totalRevenue > 0
            ? Math.round((data.revenue / totalRevenue) * 100)
            : 0,
        rank: 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [orderItems]);

  return {
    slotData,
    globalTopProducts,
    isLoading: loadingOrders || loadingItems,
    totalOrders: ordersWithHour?.length || 0,
  };
}
