import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format } from "date-fns";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";

export interface PlatformBreakdown {
  revenue: number;
  orders: number;
  avgBasket: number;
  netPayout: number;
  mealVoucher: number;
  profitability: number | null;
  negotiatedCofinancement?: number;
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
  mealVoucher: number; // Titres-restaurant Uber uniquement
  // Quality metrics
  rating: number | null;
  profitability: number | null;
  // Cofinancement marketing négocié (versé par Uber au niveau du payout hebdo, hors commandes)
  negotiatedCofinancement: number;
  // Operations metrics
  prepTime: number | null;
  totalDeliveryTime: number | null; // Temps prépa+livraison moyen
  errorRate: number | null;
  downtime: number | null;
  availabilityRate: number | null;
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
  totalMealVoucher: number;
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
  reviewsData?: any[] | null;
}

const RETRY_CONFIG = {
  retry: 1,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),
  staleTime: 5 * 60 * 1000,
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
  reviewsData: externalReviewsData = null,
}: UseNetworkStatsParams) {
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(endDate, "yyyy-MM-dd");

  // Calculate N-1 date range
  const prevStartDate = new Date(startDate);
  prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
  const prevEndDate = new Date(endDate);
  prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
  const prevStartDateStr = format(prevStartDate, "yyyy-MM-dd");
  const prevEndDateStr = format(prevEndDate, "yyyy-MM-dd");

  const hasIds = restaurantIds.length > 0;

  // ═══════════════════════════════════════════════
  // WAVE 1: Restaurants + Deliveroo RPC (lightweight)
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

  // Deliveroo sales via RPC — shared cache key with useOverviewData
  const { data: deliverooSummaryData, isLoading: deliverooLoading } = useQuery({
    queryKey: ["overview-deliveroo-sales", restaurantIds, startDateStr, endDateStr],
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

  // Negotiated marketing cofinancement (payout-level adjustments, hors commandes)
  const { data: negotiatedCofinData } = useQuery({
    queryKey: ["network-stats-negotiated-cofin", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [] as { restaurant_id: string; amount: number }[];
      const { data, error } = await supabase
        .from("payout_adjustments")
        .select("restaurant_id, amount")
        .eq("category", "marketing_adjustment")
        .in("restaurant_id", restaurantIds)
        .gte("payout_date", startDateStr)
        .lte("payout_date", endDateStr);
      if (error) throw error;
      const byResto = new Map<string, number>();
      for (const row of data || []) {
        if (!row.restaurant_id) continue;
        byResto.set(row.restaurant_id, (byResto.get(row.restaurant_id) || 0) + Number(row.amount || 0));
      }
      return Array.from(byResto.entries()).map(([restaurant_id, amount]) => ({ restaurant_id, amount }));
    },
    enabled: hasIds,
    ...RETRY_CONFIG,
  });

  // N-1 sales via aggregated RPC (no row limit issue)
  const { data: prevSalesData } = useQuery({
    queryKey: ["network-stats-sales-prev", restaurantIds, prevStartDateStr, prevEndDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase.rpc("get_network_orders_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: prevStartDateStr,
        p_end_date: prevEndDateStr,
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        total_sales_incl_vat: Number(d.total_sales_incl_vat),
        order_count: Number(d.order_count),
      }));
    },
    enabled: hasIds && includeN1Comparison,
    ...RETRY_CONFIG,
  });

  // Wave 1 is done when restaurants are loaded
  const wave1Done = !!restaurantsRaw;

  // ═══════════════════════════════════════════════
  // WAVE 2: Reviews + Accuracy + Orders payout (wait for wave 1)
  // ═══════════════════════════════════════════════

  // Reviews data comes from useOverviewData via props (no duplicate fetch)
  const reviewsData = externalReviewsData || [];

  const { data: accuracyData, isLoading: accuracyLoading } = useQuery({
    queryKey: ["overview-accuracy", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase
        .from("daily_order_accuracy")
        .select("*")
        .eq("period_type", "current")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds)
        .range(0, 10000);
      if (error) throw error;
      return data || [];
    },
    enabled: hasIds && wave1Done,
    ...RETRY_CONFIG,
  });

  // Orders payout via RPC — shared cache key with useOverviewData (overview-sales)
  const { data: ordersPayoutData, isLoading: ordersPayoutLoading } = useQuery({
    queryKey: ["overview-sales", restaurantIds, startDateStr, endDateStr],
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
    enabled: hasIds && wave1Done,
    ...RETRY_CONFIG,
  });

  // Wave 2 is done when reviews, accuracy and orders payout are loaded
  const wave2Done = !!reviewsData && !!accuracyData && !!ordersPayoutData;

  // ═══════════════════════════════════════════════
  // WAVE 3: Prep time RPC + Availability RPC (wait for wave 2)
  // ═══════════════════════════════════════════════

  const { data: prepTimeSummaryData, isLoading: historyLoading } = useQuery({
    queryKey: ["overview-prep-times", restaurantIds, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!hasIds) return [];
      const { data, error } = await supabase.rpc("get_network_prep_time_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDateStr,
        p_end_date: endDateStr,
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
    enabled: hasIds && wave2Done,
    ...RETRY_CONFIG,
  });

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ["overview-availability", restaurantIds, startDate.toISOString(), endDate.toISOString()],
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
        total_online_minutes: Number(d.total_online_minutes || 0),
        total_offline_minutes: Number(d.total_offline_minutes),
      }));
    },
    enabled: hasIds && wave2Done,
    ...RETRY_CONFIG,
  });

  // ═══════════════════════════════════════════════
  // CALCULATION: Per-restaurant statistics
  // ═══════════════════════════════════════════════

  const stats = useMemo<RestaurantNetworkStats[]>(() => {
    if (!restaurants?.length) return [];

    return restaurants.map((resto) => {
      // Uber data from orders payout RPC (replaces salesData)
      const restoOrdersSummary = ordersPayoutData?.find((o) => o.restaurant_id === resto.id);
      const uberRevenue = restoOrdersSummary?.total_sales_incl_vat || 0;
      const uberOrders = restoOrdersSummary?.order_count || 0;

      // Deliveroo data from RPC summary
      const restoDeliveroo = deliverooSummaryData?.find((d) => d.restaurant_id === resto.id);
      const deliverooRevenue = restoDeliveroo?.total_revenue || 0;
      const deliverooOrders = restoDeliveroo?.order_count || 0;
      const deliverooNetPayout = restoDeliveroo?.total_payable || 0;

      // Combined metrics
      const revenue = uberRevenue + deliverooRevenue;
      const orders = uberOrders + deliverooOrders;
      const avgBasket = orders > 0 ? revenue / orders : 0;

      // N-1 comparison from aggregated RPC
      const restoPrevSales = prevSalesData?.find((s) => s.restaurant_id === resto.id);
      const prevRevenue = restoPrevSales?.total_sales_incl_vat || 0;
      const prevOrders = restoPrevSales?.order_count || 0;

      const restoReviewAggs = reviewsData?.filter((r) => r.restaurant_id === resto.id) || [];
      const restoRatingSum = restoReviewAggs.reduce((s, r: any) => s + (r.avg_rating || 0) * (r.review_count || 0), 0);
      const restoReviewTotal = restoReviewAggs.reduce((s, r: any) => s + (r.review_count || 0), 0);
      const rating = restoReviewTotal > 0 ? restoRatingSum / restoReviewTotal : null;

      // Negotiated cofinancement (versé par Uber au niveau du payout, hors commandes)
      const negotiatedCofin = negotiatedCofinData?.find((c) => c.restaurant_id === resto.id)?.amount || 0;

      // Profitability from orders payout RPC
      let profitability: number | null = null;
      let netPayout = 0;
      
      if (restoOrdersSummary || restoDeliveroo) {
        // Uber part
        const uberSales = restoOrdersSummary?.total_sales_incl_vat || 0;
        const totalPromo = restoOrdersSummary?.total_item_promo_incl_vat || 0;
        const totalNetPayoutRaw = restoOrdersSummary?.total_net_payout || 0;
        const totalMealVoucher = restoOrdersSummary?.total_meal_voucher || 0;
        // Cofin négocié inclus dans le versement Uber → impacte la Marge Uber
        const uberNetPayout = totalNetPayoutRaw + totalMealVoucher + negotiatedCofin;
        
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

      // Uber profitability (inclut cofin négocié)
      let uberProfitability: number | null = null;
      if (restoOrdersSummary) {
        const uberSalesVal = restoOrdersSummary.total_sales_incl_vat;
        const totalPromoVal = restoOrdersSummary.total_item_promo_incl_vat;
        const uberNetPayoutVal = restoOrdersSummary.total_net_payout + restoOrdersSummary.total_meal_voucher + negotiatedCofin;
        const uberBase = profitabilityBase === "net" ? Math.max(0, uberSalesVal - totalPromoVal) : uberSalesVal;
        uberProfitability = uberBase > 0 ? (uberNetPayoutVal / uberBase) * 100 : null;
      }

      // Deliveroo profitability
      let delProfitability: number | null = null;
      if (deliverooRevenue > 0) {
        delProfitability = (deliverooNetPayout / deliverooRevenue) * 100;
      }

      const uberNetPayoutFinal = restoOrdersSummary
        ? restoOrdersSummary.total_net_payout + restoOrdersSummary.total_meal_voucher + negotiatedCofin
        : negotiatedCofin;

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
        negotiatedCofinancement: parseFloat(negotiatedCofin.toFixed(2)),
        prepTime: prepTime != null ? prepTime : null,
        totalDeliveryTime: totalDeliveryTime != null ? totalDeliveryTime : null,
        errorRate: errorRate != null ? parseFloat(errorRate.toFixed(2)) : null,
        downtime: downtime != null ? parseFloat(downtime.toFixed(1)) : null,
        netPayout: parseFloat(netPayout.toFixed(2)),
        mealVoucher: restoOrdersSummary ? parseFloat((restoOrdersSummary.total_meal_voucher || 0).toFixed(2)) : 0,
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
            mealVoucher: restoOrdersSummary ? parseFloat((restoOrdersSummary.total_meal_voucher || 0).toFixed(2)) : 0,
            profitability: uberProfitability != null ? parseFloat(uberProfitability.toFixed(1)) : null,
            negotiatedCofinancement: parseFloat(negotiatedCofin.toFixed(2)),
          },
          deliveroo: {
            revenue: deliverooRevenue,
            orders: deliverooOrders,
            avgBasket: parseFloat(deliverooAvgBasket.toFixed(2)),
            netPayout: parseFloat(deliverooNetPayout.toFixed(2)),
            mealVoucher: 0,
            profitability: delProfitability != null ? parseFloat(delProfitability.toFixed(1)) : null,
          },
        },
      };
    });
  }, [
    restaurants,
    deliverooSummaryData,
    prevSalesData,
    reviewsData,
    ordersPayoutData,
    negotiatedCofinData,
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
    const totalMealVoucher = stats.reduce((sum, s) => sum + s.mealVoucher, 0);

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
      totalMealVoucher: parseFloat(totalMealVoucher.toFixed(2)),
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
    deliverooLoading ||
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
