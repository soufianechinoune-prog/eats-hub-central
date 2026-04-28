import { useState, useMemo, useEffect, useCallback } from "react";
import { subWeeks, startOfWeek, endOfWeek, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext, PeriodMode } from "@/contexts/AnalyticsContext";
import { useOverviewData } from "@/hooks/useOverviewData";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, TrendingDown, TrendingUp, Percent, PauseCircle, Award, FileDown, FileSpreadsheet, ChevronRight, RefreshCw, Truck, Download, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOverviewExport } from "@/hooks/useOverviewExport";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { RestaurantComparisonTable } from "@/components/overview/RestaurantComparisonTable";
import { useNetworkStats } from "@/hooks/useNetworkStats";

import { PlatformRevenueSplit } from "@/components/overview/PlatformRevenueSplit";
import { useNetworkCashRevenue } from "@/hooks/useNetworkCashRevenue";
import { useActiveChainPOSConnection } from "@/hooks/usePOSConnectors";

const getOverviewStorageKey = (chainId: string | null) =>
  chainId ? `overview-state-${chainId}` : "overview-state";

// Success Score tier configuration
const TIER_BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  Excellent: { label: 'Excellent', color: 'bg-emerald-500' },
  Great: { label: 'Très Bon', color: 'bg-blue-500' },
  Good: { label: 'Bon', color: 'bg-amber-500' },
  Fair: { label: 'Correct', color: 'bg-orange-500' },
  Poor: { label: 'Insuffisant', color: 'bg-red-500' },
};
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

