import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, subYears, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileDown, Zap, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnalyticsCharts, ChartActionsConfig } from "@/components/analytics/AnalyticsCharts";
import { RestaurantRanking } from "@/components/analytics/RestaurantRanking";
import { useAnalyticsPdfExport } from "@/hooks/useAnalyticsPdfExport";
import { useRestaurantActions } from "@/hooks/useRestaurantActions";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { resolveBrandScopedRestaurantIds, EMPTY_BRAND_SCOPE_RESTAURANT_IDS } from "@/lib/brandScope";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import Reviews from "@/pages/Reviews";
import { OperationsAnalytics } from "@/components/analytics/OperationsAnalytics";
import { ActionFilterPopover } from "@/components/analytics/ActionFilterPopover";
import { EcoContributionSection } from "@/components/analytics/EcoContributionSection";
import { OffersAnalyticsSection } from "@/components/analytics/OffersAnalyticsSection";
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
  const viewMode = (viewModeParam || "overview") as "overview" | "revenue" | "conversion" | "finances" | "reviews" | "operations" | "eco-contribution" | "offers";
  
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
    isNetworkView,
    selectedChainId,
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
  
  // Profitability chart comparison mode state
  const [profitabilityComparisonMode, setProfitabilityComparisonMode] = useState<"yearOverYear" | "rollingPeriod">("yearOverYear");

  // Conversion granularity override (user can force weekly even in year view)
  const [conversionGranularityOverride, setConversionGranularityOverride] = useState<"auto" | "weekly" | "monthly">("weekly");

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

  // === Performance: only fetch data relevant to the active viewMode ===
  const needsRevenue = viewMode === 'revenue' || viewMode === 'overview';
  const needsConversion = viewMode === 'conversion' || viewMode === 'overview';
  const needsFinances = viewMode === 'finances';
  const needsPayouts = viewMode === 'revenue' || viewMode === 'finances' || viewMode === 'overview';
  const needsProfitability = viewMode === 'revenue' || viewMode === 'finances';

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
    navigate(`/actions?highlight=${actionId}`);
  };

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
    const uniqueMap = new Map();
    all.forEach(a => uniqueMap.set(a.id, a));
    return Array.from(uniqueMap.values());
  }, [uberActions, deliverooActions]);

  useEffect(() => {
    if (!hasInitializedActions && globalActions.length > 0) {
      setSelectedActionIds(new Set(globalActions.map(a => a.id)));
      setHasInitializedActions(true);
    }
  }, [globalActions, hasInitializedActions]);

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

  const filteredGlobalActions = useMemo(() => {
    return globalActions.filter(a => selectedActionIds.has(a.id));
  }, [globalActions, selectedActionIds]);

  const getEffectiveMonthRange = () => {
    if (periodMode === "year") {
      return { start: 1, end: 12 };
    } else if (periodMode === "month") {
      return { start: selectedMonth, end: selectedMonth };
    } else if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      const startMonth = dateRange.from.getMonth() + 1;
      const endMonth = dateRange.to.getMonth() + 1;
      return { start: startMonth, end: endMonth };
    }
    return { start: 1, end: 12 };
  };

  const { start: effectiveStartMonth, end: effectiveEndMonth } = getEffectiveMonthRange();

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants_with_commission", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, city, postal_code, is_pinned, uber_commission_rate")
        .order("name");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const selectedRestaurantsData = useMemo(() => {
    if (!restaurants) return [];

    if (selectedRestaurants.length === 0) {
      return restaurants.filter(r => r.is_pinned);
    }

    return restaurants.filter(r => selectedRestaurants.includes(r.id));
  }, [restaurants, selectedRestaurants]);

  const { contextualEvents: holidayEvents } = useFrenchHolidays(selectedYear, showHolidays);
  const { contextualEvents: schoolHolidayEvents, loading: schoolHolidaysLoading, relevantZones } = useSchoolHolidays(selectedYear, selectedRestaurantsData, showSchoolHolidays);
  const { footballEvents, loading: footballLoading } = useFootballMatches(selectedYear, selectedRestaurantsData, showFootballMatches);

  const pinnedRestaurantIds = useMemo(() =>
    restaurants?.filter(r => r.is_pinned).map(r => r.id) || []
  , [restaurants]);
  const chainRestaurantIds = useMemo(() => restaurants?.map(r => r.id) || [], [restaurants]);

  const restaurantFilter = useMemo(() => (
    resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      isNetworkView,
      chainRestaurantIds,
      pinnedRestaurantIds,
    })
  ), [selectedRestaurants, selectedChainId, isNetworkView, pinnedRestaurantIds, chainRestaurantIds]);

  const isRestaurantScopeReady = !restaurantFilter || 
    restaurantFilter !== EMPTY_BRAND_SCOPE_RESTAURANT_IDS;

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
    enabled: needsPayouts,
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
    enabled: needsPayouts,
  });

  // Fetch advertising expenses from payout_adjustments (3 years for year view)
  const { data: advertisingData } = useQuery({
    queryKey: ["analytics_advertising", restaurantFilter, selectedYear],
    queryFn: async () => {
      const startYear = selectedYear - 2;
      let query = supabase
        .from('payout_adjustments')
        .select('payout_date, restaurant_id, amount')
        .eq('category', 'advertising')
        .gte('payout_date', `${startYear}-01-01`)
        .lte('payout_date', `${selectedYear}-12-31`);
      
      if (restaurantFilter && restaurantFilter.length > 0) {
        query = query.in('restaurant_id', restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error("[Analytics] advertising data error:", error);
        throw error;
      }
      return data || [];
    },
    enabled: needsFinances,
  });

  // Fetch detailed payouts data - always fetch for the full year in finances mode
  // For Deliveroo: fetch from deliveroo_orders and map to PayoutData format
  const { data: deliverooPayoutsData, isLoading: loadingDeliverooPayouts } = useQuery({
    queryKey: ["analytics_deliveroo_payouts_detail", restaurantFilter, selectedYear, drillDownMonth, viewMode],
    queryFn: async () => {
      // Determine date range
      let queryStartDate: string;
      let queryEndDate: string;
      if (drillDownMonth) {
        queryStartDate = `${selectedYear}-${String(drillDownMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, drillDownMonth, 0).getDate();
        queryEndDate = `${selectedYear}-${String(drillDownMonth).padStart(2, '0')}-${lastDay}`;
      } else {
        // Fetch 3 years for year view support
        const startYear = selectedYear - 2;
        queryStartDate = `${startYear}-01-01`;
        queryEndDate = `${selectedYear}-12-31`;
      }

      // Use server-side RPC aggregation instead of client-side pagination
      const PAGE_SIZE = 1000;
      const allRows: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.rpc('get_deliveroo_payouts_detail', {
          p_start_date: queryStartDate,
          p_end_date: queryEndDate,
          p_restaurant_ids: restaurantFilter && restaurantFilter.length > 0 ? restaurantFilter : null,
        }).range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error("[Analytics] get_deliveroo_payouts_detail error:", error);
          throw error;
        }

        if (data) {
          allRows.push(...data);
          hasMore = data.length === PAGE_SIZE;
          from += PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      return allRows;
    },
    enabled: (selectedPlatform === "deliveroo" || selectedPlatform === "global") && (!!drillDownMonth || viewMode === "finances"),
  });

  const { data: dailyPayoutsData } = useQuery({
    queryKey: ["analytics_payouts_detail", restaurantFilter, selectedYear, drillDownMonth, viewMode],
    queryFn: async () => {
      if (viewMode === "finances") {
        // If a specific month is selected, fetch only that month
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
          return data || [];
        }
        // Full year: fetch 3 years in parallel using yearly RPC with pagination to bypass 1000-row limit
        const PAGE_SIZE = 1000;
        const fetchAllForYear = async (year: number) => {
          let all: any[] = [];
          let from = 0;
          while (true) {
            const { data, error } = await supabase
              .rpc('get_yearly_payouts_detail', {
                p_year: year,
                p_restaurant_ids: restaurantFilter || null,
              })
              .range(from, from + PAGE_SIZE - 1);
            if (error) {
              console.error("[Analytics] get_yearly_payouts_detail error:", error);
              throw error;
            }
            if (data) all.push(...data);
            if (!data || data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
          }
          return all;
        };
        const yearsToFetch = [selectedYear, selectedYear - 1, selectedYear - 2];
        const results = await Promise.all(yearsToFetch.map(fetchAllForYear));
        return results.flat();
      }
      
      // For non-finances views, if we have a specific month, fetch just that month
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
        return data || [];
      }
      
      return null;
    },
    enabled: (selectedPlatform !== "deliveroo") && (!!drillDownMonth || viewMode === "finances"),
  });

  // Select the right payouts data based on platform
  const effectiveDailyPayoutsData = useMemo(() => {
    if (selectedPlatform === "deliveroo") return deliverooPayoutsData || [];
    if (selectedPlatform === "global") return [...(dailyPayoutsData || []), ...(deliverooPayoutsData || [])];
    return dailyPayoutsData;
  }, [selectedPlatform, dailyPayoutsData, deliverooPayoutsData]);

  // Aggregate Deliveroo weekly data into monthly summaries (same shape as get_monthly_payouts_summary)
  const deliverooMonthlyPayouts = useMemo(() => {
    if (!deliverooPayoutsData || deliverooPayoutsData.length === 0) return { current: [] as any[], prev: [] as any[] };
    
    const currentYear = selectedYear;
    const prevYear = selectedYear - 1;
    const currentMonthly: Record<number, any> = {};
    const prevMonthly: Record<number, any> = {};

    deliverooPayoutsData.forEach((row: any) => {
      const date = new Date(row.payout_date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const target = year === currentYear ? currentMonthly : year === prevYear ? prevMonthly : null;
      if (!target) return;
      
      if (!target[month]) {
        target[month] = {
          month,
          sales_incl_vat: 0,
          refund_incl_vat: 0,
          item_promo_incl_vat: 0,
          uber_fee_incl_vat: 0,
          delivery_promo_incl_vat: 0,
          other_payments_incl_vat: 0,
          marketing_fee_adjustment: 0,
          net_payout: 0,
          order_count: 0,
          tips: 0,
        };
      }
      const m = target[month];
      m.sales_incl_vat += Number(row.sales_incl_vat) || 0;
      m.refund_incl_vat += Number(row.refund_incl_vat) || 0;
      m.item_promo_incl_vat += Number(row.item_promo_incl_vat) || 0;
      m.uber_fee_incl_vat += Number(row.uber_fee_after_promo_incl_vat) || 0;
      m.other_payments_incl_vat += Number(row.other_payments_incl_vat) || 0;
      m.marketing_fee_adjustment += Number(row.marketing_fee_adjustment) || 0;
      m.net_payout += Number(row.net_payout) || 0;
      m.order_count += Number(row.order_count) || 0;
    });

    return {
      current: Object.values(currentMonthly),
      prev: Object.values(prevMonthly),
    };
  }, [deliverooPayoutsData, selectedYear]);

  // Effective monthly payouts data based on platform
  const effectivePayoutsData = useMemo(() => {
    if (selectedPlatform === "deliveroo") return deliverooMonthlyPayouts.current;
    if (selectedPlatform === "global") return [...(payoutsData || []), ...deliverooMonthlyPayouts.current];
    return payoutsData;
  }, [selectedPlatform, payoutsData, deliverooMonthlyPayouts]);

  const effectivePrevPayoutsData = useMemo(() => {
    if (selectedPlatform === "deliveroo") return deliverooMonthlyPayouts.prev;
    if (selectedPlatform === "global") return [...(prevPayoutsData || []), ...deliverooMonthlyPayouts.prev];
    return prevPayoutsData;
  }, [selectedPlatform, prevPayoutsData, deliverooMonthlyPayouts]);

  // ========== PROFITABILITY DATA ==========
  // Calculate previous period range for profitability comparison
  const profitabilityPrevRange = useMemo(() => {
    if (profitabilityComparisonMode === "rollingPeriod") {
      return { start: subWeeks(startDate, 4), end: subWeeks(endDate, 4) };
    }
    return { start: subYears(startDate, 1), end: subYears(endDate, 1) };
  }, [startDate, endDate, profitabilityComparisonMode]);

  // Fetch profitability data for current period
  const { data: profitabilityData } = useQuery({
    queryKey: ["analytics_profitability", restaurantFilter, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const ids = restaurantFilter || restaurants?.filter(r => r.is_pinned).map(r => r.id) || [];
      if (!ids.length) return [];
      
      const { data, error } = await supabase.rpc("get_profitability_daily", {
        p_restaurant_ids: ids,
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
      });
      if (error) {
        console.error("[Analytics] get_profitability_daily error:", error);
        throw error;
      }
      return data || [];
    },
    enabled: needsProfitability && (restaurants?.length || 0) > 0,
  });

  // Fetch profitability data for previous period
  const { data: prevProfitabilityData } = useQuery({
    queryKey: ["analytics_profitability_prev", restaurantFilter, format(profitabilityPrevRange.start, "yyyy-MM-dd"), format(profitabilityPrevRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      const ids = restaurantFilter || restaurants?.filter(r => r.is_pinned).map(r => r.id) || [];
      if (!ids.length) return [];
      
      const { data, error } = await supabase.rpc("get_profitability_daily", {
        p_restaurant_ids: ids,
        p_start_date: format(profitabilityPrevRange.start, "yyyy-MM-dd"),
        p_end_date: format(profitabilityPrevRange.end, "yyyy-MM-dd"),
      });
      if (error) {
        console.error("[Analytics] get_profitability_daily prev error:", error);
        throw error;
      }
      return data || [];
    },
    enabled: needsProfitability && (restaurants?.length || 0) > 0,
  });

  // ========== UBER EATS DATA (Current Year) — always from orders table ==========
  const { data: uberRevenueData, isLoading: loadingUberRevenue, error: uberRevenueError } = useQuery({
    queryKey: ["analytics_revenue_uber", restaurantFilter, selectedYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      console.log("[Analytics] Fetching uber revenue data from orders", { selectedYear, granularity, restaurantFilter });
      
      if (granularity === "daily") {
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
      } else {
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
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    placeholderData: (previousData) => previousData,
    enabled: needsRevenue && isRestaurantScopeReady,
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
      // Always return daily data so AnalyticsCharts can aggregate weekly if needed
      return dailyData;
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: needsConversion,
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
    enabled: needsConversion,
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
    enabled: needsRevenue && isRestaurantScopeReady,
  });

  // ========== UBER EATS DATA (Previous Year - N-1 or Rolling Period) ==========
  const { data: uberPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_uber_prev", restaurantFilter, prevYear, selectedYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), comparisonMode],
    queryFn: async () => {
      // Rolling Period mode: fetch 28 days before current period
      if (comparisonMode === "rollingPeriod") {
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 28);
        const prevEndDate = new Date(endDate);
        prevEndDate.setDate(prevEndDate.getDate() - 28);
        
        if (granularity === "daily") {
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
        } else {
          const { data, error } = await supabase.rpc('get_monthly_revenue_from_orders', {
            p_year: prevStartDate.getFullYear(),
            p_restaurant_ids: restaurantFilter || null,
          });
          if (error) throw error;
          return data || [];
        }
      }
      
      // Year over Year mode: fetch from previous year
      if (granularity === "daily") {
        const prevStartDate = new Date(startDate);
        prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
        const prevEndDate = new Date(endDate);
        prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        
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
      } else {
        const { data, error } = await supabase.rpc('get_monthly_revenue_from_orders', {
          p_year: prevYear,
          p_restaurant_ids: restaurantFilter || null,
        });
        if (error) throw error;
        return data || [];
      }
    },
    enabled: needsRevenue && isRestaurantScopeReady,
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
      // Always return daily data for flexible aggregation in AnalyticsCharts
      return dailyData;
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: needsConversion,
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
    enabled: needsRevenue && isRestaurantScopeReady,
  });

  // ========== DELIVEROO DATA (Current Year) ==========
  // Shared helper: fetch all deliveroo_orders rows in a date range with pagination
  const fetchAllDeliverooOrderRows = useCallback(async (qStart: string, qEnd: string) => {
    const PAGE_SIZE = 1000;
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      let query = supabase
        .from("deliveroo_orders")
        .select("delivery_datetime, order_amount, history_type, restaurant_id")
        .gte("delivery_datetime", `${qStart}T00:00:00`)
        .lte("delivery_datetime", `${qEnd}T23:59:59`)
        .range(from, from + PAGE_SIZE - 1);
      if (restaurantFilter && restaurantFilter.length > 0) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        allRows.push(...data);
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    return allRows;
  }, [restaurantFilter]);

  // Shared helper: aggregate deliveroo order rows into revenue data
  const aggregateDeliverooRevenue = useCallback((rows: any[], gran: typeof granularity) => {
    const ORDER_TYPES = ["Livraison", "À emporter"];
    const orderRows = rows.filter(r => ORDER_TYPES.includes(r.history_type));

    const grouped: Record<string, { revenue: number; count: number; restaurantId: string }[]> = {};

    // Helper: format a UTC date as yyyy-MM-dd in Europe/Paris timezone
    const toParisDate = (d: Date) => {
      const parts = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      const y = parts.find(p => p.type === 'year')!.value;
      const m = parts.find(p => p.type === 'month')!.value;
      const dd = parts.find(p => p.type === 'day')!.value;
      return { dateStr: `${y}-${m}-${dd}`, year: Number(y), month: Number(m) };
    };

    for (const row of orderRows) {
      if (!row.delivery_datetime) continue;
      const dt = new Date(row.delivery_datetime);
      const paris = toParisDate(dt);
      const key = gran === "daily"
        ? paris.dateStr
        : `${paris.year}-${paris.month}`;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        revenue: Math.abs(Number(row.order_amount) || 0),
        count: 1,
        restaurantId: row.restaurant_id,
      });
    }

    return Object.entries(grouped).map(([key, items]) => {
      const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
      const totalCount = items.length;
      if (gran === "daily") {
        return {
          id: key,
          date: key,
          platform: "deliveroo",
          restaurant_id: items[0].restaurantId,
          revenue_ttc: totalRevenue,
          order_count: totalCount,
          average_basket: totalCount > 0 ? totalRevenue / totalCount : 0,
          month: new Date(key).getMonth() + 1,
          year: new Date(key).getFullYear(),
        };
      } else {
        const [y, m] = key.split("-").map(Number);
        return {
          id: key,
          platform: "deliveroo",
          restaurant_id: items[0].restaurantId,
          revenue_ttc: totalRevenue,
          order_count: totalCount,
          average_basket: totalCount > 0 ? totalRevenue / totalCount : 0,
          month: m,
          year: y,
        };
      }
    });
  }, []);

  const { data: deliverooRevenueData, isLoading: loadingDeliverooRevenue } = useQuery({
    queryKey: ["analytics_revenue_deliveroo", restaurantFilter, selectedYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const rows = await fetchAllDeliverooOrderRows(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"));
      return aggregateDeliverooRevenue(rows, granularity);
    },
    placeholderData: (previousData) => previousData,
    enabled: needsRevenue && isRestaurantScopeReady,
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
      // Always return daily data for flexible aggregation in AnalyticsCharts
      return dailyData;
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: needsConversion,
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
    enabled: needsRevenue && isRestaurantScopeReady,
  });

  // ========== DELIVEROO DATA (Previous Year - N-1) ==========
  const { data: deliverooPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_deliveroo_prev", restaurantFilter, prevYear, granularity, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const prevStartDate = new Date(startDate);
      prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
      const prevEndDate = new Date(endDate);
      prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
      const rows = await fetchAllDeliverooOrderRows(format(prevStartDate, "yyyy-MM-dd"), format(prevEndDate, "yyyy-MM-dd"));
      return aggregateDeliverooRevenue(rows, granularity);
    },
    enabled: needsRevenue && isRestaurantScopeReady,
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
      // Always return daily data for flexible aggregation in AnalyticsCharts
      return dailyData;
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: needsConversion,
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
    enabled: needsRevenue && isRestaurantScopeReady,
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
      case "eco-contribution":
        return { title: "Éco-Contribution", subtitle: "Suivi des éco-contributions et prélèvements" };
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{pageTitle.title}</h1>
            <p className="text-muted-foreground mt-1">
              {pageTitle.subtitle}
            </p>
          </div>
        </div>
        {viewMode !== "eco-contribution" && (
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
        )}
      </div>

      {/* Analytics Header with shared filters */}
      {viewMode !== "eco-contribution" && <AnalyticsHeader weekOnlyRange={viewMode === "conversion"} />}

      {/* Granularity Badge and Actions Toggle - hidden entirely on finances view */}
      {viewMode !== "finances" && viewMode !== "eco-contribution" && (
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
      )}

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
            if (viewMode === "offers") {
              return <OffersAnalyticsSection />;
            } else if (viewMode === "eco-contribution") {
              return (
                <EcoContributionSection
                  restaurants={restaurants || []}
                  selectedRestaurants={[]}
                  selectedYear={selectedYear}
                  selectedMonth={drillDownMonth}
                  selectedPlatform={selectedPlatform}
                  selectedChainId={selectedChainId}
                />
              );
            } else if (viewMode === "reviews") {
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
                  payoutsData={effectivePayoutsData}
                  prevPayoutsData={effectivePrevPayoutsData}
                  dailyPayoutsData={effectiveDailyPayoutsData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                  selectedYear={selectedYear}
                  startDate={startDate}
                  endDate={endDate}
                  actions={currentActions}
                  chartActionsConfig={chartActionsConfig}
                  onChartActionsConfigChange={handleChartActionsConfigChange}
                  onActionClick={handleActionClick}
                  viewMode={viewMode as "revenue" | "conversion" | "finances"}
                  restaurants={restaurants}
                  selectedRestaurants={selectedRestaurants}
                  allConversionData={allUberConversionData}
                  granularity={granularity}
                  conversionGranularityOverride={conversionGranularityOverride}
                  onConversionGranularityOverrideChange={setConversionGranularityOverride}
                  comparisonMode={comparisonMode}
                  onComparisonModeChange={setComparisonMode}
                  drillDownMonth={drillDownMonth}
                  onDrillDownChange={handleMonthDrillDown}
                  contextualEvents={allContextualEvents}
                  profitabilityData={profitabilityData}
                  prevProfitabilityData={prevProfitabilityData}
                  profitabilityDateRange={{ start: startDate, end: endDate }}
                  profitabilityPrevDateRange={profitabilityPrevRange}
                  profitabilityComparisonMode={profitabilityComparisonMode}
                  onProfitabilityComparisonModeChange={setProfitabilityComparisonMode}
                  advertisingData={advertisingData}
                  // Action filtering props for FinancesSection
                  globalActions={globalActions}
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
                  isPayoutsLoading={loadingDeliverooPayouts}
                />
              );
            }
          })()}
        </div>
      )}
    </div>
  );
}
