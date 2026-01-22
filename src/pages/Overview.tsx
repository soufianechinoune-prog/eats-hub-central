import { useState, useMemo } from "react";
import { subWeeks, startOfWeek, endOfWeek, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext, PeriodMode } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Clock, TrendingDown, Percent, PauseCircle, Award, FileDown, FileSpreadsheet, ChevronRight, RefreshCw } from "lucide-react";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOverviewExport } from "@/hooks/useOverviewExport";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { RestaurantComparisonTable } from "@/components/overview/RestaurantComparisonTable";
import { useNetworkStats } from "@/hooks/useNetworkStats";
// Build timestamp for cache verification
const BUILD_TIMESTAMP = new Date().toISOString();
// Formater les minutes en "X min Y s" (ex: 4.5 → "4 min 30 s")
const formatMinutesToTime = (minutes: number | null | undefined): string | null => {
  if (minutes == null || isNaN(minutes)) return null;
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins} min ${secs} s`;
};

// Formater les heures en "Xh Ymin" pour le temps d'inactivité (ex: 4.5 → "4h 30min")
const formatHoursToTime = (hours: number | null | undefined): string | null => {
  if (hours == null || isNaN(hours)) return null;
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (h === 0) return `${mins}min`;
  if (mins === 0) return `${h}h`;
  return `${h}h ${mins}min`;
};

const Overview = () => {
  const defaultPeriodMode: OverviewPeriodMode = "previous_week";
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>(defaultPeriodMode);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showN1Comparison, setShowN1Comparison] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { exportComprehensivePdf, exportComprehensiveExcel, isExporting } = useOverviewExport();
  
  // Analytics context for navigation to Finances
  const {
    setSelectedRestaurants,
    setVisibleRestaurants,
    setPeriodMode: setAnalyticsPeriodMode,
    setSelectedYear: setAnalyticsYear,
    setSelectedMonth: setAnalyticsMonth,
    setDateRange: setAnalyticsDateRange,
  } = useAnalyticsContext();

  // Navigate to Finances & Frais with restaurant and period pre-selected
  const navigateToFinances = (restaurantId: string) => {
    // Select only this restaurant
    setSelectedRestaurants([restaurantId]);
    setVisibleRestaurants([restaurantId]);
    
    // Map Overview periodMode to Analytics periodMode
    const analyticsMode: PeriodMode = 
      periodMode === "previous_week" ? "previous_week" :
      periodMode === "7d" ? "7d" :
      periodMode === "30d" ? "30d" :
      periodMode === "current_month" ? "current_month" :
      periodMode === "year" ? "year" :
      periodMode === "custom_month" ? "month" :
      periodMode === "custom_range" ? "range" : "previous_week";
    
    setAnalyticsPeriodMode(analyticsMode);
    setAnalyticsYear(selectedYear);
    setAnalyticsMonth(selectedMonth);
    
    if (dateRange) {
      setAnalyticsDateRange(dateRange);
    }
    
    // Navigate to Finances tab
    navigate("/analytics/finances");
  };

  // Navigate to Finances & Frais globally (all restaurants) with period pre-selected
  const navigateToFinancesGlobal = () => {
    // Map Overview periodMode to Analytics periodMode
    const analyticsMode: PeriodMode = 
      periodMode === "previous_week" ? "previous_week" :
      periodMode === "7d" ? "7d" :
      periodMode === "30d" ? "30d" :
      periodMode === "current_month" ? "current_month" :
      periodMode === "year" ? "year" :
      periodMode === "custom_month" ? "month" :
      periodMode === "custom_range" ? "range" : "previous_week";
    
    setAnalyticsPeriodMode(analyticsMode);
    setAnalyticsYear(selectedYear);
    setAnalyticsMonth(selectedMonth);
    
    if (dateRange) {
      setAnalyticsDateRange(dateRange);
    }
    
    // Navigate to Finances tab
    navigate("/analytics/finances");
  };

  const isCustomPeriod = periodMode !== defaultPeriodMode;

  const handleResetPeriod = () => {
    setPeriodMode(defaultPeriodMode);
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
    setDateRange(undefined);
  };

  // Calculate date range based on selected period
  const getDateRangeFromPeriod = () => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (periodMode) {
      case "previous_week":
        // Use date-fns for consistent week calculation (Monday to Sunday)
        const lastWeek = subWeeks(now, 1);
        start = startOfWeek(lastWeek, { weekStartsOn: 1 }); // Monday
        end = endOfWeek(lastWeek, { weekStartsOn: 1 });     // Sunday
        break;
      case "7d":
        start.setDate(now.getDate() - 7);
        end = now;
        break;
      case "30d":
        start.setDate(now.getDate() - 30);
        end = now;
        break;
      case "current_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case "year":
        start = new Date(selectedYear, 0, 1);
        end = new Date(selectedYear, 11, 31);
        break;
      case "custom_month":
        start = new Date(selectedYear, selectedMonth - 1, 1);
        end = new Date(selectedYear, selectedMonth, 0); // Last day of month
        break;
      case "custom_range":
        if (dateRange?.from && dateRange?.to) {
          start = dateRange.from;
          end = dateRange.to;
        }
        break;
    }
    
    return { startDate: start, endDate: end };
  };


  const { startDate, endDate } = getDateRangeFromPeriod();

  // Format dates for queries (use local calendar date, not UTC date)
  // Using toISOString() can shift the day in France/Europe timezones and create an extra day.
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(endDate, "yyyy-MM-dd");

  // Fetch network health data
  const { data: networkData, isLoading, error } = useQuery({
    queryKey: ["network-health", periodMode, selectedYear, selectedMonth, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), startDateStr, endDateStr],
    queryFn: async () => {
      console.log("Fetching network health data for period:", startDateStr, "to", endDateStr);
      
      // Fetch pinned restaurants only
      const { data: restaurants, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true)
        .eq("is_pinned", true);
      
      if (restaurantsError) {
        console.error("Error fetching restaurants:", restaurantsError);
        throw restaurantsError;
      }

      console.log("Pinned restaurants:", restaurants?.length, restaurants?.map(r => r.name));
      
      const restaurantIds = restaurants?.map(r => r.id) || [];
      
      if (restaurantIds.length === 0) {
        return {
          global: { rating: null, prepTime: null, errorRate: null, incorrectOrderRate: null, profitability: null, downtime: null, productApprovalRate: null },
          uber: { rating: null, prepTime: null, errorRate: null, incorrectOrderRate: null, profitability: null, downtime: null },
          deliveroo: { rating: null, prepTime: null, errorRate: null, incorrectOrderRate: null, profitability: null, downtime: null },
          topByRating: [], flopByRating: [], topByRevenue: [], flopByRevenue: [], topByProfitability: [], flopByProfitability: [],
          topByConversion: [], flopByConversion: [],
          topProducts: [], improvementProducts: [], totalRestaurants: 0, hasData: false,
          debugInfo: { periodMode, startDateStr, endDateStr, pinnedRestaurants: 0, salesRowsTotal: 0, reviewsRowsTotal: 0, salesByRestaurant: [], reviewsByRestaurant: [], buildTimestamp: BUILD_TIMESTAMP },
        };
      }

      // 1. Fetch daily sales (CA et commandes) - use deduplicated view to avoid duplicates
      // Use pagination to bypass the 1000 row limit
      let dailySalesData: Array<{
        restaurant_id: string;
        date: string;
        revenue_ttc: number;
        order_count: number;
        average_basket: number;
        platform: string;
      }> = [];
      let salesOffset = 0;
      let salesHasMore = true;
      const PAGE_SIZE = 1000;

      while (salesHasMore) {
        const { data: salesPage, error: salesError } = await supabase
          .from("daily_sales_uber_deduped")
          .select("restaurant_id, date, revenue_ttc, order_count, average_basket, platform")
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .in("restaurant_id", restaurantIds)
          // Deterministic multi-column sort to avoid pagination instability
          .order("date", { ascending: true })
          .order("restaurant_id", { ascending: true })
          .order("platform", { ascending: true })
          .range(salesOffset, salesOffset + PAGE_SIZE - 1);

        if (salesError) {
          console.error("Error fetching daily sales:", salesError);
          break;
        }

        if (salesPage && salesPage.length > 0) {
          dailySalesData = [...dailySalesData, ...salesPage];
          salesOffset += PAGE_SIZE;
          salesHasMore = salesPage.length === PAGE_SIZE;
        } else {
          salesHasMore = false;
        }
      }

      console.log("Daily sales data fetched (deduped + paginated):", dailySalesData.length, "rows");

      // Fetch payouts data for profitability calculation
      const { data: payoutsData, error: payoutsError } = await supabase
        .from("payouts")
        .select("restaurant_id, payout_date, sales_incl_vat, net_payout, order_count")
        .gte("payout_date", startDateStr)
        .lte("payout_date", endDateStr)
        .in("restaurant_id", restaurantIds);

      if (payoutsError) console.error("Error fetching payouts:", payoutsError);
      console.log("Payouts data:", payoutsData?.length, "rows");

      // 2. Fetch customer reviews - use review_date field with pagination
      let reviewsData: Array<{
        restaurant_id: string;
        overall_rating: number | null;
        review_date: string | null;
        platform: string | null;
      }> = [];
      let reviewsOffset = 0;
      let reviewsHasMore = true;

      while (reviewsHasMore) {
        const { data: reviewsPage, error: reviewsError } = await supabase
          .from("customer_reviews")
          .select("restaurant_id, overall_rating, review_date, platform")
          .gte("review_date", startDateStr)
          .lte("review_date", endDateStr)
          .in("restaurant_id", restaurantIds)
          // Deterministic multi-column sort for stable pagination
          .order("review_date", { ascending: true })
          .order("restaurant_id", { ascending: true })
          .order("id", { ascending: true })
          .range(reviewsOffset, reviewsOffset + PAGE_SIZE - 1);

        if (reviewsError) {
          console.error("Error fetching reviews:", reviewsError);
          break;
        }

        if (reviewsPage && reviewsPage.length > 0) {
          reviewsData = [...reviewsData, ...reviewsPage];
          reviewsOffset += PAGE_SIZE;
          reviewsHasMore = reviewsPage.length === PAGE_SIZE;
        } else {
          reviewsHasMore = false;
        }
      }

      console.log("Reviews data (paginated):", reviewsData.length, "rows");

      // 3. Fetch order history for prep times - use order_datetime field
      const { data: orderHistoryData, error: historyError } = await supabase
        .from("order_history")
        .select("restaurant_id, initial_prep_time_minutes, avoidable_wait_time_minutes, order_datetime, platform")
        .gte("order_datetime", startDate.toISOString())
        .lte("order_datetime", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .range(0, 50000);

      if (historyError) console.error("Error fetching order history:", historyError);
      console.log("Order history data:", orderHistoryData?.length, "rows");

      // 4. Fetch order errors - use error_date field
      const { data: errorsData, error: errorsError } = await supabase
        .from("order_errors")
        .select("restaurant_id, error_date, financial_impact")
        .gte("error_date", startDate.toISOString())
        .lte("error_date", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .range(0, 10000);

      if (errorsError) console.error("Error fetching errors:", errorsError);
      console.log("Errors data:", errorsData?.length, "rows");

      // 5. Fetch daily order accuracy - use date field
      const { data: accuracyData, error: accuracyError } = await supabase
        .from("daily_order_accuracy")
        .select("*")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds)
        .range(0, 10000);

      if (accuracyError) console.error("Error fetching accuracy:", accuracyError);
      console.log("Accuracy data:", accuracyData?.length, "rows");

      // 6. Fetch menu item reviews - use review_date field
      const { data: menuReviewsData, error: menuReviewsError } = await supabase
        .from("menu_item_reviews")
        .select("restaurant_id, rating, thumb_up, thumb_down, item_title, platform")
        .gte("review_date", startDate.toISOString())
        .lte("review_date", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .range(0, 50000);

      if (menuReviewsError) console.error("Error fetching menu reviews:", menuReviewsError);
      console.log("Menu reviews data:", menuReviewsData?.length, "rows");

      // 7. Fetch hourly availability for downtime - use hour_start field
      const { data: availabilityData, error: availabilityError } = await supabase
        .from("hourly_availability")
        .select("restaurant_id, hour_start, online_minutes, offline_minutes, platform")
        .gte("hour_start", startDate.toISOString())
        .lte("hour_start", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .range(0, 50000);

      if (availabilityError) console.error("Error fetching availability:", availabilityError);
      console.log("Availability data:", availabilityData?.length, "rows");

      // 8. Fetch daily conversion data for conversion ranking
      const { data: conversionData, error: conversionError } = await supabase
        .from("daily_conversion")
        .select("restaurant_id, visits, menu_views, add_to_cart, orders, date")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds)
        .range(0, 10000);

      if (conversionError) console.error("Error fetching conversion:", conversionError);
      console.log("Conversion data:", conversionData?.length, "rows");

      // Calculate aggregated metrics
      const totalRevenue = dailySalesData?.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0) || 0;
      const totalOrders = dailySalesData?.reduce((sum, d) => sum + Number(d.order_count || 0), 0) || 0;
      
      // Average rating from reviews
      const avgRating = reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / reviewsData.length
        : null;

      // Average prep time from order history
      const validPrepTimes = orderHistoryData?.filter(o => o.initial_prep_time_minutes != null) || [];
      const avgPrepTime = validPrepTimes.length > 0
        ? validPrepTimes.reduce((sum, o) => sum + Number(o.initial_prep_time_minutes || 0), 0) / validPrepTimes.length
        : null;

      // Error rate = errors / total orders
      const totalErrors = errorsData?.length || 0;
      const errorRate = totalOrders > 0 ? (totalErrors / totalOrders) * 100 : null;

      // Incorrect order rate from accuracy data
      const totalIncorrectOrders = accuracyData?.reduce((sum, a) => sum + Number(a.incorrect_orders_count || 0), 0) || 0;
      const incorrectOrderRate = totalOrders > 0 ? (totalIncorrectOrders / totalOrders) * 100 : null;

      // Product approval rate from menu reviews (thumb_up = 1, thumb_down = 0)
      const productApprovalRate = menuReviewsData && menuReviewsData.length > 0
        ? (menuReviewsData.filter(r => r.thumb_up === 1).length / menuReviewsData.length) * 100
        : null;

      // Calculate downtime from availability data - arrondi à 1 décimale
      const totalOfflineMinutes = availabilityData?.reduce((sum, a) => sum + Number(a.offline_minutes || 0), 0) || 0;
      const downtimeHours = totalOfflineMinutes > 0 ? Math.round(totalOfflineMinutes / 6) / 10 : null; // En heures avec 1 décimale
      
      // Downtime Uber-spécifique
      const uberAvailability = availabilityData?.filter(a => a.platform === "uber_eats") || [];
      const uberOfflineMinutes = uberAvailability.reduce((sum, a) => sum + Number(a.offline_minutes || 0), 0);
      const uberDowntimeHours = uberOfflineMinutes > 0 ? Math.round(uberOfflineMinutes / 6) / 10 : null;

      // Calculate global profitability from payouts data
      const totalPayoutSales = payoutsData?.reduce((sum, p) => sum + Number(p.sales_incl_vat || 0), 0) || 0;
      const totalNetPayout = payoutsData?.reduce((sum, p) => sum + Number(p.net_payout || 0), 0) || 0;
      const globalProfitability = totalPayoutSales > 0 ? (totalNetPayout / totalPayoutSales) * 100 : null;

      // Calculate per-restaurant metrics
      const restaurantMetrics = restaurants?.map(resto => {
        const restoSales = dailySalesData?.filter(d => d.restaurant_id === resto.id) || [];
        const restoReviews = reviewsData?.filter(r => r.restaurant_id === resto.id) || [];
        const restoHistory = orderHistoryData?.filter(h => h.restaurant_id === resto.id) || [];
        const restoErrors = errorsData?.filter(e => e.restaurant_id === resto.id) || [];
        const restoPayouts = payoutsData?.filter(p => p.restaurant_id === resto.id) || [];

        const revenue = restoSales.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0);
        const orders = restoSales.reduce((sum, d) => sum + Number(d.order_count || 0), 0);
        // Use null when no reviews exist (not 0, to avoid confusion)
        const rating = restoReviews.length > 0
          ? restoReviews.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / restoReviews.length
          : null;
        const validPrep = restoHistory.filter(h => h.initial_prep_time_minutes != null);
        const prepTime = validPrep.length > 0
          ? validPrep.reduce((sum, h) => sum + Number(h.initial_prep_time_minutes || 0), 0) / validPrep.length
          : null;
        const restoErrorRate = orders > 0 ? (restoErrors.length / orders) * 100 : null;
        
        // Calculate profitability from payouts
        const restoPayoutSales = restoPayouts.reduce((sum, p) => sum + Number(p.sales_incl_vat || 0), 0);
        const restoNetPayout = restoPayouts.reduce((sum, p) => sum + Number(p.net_payout || 0), 0);
        const profitability = restoPayoutSales > 0 ? (restoNetPayout / restoPayoutSales) * 100 : null;

        return {
          id: resto.id,
          name: resto.name,
          city: resto.city,
          rating: rating != null ? parseFloat(rating.toFixed(1)) : null,
          reviewCount: restoReviews.length,
          prepTime: prepTime != null ? Math.round(prepTime) : null,
          errorRate: restoErrorRate != null ? parseFloat(restoErrorRate.toFixed(1)) : null,
          profitability,
          revenue,
          salesRows: restoSales.length,
        };
      }) || [];

      // Debug info for troubleshooting
      const debugInfo = {
        periodMode,
        startDateStr,
        endDateStr,
        pinnedRestaurants: restaurants?.length || 0,
        salesRowsTotal: dailySalesData.length,
        reviewsRowsTotal: reviewsData.length,
        salesByRestaurant: restaurantMetrics.map(r => ({ name: r.name, rows: r.salesRows, revenue: r.revenue })),
        reviewsByRestaurant: restaurantMetrics.map(r => ({ name: r.name, count: r.reviewCount, rating: r.rating })),
        buildTimestamp: BUILD_TIMESTAMP,
      };
      console.log("Debug info:", debugInfo);

      // Sort and get top/flop by different metrics (filter out null values for ratings)
      const withRatings = restaurantMetrics.filter(r => r.rating != null);
      const sortedByRating = [...withRatings].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      const topByRating = sortedByRating.slice(0, 5);
      const flopByRating = sortedByRating.slice(-5).reverse();

      const sortedByRevenue = [...restaurantMetrics].sort((a, b) => b.revenue - a.revenue);
      const topByRevenue = sortedByRevenue.slice(0, 5);
      const flopByRevenue = sortedByRevenue.slice(-5).reverse();

      const withProfitability = restaurantMetrics.filter(r => r.profitability != null);
      const sortedByProfitability = [...withProfitability].sort((a, b) => (b.profitability ?? 0) - (a.profitability ?? 0));
      const topByProfitability = sortedByProfitability.slice(0, 5);
      const flopByProfitability = sortedByProfitability.slice(-5).reverse();

      // Calculate conversion rate per restaurant
      const conversionMetrics = restaurants?.map(resto => {
        const restoConv = conversionData?.filter(c => c.restaurant_id === resto.id) || [];
        const visits = restoConv.reduce((sum, c) => sum + (c.visits || 0), 0);
        const orders = restoConv.reduce((sum, c) => sum + (c.orders || 0), 0);
        const conversionRate = visits > 0 ? (orders / visits) * 100 : 0;
        
        return {
          id: resto.id,
          name: resto.name,
          city: resto.city,
          visits,
          orders,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
        };
      }).filter(r => r.visits > 0) || [];

      const sortedByConversion = [...conversionMetrics].sort((a, b) => b.conversionRate - a.conversionRate);
      const topByConversion = sortedByConversion.slice(0, 5);
      const flopByConversion = sortedByConversion.slice(-5).reverse();

      // Platform-specific metrics
      const uberSales = dailySalesData?.filter(d => d.platform === "uber_eats") || [];
      const uberReviews = reviewsData?.filter(r => r.platform === "uber_eats") || [];
      const uberHistory = orderHistoryData?.filter(h => h.platform === "uber_eats") || [];
      
      const uberRevenue = uberSales.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0);
      const uberOrders = uberSales.reduce((sum, d) => sum + Number(d.order_count || 0), 0);
      const uberRating = uberReviews.length > 0 
        ? uberReviews.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / uberReviews.length 
        : null;
      const uberValidPrep = uberHistory.filter(h => h.initial_prep_time_minutes != null);
      const uberPrepTime = uberValidPrep.length > 0
        ? uberValidPrep.reduce((sum, h) => sum + Number(h.initial_prep_time_minutes || 0), 0) / uberValidPrep.length
        : null;

      const deliverooSales = dailySalesData?.filter(d => d.platform === "deliveroo") || [];
      const deliverooReviews = reviewsData?.filter(r => r.platform === "deliveroo") || [];
      
      const deliverooRevenue = deliverooSales.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0);
      const deliverooOrders = deliverooSales.reduce((sum, d) => sum + Number(d.order_count || 0), 0);
      const deliverooRating = deliverooReviews.length > 0
        ? deliverooReviews.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / deliverooReviews.length
        : null;

      const result = {
        global: {
          rating: avgRating,
          prepTime: avgPrepTime != null ? Math.round(avgPrepTime) : null,
          errorRate: errorRate,
          incorrectOrderRate: incorrectOrderRate,
          profitability: globalProfitability,
          downtime: downtimeHours,
          productApprovalRate: productApprovalRate,
        },
        uber: {
          rating: uberRating,
          prepTime: uberPrepTime != null ? Math.round(uberPrepTime) : null,
          errorRate: uberOrders > 0 ? (errorsData?.length || 0) / uberOrders * 100 : null,
          incorrectOrderRate: incorrectOrderRate, // Données Uber uniquement pour l'instant
          profitability: globalProfitability, // Payouts are from Uber
          downtime: uberDowntimeHours,
        },
        deliveroo: {
          rating: deliverooRating,
          prepTime: null,
          errorRate: null,
          incorrectOrderRate: null,
          profitability: null,
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
        // Aggregate menu reviews by product for top/flop products
        topProducts: (() => {
          const productMap = new Map<string, {
            title: string;
            thumbsUp: number;
            thumbsDown: number;
          }>();

          menuReviewsData?.forEach(review => {
            const title = review.item_title?.trim() || "Unknown";
            const key = title.toLowerCase();
            
            if (!productMap.has(key)) {
              productMap.set(key, { title, thumbsUp: 0, thumbsDown: 0 });
            }
            
            const prod = productMap.get(key)!;
            prod.thumbsUp += review.thumb_up || 0;
            prod.thumbsDown += review.thumb_down || 0;
          });

          return Array.from(productMap.values())
            .filter(p => (p.thumbsUp + p.thumbsDown) > 0)
            .filter(p => !p.title.toLowerCase().includes('article inconnu'))
            .filter(p => !p.title.toLowerCase().includes('unknown item'))
            .map(p => {
              const total = p.thumbsUp + p.thumbsDown;
              return {
                name: p.title,
                rating: `${Math.round((p.thumbsUp / total) * 100)}%`,
                reviews: total,
                approvalRate: Math.round((p.thumbsUp / total) * 100)
              };
            })
            .sort((a, b) => b.approvalRate - a.approvalRate)
            .slice(0, 5);
        })(),
        improvementProducts: (() => {
          const productMap = new Map<string, {
            title: string;
            thumbsUp: number;
            thumbsDown: number;
          }>();

          menuReviewsData?.forEach(review => {
            const title = review.item_title?.trim() || "Unknown";
            const key = title.toLowerCase();
            
            if (!productMap.has(key)) {
              productMap.set(key, { title, thumbsUp: 0, thumbsDown: 0 });
            }
            
            const prod = productMap.get(key)!;
            prod.thumbsUp += review.thumb_up || 0;
            prod.thumbsDown += review.thumb_down || 0;
          });

          return Array.from(productMap.values())
            .filter(p => (p.thumbsUp + p.thumbsDown) > 0)
            .filter(p => p.thumbsDown > 0) // Only products with at least 1 negative review
            .filter(p => !p.title.toLowerCase().includes('article inconnu'))
            .filter(p => !p.title.toLowerCase().includes('unknown item'))
            .map(p => {
              const total = p.thumbsUp + p.thumbsDown;
              return {
                name: p.title,
                rating: `${Math.round((p.thumbsUp / total) * 100)}%`,
                reviews: total,
                approvalRate: Math.round((p.thumbsUp / total) * 100)
              };
            })
            .sort((a, b) => a.approvalRate - b.approvalRate)
            .slice(0, 5);
        })(),
        totalRestaurants: restaurants?.length || 0,
        hasData: (dailySalesData?.length || 0) > 0 || (reviewsData?.length || 0) > 0,
        debugInfo,
      };

      console.log("Returning data:", result);
      return result;
    },
  });

  // Use centralized network stats hook for the comparison table
  const pinnedRestaurantIds = useMemo(() => {
    // Extract restaurant IDs from networkData if available
    return networkData?.topByRevenue?.map(r => r.id) || 
           networkData?.topByRating?.map(r => r.id) || 
           [];
  }, [networkData?.topByRevenue, networkData?.topByRating]);

  // Fetch pinned restaurant IDs directly for the table
  const { data: pinnedIds } = useQuery({
    queryKey: ["pinned-restaurant-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id")
        .eq("is_active", true)
        .eq("is_pinned", true);
      if (error) throw error;
      return data?.map(r => r.id) || [];
    },
  });

  const { stats: comparisonStats, networkTotals, isLoading: statsLoading } = useNetworkStats({
    restaurantIds: pinnedIds || [],
    startDate,
    endDate,
    profitabilityBase: "gross",
    includeN1Comparison: showN1Comparison,
  });

  console.log("Query state - isLoading:", isLoading, "error:", error, "data:", networkData);

  const MONTHS_FULL = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const getPeriodLabel = () => {
    switch (periodMode) {
      case "previous_week": return "Semaine précédente";
      case "7d": return "7 derniers jours";
      case "30d": return "30 derniers jours";
      case "current_month": return "Mois en cours";
      case "year": return `${selectedYear}`;
      case "custom_month": return `${MONTHS_FULL[selectedMonth - 1]} ${selectedYear}`;
      case "custom_range": 
        if (dateRange?.from && dateRange?.to) {
          return `${dateRange.from.toLocaleDateString('fr-FR')} – ${dateRange.to.toLocaleDateString('fr-FR')}`;
        }
        return "Période personnalisée";
      default: return "Période";
    }
  };

  const handleExportPdf = () => {
    exportComprehensivePdf({
      title: "Vue d'ensemble",
      period: getPeriodLabel(),
      totalRestaurants: networkData?.totalRestaurants || 0,
      globalMetrics: {
        rating: networkData?.global.rating ?? null,
        prepTime: networkData?.global.prepTime ?? null,
        errorRate: networkData?.global.errorRate ?? null,
        incorrectOrderRate: networkData?.global.incorrectOrderRate ?? null,
        profitability: networkData?.global.profitability ?? null,
        downtime: networkData?.global.downtime ?? null,
      },
      uberMetrics: {
        rating: networkData?.uber?.rating ?? null,
        prepTime: networkData?.uber?.prepTime ?? null,
        errorRate: networkData?.uber?.errorRate ?? null,
        incorrectOrderRate: networkData?.uber?.incorrectOrderRate ?? null,
        profitability: networkData?.uber?.profitability ?? null,
        downtime: networkData?.uber?.downtime ?? null,
      },
      deliverooMetrics: {
        rating: networkData?.deliveroo?.rating ?? null,
        prepTime: networkData?.deliveroo?.prepTime ?? null,
        errorRate: networkData?.deliveroo?.errorRate ?? null,
        incorrectOrderRate: networkData?.deliveroo?.incorrectOrderRate ?? null,
        profitability: networkData?.deliveroo?.profitability ?? null,
        downtime: networkData?.deliveroo?.downtime ?? null,
      },
      restaurantComparison: comparisonStats,
      networkTotals: networkTotals,
      showN1: showN1Comparison,
    });
  };

  const handleExportExcel = () => {
    exportComprehensiveExcel({
      title: "Vue d'ensemble",
      period: getPeriodLabel(),
      totalRestaurants: networkData?.totalRestaurants || 0,
      globalMetrics: {
        rating: networkData?.global.rating ?? null,
        prepTime: networkData?.global.prepTime ?? null,
        errorRate: networkData?.global.errorRate ?? null,
        incorrectOrderRate: networkData?.global.incorrectOrderRate ?? null,
        profitability: networkData?.global.profitability ?? null,
        downtime: networkData?.global.downtime ?? null,
      },
      uberMetrics: {
        rating: networkData?.uber?.rating ?? null,
        prepTime: networkData?.uber?.prepTime ?? null,
        errorRate: networkData?.uber?.errorRate ?? null,
        incorrectOrderRate: networkData?.uber?.incorrectOrderRate ?? null,
        profitability: networkData?.uber?.profitability ?? null,
        downtime: networkData?.uber?.downtime ?? null,
      },
      deliverooMetrics: {
        rating: networkData?.deliveroo?.rating ?? null,
        prepTime: networkData?.deliveroo?.prepTime ?? null,
        errorRate: networkData?.deliveroo?.errorRate ?? null,
        incorrectOrderRate: networkData?.deliveroo?.incorrectOrderRate ?? null,
        profitability: networkData?.deliveroo?.profitability ?? null,
        downtime: networkData?.deliveroo?.downtime ?? null,
      },
      restaurantComparison: comparisonStats,
      networkTotals: networkTotals,
      showN1: showN1Comparison,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-8 space-y-8">
      {/* Header with glassmorphism */}
      <div className="flex items-center justify-between backdrop-blur-xl bg-card/50 border border-border/50 rounded-2xl p-6 shadow-lg">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Vue d'ensemble
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
              Santé du réseau
            </span>
            <span className="text-sm">·</span>
            <span className="font-semibold">{networkData?.totalRestaurants || 0}</span>
            <span>restaurants suivis</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["network-health"] });
              window.location.reload();
            }}
            variant="outline"
            size="icon"
            title="Forcer le rafraîchissement"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleExportPdf}
            disabled={isExporting}
            variant="outline"
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
          <Button
            onClick={handleExportExcel}
            disabled={isExporting}
            variant="outline"
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <OverviewPeriodSelector
            periodMode={periodMode}
            onPeriodModeChange={setPeriodMode}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            showReset={isCustomPeriod}
            onReset={handleResetPeriod}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-pulse">Chargement des données...</div>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Erreur lors du chargement des données: {String(error)}
        </div>
      ) : (
        <div>
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Global Card */}
            <Card className="border-2 border-primary/30 shadow-2xl bg-gradient-to-br from-card via-card to-primary/5 backdrop-blur-xl hover:shadow-primary/20 transition-all duration-500 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Global</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Toutes plateformes</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.global.rating != null ? networkData.global.rating.toFixed(1) : null} unit="/5" color="text-blue-500" onClick={() => navigate(`/compare/ratings?period=${periodMode === 'previous_week' || periodMode === '7d' ? 'week' : periodMode === 'year' ? 'quarter' : 'month'}`)} />
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.global.prepTime)} color="text-amber-500" onClick={() => navigate('/compare/prep-time')} />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.global.incorrectOrderRate != null ? networkData.global.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" onClick={() => navigate('/compare/inaccurate-orders')} />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.global.profitability != null ? networkData.global.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" onClick={() => navigateToFinancesGlobal()} />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.global.downtime)} color="text-orange-500" onClick={() => navigate('/compare/downtime')} />
                <MetricRow icon={Clock} label="Horaires d'ouverture" value="Voir analyse" color="text-indigo-500" onClick={() => navigate('/compare/opening-hours')} />
                <MetricRow icon={Star} label="Avis produits" value={networkData?.global.productApprovalRate != null ? Math.round(networkData.global.productApprovalRate) : null} unit="%" color="text-violet-500" />
              </CardContent>
            </Card>

            {/* Uber Eats Card */}
            <Card className="border-2 border-uber/30 shadow-2xl bg-gradient-to-br from-card via-card to-uber/5 backdrop-blur-xl hover:shadow-uber/20 transition-all duration-500 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-uber/10 flex items-center justify-center">
                      <UberEatsLogo size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Uber Eats</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{getPeriodLabel()}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.uber.rating != null ? networkData.uber.rating.toFixed(1) : null} unit="/5" color="text-blue-500" onClick={() => navigate(`/compare/ratings?period=${periodMode === 'previous_week' || periodMode === '7d' ? 'week' : periodMode === 'year' ? 'quarter' : 'month'}`)} />
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.uber.prepTime)} color="text-amber-500" onClick={() => navigate('/compare/prep-time')} />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.uber.incorrectOrderRate != null ? networkData.uber.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" onClick={() => navigate('/compare/inaccurate-orders')} />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.uber.profitability != null ? networkData.uber.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" onClick={() => navigateToFinancesGlobal()} />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.uber.downtime)} color="text-orange-500" onClick={() => navigate('/compare/downtime')} />
              </CardContent>
            </Card>

            {/* Deliveroo Card */}
            <Card className="border-2 border-deliveroo/30 shadow-2xl bg-gradient-to-br from-card via-card to-deliveroo/5 backdrop-blur-xl hover:shadow-deliveroo/20 transition-all duration-500 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-deliveroo/10 flex items-center justify-center">
                      <DeliverooLogo size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Deliveroo</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{getPeriodLabel()}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.deliveroo.rating != null ? networkData.deliveroo.rating.toFixed(1) : null} unit="/5" color="text-blue-500" onClick={() => navigate(`/compare/ratings?period=${periodMode === 'previous_week' || periodMode === '7d' ? 'week' : periodMode === 'year' ? 'quarter' : 'month'}`)} />
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.deliveroo.prepTime)} color="text-amber-500" onClick={() => navigate('/compare/prep-time')} />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.deliveroo.incorrectOrderRate != null ? networkData.deliveroo.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.deliveroo.profitability != null ? networkData.deliveroo.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" onClick={() => navigateToFinancesGlobal()} />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.deliveroo.downtime)} color="text-orange-500" onClick={() => navigate('/compare/downtime')} />
              </CardContent>
            </Card>
          </div>

          {/* Comprehensive Restaurant Comparison Table */}
          <div className="mt-10">
            <RestaurantComparisonTable
              stats={comparisonStats}
              networkTotals={networkTotals}
              showN1Comparison={showN1Comparison}
              onToggleN1={setShowN1Comparison}
              isLoading={statsLoading}
            />
          </div>


          {/* Avis Produits */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-warning" />
                  Produits les mieux notés
                </CardTitle>
              </CardHeader>
              <CardContent>
                {networkData?.topProducts && networkData.topProducts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Note</TableHead>
                        <TableHead className="text-right">Avis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {networkData.topProducts.map((product, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-1 text-warning font-semibold">
                              <Star className="h-3 w-3 fill-warning" />
                              {product.rating}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{product.reviews}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products to Improve */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-warning" />
                  Produits à améliorer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {networkData?.improvementProducts && networkData.improvementProducts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Note</TableHead>
                        <TableHead className="text-right">Avis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {networkData.improvementProducts.map((product, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-1 text-warning/70 font-semibold">
                              <Star className="h-3 w-3 fill-warning/70" />
                              {product.rating}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{product.reviews}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricRow = ({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  color,
  onClick
}: { 
  icon: any; 
  label: string; 
  value: any; 
  unit?: string; 
  color: string;
  onClick?: () => void;
}) => {
  // Display "--" for 0 or null/undefined values
  const displayValue = value === 0 || value === null || value === undefined || value === "0" || value === "0.0" 
    ? "--" 
    : value;
  const showUnit = displayValue !== "--";
  
  return (
    <div 
      className={cn(
        "flex items-center justify-between text-sm",
        onClick && "cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors group"
      )}
      onClick={onClick}
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
        {onClick && (
          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
      <span className={cn("font-semibold", displayValue === "--" ? "text-muted-foreground" : color)}>
        {displayValue}{showUnit ? unit : ""}
      </span>
    </div>
  );
};

export default Overview;
