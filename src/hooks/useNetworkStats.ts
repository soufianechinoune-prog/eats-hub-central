import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";

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

/**
 * Centralized hook for fetching network-wide restaurant statistics
 * Uses the same data sources and formulas as individual comparison pages
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

  // Fetch restaurants info
  const { data: restaurantsRaw } = useQuery({
    queryKey: ["network-stats-restaurants", restaurantIds],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")
        .in("id", restaurantIds);
      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Filter restaurants to only those active during the selected period
  const restaurants = useMemo(() => {
    if (!restaurantsRaw) return [];
    return filterActiveRestaurants(restaurantsRaw, startDate, endDate);
  }, [restaurantsRaw, startDate, endDate]);

  // Fetch daily sales (CA & orders)
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["network-stats-sales", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      
      let allData: Array<{
        restaurant_id: string;
        revenue_ttc: number;
        order_count: number;
      }> = [];
      let offset = 0;
      let hasMore = true;
      const PAGE_SIZE = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from("daily_sales_uber_deduped")
          .select("restaurant_id, revenue_ttc, order_count")
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .in("restaurant_id", restaurantIds)
          .order("date", { ascending: true })
          .order("restaurant_id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch N-1 sales if requested
  const { data: prevSalesData } = useQuery({
    queryKey: ["network-stats-sales-prev", restaurantIds, prevStartDateStr, prevEndDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("daily_sales_uber_deduped")
        .select("restaurant_id, revenue_ttc, order_count")
        .gte("date", prevStartDateStr)
        .lte("date", prevEndDateStr)
        .in("restaurant_id", restaurantIds);

      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0 && includeN1Comparison,
  });

  // Fetch customer reviews for ratings
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["network-stats-reviews", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("customer_reviews")
        .select("restaurant_id, overall_rating")
        .gte("review_date", startDateStr)
        .lte("review_date", endDateStr)
        .in("restaurant_id", restaurantIds);

      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch orders for profitability (aligned with Finances page - uses order_datetime, not payout_date)
  const { data: ordersPayoutData, isLoading: ordersPayoutLoading } = useQuery({
    queryKey: ["network-stats-orders-payout", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      
      // Pagination to bypass 1000-row limit
      const PAGE_SIZE = 1000;
      let allData: Array<{
        restaurant_id: string;
        sales_incl_vat: number | null;
        net_payout: number | null;
        item_promo_incl_vat: number | null;
        meal_voucher_amount: number | null;
      }> = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("orders")
          .select("restaurant_id, sales_incl_vat, net_payout, item_promo_incl_vat, meal_voucher_amount")
          .gte("order_datetime", `${startDateStr}T00:00:00`)
          .lte("order_datetime", `${endDateStr}T23:59:59`)
          .in("restaurant_id", restaurantIds)
          .order("order_datetime", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        
        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === PAGE_SIZE;
          offset += PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch order history for prep times (paginated)
  const { data: orderHistoryData, isLoading: historyLoading } = useQuery({
    queryKey: ["network-stats-history", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      
      let allData: Array<{ 
        restaurant_id: string; 
        initial_prep_time_minutes: number | null;
        total_prep_delivery_time_minutes: number | null;
      }> = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: pageData, error } = await supabase
          .from("order_history")
          .select("restaurant_id, initial_prep_time_minutes, total_prep_delivery_time_minutes")
          .gte("order_datetime", startDate.toISOString())
          .lte("order_datetime", endDate.toISOString())
          .in("restaurant_id", restaurantIds)
          .order("order_datetime", { ascending: true })
          .order("restaurant_id", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (pageData && pageData.length > 0) {
          allData = [...allData, ...pageData];
          hasMore = pageData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
    enabled: restaurantIds.length > 0,
  });

  // Fetch order accuracy for error rate
  const { data: accuracyData, isLoading: accuracyLoading } = useQuery({
    queryKey: ["network-stats-accuracy", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      
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
    enabled: restaurantIds.length > 0,
  });

  // Fetch availability for downtime
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ["network-stats-availability", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("hourly_availability")
        .select("restaurant_id, offline_minutes")
        .gte("hour_start", startDate.toISOString())
        .lte("hour_start", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .range(0, 50000);

      if (error) throw error;
      return data || [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Calculate per-restaurant statistics
  const stats = useMemo<RestaurantNetworkStats[]>(() => {
    if (!restaurants?.length) return [];

    return restaurants.map((resto) => {
      // Sales metrics
      const restoSales = salesData?.filter((s) => s.restaurant_id === resto.id) || [];
      const revenue = restoSales.reduce((sum, s) => sum + Number(s.revenue_ttc || 0), 0);
      const orders = restoSales.reduce((sum, s) => sum + Number(s.order_count || 0), 0);
      const avgBasket = orders > 0 ? revenue / orders : 0;

      // N-1 Sales
      const restoPrevSales = prevSalesData?.filter((s) => s.restaurant_id === resto.id) || [];
      const prevRevenue = restoPrevSales.reduce((sum, s) => sum + Number(s.revenue_ttc || 0), 0);
      const prevOrders = restoPrevSales.reduce((sum, s) => sum + Number(s.order_count || 0), 0);

      // Rating (same formula as Overview.tsx line 427-429)
      const restoReviews = reviewsData?.filter((r) => r.restaurant_id === resto.id) || [];
      const rating =
        restoReviews.length > 0
          ? restoReviews.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) /
            restoReviews.length
          : null;

      // Profitability & Net Payout from orders (consistent with Finances page)
      const restoOrders = ordersPayoutData?.filter((o) => o.restaurant_id === resto.id) || [];
      let profitability: number | null = null;
      let netPayout = 0;
      
      if (restoOrders.length > 0) {
        const totalSales = restoOrders.reduce(
          (sum, o) => sum + Math.max(0, Number(o.sales_incl_vat || 0)),
          0
        );
        const totalPromo = restoOrders.reduce(
          (sum, o) => sum + Math.abs(Number(o.item_promo_incl_vat || 0)),
          0
        );
        const totalNetPayoutRaw = restoOrders.reduce(
          (sum, o) => sum + Number(o.net_payout || 0),
          0
        );
        const totalMealVoucher = restoOrders.reduce(
          (sum, o) => sum + Number(o.meal_voucher_amount || 0),
          0
        );
        
        // Versement net total = net_payout + meal_voucher
        netPayout = totalNetPayoutRaw + totalMealVoucher;

        const denominator =
          profitabilityBase === "net"
            ? Math.max(0, totalSales - totalPromo)
            : totalSales;

        profitability =
          denominator > 0
            ? (netPayout / denominator) * 100
            : null;
      }

      // Prep time (same formula as PrepTimeComparison.tsx line 84-86)
      const restoHistory =
        orderHistoryData?.filter((h) => h.restaurant_id === resto.id) || [];
      const validPrepTimes = restoHistory.filter(
        (h) => h.initial_prep_time_minutes != null
      );
      const prepTime =
        validPrepTimes.length > 0
          ? validPrepTimes.reduce(
              (sum, h) => sum + Number(h.initial_prep_time_minutes || 0),
              0
            ) / validPrepTimes.length
          : null;

      // Total delivery time (prep + delivery)
      const validTotalDelivery = restoHistory.filter(
        (h) => h.total_prep_delivery_time_minutes != null
      );
      const totalDeliveryTime =
        validTotalDelivery.length > 0
          ? validTotalDelivery.reduce(
              (sum, h) => sum + Number(h.total_prep_delivery_time_minutes || 0),
              0
            ) / validTotalDelivery.length
          : null;

      // Error rate (same formula as InaccurateOrdersComparison.tsx line 163-164)
      const restoAccuracy =
        accuracyData?.filter((a) => a.restaurant_id === resto.id) || [];
      const totalIncorrect = restoAccuracy.reduce(
        (sum, a) => sum + Number(a.incorrect_orders_count || 0),
        0
      );
      const errorRate = orders > 0 ? (totalIncorrect / orders) * 100 : null;

      // Downtime (same formula as DowntimeComparison.tsx line 82-83)
      const restoAvail =
        availabilityData?.filter((a) => a.restaurant_id === resto.id) || [];
      const totalOfflineMinutes = restoAvail.reduce(
        (sum, a) => sum + Number(a.offline_minutes || 0),
        0
      );
      // Show 0 if there's availability data but no downtime, null only if no data at all
      const downtime = restoAvail.length > 0 ? totalOfflineMinutes / 60 : null;

      // Variations
      const revenueVariation =
        includeN1Comparison && prevRevenue > 0
          ? ((revenue - prevRevenue) / prevRevenue) * 100
          : null;
      const ordersVariation =
        includeN1Comparison && prevOrders > 0
          ? ((orders - prevOrders) / prevOrders) * 100
          : null;

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
        // Keep full precision; UI formatting will handle rounding to seconds.
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
      };
    });
  }, [
    restaurants,
    salesData,
    prevSalesData,
    reviewsData,
    ordersPayoutData,
    orderHistoryData,
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

    // Average of non-null values
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

    // N-1 totals
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
       // Keep full precision; UI formatting will handle rounding to seconds.
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
