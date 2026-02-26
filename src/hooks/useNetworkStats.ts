import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";

export interface PlatformBreakdown {
  revenue: number;
  orders: number;
  avgBasket: number;
  netPayout: number;
  profitability: number | null;
}

export interface RestaurantNetworkStats {
  id: string;
  name: string;
  city: string | null;
  // Financial metrics
  revenue: number;
  orders: number;
  avgBasket: number;
  netPayout: number; // Versement net total (net_payout + meal_voucher)
  // Quality metrics
  rating: number | null;
  profitability: number | null;
  // Operations metrics
  prepTime: number | null;
  totalDeliveryTime: number | null; // Temps prépa+livraison moyen
  errorRate: number | null;
  downtime: number | null;
  // N-1 comparison (optional)
  prevRevenue?: number | null;
  prevOrders?: number | null;
  revenueVariation?: number | null;
  ordersVariation?: number | null;
  // Platform breakdown
  platformBreakdown: {
    uber: PlatformBreakdown;
    deliveroo: PlatformBreakdown;
  };
}

export interface NetworkTotals {
  totalRevenue: number;
  totalOrders: number;
  avgBasket: number;
  totalNetPayout: number; // Total versement net réseau
  avgRating: number | null;
  avgProfitability: number | null;
  avgPrepTime: number | null;
  avgTotalDeliveryTime: number | null; // Moyenne temps prépa+livraison
  avgErrorRate: number | null;
  totalDowntime: number | null;
  // N-1 comparison
  prevTotalRevenue?: number;
  prevTotalOrders?: number;
  revenueVariation?: number | null;
}

interface UseNetworkStatsParams {
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
  profitabilityBase?: "gross" | "net";
  includeN1Comparison?: boolean;
}

