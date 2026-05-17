import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const PAGE_SIZE = 1000;
const RETRY_CONFIG = {
  retry: 1,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000),
};

// Helper: paginated fetch
async function fetchAllPages<T>(
  buildQuery: (offset: number) => any,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await buildQuery(offset);
    if (error) throw error;
    if (data && data.length > 0) {
      all.push(...data);
      hasMore = data.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return all;
}

// ===================== Individual hooks =====================

function useOverviewRestaurants(chainId: string | null) {
  return useQuery({
    queryKey: ["overview-restaurants", chainId],
    queryFn: async () => {
      // Charge tous les restaurants actifs de la marque (le filtre is_pinned a été retiré).
      let query = supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true);
      if (chainId) {
        query = query.eq("chain_id", chainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...RETRY_CONFIG,
  });
}

function useOverviewSales(
  restaurantIds: string[],
  startDateStr: string,
  endDateStr: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-sales", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase.rpc("get_network_orders_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });
      if (error) throw error;
      // Keep ALL fields from RPC so this cache can be shared with useNetworkStats
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        revenue_ttc: Number(d.total_sales_incl_vat),
        order_count: Number(d.order_count),
        total_sales_incl_vat: Number(d.total_sales_incl_vat),
        total_net_payout: Number(d.total_net_payout),
        total_item_promo_incl_vat: Number(d.total_item_promo_incl_vat),
        total_meal_voucher: Number(d.total_meal_voucher),
      }));
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

function useOverviewPayouts(
  restaurantIds: string[],
  startDateStr: string,
  endDateStr: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-payouts", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("restaurant_id, payout_date, sales_incl_vat, net_payout, order_count")
        .gte("payout_date", startDateStr)
        .lte("payout_date", endDateStr)
        .in("restaurant_id", restaurantIds);
      if (error) throw error;
      return data || [];
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

function useOverviewReviews(
  restaurantIds: string[],
  startDateStr: string,
  endDateStr: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-reviews", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await supabase.rpc("get_network_ratings_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        avg_rating: Number(d.avg_rating),
        review_count: Number(d.review_count),
        platform: d.platform,
      }));
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

function useOverviewAccuracy(
  restaurantIds: string[],
  startDateStr: string,
  endDateStr: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-accuracy", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_order_accuracy")
        .select("*")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds)
        .eq("period_type", "current")
        .range(0, 10000);
      if (error) throw error;
      return data || [];
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

// Prep times via RPC (replaces paginated order_history fetch)
function useOverviewPrepTimes(
  restaurantIds: string[],
  startDate: Date,
  endDate: Date,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-prep-times", restaurantIds, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_network_prep_time_summary", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        avg_prep_time: d.avg_prep_time != null ? Number(d.avg_prep_time) : null,
        avg_avoidable_wait_time: d.avg_avoidable_wait_time != null ? Number(d.avg_avoidable_wait_time) : null,
        prep_count: Number(d.prep_count),
        avoidable_wait_count: Number(d.avoidable_wait_count),
      }));
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

// Availability via RPC (replaces paginated hourly_availability fetch)
function useOverviewAvailability(
  restaurantIds: string[],
  startDate: Date,
  endDate: Date,
  enabled: boolean,
) {
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(endDate, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["overview-availability", restaurantIds, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability_by_restaurant", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_restaurant_ids: restaurantIds,
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        total_online_minutes: Number(d.total_online_minutes),
        total_offline_minutes: Number(d.total_offline_minutes),
      }));
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

function useOverviewProducts(
  restaurantIds: string[],
  startDate: Date,
  endDate: Date,
  startDateStr: string,
  endDateStr: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-products", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      // Menu item reviews for top/flop products
      const { data: menuReviewsData, error: menuReviewsError } = await supabase
        .from("menu_item_reviews")
        .select("restaurant_id, rating, thumb_up, thumb_down, item_title, platform")
        .gte("review_date", startDate.toISOString())
        .lte("review_date", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .range(0, 50000);

      if (menuReviewsError) throw menuReviewsError;

      // Best selling products via RPC
      const { data: orderItemsData, error: orderItemsError } = await supabase.rpc(
        "get_product_sales_for_period",
        {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_restaurant_ids: restaurantIds,
        },
      );
      if (orderItemsError) throw orderItemsError;

      return {
        menuReviews: menuReviewsData || [],
        orderItems: (orderItemsData || []).map((d: any) => ({
          item_title: d.item_title,
          quantity: Number(d.total_quantity),
        })),
      };
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

// Deliveroo sales via RPC (replaces paginated deliveroo_orders fetch)
function useOverviewDeliverooSales(
  restaurantIds: string[],
  startDateStr: string,
  endDateStr: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-deliveroo-sales", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
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
    enabled,
    ...RETRY_CONFIG,
  });
}

