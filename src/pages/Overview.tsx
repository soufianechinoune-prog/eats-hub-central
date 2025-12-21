import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Star, Clock, TrendingDown, Percent, DollarSign, PauseCircle, Award, Euro, FileDown, FileSpreadsheet, ChevronRight, Users } from "lucide-react";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOverviewExport } from "@/hooks/useOverviewExport";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";

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
  const [rankingTab, setRankingTab] = useState<"rating" | "revenue" | "profitability" | "conversion">("rating");
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const { exportToPdf, exportToExcel, isExporting } = useOverviewExport();

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
        // Find last Sunday (end of previous week)
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - daysSinceSunday);
        lastSunday.setHours(23, 59, 59, 999);
        
        // Find the Monday of that week (6 days before Sunday)
        const lastMonday = new Date(lastSunday);
        lastMonday.setDate(lastSunday.getDate() - 6);
        lastMonday.setHours(0, 0, 0, 0);
        
        start = lastMonday;
        end = lastSunday;
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

  // Format dates for queries
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

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
          global: { rating: null, prepTime: null, errorRate: null, incorrectOrderRate: null, profitability: null, downtime: null, productRating: null },
          uber: { rating: null, prepTime: null, errorRate: null, incorrectOrderRate: null, profitability: null, downtime: null },
          deliveroo: { rating: null, prepTime: null, errorRate: null, incorrectOrderRate: null, profitability: null, downtime: null },
          topByRating: [], flopByRating: [], topByRevenue: [], flopByRevenue: [], topByProfitability: [], flopByProfitability: [],
          topByConversion: [], flopByConversion: [],
          topProducts: [], improvementProducts: [], totalRestaurants: 0, hasData: false,
        };
      }

      // 1. Fetch daily sales (CA et commandes) - use date field
      const { data: dailySalesData, error: salesError } = await supabase
        .from("daily_sales_uber")
        .select("restaurant_id, date, revenue_ttc, order_count, average_basket, platform")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds);

      if (salesError) console.error("Error fetching daily sales:", salesError);
      console.log("Daily sales data:", dailySalesData?.length, "rows");

      // 2. Fetch customer reviews - use review_date field
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("customer_reviews")
        .select("restaurant_id, overall_rating, review_date, platform")
        .gte("review_date", startDate.toISOString())
        .lte("review_date", endDate.toISOString())
        .in("restaurant_id", restaurantIds);

      if (reviewsError) console.error("Error fetching reviews:", reviewsError);
      console.log("Reviews data:", reviewsData?.length, "rows");

      // 3. Fetch order history for prep times - use order_datetime field
      const { data: orderHistoryData, error: historyError } = await supabase
        .from("order_history")
        .select("restaurant_id, initial_prep_time_minutes, avoidable_wait_time_minutes, order_datetime, platform")
        .gte("order_datetime", startDate.toISOString())
        .lte("order_datetime", endDate.toISOString())
        .in("restaurant_id", restaurantIds);

      if (historyError) console.error("Error fetching order history:", historyError);
      console.log("Order history data:", orderHistoryData?.length, "rows");

      // 4. Fetch order errors - use error_date field
      const { data: errorsData, error: errorsError } = await supabase
        .from("order_errors")
        .select("restaurant_id, error_date, financial_impact")
        .gte("error_date", startDate.toISOString())
        .lte("error_date", endDate.toISOString())
        .in("restaurant_id", restaurantIds);

      if (errorsError) console.error("Error fetching errors:", errorsError);
      console.log("Errors data:", errorsData?.length, "rows");

      // 5. Fetch daily order accuracy - use date field
      const { data: accuracyData, error: accuracyError } = await supabase
        .from("daily_order_accuracy")
        .select("*")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds);

      if (accuracyError) console.error("Error fetching accuracy:", accuracyError);
      console.log("Accuracy data:", accuracyData?.length, "rows");

      // 6. Fetch menu item reviews - use review_date field
      const { data: menuReviewsData, error: menuReviewsError } = await supabase
        .from("menu_item_reviews")
        .select("restaurant_id, rating, thumb_up, thumb_down, item_title, platform")
        .gte("review_date", startDate.toISOString())
        .lte("review_date", endDate.toISOString())
        .in("restaurant_id", restaurantIds);

      if (menuReviewsError) console.error("Error fetching menu reviews:", menuReviewsError);
      console.log("Menu reviews data:", menuReviewsData?.length, "rows");

      // 7. Fetch hourly availability for downtime - use hour_start field
      const { data: availabilityData, error: availabilityError } = await supabase
        .from("hourly_availability")
        .select("restaurant_id, hour_start, online_minutes, offline_minutes, platform")
        .gte("hour_start", startDate.toISOString())
        .lte("hour_start", endDate.toISOString())
        .in("restaurant_id", restaurantIds);

      if (availabilityError) console.error("Error fetching availability:", availabilityError);
      console.log("Availability data:", availabilityData?.length, "rows");

      // 8. Fetch daily conversion data for conversion ranking
      const { data: conversionData, error: conversionError } = await supabase
        .from("daily_conversion")
        .select("restaurant_id, visits, menu_views, add_to_cart, orders, date")
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("restaurant_id", restaurantIds);

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

      // Product rating from menu reviews
      const avgProductRating = menuReviewsData && menuReviewsData.length > 0
        ? menuReviewsData.reduce((sum, r) => sum + Number(r.rating || 0), 0) / menuReviewsData.length
        : null;

      // Calculate downtime from availability data - arrondi à 1 décimale
      const totalOfflineMinutes = availabilityData?.reduce((sum, a) => sum + Number(a.offline_minutes || 0), 0) || 0;
      const downtimeHours = totalOfflineMinutes > 0 ? Math.round(totalOfflineMinutes / 6) / 10 : null; // En heures avec 1 décimale
      
      // Downtime Uber-spécifique
      const uberAvailability = availabilityData?.filter(a => a.platform === "uber_eats") || [];
      const uberOfflineMinutes = uberAvailability.reduce((sum, a) => sum + Number(a.offline_minutes || 0), 0);
      const uberDowntimeHours = uberOfflineMinutes > 0 ? Math.round(uberOfflineMinutes / 6) / 10 : null;

      // Calculate per-restaurant metrics
      const restaurantMetrics = restaurants?.map(resto => {
        const restoSales = dailySalesData?.filter(d => d.restaurant_id === resto.id) || [];
        const restoReviews = reviewsData?.filter(r => r.restaurant_id === resto.id) || [];
        const restoHistory = orderHistoryData?.filter(h => h.restaurant_id === resto.id) || [];
        const restoErrors = errorsData?.filter(e => e.restaurant_id === resto.id) || [];

        const revenue = restoSales.reduce((sum, d) => sum + Number(d.revenue_ttc || 0), 0);
        const orders = restoSales.reduce((sum, d) => sum + Number(d.order_count || 0), 0);
        const rating = restoReviews.length > 0
          ? restoReviews.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / restoReviews.length
          : 0;
        const validPrep = restoHistory.filter(h => h.initial_prep_time_minutes != null);
        const prepTime = validPrep.length > 0
          ? validPrep.reduce((sum, h) => sum + Number(h.initial_prep_time_minutes || 0), 0) / validPrep.length
          : 0;
        const restoErrorRate = orders > 0 ? (restoErrors.length / orders) * 100 : 0;
        
        // For profitability, we'd need fees data - for now set to 0
        const profitability = 0;

        return {
          id: resto.id,
          name: resto.name,
          city: resto.city,
          rating: parseFloat(rating.toFixed(1)),
          prepTime: Math.round(prepTime),
          errorRate: parseFloat(restoErrorRate.toFixed(1)),
          profitability,
          revenue,
        };
      }) || [];

      // Sort and get top/flop by different metrics
      const sortedByRating = [...restaurantMetrics].sort((a, b) => b.rating - a.rating);
      const topByRating = sortedByRating.slice(0, 5);
      const flopByRating = sortedByRating.slice(-5).reverse();

      const sortedByRevenue = [...restaurantMetrics].sort((a, b) => b.revenue - a.revenue);
      const topByRevenue = sortedByRevenue.slice(0, 5);
      const flopByRevenue = sortedByRevenue.slice(-5).reverse();

      const sortedByProfitability = [...restaurantMetrics].sort((a, b) => b.profitability - a.profitability);
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
          profitability: null, // Needs monthly_fees data
          downtime: downtimeHours,
          productRating: avgProductRating,
        },
        uber: {
          rating: uberRating,
          prepTime: uberPrepTime != null ? Math.round(uberPrepTime) : null,
          errorRate: uberOrders > 0 ? (errorsData?.length || 0) / uberOrders * 100 : null,
          incorrectOrderRate: incorrectOrderRate, // Données Uber uniquement pour l'instant
          profitability: null,
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
        topProducts: [],
        improvementProducts: [],
        totalRestaurants: restaurants?.length || 0,
        hasData: (dailySalesData?.length || 0) > 0 || (reviewsData?.length || 0) > 0,
      };

      console.log("Returning data:", result);
      return result;
    },
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
    const rankingType = rankingTab === "rating" ? "Note" : rankingTab === "revenue" ? "CA" : "Rentabilité";
    const topRestaurants = rankingTab === "rating" ? networkData?.topByRating : rankingTab === "revenue" ? networkData?.topByRevenue : networkData?.topByProfitability;
    const flopRestaurants = rankingTab === "rating" ? networkData?.flopByRating : rankingTab === "revenue" ? networkData?.flopByRevenue : networkData?.flopByProfitability;
    
    exportToPdf(contentRef.current, {
      title: "Vue d'ensemble",
      period: getPeriodLabel(),
      globalMetrics: {
        avgRating: networkData?.global.rating || 0,
        avgPrepTime: networkData?.global.prepTime || 0,
        avgErrorRate: networkData?.global.errorRate || 0,
        avgProfitability: networkData?.global.profitability || 0,
      },
      topRestaurants: topRestaurants || [],
      flopRestaurants: flopRestaurants || [],
      rankingType,
    });
  };

  const handleExportExcel = () => {
    const rankingType = rankingTab === "rating" ? "Note" : rankingTab === "revenue" ? "CA" : "Rentabilité";
    const topRestaurants = rankingTab === "rating" ? networkData?.topByRating : rankingTab === "revenue" ? networkData?.topByRevenue : networkData?.topByProfitability;
    const flopRestaurants = rankingTab === "rating" ? networkData?.flopByRating : rankingTab === "revenue" ? networkData?.flopByRevenue : networkData?.flopByProfitability;
    
    exportToExcel({
      title: "Vue d'ensemble",
      period: getPeriodLabel(),
      globalMetrics: {
        avgRating: networkData?.global.rating || 0,
        avgPrepTime: networkData?.global.prepTime || 0,
        avgErrorRate: networkData?.global.errorRate || 0,
        avgProfitability: networkData?.global.profitability || 0,
      },
      topRestaurants: topRestaurants || [],
      flopRestaurants: flopRestaurants || [],
      rankingType,
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
        <div ref={contentRef}>
          {/* KPIs Globaux - Priority Section with Modern Design */}
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
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.global.prepTime)} color="text-amber-500" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.global.incorrectOrderRate != null ? networkData.global.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.global.profitability != null ? networkData.global.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.global.downtime)} color="text-orange-500" onClick={() => navigate('/compare/downtime')} />
                <MetricRow icon={Clock} label="Horaires d'ouverture" value="Voir analyse" color="text-indigo-500" onClick={() => navigate('/compare/opening-hours')} />
                <MetricRow icon={Star} label="Avis produits" value={networkData?.global.productRating != null ? networkData.global.productRating.toFixed(1) : null} unit="/5" color="text-violet-500" />
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
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.uber.prepTime)} color="text-amber-500" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.uber.incorrectOrderRate != null ? networkData.uber.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.uber.profitability != null ? networkData.uber.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" />
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
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.deliveroo.prepTime)} color="text-amber-500" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.deliveroo.incorrectOrderRate != null ? networkData.deliveroo.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.deliveroo.profitability != null ? networkData.deliveroo.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.deliveroo.downtime)} color="text-orange-500" onClick={() => navigate('/compare/downtime')} />
              </CardContent>
            </Card>
          </div>

          {/* Top & Flop Restaurants with Modern Tabs */}
          <Tabs value={rankingTab} onValueChange={(v) => setRankingTab(v as typeof rankingTab)} className="w-full">
            <div className="flex items-center justify-center mb-8">
              <TabsList className="grid w-full max-w-2xl grid-cols-4 h-14 p-1.5 bg-muted/50 backdrop-blur-xl border-2 border-border/50 rounded-2xl shadow-lg">
                <TabsTrigger value="rating" className="flex items-center gap-2 text-sm font-semibold rounded-xl data-[state=active]:shadow-lg transition-all duration-300">
                  <Star className="h-4 w-4" />
                  Note
                </TabsTrigger>
                <TabsTrigger value="revenue" className="flex items-center gap-2 text-sm font-semibold rounded-xl data-[state=active]:shadow-lg transition-all duration-300">
                  <Euro className="h-4 w-4" />
                  CA
                </TabsTrigger>
                <TabsTrigger value="profitability" className="flex items-center gap-2 text-sm font-semibold rounded-xl data-[state=active]:shadow-lg transition-all duration-300">
                  <Percent className="h-4 w-4" />
                  Rentabilité
                </TabsTrigger>
                <TabsTrigger value="conversion" className="flex items-center gap-2 text-sm font-semibold rounded-xl data-[state=active]:shadow-lg transition-all duration-300">
                  <Users className="h-4 w-4" />
                  Conversion
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="rating" className="mt-0 space-y-0">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Top 5 by Rating */}
                <Card className="border-2 border-emerald-500/20 shadow-xl bg-gradient-to-br from-card to-emerald-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Award className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Top 5 Restaurants</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.topByRating.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-emerald-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-emerald-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg">
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                {resto.rating}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Flop 5 by Rating */}
                <Card className="border-2 border-red-500/20 shadow-xl bg-gradient-to-br from-card to-red-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-400">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Points d'attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.flopByRating.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-red-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-red-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg text-red-600">
                                <Star className="h-4 w-4 fill-red-400/50 text-red-400/50" />
                                {resto.rating}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="revenue" className="mt-0 space-y-0">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Top 5 by Revenue */}
                <Card className="border-2 border-emerald-500/20 shadow-xl bg-gradient-to-br from-card to-emerald-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Award className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Top 5 Restaurants</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">CA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.topByRevenue.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-emerald-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-emerald-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {resto.revenue.toLocaleString('fr-FR')} €
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Flop 5 by Revenue */}
                <Card className="border-2 border-red-500/20 shadow-xl bg-gradient-to-br from-card to-red-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-400">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Points d'attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">CA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.flopByRevenue.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-red-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-red-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-sm text-red-600 whitespace-nowrap">
                                {resto.revenue.toLocaleString('fr-FR')} €
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="profitability" className="mt-0 space-y-0">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Top 5 by Profitability */}
                <Card className="border-2 border-emerald-500/20 shadow-xl bg-gradient-to-br from-card to-emerald-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Award className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Top 5 Restaurants</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Rentabilité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.topByProfitability.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-emerald-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-emerald-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn("font-bold text-lg", resto.profitability > 55 ? "text-emerald-600 dark:text-emerald-400" : resto.profitability > 45 ? "text-amber-600 dark:text-amber-400" : "text-red-600")}>
                                {resto.profitability}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Flop 5 by Profitability */}
                <Card className="border-2 border-red-500/20 shadow-xl bg-gradient-to-br from-card to-red-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-400">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Points d'attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Rentabilité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.flopByProfitability.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-red-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-red-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-lg text-red-600">
                                {resto.profitability}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="conversion" className="mt-0 space-y-0">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Top 5 by Conversion */}
                <Card className="border-2 border-emerald-500/20 shadow-xl bg-gradient-to-br from-card to-emerald-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Award className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Top 5 Restaurants</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Taux</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.topByConversion?.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-emerald-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-emerald-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                <Users className="h-4 w-4" />
                                {resto.conversionRate}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!networkData?.topByConversion || networkData.topByConversion.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Aucune donnée de conversion disponible
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Flop 5 by Conversion */}
                <Card className="border-2 border-red-500/20 shadow-xl bg-gradient-to-br from-card to-red-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-400">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Points d'attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Taux</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.flopByConversion?.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-red-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-red-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg text-red-600">
                                <Users className="h-4 w-4" />
                                {resto.conversionRate}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!networkData?.flopByConversion || networkData.flopByConversion.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Aucune donnée de conversion disponible
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

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
