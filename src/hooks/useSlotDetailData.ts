import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { differenceInDays, startOfWeek, format } from "date-fns";
import { fr } from "date-fns/locale";

export type DataGranularity = "daily" | "weekly" | "monthly";

interface SlotDetailParams {
  restaurantId: string;
  slotHours: number[];
  startDate: string;
  endDate: string;
  enabled?: boolean;
}

interface DailySlotData {
  date: string;
  order_count: number;
  revenue: number;
}

interface AggregatedData {
  label: string;
  date: string;
  order_count: number;
  revenue: number;
  avg_basket: number;
}

export function useSlotDetailData({
  restaurantId,
  slotHours,
  startDate,
  endDate,
  enabled = true,
}: SlotDetailParams) {
  // Calculate granularity based on date range
  const { granularity, periodDays } = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = differenceInDays(end, start) + 1;
    
    let gran: DataGranularity;
    if (days <= 31) {
      gran = "daily";
    } else if (days <= 93) {
      gran = "weekly";
    } else {
      gran = "monthly";
    }
    
    return { granularity: gran, periodDays: days };
  }, [startDate, endDate]);

  // Fetch raw daily data for the slot
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ["slot-detail", restaurantId, slotHours, startDate, endDate],
    queryFn: async () => {
      // Build hours filter for SQL
      const hoursCondition = slotHours.map(h => `EXTRACT(HOUR FROM order_datetime) = ${h}`).join(' OR ');
      
      const { data, error } = await supabase
        .from("order_history")
        .select("order_datetime, order_amount")
        .eq("restaurant_id", restaurantId)
        .eq("order_status", "completed")
        .gte("order_datetime", startDate)
        .lte("order_datetime", endDate);

      if (error) throw error;

      // Filter by hours in JS (Supabase doesn't support EXTRACT in filters easily)
      const filtered = (data || []).filter(order => {
        if (!order.order_datetime) return false;
        const hour = new Date(order.order_datetime).getHours();
        return slotHours.includes(hour);
      });

      // Group by date
      const byDate: Record<string, { count: number; revenue: number }> = {};
      filtered.forEach(order => {
        const date = order.order_datetime!.split("T")[0];
        if (!byDate[date]) {
          byDate[date] = { count: 0, revenue: 0 };
        }
        byDate[date].count += 1;
        byDate[date].revenue += Number(order.order_amount) || 0;
      });

      return Object.entries(byDate)
        .map(([date, stats]) => ({
          date,
          order_count: stats.count,
          revenue: stats.revenue,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)) as DailySlotData[];
    },
    enabled: enabled && !!restaurantId && slotHours.length > 0,
  });

  // Aggregate data based on granularity
  const aggregatedData = useMemo((): AggregatedData[] => {
    if (!rawData?.length) return [];

    if (granularity === "daily") {
      return rawData.map(d => ({
        label: format(new Date(d.date), "dd MMM", { locale: fr }),
        date: d.date,
        order_count: d.order_count,
        revenue: d.revenue,
        avg_basket: d.order_count > 0 ? d.revenue / d.order_count : 0,
      }));
    }

    if (granularity === "weekly") {
      const byWeek: Record<string, { orders: number; revenue: number; startDate: string }> = {};
      
      rawData.forEach(d => {
        const date = new Date(d.date);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekKey = format(weekStart, "yyyy-MM-dd");
        
        if (!byWeek[weekKey]) {
          byWeek[weekKey] = { orders: 0, revenue: 0, startDate: weekKey };
        }
        byWeek[weekKey].orders += d.order_count;
        byWeek[weekKey].revenue += d.revenue;
      });

      return Object.values(byWeek)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map(w => ({
          label: `Sem. ${format(new Date(w.startDate), "dd/MM", { locale: fr })}`,
          date: w.startDate,
          order_count: w.orders,
          revenue: w.revenue,
          avg_basket: w.orders > 0 ? w.revenue / w.orders : 0,
        }));
    }

    // Monthly
    const byMonth: Record<string, { orders: number; revenue: number; monthKey: string }> = {};
    
    rawData.forEach(d => {
      const date = new Date(d.date);
      const monthKey = format(date, "yyyy-MM");
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { orders: 0, revenue: 0, monthKey };
      }
      byMonth[monthKey].orders += d.order_count;
      byMonth[monthKey].revenue += d.revenue;
    });

    return Object.values(byMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(m => ({
        label: format(new Date(m.monthKey + "-01"), "MMM yy", { locale: fr }),
        date: m.monthKey,
        order_count: m.orders,
        revenue: m.revenue,
        avg_basket: m.orders > 0 ? m.revenue / m.orders : 0,
      }));
  }, [rawData, granularity]);

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!aggregatedData.length) return null;

    const totalOrders = aggregatedData.reduce((sum, d) => sum + d.order_count, 0);
    const totalRevenue = aggregatedData.reduce((sum, d) => sum + d.revenue, 0);
    const avgPerPeriod = totalOrders / aggregatedData.length;
    const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      totalRevenue,
      avgPerPeriod,
      avgBasket,
      periodCount: aggregatedData.length,
    };
  }, [aggregatedData]);

  return {
    data: aggregatedData,
    summary,
    granularity,
    periodDays,
    isLoading,
    error,
  };
}
