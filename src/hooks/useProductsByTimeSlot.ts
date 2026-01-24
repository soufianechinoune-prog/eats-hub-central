import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

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

interface RpcResult {
  slot_label: string;
  slot_range: string;
  product_title: string;
  quantity: number;
  revenue: number;
  percent_of_slot: number;
  rank: number;
  slot_total_orders: number;
  slot_total_revenue: number;
}

export function useProductsByTimeSlot(
  restaurantIds: string[] | undefined,
  startDate: string,
  endDate: string,
  topN: number = 3
) {
  const { data: rpcData, isLoading } = useQuery({
    queryKey: ["products-by-slot-rpc", restaurantIds, startDate, endDate, topN],
    queryFn: async () => {
      if (!restaurantIds?.length) return [];

      const { data, error } = await supabase.rpc("get_products_by_time_slot", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDate,
        p_end_date: endDate,
        p_top_n: topN,
      });

      if (error) throw error;
      return (data as RpcResult[]) || [];
    },
    enabled: !!restaurantIds?.length,
  });

  // Transform RPC result into ProductSlotData[]
  const slotData = useMemo((): ProductSlotData[] => {
    if (!rpcData?.length) return [];

    const slotMap = new Map<string, ProductSlotData>();

    rpcData.forEach((row) => {
      if (!slotMap.has(row.slot_label)) {
        const slotDef = TIME_SLOTS.find((s) => s.label === row.slot_label);
        slotMap.set(row.slot_label, {
          slotLabel: row.slot_label,
          slotRange: row.slot_range,
          slotHours: slotDef?.hours || [],
          topProducts: [],
          totalOrders: Number(row.slot_total_orders) || 0,
          totalRevenue: Number(row.slot_total_revenue) || 0,
        });
      }

      slotMap.get(row.slot_label)!.topProducts.push({
        title: row.product_title,
        quantity: Number(row.quantity) || 0,
        revenue: Number(row.revenue) || 0,
        percentOfSlot: Number(row.percent_of_slot) || 0,
        rank: Number(row.rank) || 0,
      });
    });

    // Sort slots in the correct order
    const slotOrder = ["Déjeuner", "Après-midi", "Dîner", "Soirée", "Late-night"];
    return Array.from(slotMap.values()).sort(
      (a, b) => slotOrder.indexOf(a.slotLabel) - slotOrder.indexOf(b.slotLabel)
    );
  }, [rpcData]);

  // Global top products (aggregate from slot data)
  const globalTopProducts = useMemo(() => {
    if (!rpcData?.length) return [];

    const productMap = new Map<string, { quantity: number; revenue: number }>();

    rpcData.forEach((row) => {
      if (!productMap.has(row.product_title)) {
        productMap.set(row.product_title, { quantity: 0, revenue: 0 });
      }
      const product = productMap.get(row.product_title)!;
      product.quantity += Number(row.quantity) || 0;
      product.revenue += Number(row.revenue) || 0;
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
  }, [rpcData]);

  // Count total orders from slot data
  const totalOrders = useMemo(() => {
    return slotData.reduce((sum, slot) => sum + slot.totalOrders, 0);
  }, [slotData]);

  return {
    slotData,
    globalTopProducts,
    isLoading,
    totalOrders,
  };
}