// Load saved state from localStorage (brand-aware)
const getInitialOverviewState = (chainId: string | null) => {
  try {
    const stored = localStorage.getItem(getOverviewStorageKey(chainId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const Overview = () => {
  // Read analytics context for cross-page sync
  const analyticsCtx = useAnalyticsContext();
  const storedState = getInitialOverviewState(analyticsCtx.selectedChainId);
  
  // Map AnalyticsContext periodMode to OverviewPeriodMode
  const ctxPeriodMode: OverviewPeriodMode = 
    analyticsCtx.periodMode === "month" ? "custom_month" :
    analyticsCtx.periodMode === "range" ? "custom_range" :
    (analyticsCtx.periodMode as OverviewPeriodMode);
  
  // Initialize from localStorage, but prefer AnalyticsContext if it was set from another page
  const defaultPeriodMode: OverviewPeriodMode = "previous_week";
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>(
    () => storedState?.periodMode || ctxPeriodMode || defaultPeriodMode
  );
  const [selectedYear, setSelectedYear] = useState(
    () => storedState?.selectedYear || analyticsCtx.selectedYear || new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    () => storedState?.selectedMonth || analyticsCtx.selectedMonth || new Date().getMonth() + 1
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (storedState?.dateRange?.from && storedState?.dateRange?.to) {
      return {
        from: new Date(storedState.dateRange.from),
        to: new Date(storedState.dateRange.to),
      };
    }
    return analyticsCtx.dateRange;
  });
  const [showN1Comparison, setShowN1Comparison] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { exportComprehensivePdf, exportComprehensiveExcel, isExporting } = useOverviewExport();

  // Single unified query for all active restaurants of the active brand
  const selectedChainId = analyticsCtx.selectedChainId;
  const { data: allActiveRestaurants, error: restaurantsError } = useQuery({
    queryKey: ["all-active-restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id")
        .eq("is_active", true);
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    retry: 4,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Persist state to localStorage (brand-aware)
  useEffect(() => {
    const state = {
      periodMode,
      selectedYear,
      selectedMonth,
      dateRange: dateRange ? {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      } : undefined,
    };
    localStorage.setItem(getOverviewStorageKey(selectedChainId), JSON.stringify(state));
  }, [periodMode, selectedYear, selectedMonth, dateRange, selectedChainId]);

  // Fetch latest Success Score for network overview, filtered by chain
  const activeRestaurantIds = useMemo(() => allActiveRestaurants?.map(r => r.id) || [], [allActiveRestaurants]);
  
  const { data: successScoreData } = useQuery({
    queryKey: ["network-success-score", selectedChainId, activeRestaurantIds],
    queryFn: async () => {
      // If chain selected but no restaurants → no scores
      if (selectedChainId && activeRestaurantIds.length === 0) return null;

      let query = supabase
        .from("success_scores")
        .select("score_tier")
        .order("score_month", { ascending: false })
        .limit(100);
      
      if (activeRestaurantIds.length > 0 && selectedChainId) {
        query = query.in("restaurant_id", activeRestaurantIds);
      }

      const { data: scores } = await query;
      if (!scores || scores.length === 0) return null;
      
      const tierCounts: Record<string, number> = {};
      scores.forEach(s => {
        if (s.score_tier) {
          tierCounts[s.score_tier] = (tierCounts[s.score_tier] || 0) + 1;
        }
      });
      
      const dominantTier = Object.entries(tierCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      
      return { dominantTier };
    },
  });
  
  // Aliases for analytics context setters
  const setSelectedRestaurants = analyticsCtx.setSelectedRestaurants;
  const setVisibleRestaurants = analyticsCtx.setVisibleRestaurants;
  const setAnalyticsPeriodMode = analyticsCtx.setPeriodMode;
  const setAnalyticsYear = analyticsCtx.setSelectedYear;
  const setAnalyticsMonth = analyticsCtx.setSelectedMonth;
  const setAnalyticsDateRange = analyticsCtx.setDateRange;
  const setSelectedPlatform = analyticsCtx.setSelectedPlatform;

  // Sync Overview period to AnalyticsContext so all Analytics pages stay in sync
  useEffect(() => {
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
  }, [periodMode, selectedYear, selectedMonth, dateRange]);

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

  // Navigate to Finances & Frais globally (all restaurants) with period and platform pre-selected
  const navigateToFinancesGlobal = (platform: "uber_eats" | "deliveroo" | "global" = "global") => {
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
    setSelectedPlatform(platform);
    
    if (dateRange) {
      setAnalyticsDateRange(dateRange);
    }
    
    // Navigate to Finances tab
    navigate("/analytics/finances");
  };

  // Navigate to Ratings Comparison with period preserved
  const navigateToRatingsComparison = useCallback(() => {
    const ratingsState = {
      periodMode,
      selectedYear,
      selectedMonth,
      customDateRange: dateRange ? {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      } : undefined,
    };
    localStorage.setItem("ratings-comparison-state", JSON.stringify(ratingsState));
    navigate("/compare/ratings");
  }, [periodMode, selectedYear, selectedMonth, dateRange, navigate]);

  // Navigate to Downtime Comparison with period preserved
  const navigateToDowntimeComparison = useCallback(() => {
    const downtimeState = {
      periodMode,
      selectedYear,
      selectedMonth,
      customDateRange: dateRange ? {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      } : undefined,
    };
    localStorage.setItem("downtime-comparison-state", JSON.stringify(downtimeState));

    navigate("/compare/downtime");
  }, [periodMode, selectedYear, selectedMonth, dateRange, navigate]);

  const isCustomPeriod = periodMode !== defaultPeriodMode;

  const handleResetPeriod = () => {
    setPeriodMode(defaultPeriodMode);
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
    setDateRange(undefined);
  };

  // Calculate date range based on selected period — memoized so dependent
  // queries don't re-fetch on every render (huge perf win for full-year views).
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (periodMode) {
      case "previous_week": {
        const lastWeek = subWeeks(now, 1);
        start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      }
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
        end = new Date(selectedYear, selectedMonth, 0);
        break;
      case "custom_range":
        if (dateRange?.from && dateRange?.to) {
          start = dateRange.from;
          end = dateRange.to;
        }
        break;
    }

    // Clamp endDate to today: keeps "vs N-1 (same period)" fair when user
    // selects the current/future year (e.g. 4 months of 2026 vs 12 of 2025).
    if (end > now) end = now;

    return { startDate: start, endDate: end };
  }, [periodMode, selectedYear, selectedMonth, dateRange]);

  // Format dates for queries (use local calendar date, not UTC date)
  // Using toISOString() can shift the day in France/Europe timezones and create an extra day.
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(endDate, "yyyy-MM-dd");

  // All active restaurants of the brand are used (épinglage retiré).
  const activeIds = useMemo(
    () => allActiveRestaurants?.map(r => r.id) || [],
    [allActiveRestaurants]
  );

  // Use the new decomposed hook instead of the monolithic query
  const {
    data: networkData,
    isLoading,
    isFullyLoaded,
    wave1Loading,
    wave2Loading,
    wave3Loading,
    wave4Loading,
    criticalError: overviewError,
    queryKeys: overviewQueryKeys,
    reviewsData: overviewReviewsData,
  } = useOverviewData(startDate, endDate, startDateStr, endDateStr, activeIds, analyticsCtx.selectedChainId);

  const error = overviewError;

  const { stats: comparisonStats, networkTotals, isLoading: statsLoading } = useNetworkStats({
    restaurantIds: activeIds,
    startDate,
    endDate,
    profitabilityBase: "gross",
    includeN1Comparison: showN1Comparison,
    reviewsData: overviewReviewsData,
  });

  const { data: cashRevenueData, isLoading: cashLoading } = useNetworkCashRevenue({
    startDate,
    endDate,
    chainId: analyticsCtx.selectedChainId,
  });
  const { data: activePosConnection } = useActiveChainPOSConnection();
  const cashConnected = !!activePosConnection && activePosConnection.is_active;

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={isExporting}
                className="gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Export en cours…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Télécharger
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={handleExportPdf} disabled={isExporting} className="gap-2">
                <FileDown className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} disabled={isExporting} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      ) : (error || restaurantsError) ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-destructive font-medium">
            Erreur lors du chargement des données
          </p>
          <p className="text-sm text-muted-foreground">
            La base de données est temporairement surchargée. Réessayez dans quelques secondes.
          </p>
          <Button
            onClick={() => {
              overviewQueryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
              queryClient.invalidateQueries({ queryKey: ["all-active-restaurants"] });
            }}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </Button>
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
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.global.rating != null ? networkData.global.rating.toFixed(1) : null} unit="/5" color="text-blue-500" onClick={navigateToRatingsComparison} />
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.global.prepTime)} color="text-amber-500" onClick={() => navigate('/compare/prep-time')} />
                <MetricRow icon={Truck} label="Temps prépa+livraison" value={networkTotals.avgTotalDeliveryTime != null ? `${Math.round(networkTotals.avgTotalDeliveryTime)}min` : null} color="text-cyan-500" onClick={() => navigate('/compare/total-delivery-time')} />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.global.incorrectOrderRate != null ? networkData.global.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" onClick={() => navigate('/compare/inaccurate-orders')} />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.global.profitability != null ? networkData.global.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" onClick={() => navigateToFinancesGlobal("global")} />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.global.downtime)} color="text-orange-500" onClick={navigateToDowntimeComparison} />
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
                  
                  {/* Success Score Badge */}
                  {successScoreData?.dominantTier && TIER_BADGE_CONFIG[successScoreData.dominantTier] && (
                    <Badge 
                      className={`${TIER_BADGE_CONFIG[successScoreData.dominantTier].color} text-white cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => navigate('/success-score')}
                    >
                      {TIER_BADGE_CONFIG[successScoreData.dominantTier].label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.uber.rating != null ? networkData.uber.rating.toFixed(1) : null} unit="/5" color="text-blue-500" onClick={navigateToRatingsComparison} />
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.uber.prepTime)} color="text-amber-500" onClick={() => navigate('/compare/prep-time')} />
                <MetricRow icon={Truck} label="Temps prépa+livraison" value={networkTotals.avgTotalDeliveryTime != null ? `${Math.round(networkTotals.avgTotalDeliveryTime)}min` : null} color="text-cyan-500" onClick={() => navigate('/compare/total-delivery-time')} />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.uber.incorrectOrderRate != null ? networkData.uber.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" onClick={() => navigate('/compare/inaccurate-orders')} />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.uber.profitability != null ? networkData.uber.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" onClick={() => navigateToFinancesGlobal("uber_eats")} />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.uber.downtime)} color="text-orange-500" onClick={navigateToDowntimeComparison} />
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
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.deliveroo.rating != null ? networkData.deliveroo.rating.toFixed(1) : null} unit="/5" color="text-blue-500" onClick={navigateToRatingsComparison} />
                <MetricRow icon={Clock} label="Temps préparation" value={formatMinutesToTime(networkData?.deliveroo.prepTime)} color="text-amber-500" onClick={() => navigate('/compare/prep-time')} />
                <MetricRow icon={Truck} label="Temps prépa+livraison" value={networkTotals.avgTotalDeliveryTime != null ? `${Math.round(networkTotals.avgTotalDeliveryTime)}min` : null} color="text-cyan-500" onClick={() => navigate('/analytics?view=operations&tab=totalDelivery')} />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.deliveroo.incorrectOrderRate != null ? networkData.deliveroo.incorrectOrderRate.toFixed(1) : null} unit="%" color="text-red-500" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.deliveroo.profitability != null ? networkData.deliveroo.profitability.toFixed(1) : null} unit="%" color="text-emerald-500" onClick={() => navigateToFinancesGlobal("deliveroo")} />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={formatHoursToTime(networkData?.deliveroo.downtime)} color="text-orange-500" onClick={navigateToDowntimeComparison} />
              </CardContent>
            </Card>

          </div>

          {/* Platform Revenue Split */}
          <div className="mt-10">
            <PlatformRevenueSplit
              stats={comparisonStats}
              isLoading={statsLoading || cashLoading}
              cashTotal={cashRevenueData?.totalCash ?? 0}
              cashDaysWithData={cashRevenueData?.daysWithData}
              cashVariation={cashRevenueData?.cashVariation ?? null}
            />
          </div>

          {/* Comprehensive Restaurant Comparison Table */}
          <div className="mt-6">
            <RestaurantComparisonTable
              stats={comparisonStats}
              networkTotals={networkTotals}
              showN1Comparison={showN1Comparison}
              onToggleN1={setShowN1Comparison}
              isLoading={statsLoading}
              onRestaurantClick={navigateToFinances}
            />
          </div>


          {/* Avis Produits */}
          <div className="grid gap-6 lg:grid-cols-2 mt-10">
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

            {/* Best Selling Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Produits les plus vendus
                </CardTitle>
              </CardHeader>
              <CardContent>
                {networkData?.bestSellingProducts && networkData.bestSellingProducts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {networkData.bestSellingProducts.map((product, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-primary">
                              {product.quantity.toLocaleString('fr-FR')}
                            </span>
                          </TableCell>
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