function useOverviewConversion(
  restaurantIds: string[],
  startDateStr: string,
  endDateStr: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-conversion", restaurantIds, startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_conversion")
        .select("restaurant_id, visits, menu_views, add_to_cart, orders, date")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds)
        .range(0, 10000);
      if (error) throw error;
      return data || [];
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

function useOverviewErrors(
  restaurantIds: string[],
  startDate: Date,
  endDate: Date,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["overview-errors", restaurantIds, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_errors")
        .select("restaurant_id, error_date, financial_impact, uber_order_id")
        .gte("error_date", startDate.toISOString())
        .lte("error_date", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .range(0, 10000);
      if (error) throw error;
      return data || [];
    },
    enabled,
    ...RETRY_CONFIG,
  });
}

// ===================== Main composite hook =====================

export interface OverviewData {
  global: {
    rating: number | null;
    prepTime: number | null;
    errorRate: number | null;
    incorrectOrderRate: number | null;
    profitability: number | null;
    downtime: number | null;
    productApprovalRate: number | null;
  };
  uber: {
    rating: number | null;
    prepTime: number | null;
    errorRate: number | null;
    incorrectOrderRate: number | null;
    profitability: number | null;
    downtime: number | null;
  };
  deliveroo: {
    rating: number | null;
    prepTime: number | null;
    errorRate: number | null;
    incorrectOrderRate: number | null;
    profitability: number | null;
    downtime: number | null;
  };
  topByRating: any[];
  flopByRating: any[];
  topByRevenue: any[];
  flopByRevenue: any[];
  topByProfitability: any[];
  flopByProfitability: any[];
  topByConversion: any[];
  flopByConversion: any[];
  topProducts: any[];
  bestSellingProducts: any[];
  totalRestaurants: number;
  hasData: boolean;
}

