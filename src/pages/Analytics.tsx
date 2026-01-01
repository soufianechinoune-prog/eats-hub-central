import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileDown, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnalyticsCharts, ChartActionsConfig } from "@/components/analytics/AnalyticsCharts";
import { RestaurantRanking } from "@/components/analytics/RestaurantRanking";
import { useAnalyticsPdfExport } from "@/hooks/useAnalyticsPdfExport";
import { useRestaurantActions } from "@/hooks/useRestaurantActions";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import Reviews from "@/pages/Reviews";
import { OperationsAnalytics } from "@/components/analytics/OperationsAnalytics";
import { ActionFilterPopover } from "@/components/analytics/ActionFilterPopover";
import { useFrenchHolidays } from "@/hooks/useFrenchHolidays";
import { useSchoolHolidays } from "@/hooks/useSchoolHolidays";
import { useFootballMatches } from "@/hooks/useFootballMatches";

const DEFAULT_CHART_ACTIONS_CONFIG: ChartActionsConfig = {
  global: false,
  revenue: true,
  conversionFunnel: true,
  conversionRate: true,
  fees: true,
  netPayout: true,
  profitability: true,
  avgBasket: true,
};

const MONTHS_FULL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function Analytics() {
  const { viewMode: viewModeParam } = useParams<{ viewMode: string }>();
  const viewMode = (viewModeParam || "overview") as "overview" | "revenue" | "conversion" | "finances" | "reviews" | "operations";
  
  const {
    selectedRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    setPeriodMode,
    setSelectedMonth,
    comparisonMode,
    setComparisonMode,
  } = useAnalyticsContext();

  const [chartActionsConfig, setChartActionsConfig] = useState<ChartActionsConfig>(() => {
    const saved = localStorage.getItem('analyticsChartActionsConfig');
    if (saved) {
      try {
        return { ...DEFAULT_CHART_ACTIONS_CONFIG, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_CHART_ACTIONS_CONFIG;
      }
    }
    return DEFAULT_CHART_ACTIONS_CONFIG;
  });
  // Granular action filtering - track selected action IDs
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
  const [hasInitializedActions, setHasInitializedActions] = useState(false);
  
  // Contextual events toggles - all OFF by default
  const [showHolidays, setShowHolidays] = useState(false);
  const [showSchoolHolidays, setShowSchoolHolidays] = useState(false);
  const [showFootballMatches, setShowFootballMatches] = useState(false);

  // Handler for synchronized drill-down (changes global context)
  const handleMonthDrillDown = (month: number | null) => {
    if (month === null) {
      // Return to year view
      setPeriodMode("year");
    } else {
      // Switch to month mode
      setPeriodMode("month");
      setSelectedMonth(month);
    }
  };

  // Derive drillDownMonth from context
  const drillDownMonth = periodMode === "month" ? selectedMonth : null;

  const chartsRef = useRef<HTMLDivElement>(null);
  const { exportToPdf, isExporting } = useAnalyticsPdfExport();

  const prevYear = selectedYear - 1;

  // Determine data granularity based on selected period
  const { granularity, startDate, endDate, periodDays } = useDataGranularity({
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  });

  // Tab changes are now handled by Analytics context platform selector (no URL sync needed)

  const handleChartActionsConfigChange = (newConfig: ChartActionsConfig) => {
    setChartActionsConfig(newConfig);
    localStorage.setItem('analyticsChartActionsConfig', JSON.stringify(newConfig));
  };

  const handleGlobalToggleChange = (value: boolean) => {
    handleChartActionsConfigChange({ ...chartActionsConfig, global: value });
  };

  

  const navigate = useNavigate();

  const handleActionClick = (actionId: string) => {
    // Navigate to actions page with highlight parameter
    navigate(`/actions?highlight=${actionId}`);
  };

  // Fetch restaurant actions for the selected year and platform
  const { data: uberActions } = useRestaurantActions(
    selectedYear,
    selectedRestaurants.length > 0 ? selectedRestaurants : undefined,
    "uber_eats"
  );

  const { data: deliverooActions } = useRestaurantActions(
    selectedYear,
    selectedRestaurants.length > 0 ? selectedRestaurants : undefined,
    "deliveroo"
  );

  const globalActions = useMemo(() => {
    const all = [...(uberActions || []), ...(deliverooActions || [])];
    // Deduplicate by id
    const uniqueMap = new Map();
    all.forEach(a => uniqueMap.set(a.id, a));
    return Array.from(uniqueMap.values());
  }, [uberActions, deliverooActions]);
  
  
  // Initialize selectedActionIds with all actions when first loaded
  useEffect(() => {
    if (!hasInitializedActions && globalActions.length > 0) {
      setSelectedActionIds(new Set(globalActions.map(a => a.id)));
      setHasInitializedActions(true);
    }
  }, [globalActions, hasInitializedActions]);
  
  // Granular action filtering handlers
  const handleActionToggle = useCallback((actionId: string) => {
    setSelectedActionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  }, []);
  
  const handleSelectAllCategory = useCallback((category: string, selected: boolean) => {
    const categoryActionIds = globalActions.filter(a => a.category === category).map(a => a.id);
    
    setSelectedActionIds(prev => {
      const newSet = new Set(prev);
      categoryActionIds.forEach(id => {
        if (selected) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      });
      return newSet;
    });
  }, [globalActions]);
  
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedActionIds(new Set(globalActions.map(a => a.id)));
    } else {
      setSelectedActionIds(new Set());
    }
  }, [globalActions]);
  
  // Filter actions based on selected IDs
  const filteredGlobalActions = useMemo(() => {
    return globalActions.filter(a => selectedActionIds.has(a.id));
  }, [globalActions, selectedActionIds]);

  // Determine month range based on period mode
  const getEffectiveMonthRange = () => {
    if (periodMode === "year") {
      return { start: 1, end: 12 };
    } else if (periodMode === "month") {
      return { start: selectedMonth, end: selectedMonth };
    } else if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      // For date range, we use full months from start to end
      const startMonth = dateRange.from.getMonth() + 1;
      const endMonth = dateRange.to.getMonth() + 1;
      return { start: startMonth, end: endMonth };
    }
    return { start: 1, end: 12 };
  };

  const { start: effectiveStartMonth, end: effectiveEndMonth } = getEffectiveMonthRange();

  // Platform is managed via AnalyticsContext (persisted in localStorage), no URL sync needed

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants_with_commission"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, postal_code, is_pinned, uber_commission_rate")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
  
  // Filter restaurants to only selected ones for contextual events (school holidays zones)
  // When no specific selection, use pinned restaurants to determine zones
  const selectedRestaurantsData = useMemo(() => {
    if (!restaurants) return [];
    
    if (selectedRestaurants.length === 0) {
      // Use pinned restaurants for zone filtering when "Tous les restaurants"
      return restaurants.filter(r => r.is_pinned);
    }
    
    return restaurants.filter(r => selectedRestaurants.includes(r.id));
  }, [restaurants, selectedRestaurants]);

  // Fetch contextual events (after restaurants are loaded)
  const { contextualEvents: holidayEvents } = useFrenchHolidays(selectedYear, showHolidays);
  const { contextualEvents: schoolHolidayEvents, loading: schoolHolidaysLoading, relevantZones } = useSchoolHolidays(selectedYear, selectedRestaurantsData, showSchoolHolidays);
  const { footballEvents, loading: footballLoading } = useFootballMatches(selectedYear, selectedRestaurantsData, showFootballMatches);

  // Build filter for restaurants
  const restaurantFilter = selectedRestaurants.length > 0 ? selectedRestaurants : undefined;

  // Fetch payouts data from payouts table (aggregated by month)
  const { data: payoutsData, isLoading: loadingPayouts } = useQuery({
    queryKey: ["analytics_payouts", restaurantFilter, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_payouts_summary', {
        p_year: selectedYear,
        p_restaurant_ids: restaurantFilter || null,
      });
      if (error) {
        console.error("[Analytics] get_monthly_payouts_summary error:", error);
        throw error;
      }
      console.log("[Analytics] Payouts data:", data?.length, "rows", data);
      return data || [];
    },
  });

  // Fetch previous year payouts for comparison
  const { data: prevPayoutsData } = useQuery({
    queryKey: ["analytics_payouts_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_payouts_summary', {
        p_year: prevYear,
        p_restaurant_ids: restaurantFilter || null,
      });
      if (error) {
        console.error("[Analytics] get_monthly_payouts_summary (prev) error:", error);
        throw error;
      }
      return data || [];
    },
  });

  // Fetch detailed payouts data - always fetch for the full year in finances mode
  const { data: dailyPayoutsData } = useQuery({
    queryKey: ["analytics_payouts_detail", restaurantFilter, selectedYear, drillDownMonth, viewMode],
    queryFn: async () => {
      // If we have a specific month, fetch just that month
      if (drillDownMonth) {
        const { data, error } = await supabase.rpc('get_monthly_payouts_detail', {
          p_year: selectedYear,
          p_month: drillDownMonth,
          p_restaurant_ids: restaurantFilter || null,
        });
        if (error) {
          console.error("[Analytics] get_monthly_payouts_detail error:", error);
          throw error;
        }
        console.log("[Analytics] Daily payouts data for month", drillDownMonth, ":", data?.length, "rows");
        return data || [];
      }
      
      // In finances mode without drill-down, fetch all payouts for the year
      if (viewMode === "finances") {
        let query = supabase
          .from('payouts')
          .select('*')
          .gte('payout_date', `${selectedYear}-01-01`)
          .lte('payout_date', `${selectedYear}-12-31`)
          .order('payout_date', { ascending: false });
        
        // Filter by restaurants if specified
        if (restaurantFilter && restaurantFilter.length > 0) {
          query = query.in('restaurant_id', restaurantFilter);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error("[Analytics] payouts fetch error:", error);
          throw error;
        }
        console.log("[Analytics] Full year payouts data:", data?.length, "rows");
        return data || [];
      }
      
      return null;
    },
    enabled: !!drillDownMonth || viewMode === "finances",
  });

  // ========== HYBRID DATA SOURCE LOGIC ==========
  // 2025+ → daily_sales_uber table (official Uber "Sales Over Time" exports)
  // 2024 and before → orders table (parsed from detailed reports)
  const SALES_OVER_TIME_START_YEAR = 2025;

  // ========== UBER EATS DATA (Current Year) ==========
  const { data: uberRevenueData, isLoading: loadingUberRevenue, error: uberRevenueError } = useQuery({
    queryKey: ["analytics_revenue_uber", restaurantFilter, selectedYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      console.log("[Analytics] Fetching uber revenue data", { selectedYear, granularity, restaurantFilter });
      // Use daily_sales_uber for 2025+, orders table for 2024 and before
      const useNewTable = selectedYear >= SALES_OVER_TIME_START_YEAR;
      
      if (granularity === "daily") {
        if (useNewTable) {
          const { data, error } = await supabase.rpc('get_daily_sales_uber', {
            p_start_date: format(startDate, "yyyy-MM-dd"),
            p_end_date: format(endDate, "yyyy-MM-dd"),
            p_restaurant_ids: restaurantFilter || null,
            p_period_type: 'current',
          });
          if (error) {
            console.error("[Analytics] get_daily_sales_uber error:", error);
            throw error;
          }
          console.log("[Analytics] get_daily_sales_uber result:", data?.length, "rows");
          return (data || []).map((item: any) => ({
            ...item,
            month: new Date(item.date).getMonth() + 1,
            year: new Date(item.date).getFullYear(),
          }));
        } else {
          // Fallback to orders table for 2024 and before
          const { data, error } = await supabase.rpc('get_daily_revenue_from_orders', {
            p_start_date: format(startDate, "yyyy-MM-dd"),
            p_end_date: format(endDate, "yyyy-MM-dd"),
            p_restaurant_ids: restaurantFilter || null,
          });
          if (error) {
            console.error("[Analytics] get_daily_revenue_from_orders error:", error);
            throw error;
          }
          return (data || []).map((item: any) => ({
            ...item,
            month: new Date(item.date).getMonth() + 1,
            year: new Date(item.date).getFullYear(),
          }));
        }
      } else {
        if (useNewTable) {
          const { data, error } = await supabase.rpc('get_monthly_sales_from_daily', {
            p_year: selectedYear,
            p_restaurant_ids: restaurantFilter || null,
            p_period_type: 'current',
          });
          if (error) {
            console.error("[Analytics] get_monthly_sales_from_daily error:", error);
            throw error;
          }
          console.log("[Analytics] get_monthly_sales_from_daily result:", data?.length, "rows", data);
          return data || [];
        } else {
          // Fallback to orders table for 2024 and before
          const { data, error } = await supabase.rpc('get_monthly_revenue_from_orders', {
            p_year: selectedYear,
            p_restaurant_ids: restaurantFilter || null,
          });
          if (error) {
            console.error("[Analytics] get_monthly_revenue_from_orders error:", error);
            throw error;
          }
          return data || [];
        }
      }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    placeholderData: (previousData) => previousData,
  });

  // Helper function to aggregate daily conversion data by month
  const aggregateDailyConversionByMonth = (dailyData: any[]) => {
    const monthlyMap = new Map<string, any>();

    dailyData.forEach((item) => {
      const month = new Date(item.date).getMonth() + 1;
      const key = `${item.restaurant_id}-${month}`;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          restaurant_id: item.restaurant_id,
          month,
          year: new Date(item.date).getFullYear(),
          platform: item.platform,
          visits: 0,
          menu_views: 0,
          add_to_cart: 0,
          orders: 0,
        });
      }

      const agg = monthlyMap.get(key);
      agg.visits += item.visits || 0;
      agg.menu_views += item.menu_views || 0;
      agg.add_to_cart += item.add_to_cart || 0;
      agg.orders += item.orders || 0;
    });

    // Calculate rates
    return Array.from(monthlyMap.values()).map((item) => ({
      ...item,
      view_rate: item.visits > 0 ? (item.menu_views / item.visits) * 100 : null,
      cart_rate: item.menu_views > 0 ? (item.add_to_cart / item.menu_views) * 100 : null,
      conversion_rate: item.add_to_cart > 0 ? (item.orders / item.add_to_cart) * 100 : null,
      overall_rate: item.visits > 0 ? (item.orders / item.visits) * 100 : null,
    }));
  };

  // Supabase REST has a default 1000-row limit per request.
  // For conversion charts we must page through results, otherwise late-year periods (e.g. December)
  // can appear empty.
  const fetchAllDailyConversion = async (params: {
    platform: "uber_eats" | "deliveroo";
    start: string; // yyyy-MM-dd
    end: string; // yyyy-MM-dd
    restaurantIds?: string[];
  }) => {
    const pageSize = 1000;
    let from = 0;
    const all: any[] = [];

    while (true) {
      let query = supabase
        .from("daily_conversion")
        .select("*")
        .eq("platform", params.platform)
        .gte("date", params.start)
        .lte("date", params.end)
        .order("date")
        .range(from, from + pageSize - 1);

      if (params.restaurantIds?.length) {
        query = query.in("restaurant_id", params.restaurantIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      all.push(...rows);

      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return all;
  };

  const { data: uberConversionData, isLoading: loadingUberConversion } = useQuery({
    queryKey: [
      "analytics_conversion_uber",
      restaurantFilter,
      selectedYear,
      granularity,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const startKey = format(startDate, "yyyy-MM-dd");
      const endKey = format(endDate, "yyyy-MM-dd");

      console.log("[Analytics] Fetching uber conversion data", {
        restaurantFilter,
        selectedYear,
        granularity,
        startKey,
        endKey,
      });

      const rows = await fetchAllDailyConversion({
        platform: "uber_eats",
        start: startKey,
        end: endKey,
        restaurantIds: restaurantFilter,
      });

      console.log("[Analytics] Uber conversion result:", rows.length, "rows");

      const dailyData = rows.map((item) => ({
        ...item,
        month: new Date(item.date).getMonth() + 1,
        year: new Date(item.date).getFullYear(),
      }));

      if (granularity === "daily") return dailyData;
      return aggregateDailyConversionByMonth(dailyData);
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch ALL restaurants' conversion data for ranking comparison (no restaurant filter)
  // Uses dynamic date range based on selected period (year, month, or custom range)
  const { data: allUberConversionData } = useQuery({
    queryKey: [
      "analytics_conversion_uber_all",
      selectedYear,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const startKey = format(startDate, "yyyy-MM-dd");
      const endKey = format(endDate, "yyyy-MM-dd");

      const rows = await fetchAllDailyConversion({
        platform: "uber_eats",
        start: startKey,
        end: endKey,
      });

      const dailyData = rows.map((item) => ({
        ...item,
        month: new Date(item.date).getMonth() + 1,
        year: new Date(item.date).getFullYear(),
      }));

      return aggregateDailyConversionByMonth(dailyData);
    },
    placeholderData: (previousData) => previousData,
  });

  const { data: uberFeesData, isLoading: loadingUberFees } = useQuery({
    queryKey: ["analytics_fees_uber", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    placeholderData: (previousData) => previousData,
  });

  // ========== UBER EATS DATA (Previous Year - N-1 or Rolling Period) ==========
  const { data: uberPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_uber_prev", restaurantFilter, prevYear, selectedYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), comparisonMode],
    queryFn: async () => {
      // Rolling Period mode: use period_type='previous' from daily_sales_uber (2025+ only)
      if (comparisonMode === "rollingPeriod" && selectedYear >= SALES_OVER_TIME_START_YEAR) {
        // Calculer les dates 28 jours avant (4 semaines) pour comparer les mêmes jours de semaine
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 28);
        const prevEndDate = new Date(endDate);
        prevEndDate.setDate(prevEndDate.getDate() - 28);
        
        if (granularity === "daily") {
          const { data, error } = await supabase.rpc('get_daily_sales_uber', {
            p_start_date: format(prevStartDate, "yyyy-MM-dd"),
            p_end_date: format(prevEndDate, "yyyy-MM-dd"),
            p_restaurant_ids: restaurantFilter || null,
            p_period_type: 'current',
          });
          if (error) throw error;
          return (data || []).map((item: any) => ({
            ...item,
            month: new Date(item.date).getMonth() + 1,
            year: new Date(item.date).getFullYear(),
          }));
        } else {
          // Pour la vue mensuelle, récupérer les données du mois précédent
          const { data, error } = await supabase.rpc('get_monthly_sales_from_daily', {
            p_year: prevStartDate.getFullYear(),
            p_restaurant_ids: restaurantFilter || null,
            p_period_type: 'current',
          });
          if (error) throw error;
          return data || [];
        }
      }
      
      // Year over Year mode: fetch from previous year
      const useNewTable = prevYear >= SALES_OVER_TIME_START_YEAR;
      
      if (granularity === "daily") {
        const prevStartDate = new Date(startDate);
        prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
        const prevEndDate = new Date(endDate);
        prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        
        if (useNewTable) {
          const { data, error } = await supabase.rpc('get_daily_sales_uber', {
            p_start_date: format(prevStartDate, "yyyy-MM-dd"),
            p_end_date: format(prevEndDate, "yyyy-MM-dd"),
            p_restaurant_ids: restaurantFilter || null,
            p_period_type: 'current',
          });
          if (error) throw error;
          return (data || []).map((item: any) => ({
            ...item,
            month: new Date(item.date).getMonth() + 1,
            year: new Date(item.date).getFullYear(),
          }));
        } else {
          // Fallback to orders table for 2024 and before
          const { data, error } = await supabase.rpc('get_daily_revenue_from_orders', {
            p_start_date: format(prevStartDate, "yyyy-MM-dd"),
            p_end_date: format(prevEndDate, "yyyy-MM-dd"),
            p_restaurant_ids: restaurantFilter || null,
          });
          if (error) throw error;
          return (data || []).map((item: any) => ({
            ...item,
            month: new Date(item.date).getMonth() + 1,
            year: new Date(item.date).getFullYear(),
          }));
        }
      } else {
        if (useNewTable) {
          const { data, error } = await supabase.rpc('get_monthly_sales_from_daily', {
            p_year: prevYear,
            p_restaurant_ids: restaurantFilter || null,
            p_period_type: 'current',
          });
          if (error) throw error;
          return data || [];
        } else {
          // Fallback to orders table for 2024 and before
          const { data, error } = await supabase.rpc('get_monthly_revenue_from_orders', {
            p_year: prevYear,
            p_restaurant_ids: restaurantFilter || null,
          });
          if (error) throw error;
          return data || [];
        }
      }
    },
  });

  const { data: uberPrevConversionData } = useQuery({
    queryKey: [
      "analytics_conversion_uber_prev",
      restaurantFilter,
      prevYear,
      granularity,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const prevStart = new Date(startDate);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(endDate);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);

      const startKey = format(prevStart, "yyyy-MM-dd");
      const endKey = format(prevEnd, "yyyy-MM-dd");

      const rows = await fetchAllDailyConversion({
        platform: "uber_eats",
        start: startKey,
        end: endKey,
        restaurantIds: restaurantFilter,
      });

      const dailyData = rows.map((item) => ({
        ...item,
        month: new Date(item.date).getMonth() + 1,
        year: new Date(item.date).getFullYear(),
      }));

      if (granularity === "daily") return dailyData;
      return aggregateDailyConversionByMonth(dailyData);
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: uberPrevFeesData } = useQuery({
    queryKey: ["analytics_fees_uber_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== DELIVEROO DATA (Current Year) ==========
  const { data: deliverooRevenueData, isLoading: loadingDeliverooRevenue } = useQuery({
    queryKey: ["analytics_revenue_deliveroo", restaurantFilter, selectedYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (granularity === "daily") {
        let query = supabase
          .from("daily_revenue")
          .select("*")
          .eq("platform", "deliveroo")
          .gte("date", format(startDate, "yyyy-MM-dd"))
          .lte("date", format(endDate, "yyyy-MM-dd"))
          .order("date");
        
        if (restaurantFilter) {
          query = query.in("restaurant_id", restaurantFilter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return data?.map(item => ({
          ...item,
          month: new Date(item.date).getMonth() + 1,
          year: new Date(item.date).getFullYear(),
        })) || [];
      } else {
        let query = supabase
          .from("monthly_revenue")
          .select("*")
          .eq("year", selectedYear)
          .eq("platform", "deliveroo")
          .order("month");
        
        if (restaurantFilter) {
          query = query.in("restaurant_id", restaurantFilter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
      }
    },
    placeholderData: (previousData) => previousData,
  });

  const { data: deliverooConversionData, isLoading: loadingDeliverooConversion } = useQuery({
    queryKey: [
      "analytics_conversion_deliveroo",
      restaurantFilter,
      selectedYear,
      granularity,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const startKey = format(startDate, "yyyy-MM-dd");
      const endKey = format(endDate, "yyyy-MM-dd");

      const rows = await fetchAllDailyConversion({
        platform: "deliveroo",
        start: startKey,
        end: endKey,
        restaurantIds: restaurantFilter,
      });

      const dailyData = rows.map((item) => ({
        ...item,
        month: new Date(item.date).getMonth() + 1,
        year: new Date(item.date).getFullYear(),
      }));

      if (granularity === "daily") return dailyData;
      return aggregateDailyConversionByMonth(dailyData);
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: deliverooFeesData, isLoading: loadingDeliverooFees } = useQuery({
    queryKey: ["analytics_fees_deliveroo", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    placeholderData: (previousData) => previousData,
  });

  // ========== DELIVEROO DATA (Previous Year - N-1) ==========
  const { data: deliverooPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_deliveroo_prev", restaurantFilter, prevYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (granularity === "daily") {
        const prevStartDate = new Date(startDate);
        prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
        const prevEndDate = new Date(endDate);
        prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        
        let query = supabase
          .from("daily_revenue")
          .select("*")
          .eq("platform", "deliveroo")
          .gte("date", format(prevStartDate, "yyyy-MM-dd"))
          .lte("date", format(prevEndDate, "yyyy-MM-dd"))
          .order("date");
        
        if (restaurantFilter) {
          query = query.in("restaurant_id", restaurantFilter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return data?.map(item => ({
          ...item,
          month: new Date(item.date).getMonth() + 1,
          year: new Date(item.date).getFullYear(),
        })) || [];
      } else {
        let query = supabase
          .from("monthly_revenue")
          .select("*")
          .eq("year", prevYear)
          .eq("platform", "deliveroo")
          .order("month");
        
        if (restaurantFilter) {
          query = query.in("restaurant_id", restaurantFilter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
      }
    },
  });

  const { data: deliverooPrevConversionData } = useQuery({
    queryKey: [
      "analytics_conversion_deliveroo_prev",
      restaurantFilter,
      prevYear,
      granularity,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const prevStart = new Date(startDate);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(endDate);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);

      const startKey = format(prevStart, "yyyy-MM-dd");
      const endKey = format(prevEnd, "yyyy-MM-dd");

      const rows = await fetchAllDailyConversion({
        platform: "deliveroo",
        start: startKey,
        end: endKey,
        restaurantIds: restaurantFilter,
      });

      const dailyData = rows.map((item) => ({
        ...item,
        month: new Date(item.date).getMonth() + 1,
        year: new Date(item.date).getFullYear(),
      }));

      if (granularity === "daily") return dailyData;
      return aggregateDailyConversionByMonth(dailyData);
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: deliverooPrevFeesData } = useQuery({
    queryKey: ["analytics_fees_deliveroo_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== GLOBAL DATA (Combined) ==========
  const globalRevenueData = useMemo(() => {
    return [...(uberRevenueData || []), ...(deliverooRevenueData || [])];
  }, [uberRevenueData, deliverooRevenueData]);

  const globalConversionData = useMemo(() => {
    return [...(uberConversionData || []), ...(deliverooConversionData || [])];
  }, [uberConversionData, deliverooConversionData]);

  const globalFeesData = useMemo(() => {
    return [...(uberFeesData || []), ...(deliverooFeesData || [])];
  }, [uberFeesData, deliverooFeesData]);

  const globalPrevRevenueData = useMemo(() => {
    return [...(uberPrevRevenueData || []), ...(deliverooPrevRevenueData || [])];
  }, [uberPrevRevenueData, deliverooPrevRevenueData]);

  const globalPrevConversionData = useMemo(() => {
    return [...(uberPrevConversionData || []), ...(deliverooPrevConversionData || [])];
  }, [uberPrevConversionData, deliverooPrevConversionData]);

  const globalPrevFeesData = useMemo(() => {
    return [...(uberPrevFeesData || []), ...(deliverooPrevFeesData || [])];
  }, [uberPrevFeesData, deliverooPrevFeesData]);

  const isLoading = loadingUberRevenue || loadingUberConversion || loadingUberFees ||
                    loadingDeliverooRevenue || loadingDeliverooConversion || loadingDeliverooFees;

  // Debug logging
  useEffect(() => {
    console.log("[Analytics] Data state:", {
      isLoading,
      uberRevenueData: uberRevenueData?.length,
      uberRevenueError,
      selectedPlatform,
      selectedYear,
      granularity,
      restaurantFilter,
    });
    if (uberRevenueData && uberRevenueData.length > 0) {
      console.log("[Analytics] Sample data:", uberRevenueData[0]);
    }
  }, [isLoading, uberRevenueData, uberRevenueError, selectedPlatform, selectedYear, granularity, restaurantFilter]);

  // Get period display string for PDF export
  const getPeriodDisplay = () => {
    if (periodMode === "month") {
      return `${MONTHS_FULL[selectedMonth - 1]} ${selectedYear}`;
    } else if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "dd MMM yyyy", { locale: fr })} - ${format(dateRange.to, "dd MMM yyyy", { locale: fr })}`;
    }
    return `${selectedYear}`;
  };

  const getRestaurantsDisplay = () => {
    if (selectedRestaurants.length === 0) return "Tous les restaurants";
    const names = restaurants?.filter(r => selectedRestaurants.includes(r.id)).map(r => r.name) || [];
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
  };

  const getPlatformDisplay = () => {
    switch (selectedPlatform) {
      case "uber_eats": return "Uber Eats";
      case "deliveroo": return "Deliveroo";
      default: return "Global";
    }
  };

  const handleExportPdf = () => {
    exportToPdf(chartsRef.current, {
      title: "Rapport Analytics",
      subtitle: "CS Delivery Performance",
      period: getPeriodDisplay(),
      restaurants: getRestaurantsDisplay(),
      platform: getPlatformDisplay(),
    });
  };

  const getTitleByViewMode = (mode: string) => {
    switch (mode) {
      case "revenue":
        return { title: "Revenus & Ventes", subtitle: "Analyse du chiffre d'affaires et des commandes" };
      case "conversion":
        return { title: "Conversion", subtitle: "Analyse du funnel de conversion" };
      case "finances":
        return { title: "Finances & Frais", subtitle: "Analyse des frais et de la rentabilité" };
      case "reviews":
        return { title: "Avis", subtitle: "Analyse des avis clients et produits" };
      case "overview":
        return { title: "Vue d'ensemble", subtitle: "Classement des restaurants par performance" };
      default:
        return { title: "Analytics", subtitle: "Analyse de vos performances mensuelles" };
    }
  };

  const pageTitle = getTitleByViewMode(viewMode);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{pageTitle.title}</h1>
          <p className="text-muted-foreground mt-1">
            {pageTitle.subtitle}
          </p>
        </div>
        <Button
          onClick={handleExportPdf}
          disabled={isExporting || isLoading}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Export en cours...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Exporter PDF
            </>
          )}
        </Button>
      </div>

      {/* Analytics Header with shared filters */}
      <AnalyticsHeader />

      {/* Granularity Badge and Actions Toggle */}
      <div className="flex flex-col gap-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <Label htmlFor="show-actions" className="text-sm font-medium cursor-pointer">
                Afficher les actions
              </Label>
            </div>
            <Switch
              id="show-actions"
              checked={chartActionsConfig.global}
              onCheckedChange={handleGlobalToggleChange}
            />
          </div>
          <Badge 
            variant={granularity === "daily" ? "default" : "secondary"} 
            className="text-xs font-medium gap-1.5 px-3 py-1"
          >
            {granularity === "daily" && "📅"}
            {granularity === "weekly" && "📊"}
            {granularity === "monthly" && "📆"}
            {granularity === "daily" ? "Données quotidiennes" : granularity === "weekly" ? "Données hebdomadaires" : "Données mensuelles"}
          </Badge>
        </div>
        
        {/* Granular action filtering */}
        {chartActionsConfig.global && (
          <ActionFilterPopover
            actions={globalActions}
            selectedActionIds={selectedActionIds}
            onActionToggle={handleActionToggle}
            onSelectAllCategory={handleSelectAllCategory}
            onSelectAll={handleSelectAll}
            showHolidays={showHolidays}
            showSchoolHolidays={showSchoolHolidays}
            showFootballMatches={showFootballMatches}
            onHolidaysToggle={setShowHolidays}
            onSchoolHolidaysToggle={setShowSchoolHolidays}
            onFootballMatchesToggle={setShowFootballMatches}
          />
        )}
      </div>

      {/* Content based on selected platform from context */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div ref={chartsRef} className="mt-6 space-y-6">
          {(() => {
            // Select data based on platform
            const currentRevenueData = selectedPlatform === "uber_eats" 
              ? uberRevenueData 
              : selectedPlatform === "deliveroo" 
                ? deliverooRevenueData 
                : globalRevenueData;
            
            const currentConversionData = selectedPlatform === "uber_eats"
              ? uberConversionData
              : selectedPlatform === "deliveroo"
                ? deliverooConversionData
                : globalConversionData;
            
            const currentFeesData = selectedPlatform === "uber_eats"
              ? uberFeesData
              : selectedPlatform === "deliveroo"
                ? deliverooFeesData
                : globalFeesData;
            
            const currentPrevRevenueData = selectedPlatform === "uber_eats"
              ? uberPrevRevenueData
              : selectedPlatform === "deliveroo"
                ? deliverooPrevRevenueData
                : globalPrevRevenueData;
            
            const currentPrevConversionData = selectedPlatform === "uber_eats"
              ? uberPrevConversionData
              : selectedPlatform === "deliveroo"
                ? deliverooPrevConversionData
                : globalPrevConversionData;
            
            const currentPrevFeesData = selectedPlatform === "uber_eats"
              ? uberPrevFeesData
              : selectedPlatform === "deliveroo"
                ? deliverooPrevFeesData
                : globalPrevFeesData;
            
            // Filter actions based on selected IDs from ActionFilterPopover
            const baseActions = selectedPlatform === "uber_eats"
              ? uberActions
              : selectedPlatform === "deliveroo"
                ? deliverooActions
                : globalActions;
            
            const currentActions = (baseActions || []).filter(a => selectedActionIds.has(a.id));
            
            // Combine contextual events
            const allContextualEvents = [
              ...(holidayEvents || []),
              ...(schoolHolidayEvents || []),
              ...(footballEvents || []),
            ];

            // Render appropriate view
            if (viewMode === "reviews") {
              return <Reviews />;
            } else if (viewMode === "operations") {
              return <OperationsAnalytics />;
            } else if (viewMode === "overview") {
              return (
                <RestaurantRanking
                  restaurants={restaurants}
                  revenueData={currentRevenueData}
                  conversionData={currentConversionData}
                  feesData={currentFeesData}
                  prevRevenueData={currentPrevRevenueData}
                  prevConversionData={currentPrevConversionData}
                  prevFeesData={currentPrevFeesData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                />
              );
            } else {
              return (
                <AnalyticsCharts
                  revenueData={currentRevenueData}
                  conversionData={currentConversionData}
                  feesData={currentFeesData}
                  prevRevenueData={currentPrevRevenueData}
                  prevConversionData={currentPrevConversionData}
                  prevFeesData={currentPrevFeesData}
                  payoutsData={payoutsData}
                  prevPayoutsData={prevPayoutsData}
                  dailyPayoutsData={dailyPayoutsData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                  selectedYear={selectedYear}
                  actions={currentActions}
                  chartActionsConfig={chartActionsConfig}
                  onChartActionsConfigChange={handleChartActionsConfigChange}
                  onActionClick={handleActionClick}
                  viewMode={viewMode as "revenue" | "conversion" | "finances"}
                  restaurants={restaurants}
                  selectedRestaurants={selectedRestaurants}
                  allConversionData={allUberConversionData}
                  granularity={granularity}
                  comparisonMode={comparisonMode}
                  onComparisonModeChange={setComparisonMode}
                  drillDownMonth={drillDownMonth}
                  onDrillDownChange={handleMonthDrillDown}
                  contextualEvents={allContextualEvents}
                />
              );
            }
          })()}
        </div>
      )}
    </div>
  );
}