const RETRY_CONFIG = {
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

/**
 * Centralized hook for fetching network-wide restaurant statistics
 * Uses server-side RPC aggregation for heavy tables (orders, order_history, deliveroo_orders)
 * Queries are staggered in waves to avoid I/O contention:
 * Wave 1: restaurants + sales + deliveroo RPC (lightweight)
 * Wave 2: reviews + accuracy (small tables)
 * Wave 3: orders payout RPC (single call)
 * Wave 4: prep time RPC + availability RPC (single calls)
 */
export function useNetworkStats({
  restaurantIds,
  startDate,
  endDate,
  profitabilityBase = "gross",
  includeN1Comparison = false,
}: UseNetworkStatsParams) {
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // Calculate N-1 date range
  const prevStartDate = new Date(startDate);
  prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
  const prevEndDate = new Date(endDate);
  prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
  const prevStartDateStr = prevStartDate.toISOString().split("T")[0];
  const prevEndDateStr = prevEndDate.toISOString().split("T")[0];

  const hasIds = restaurantIds.length > 0;

  // ═══════════════════════════════════════════════
  // WAVE 1: Restaurants + Sales + Deliveroo RPC (lightweight)
  // ═══════════════════════════════════════════════

  const { data: restaurantsRaw } = useQuery({
    queryKey: ["network-stats-restaurants", restaurantIds],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")
        .in("id", restaurantIds);
      if (error) throw error;
      return data || [];
    },
    enabled: hasIds,
    ...RETRY_CONFIG,
  });

  const restaurants = useMemo(() => {
    if (!restaurantsRaw) return [];
    return filterActiveRestaurants(restaurantsRaw, startDate, endDate);
  }, [restaurantsRaw, startDate, endDate]);

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["network-stats-sales", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase
        .rpc("get_daily_revenue_from_orders", {
          p_start_date: startDateStr,
          p_end_date: endDateStr,
          p_restaurant_ids: restaurantIds,
        });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        revenue_ttc: Number(d.revenue_ttc),
        order_count: Number(d.order_count),
      }));
    },
    enabled: hasIds,
    ...RETRY_CONFIG,
  });

  // Deliveroo sales via RPC (replaces paginated fetch)
  const { data: deliverooSummaryData, isLoading: deliverooLoading } = useQuery({
    queryKey: ["network-stats-deliveroo", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase.rpc("get_network_deliveroo_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        total_revenue: Number(d.total_revenue),
        total_payable: Number(d.total_payable),
        order_count: Number(d.order_count),
      }));
    },
    enabled: hasIds,
    ...RETRY_CONFIG,
  });

  // N-1 sales (part of wave 1 since it's lightweight)
  const { data: prevSalesData } = useQuery({
    queryKey: ["network-stats-sales-prev", restaurantIds, prevStartDateStr, prevEndDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase
        .rpc("get_daily_revenue_from_orders", {
          p_start_date: prevStartDateStr,
          p_end_date: prevEndDateStr,
          p_restaurant_ids: restaurantIds,
        });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        revenue_ttc: Number(d.revenue_ttc),
        order_count: Number(d.order_count),
      }));
    },
    enabled: hasIds && includeN1Comparison,
    ...RETRY_CONFIG,
  });

  // Wave 1 is done when sales are loaded
  const wave1Done = !!salesData;

  // ═══════════════════════════════════════════════
  // WAVE 2: Reviews + Accuracy (wait for wave 1)
  // ═══════════════════════════════════════════════

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["network-stats-reviews", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase
        .from("customer_reviews")
        .select("restaurant_id, overall_rating")
        .gte("review_date", startDateStr)
        .lte("review_date", endDateStr)
        .in("restaurant_id", restaurantIds);
      if (error) throw error;
      return data || [];
    },
    enabled: hasIds && wave1Done,
    ...RETRY_CONFIG,
  });

  const { data: accuracyData, isLoading: accuracyLoading } = useQuery({
    queryKey: ["network-stats-accuracy", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase
        .from("daily_order_accuracy")
        .select("restaurant_id, incorrect_orders_count")
        .eq("period_type", "current")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds);
      if (error) throw error;
      return data || [];
    },
    enabled: hasIds && wave1Done,
    ...RETRY_CONFIG,
  });

  // Wave 2 is done when both reviews and accuracy are loaded
  const wave2Done = !!reviewsData && !!accuracyData;

  // ═══════════════════════════════════════════════
  // WAVE 3: Orders payout via RPC (wait for wave 2)
  // ═══════════════════════════════════════════════

  const { data: ordersPayoutData, isLoading: ordersPayoutLoading } = useQuery({
    queryKey: ["network-stats-orders-payout", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase.rpc("get_network_orders_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        total_sales_incl_vat: Number(d.total_sales_incl_vat),
        total_net_payout: Number(d.total_net_payout),
        total_item_promo_incl_vat: Number(d.total_item_promo_incl_vat),
        total_meal_voucher: Number(d.total_meal_voucher),
        order_count: Number(d.order_count),
      }));
    },
    enabled: hasIds && wave2Done,
    ...RETRY_CONFIG,
  });

  // Wave 3 is done when orders payout is loaded
  const wave3Done = !!ordersPayoutData;

  // ═══════════════════════════════════════════════
  // WAVE 4: Prep time RPC + Availability RPC (wait for wave 3)
  // ═══════════════════════════════════════════════

  const { data: prepTimeSummaryData, isLoading: historyLoading } = useQuery({
    queryKey: ["network-stats-history", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase.rpc("get_network_prep_time_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        avg_prep_time: d.avg_prep_time != null ? Number(d.avg_prep_time) : null,
        avg_total_delivery_time: d.avg_total_delivery_time != null ? Number(d.avg_total_delivery_time) : null,
        prep_count: Number(d.prep_count),
        delivery_count: Number(d.delivery_count),
      }));
    },
    enabled: hasIds && wave3Done,
    ...RETRY_CONFIG,
  });

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ["network-stats-availability", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase.rpc("get_availability_by_restaurant", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_restaurant_ids: restaurantIds,
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        total_offline_minutes: Number(d.total_offline_minutes),
      }));
    },
    enabled: hasIds && wave3Done,
    ...RETRY_CONFIG,
  });

  // ═══════════════════════════════════════════════
  // CALCULATION: Per-restaurant statistics
  // ═══════════════════════════════════════════════

  const stats = useMemo<RestaurantNetworkStats[]>(() => {
    if (!restaurants?.length) return [];

    return restaurants.map((resto) => {
      const restoSales = salesData?.filter((s) => s.restaurant_id === resto.id) || [];
      const uberRevenue = restoSales.reduce((sum, s) => sum + Number(s.revenue_ttc || 0), 0);
      const uberOrders = restoSales.reduce((sum, s) => sum + Number(s.order_count || 0), 0);

      // Deliveroo data from RPC summary
      const restoDeliveroo = deliverooSummaryData?.find((d) => d.restaurant_id === resto.id);
      const deliverooRevenue = restoDeliveroo?.total_revenue || 0;
      const deliverooOrders = restoDeliveroo?.order_count || 0;
      const deliverooNetPayout = restoDeliveroo?.total_payable || 0;

      // Combined metrics
      const revenue = uberRevenue + deliverooRevenue;
      const orders = uberOrders + deliverooOrders;
      const avgBasket = orders > 0 ? revenue / orders : 0;

      const restoPrevSales = prevSalesData?.filter((s) => s.restaurant_id === resto.id) || [];
      const prevRevenue = restoPrevSales.reduce((sum, s) => sum + Number(s.revenue_ttc || 0), 0);
      const prevOrders = restoPrevSales.reduce((sum, s) => sum + Number(s.order_count || 0), 0);

      const restoReviews = reviewsData?.filter((r) => r.restaurant_id === resto.id) || [];
      const rating =
        restoReviews.length > 0
          ? restoReviews.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) /
            restoReviews.length
          : null;

      // Orders payout from RPC summary
      const restoOrdersSummary = ordersPayoutData?.find((o) => o.restaurant_id === resto.id);
      let profitability: number | null = null;
      let netPayout = 0;
      
      if (restoOrdersSummary || restoDeliveroo) {
        // Uber part
        const uberSales = restoOrdersSummary?.total_sales_incl_vat || 0;
        const totalPromo = restoOrdersSummary?.total_item_promo_incl_vat || 0;
        const totalNetPayoutRaw = restoOrdersSummary?.total_net_payout || 0;
        const totalMealVoucher = restoOrdersSummary?.total_meal_voucher || 0;
        const uberNetPayout = totalNetPayoutRaw + totalMealVoucher;
        
        // Combined payout (Uber + Deliveroo)
        netPayout = uberNetPayout + deliverooNetPayout;

        // Combined profitability
        const combinedSales = profitabilityBase === "net"
          ? Math.max(0, uberSales - totalPromo) + deliverooRevenue
          : uberSales + deliverooRevenue;

        profitability =
          combinedSales > 0
            ? (netPayout / combinedSales) * 100
            : null;
      }

      // Prep time from RPC summary
      const restoPrepSummary = prepTimeSummaryData?.find((h) => h.restaurant_id === resto.id);
      const prepTime = restoPrepSummary?.avg_prep_time ?? null;
      const totalDeliveryTime = restoPrepSummary?.avg_total_delivery_time ?? null;

      const restoAccuracy =
        accuracyData?.filter((a) => a.restaurant_id === resto.id) || [];
      const totalIncorrect = restoAccuracy.reduce(
        (sum, a) => sum + Number(a.incorrect_orders_count || 0),
        0
      );
      const errorRate = orders > 0 ? (totalIncorrect / orders) * 100 : null;

      // Availability from RPC summary
      const restoAvail = availabilityData?.find((a) => a.restaurant_id === resto.id);
      const totalOfflineMinutes = restoAvail?.total_offline_minutes || 0;
      const downtime = restoAvail ? totalOfflineMinutes / 60 : null;

      const revenueVariation =
        includeN1Comparison && prevRevenue > 0
          ? ((revenue - prevRevenue) / prevRevenue) * 100
          : null;
      const ordersVariation =
        includeN1Comparison && prevOrders > 0
          ? ((orders - prevOrders) / prevOrders) * 100
          : null;

      // Platform breakdown calculations
      const uberAvgBasket = uberOrders > 0 ? uberRevenue / uberOrders : 0;
      const deliverooAvgBasket = deliverooOrders > 0 ? deliverooRevenue / deliverooOrders : 0;

      // Uber profitability
      let uberProfitability: number | null = null;
      if (restoOrdersSummary) {
        const uberSalesVal = restoOrdersSummary.total_sales_incl_vat;
        const totalPromoVal = restoOrdersSummary.total_item_promo_incl_vat;
        const uberNetPayoutVal = restoOrdersSummary.total_net_payout + restoOrdersSummary.total_meal_voucher;
        const uberBase = profitabilityBase === "net" ? Math.max(0, uberSalesVal - totalPromoVal) : uberSalesVal;
        uberProfitability = uberBase > 0 ? (uberNetPayoutVal / uberBase) * 100 : null;
      }

      // Deliveroo profitability
      let delProfitability: number | null = null;
      if (deliverooRevenue > 0) {
        delProfitability = (deliverooNetPayout / deliverooRevenue) * 100;
      }

      const uberNetPayoutFinal = restoOrdersSummary
        ? restoOrdersSummary.total_net_payout + restoOrdersSummary.total_meal_voucher
        : 0;

      return {
        id: resto.id,
        name: resto.name,
        city: resto.city,
        revenue,
        orders,
        avgBasket,
        rating: rating != null ? parseFloat(rating.toFixed(2)) : null,
        profitability:
          profitability != null ? parseFloat(profitability.toFixed(1)) : null,
        prepTime: prepTime != null ? prepTime : null,
        totalDeliveryTime: totalDeliveryTime != null ? totalDeliveryTime : null,
        errorRate: errorRate != null ? parseFloat(errorRate.toFixed(2)) : null,
        downtime: downtime != null ? parseFloat(downtime.toFixed(1)) : null,
        netPayout: parseFloat(netPayout.toFixed(2)),
        prevRevenue: includeN1Comparison ? prevRevenue : undefined,
        prevOrders: includeN1Comparison ? prevOrders : undefined,
        revenueVariation:
          revenueVariation != null
            ? parseFloat(revenueVariation.toFixed(1))
            : null,
        ordersVariation:
          ordersVariation != null
            ? parseFloat(ordersVariation.toFixed(1))
            : null,
        platformBreakdown: {
          uber: {
            revenue: uberRevenue,
            orders: uberOrders,
            avgBasket: parseFloat(uberAvgBasket.toFixed(2)),
            netPayout: parseFloat(uberNetPayoutFinal.toFixed(2)),
            profitability: uberProfitability != null ? parseFloat(uberProfitability.toFixed(1)) : null,
          },
          deliveroo: {
            revenue: deliverooRevenue,
            orders: deliverooOrders,
            avgBasket: parseFloat(deliverooAvgBasket.toFixed(2)),
            netPayout: parseFloat(deliverooNetPayout.toFixed(2)),
            profitability: delProfitability != null ? parseFloat(delProfitability.toFixed(1)) : null,
          },
        },
      };
    });
  }, [
    restaurants,
    salesData,
    deliverooSummaryData,
    prevSalesData,
    reviewsData,
    ordersPayoutData,
    prepTimeSummaryData,
    accuracyData,
    availabilityData,
    profitabilityBase,
    includeN1Comparison,
  ]);

  // Calculate network totals
  const networkTotals = useMemo<NetworkTotals>(() => {
    const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0);
    const totalOrders = stats.reduce((sum, s) => sum + s.orders, 0);
    const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalNetPayout = stats.reduce((sum, s) => sum + s.netPayout, 0);

    const validRatings = stats.filter((s) => s.rating != null);
    const avgRating =
      validRatings.length > 0
        ? validRatings.reduce((sum, s) => sum + (s.rating ?? 0), 0) /
          validRatings.length
        : null;

    const validProfitability = stats.filter((s) => s.profitability != null);
    const avgProfitability =
      validProfitability.length > 0
        ? validProfitability.reduce((sum, s) => sum + (s.profitability ?? 0), 0) /
          validProfitability.length
        : null;

    const validPrepTimes = stats.filter((s) => s.prepTime != null);
    const avgPrepTime =
      validPrepTimes.length > 0
        ? validPrepTimes.reduce((sum, s) => sum + (s.prepTime ?? 0), 0) /
          validPrepTimes.length
        : null;

    const validTotalDeliveryTimes = stats.filter((s) => s.totalDeliveryTime != null);
    const avgTotalDeliveryTime =
      validTotalDeliveryTimes.length > 0
        ? validTotalDeliveryTimes.reduce((sum, s) => sum + (s.totalDeliveryTime ?? 0), 0) /
          validTotalDeliveryTimes.length
        : null;

    const validErrorRates = stats.filter((s) => s.errorRate != null);
    const avgErrorRate =
      validErrorRates.length > 0
        ? validErrorRates.reduce((sum, s) => sum + (s.errorRate ?? 0), 0) /
          validErrorRates.length
        : null;

    const validDowntimes = stats.filter((s) => s.downtime != null);
    const totalDowntime =
      validDowntimes.length > 0
        ? validDowntimes.reduce((sum, s) => sum + (s.downtime ?? 0), 0)
        : null;

    const prevTotalRevenue = includeN1Comparison
      ? stats.reduce((sum, s) => sum + (s.prevRevenue ?? 0), 0)
      : undefined;
    const prevTotalOrders = includeN1Comparison
      ? stats.reduce((sum, s) => sum + (s.prevOrders ?? 0), 0)
      : undefined;
    const revenueVariation =
      includeN1Comparison && prevTotalRevenue && prevTotalRevenue > 0
        ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
        : null;

    return {
      totalRevenue,
      totalOrders,
      avgBasket: parseFloat(avgBasket.toFixed(2)),
      totalNetPayout: parseFloat(totalNetPayout.toFixed(2)),
      avgRating: avgRating != null ? parseFloat(avgRating.toFixed(2)) : null,
      avgProfitability:
        avgProfitability != null
          ? parseFloat(avgProfitability.toFixed(1))
          : null,
      avgPrepTime: avgPrepTime != null ? avgPrepTime : null,
      avgTotalDeliveryTime: avgTotalDeliveryTime != null ? avgTotalDeliveryTime : null,
      avgErrorRate:
        avgErrorRate != null ? parseFloat(avgErrorRate.toFixed(2)) : null,
      totalDowntime:
        totalDowntime != null ? parseFloat(totalDowntime.toFixed(1)) : null,
      prevTotalRevenue,
      prevTotalOrders,
      revenueVariation:
        revenueVariation != null
          ? parseFloat(revenueVariation.toFixed(1))
          : null,
    };
  }, [stats, includeN1Comparison]);

  const isLoading =
    salesLoading ||
    deliverooLoading ||
    reviewsLoading ||
    ordersPayoutLoading ||
    historyLoading ||
    accuracyLoading ||
    availabilityLoading;

  return {
    stats,
    networkTotals,
    isLoading,
  };
}