export function useOverviewData(
  startDate: Date,
  endDate: Date,
  startDateStr: string,
  endDateStr: string,
  filterRestaurantIds?: string[],
  chainId?: string | null,
) {
  // Wave 1: Restaurants (immediate) — use provided IDs if available, otherwise fetch pinned
  const restaurants = useOverviewRestaurants(chainId ?? null);
  const restaurantIds = filterRestaurantIds && filterRestaurantIds.length > 0
    ? filterRestaurantIds
    : (restaurants.data?.map((r) => r.id) || []);
  const hasIds = restaurantIds.length > 0;

  // Wave 1b: Sales + Payouts + Deliveroo Sales (as soon as we have IDs)
  const sales = useOverviewSales(restaurantIds, startDateStr, endDateStr, hasIds);
  const payouts = useOverviewPayouts(restaurantIds, startDateStr, endDateStr, hasIds);
  const deliverooSales = useOverviewDeliverooSales(restaurantIds, startDateStr, endDateStr, hasIds);

  // All remaining queries in parallel (no wave dependencies needed)
  const reviews = useOverviewReviews(restaurantIds, startDateStr, endDateStr, hasIds);
  const accuracy = useOverviewAccuracy(restaurantIds, startDateStr, endDateStr, hasIds);
  const errors = useOverviewErrors(restaurantIds, startDate, endDate, hasIds);
  const prepTimes = useOverviewPrepTimes(restaurantIds, startDate, endDate, hasIds);
  const availability = useOverviewAvailability(restaurantIds, startDate, endDate, hasIds);
  const products = useOverviewProducts(restaurantIds, startDate, endDate, startDateStr, endDateStr, hasIds);
  const conversion = useOverviewConversion(restaurantIds, startDateStr, endDateStr, hasIds);

  // Compute aggregated data
  const computedData = (): OverviewData | null => {
    if (!restaurants.data || !sales.data) return null;

    const dailySalesData = sales.data || [];
    const payoutsData = payouts.data || [];
    const reviewsData = reviews.data || [];
    const accuracyData = accuracy.data || [];
    const errorsData = errors.data || [];
    const prepTimesData = prepTimes.data || [];
    const availabilityData = availability.data || [];
    const menuReviewsData = products.data?.menuReviews || [];
    const orderItemsData = products.data?.orderItems || [];
    const conversionData = conversion.data || [];
    const restos = filterRestaurantIds && filterRestaurantIds.length > 0
      ? restaurants.data.filter(r => filterRestaurantIds.includes(r.id))
      : restaurants.data;

    const totalRevenue = dailySalesData.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0);
    const totalOrders = dailySalesData.reduce((sum, d) => sum + Number(d.order_count || 0), 0);

    // Avg rating from RPC aggregates (weighted by review_count)
    const totalRatingSum = reviewsData.reduce((sum, r: any) => sum + r.avg_rating * r.review_count, 0);
    const totalReviewCount = reviewsData.reduce((sum, r: any) => sum + r.review_count, 0);
    const avgRating = totalReviewCount > 0 ? totalRatingSum / totalReviewCount : null;

    // Global avg prep time from RPC summary (weighted by prep_count)
    const totalPrepSum = prepTimesData.reduce((sum: number, d: any) => {
      return d.avg_prep_time != null ? sum + d.avg_prep_time * d.prep_count : sum;
    }, 0);
    const totalPrepCount = prepTimesData.reduce((sum: number, d: any) => sum + (d.prep_count || 0), 0);
    const avgPrepTime = totalPrepCount > 0 ? totalPrepSum / totalPrepCount : null;

    const totalErrors = errorsData.length;
    const errorRate = totalOrders > 0 ? (totalErrors / totalOrders) * 100 : null;

    const totalIncorrectOrders = accuracyData.reduce((sum, a: any) => sum + Number(a.incorrect_orders_count || 0), 0);

    let incorrectOrderRate: number | null = null;
    if (totalIncorrectOrders > 0 && totalOrders > 0) {
      incorrectOrderRate = (totalIncorrectOrders / totalOrders) * 100;
    } else if (errorsData.length > 0 && totalOrders > 0) {
      const distinctErrorOrderIds = new Set(
        errorsData.map((e: any) => e.uber_order_id).filter(Boolean)
      );
      incorrectOrderRate = (distinctErrorOrderIds.size / totalOrders) * 100;
    }

    const productApprovalRate = menuReviewsData.length > 0
      ? (menuReviewsData.filter((r: any) => r.thumb_up === 1).length / menuReviewsData.length) * 100
      : null;

    // Availability from RPC summary
    const totalOfflineMinutes = availabilityData.reduce((sum, a: any) => sum + Number(a.total_offline_minutes || 0), 0);
    const downtimeHours = totalOfflineMinutes > 0 ? Math.round(totalOfflineMinutes / 6) / 10 : null;

    // Per-restaurant availability rate (simple average across restaurants with data)
    const perRestoRates = availabilityData
      .map((a: any) => {
        const online = Number(a.total_online_minutes || 0);
        const offline = Number(a.total_offline_minutes || 0);
        const total = online + offline;
        return total > 0 ? (online / total) * 100 : null;
      })
      .filter((r: number | null): r is number => r != null);
    const availabilityRate = perRestoRates.length > 0
      ? parseFloat((perRestoRates.reduce((s, r) => s + r, 0) / perRestoRates.length).toFixed(1))
      : null;

    // Uber-specific availability (not available from per-restaurant RPC without platform filter — use total for now)
    const uberDowntimeHours = downtimeHours; // TODO: add platform filter to RPC if needed
    const uberAvailabilityRate = availabilityRate;

    const totalPayoutSales = payoutsData.reduce((sum, p: any) => sum + Number(p.sales_incl_vat || 0), 0);
    const totalNetPayout = payoutsData.reduce((sum, p: any) => sum + Number(p.net_payout || 0), 0);
    const uberProfitability = totalPayoutSales > 0 ? (totalNetPayout / totalPayoutSales) * 100 : null;

    // Deliveroo financial metrics from RPC summary
    const deliverooData = deliverooSales.data || [];
    const deliverooRevenue = deliverooData.reduce((sum, d: any) => sum + Number(d.total_revenue || 0), 0);
    const deliverooNetPayout = deliverooData.reduce((sum, d: any) => sum + Number(d.total_payable || 0), 0);
    const deliverooOrderCount = deliverooData.reduce((sum, d: any) => sum + Number(d.order_count || 0), 0);
    const deliverooProfitability = deliverooRevenue > 0 ? (deliverooNetPayout / deliverooRevenue) * 100 : null;

    // Global profitability (weighted Uber + Deliveroo)
    const globalSales = totalPayoutSales + deliverooRevenue;
    const globalPayout = totalNetPayout + deliverooNetPayout;
    const globalProfitability = globalSales > 0 ? (globalPayout / globalSales) * 100 : null;

    // Per-restaurant metrics
    const restaurantMetrics = restos.map((resto) => {
      // Revenue from aggregated RPC (one row per restaurant)
      const restoSales = dailySalesData.find((d) => d.restaurant_id === resto.id);
      const restoReviewAggs = reviewsData.filter((r: any) => r.restaurant_id === resto.id);
      const restoErrors = errorsData.filter((e: any) => e.restaurant_id === resto.id);
      const restoPayouts = payoutsData.filter((p: any) => p.restaurant_id === resto.id);

      const revenue = restoSales?.revenue_ttc || 0;
      const orders = restoSales?.order_count || 0;
      const restoReviewSum = restoReviewAggs.reduce((s, r: any) => s + r.avg_rating * r.review_count, 0);
      const restoReviewTotal = restoReviewAggs.reduce((s, r: any) => s + r.review_count, 0);
      const rating = restoReviewTotal > 0 ? restoReviewSum / restoReviewTotal : null;

      // Prep time from RPC summary
      const restoPrepSummary = prepTimesData.find((h: any) => h.restaurant_id === resto.id);
      const prepTime = restoPrepSummary?.avg_prep_time ?? null;

      const restoErrorRate = orders > 0 ? (restoErrors.length / orders) * 100 : null;
      const restoPayoutSales = restoPayouts.reduce((sum, p: any) => sum + Number(p.sales_incl_vat || 0), 0);
      const restoNetPayout = restoPayouts.reduce((sum, p: any) => sum + Number(p.net_payout || 0), 0);
      const profitability = restoPayoutSales > 0 ? (restoNetPayout / restoPayoutSales) * 100 : null;

      return {
        id: resto.id,
        name: resto.name,
        city: resto.city,
        rating: rating != null ? parseFloat(rating.toFixed(1)) : null,
        reviewCount: restoReviewTotal,
        prepTime: prepTime != null ? Math.round(prepTime) : null,
        errorRate: restoErrorRate != null ? parseFloat(restoErrorRate.toFixed(1)) : null,
        profitability,
        revenue,
        salesRows: restoSales ? 1 : 0,
      };
    });

    // Rankings
    const withRatings = restaurantMetrics.filter((r) => r.rating != null);
    const sortedByRating = [...withRatings].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const topByRating = sortedByRating.slice(0, 5);
    const flopByRating = sortedByRating.slice(-5).reverse();

    const sortedByRevenue = [...restaurantMetrics].sort((a, b) => b.revenue - a.revenue);
    const topByRevenue = sortedByRevenue.slice(0, 5);
    const flopByRevenue = sortedByRevenue.slice(-5).reverse();

    const withProfitability = restaurantMetrics.filter((r) => r.profitability != null);
    const sortedByProfitability = [...withProfitability].sort((a, b) => (b.profitability ?? 0) - (a.profitability ?? 0));
    const topByProfitability = sortedByProfitability.slice(0, 5);
    const flopByProfitability = sortedByProfitability.slice(-5).reverse();

    // Conversion ranking
    const conversionMetrics = restos
      .map((resto) => {
        const restoConv = conversionData.filter((c: any) => c.restaurant_id === resto.id);
        const visits = restoConv.reduce((sum, c: any) => sum + (c.visits || 0), 0);
        const orders = restoConv.reduce((sum, c: any) => sum + (c.orders || 0), 0);
        const conversionRate = visits > 0 ? (orders / visits) * 100 : 0;
        return { id: resto.id, name: resto.name, city: resto.city, visits, orders, conversionRate: parseFloat(conversionRate.toFixed(2)) };
      })
      .filter((r) => r.visits > 0);

    const sortedByConversion = [...conversionMetrics].sort((a, b) => b.conversionRate - a.conversionRate);
    const topByConversion = sortedByConversion.slice(0, 5);
    const flopByConversion = sortedByConversion.slice(-5).reverse();

    // Platform-specific: sales data is Uber-only (from get_network_orders_summary on orders table)
    const uberOrders = totalOrders; // orders table = Uber only
    const uberReviewAggs = reviewsData.filter((r: any) => r.platform === "uber_eats");
    const uberRatingSum = uberReviewAggs.reduce((s, r: any) => s + r.avg_rating * r.review_count, 0);
    const uberReviewCount = uberReviewAggs.reduce((s, r: any) => s + r.review_count, 0);
    const uberRating = uberReviewCount > 0 ? uberRatingSum / uberReviewCount : null;
    
    // Uber prep time = global prep time (order_history is Uber-only)
    const uberPrepTime = avgPrepTime;

    const deliverooReviewAggs = reviewsData.filter((r: any) => r.platform === "deliveroo");
    const deliverooRatingSum = deliverooReviewAggs.reduce((s, r: any) => s + r.avg_rating * r.review_count, 0);
    const deliverooReviewCount = deliverooReviewAggs.reduce((s, r: any) => s + r.review_count, 0);
    const deliverooRating = deliverooReviewCount > 0 ? deliverooRatingSum / deliverooReviewCount : null;

    // Top/flop products
    const topProducts = (() => {
      const productMap = new Map<string, { title: string; thumbsUp: number; thumbsDown: number }>();
      menuReviewsData.forEach((review: any) => {
        const title = review.item_title?.trim() || "Unknown";
        const key = title.toLowerCase();
        if (!productMap.has(key)) productMap.set(key, { title, thumbsUp: 0, thumbsDown: 0 });
        const prod = productMap.get(key)!;
        prod.thumbsUp += review.thumb_up || 0;
        prod.thumbsDown += review.thumb_down || 0;
      });
      const MIN_REVIEWS_THRESHOLD = 5;
      return Array.from(productMap.values())
        .filter((p) => p.thumbsUp + p.thumbsDown >= MIN_REVIEWS_THRESHOLD)
        .filter((p) => !p.title.toLowerCase().includes("article inconnu"))
        .filter((p) => !p.title.toLowerCase().includes("unknown item"))
        .map((p) => {
          const total = p.thumbsUp + p.thumbsDown;
          return { name: p.title, rating: `${Math.round((p.thumbsUp / total) * 100)}%`, reviews: total, approvalRate: Math.round((p.thumbsUp / total) * 100) };
        })
        .sort((a, b) => b.approvalRate - a.approvalRate)
        .slice(0, 5);
    })();

    const bestSellingProducts = (() => {
      return orderItemsData
        .filter((p: any) => p.quantity > 0)
        .filter((p: any) => !p.item_title?.toLowerCase().includes("article inconnu"))
        .filter((p: any) => !p.item_title?.toLowerCase().includes("unknown item"))
        .filter((p: any) => !p.item_title?.toLowerCase().includes("unknown"))
        .slice(0, 5)
        .map((p: any) => ({ name: p.item_title, quantity: p.quantity }));
    })();

    return {
      global: {
        rating: avgRating,
        prepTime: avgPrepTime != null ? Math.round(avgPrepTime) : null,
        errorRate,
        incorrectOrderRate,
        profitability: globalProfitability,
        downtime: downtimeHours,
        productApprovalRate,
      },
      uber: {
        rating: uberRating,
        prepTime: uberPrepTime != null ? Math.round(uberPrepTime) : null,
        errorRate: uberOrders > 0 ? (errorsData.length / uberOrders) * 100 : null,
        incorrectOrderRate,
        profitability: uberProfitability,
        downtime: uberDowntimeHours,
      },
      deliveroo: {
        rating: deliverooRating,
        prepTime: null,
        errorRate: null,
        incorrectOrderRate: null,
        profitability: deliverooProfitability,
        downtime: null,
      },
      topByRating,
      flopByRating,
      topByRevenue,
      flopByRevenue,
      topByProfitability,
      flopByProfitability,
      topByConversion,
      flopByConversion,
      topProducts,
      bestSellingProducts,
      totalRestaurants: restos.length,
      hasData: dailySalesData.length > 0 || reviewsData.length > 0,
    };
  };

  const data = computedData();

  // Loading states
  const wave1Loading = restaurants.isLoading || sales.isLoading || deliverooSales.isLoading;
  const wave2Loading = reviews.isLoading || accuracy.isLoading || errors.isLoading;
  const wave3Loading = prepTimes.isLoading || availability.isLoading;
  const wave4Loading = products.isLoading || conversion.isLoading;
  const isFullyLoaded = !wave1Loading && !wave2Loading && !wave3Loading && !wave4Loading;

  // Any critical error (wave 1)
  const criticalError = restaurants.error || sales.error;

  return {
    data,
    restaurants: restaurants.data,
    reviewsData: reviews.data || [],
    isLoading: wave1Loading,
    isFullyLoaded,
    wave1Loading,
    wave2Loading,
    wave3Loading,
    wave4Loading,
    criticalError,
    // For invalidation
    queryKeys: [
      ["overview-restaurants"],
      ["overview-sales"],
      ["overview-payouts"],
      ["overview-deliveroo-sales"],
      ["overview-reviews"],
      ["overview-accuracy"],
      ["overview-errors"],
      ["overview-prep-times"],
      ["overview-availability"],
      ["overview-products"],
      ["overview-conversion"],
    ],
  };
}
