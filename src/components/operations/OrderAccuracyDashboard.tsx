import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  TrendingDown,
  Euro,
  Package,
  FileWarning,
  Loader2,
  Target,
  Info,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ErrorRateEvolutionChart } from "./ErrorRateEvolutionChart";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { checkRestaurantOpeningDate } from "@/lib/restaurantOpeningDates";
import type { PeriodMode } from "@/contexts/AnalyticsContext";

interface OrderAccuracyDashboardProps {
  selectedRestaurants: string[];
  selectedYear: number;
  selectedMonth: number | "all";
  restaurants: Array<{ id: string; name: string }>;
  periodMode?: PeriodMode;
  dateRange?: { start: Date; end: Date };
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  "Articles manquants": "#ef4444",
  "Personnalisation manquante": "#8b5cf6",
  "Mauvaise commande": "#3b82f6",
  "Article incorrect": "#f97316",
};

export function OrderAccuracyDashboard({
  selectedRestaurants,
  selectedYear,
  selectedMonth,
  restaurants,
  periodMode = "year",
  dateRange,
}: OrderAccuracyDashboardProps) {
  // Determine if we're selecting all or specific restaurants
  const isAllRestaurants = selectedRestaurants.length === 0;
  const restaurantIds = isAllRestaurants ? restaurants.map(r => r.id) : selectedRestaurants;
  const [objective, setObjective] = useState(2);
  const [chartType, setChartType] = useState<"line" | "bar">("bar");
  
  // Chart mode (year vs month)
  const [chartPeriodMode, setChartPeriodMode] = useState<"year" | "month">("year");
  const [chartSelectedMonth, setChartSelectedMonth] = useState<number | null>(null);

  // Calculate actual date range for filtering
  const effectiveDateRange = useMemo(() => {
    // Handle all quick period modes that have a dateRange
    const isQuickPeriod = ["range", "previous_week", "7d", "30d", "current_month"].includes(periodMode);
    
    if (isQuickPeriod && dateRange) {
      return {
        startDate: format(dateRange.start, "yyyy-MM-dd"),
        endDate: format(dateRange.end, "yyyy-MM-dd"),
      };
    }
    if (periodMode === "month" && selectedMonth !== "all") {
      const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      const monthEnd = endOfMonth(monthStart);
      return {
        startDate: format(monthStart, "yyyy-MM-dd"),
        endDate: format(monthEnd, "yyyy-MM-dd"),
      };
    }
    // Year mode fallback
    return {
      startDate: `${selectedYear}-01-01`,
      endDate: `${selectedYear}-12-31`,
    };
  }, [periodMode, dateRange, selectedYear, selectedMonth]);

  // Keep the chart aligned with the global filter
  useEffect(() => {
    if (periodMode === "range") {
      // For range mode, show daily data
      setChartPeriodMode("month");
      setChartSelectedMonth(null);
      return;
    }
    
    if (selectedMonth === "all") {
      setChartPeriodMode("year");
      setChartSelectedMonth(null);
      return;
    }

    setChartPeriodMode("month");
    setChartSelectedMonth(selectedMonth);
  }, [selectedMonth, selectedYear, periodMode, restaurantIds.join(",")]);
  // Fetch daily order accuracy data (new format)
  const { data: dailyAccuracy, isLoading: isLoadingDaily } = useQuery({
    queryKey: ["daily-order-accuracy", restaurantIds, effectiveDateRange.startDate, effectiveDateRange.endDate],
    queryFn: async () => {
      let query = supabase
        .from("daily_order_accuracy")
        .select("*")
        .eq("period_type", "current")
        .gte("date", effectiveDateRange.startDate)
        .lte("date", effectiveDateRange.endDate)
        .order("date", { ascending: true });

      if (!isAllRestaurants && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching daily accuracy:", error);
        return [];
      }
      return data || [];
    },
  });

  // Fallback: fetch monthly order accuracy (old format)
  const { data: monthlyAccuracy, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ["monthly-order-accuracy", restaurantIds, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_order_accuracy")
        .select("*")
        .eq("year", selectedYear)
        .order("month", { ascending: true });

      if (!isAllRestaurants && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching monthly accuracy:", error);
        return [];
      }
      return data || [];
    },
    enabled: periodMode !== "range", // Don't fetch monthly data in range mode
  });

  // Fallback #2: fetch from order_errors table (CSV imports)
  const { data: orderErrorsData, isLoading: isLoadingOrderErrors } = useQuery({
    queryKey: ["order-errors-fallback", restaurantIds, effectiveDateRange.startDate, effectiveDateRange.endDate],
    queryFn: async () => {
      let query = supabase
        .from("order_errors")
        .select("restaurant_id, uber_order_id, financial_impact, error_date, error_category")
        .gte("error_date", effectiveDateRange.startDate)
        .lte("error_date", effectiveDateRange.endDate);

      if (!isAllRestaurants && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching order errors:", error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch product issues ranking - now filtered by date range and aggregated
  const { data: productIssues, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["product-issues-ranking", restaurantIds, effectiveDateRange.startDate, effectiveDateRange.endDate],
    queryFn: async () => {
      // Fetch all product issues that overlap with the selected date range
      let query = supabase
        .from("product_issues_ranking")
        .select("*");

      if (!isAllRestaurants && restaurantIds.length > 0) {
        query = query.in("restaurant_id", restaurantIds);
      }

      // Filter by date range overlap:
      // Records where date_range_start <= effectiveDateRange.endDate AND date_range_end >= effectiveDateRange.startDate
      query = query
        .lte("date_range_start", effectiveDateRange.endDate)
        .gte("date_range_end", effectiveDateRange.startDate);

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching product issues:", error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Aggregate volumes by item_title across all matching date ranges
      const aggregated = new Map<string, { item_title: string; volume: number; score: number; count: number }>();
      
      for (const item of data) {
        const key = item.item_title;
        if (aggregated.has(key)) {
          const existing = aggregated.get(key)!;
          existing.volume += item.volume || 0;
          existing.score += item.score || 0;
          existing.count += 1;
        } else {
          aggregated.set(key, {
            item_title: item.item_title,
            volume: item.volume || 0,
            score: item.score || 0,
            count: 1,
          });
        }
      }

      // Convert to array, calculate average score, sort by volume and take top 10
      return Array.from(aggregated.values())
        .map(item => ({
          item_title: item.item_title,
          volume: item.volume,
          score: item.count > 0 ? item.score / item.count : 0,
        }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);
    },
  });

  // Check if we need daily sales data (for quick periods or range mode)
  const needsDailySales = ["range", "previous_week", "7d", "30d", "current_month"].includes(periodMode) || !!chartSelectedMonth;

  // Fetch sales data for error rate calculation (monthly RPC for year/month modes)
  const { data: salesData } = useQuery({
    queryKey: ["sales-for-error-rate", restaurantIds, selectedYear, periodMode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monthly_sales_from_daily", {
        p_year: selectedYear,
        p_restaurant_ids: restaurantIds,
        p_period_type: "current",
      });
      
      if (error) return [];
      return data || [];
    },
    // Only use monthly RPC for year/month views, not for quick periods
    enabled: !needsDailySales && periodMode !== "range",
  });

  // Fetch daily sales data for range mode, quick periods, or drill-down
  const { data: dailySalesData } = useQuery({
    queryKey: ["daily-sales-for-error-rate", restaurantIds, effectiveDateRange.startDate, effectiveDateRange.endDate, periodMode, chartSelectedMonth],
    queryFn: async () => {
      // Use effective date range for quick periods/range mode, or monthly range for drill-down
      let startDate: string;
      let endDate: string;
      
      if (needsDailySales && !chartSelectedMonth) {
        // Quick periods or range mode - use effective date range
        startDate = effectiveDateRange.startDate;
        endDate = effectiveDateRange.endDate;
      } else if (chartSelectedMonth) {
        // Drill-down into a specific month
        startDate = `${selectedYear}-${String(chartSelectedMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(selectedYear, chartSelectedMonth, 0).getDate();
        endDate = `${selectedYear}-${String(chartSelectedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      } else {
        return [];
      }
      
      const { data, error } = await supabase.rpc("get_daily_sales_uber", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_restaurant_ids: restaurantIds,
        p_period_type: "current",
      });
      
      if (error) return [];
      return data || [];
    },
    enabled: needsDailySales || !!chartSelectedMonth,
  });

  // Determine which data source to use
  const hasDaily = dailyAccuracy && dailyAccuracy.length > 0;
  const hasMonthly = monthlyAccuracy && monthlyAccuracy.length > 0;
  const hasOrderErrors = orderErrorsData && orderErrorsData.length > 0;
  const useDaily = hasDaily;
  const useOrderErrors = !hasDaily && !hasMonthly && hasOrderErrors;
  const dataSource: "daily" | "monthly" | "order_errors" | "none" = 
    hasDaily ? "daily" : hasMonthly ? "monthly" : hasOrderErrors ? "order_errors" : "none";

  // Aggregate data based on source and selection
  const aggregatedData = useMemo(() => {
    if (useDaily && dailyAccuracy) {
      // For range mode or specific month, daily data is already filtered by the query
      // For year view with month filter, we need to filter here
      let filtered = dailyAccuracy;
      if (periodMode !== "range" && selectedMonth !== "all") {
        filtered = dailyAccuracy.filter(d => {
          const date = parseISO(d.date);
          return date.getMonth() + 1 === selectedMonth;
        });
      }

      return filtered.reduce((acc, d) => ({
        incorrect_orders: acc.incorrect_orders + (d.incorrect_orders_count || 0),
        missing_items: acc.missing_items + (d.missing_items_count || 0),
        missing_items_refund: acc.missing_items_refund + Number(d.missing_items_refund || 0),
        missing_customization: acc.missing_customization + (d.missing_customization_count || 0),
        missing_customization_refund: acc.missing_customization_refund + Number(d.missing_customization_refund || 0),
        wrong_order: acc.wrong_order + (d.wrong_order_count || 0),
        wrong_order_refund: acc.wrong_order_refund + Number(d.wrong_order_refund || 0),
        incorrect_item: acc.incorrect_item + (d.incorrect_item_count || 0),
        incorrect_item_refund: acc.incorrect_item_refund + Number(d.incorrect_item_refund || 0),
        total_refund: acc.total_refund + Number(d.total_refund || 0),
      }), {
        incorrect_orders: 0,
        missing_items: 0,
        missing_items_refund: 0,
        missing_customization: 0,
        missing_customization_refund: 0,
        wrong_order: 0,
        wrong_order_refund: 0,
        incorrect_item: 0,
        incorrect_item_refund: 0,
        total_refund: 0,
      });
    } else if (monthlyAccuracy && monthlyAccuracy.length > 0) {
      const filtered = selectedMonth === "all" 
        ? monthlyAccuracy 
        : monthlyAccuracy.filter(m => m.month === selectedMonth);

      return filtered.reduce((acc, m) => ({
        incorrect_orders: acc.incorrect_orders + (m.incorrect_orders_count || 0),
        missing_items: acc.missing_items + (m.missing_items_count || 0),
        missing_items_refund: acc.missing_items_refund + Number(m.missing_items_refund || 0),
        missing_customization: acc.missing_customization + (m.missing_customization_count || 0),
        missing_customization_refund: acc.missing_customization_refund + Number(m.missing_customization_refund || 0),
        wrong_order: acc.wrong_order + (m.wrong_order_count || 0),
        wrong_order_refund: acc.wrong_order_refund + Number(m.wrong_order_refund || 0),
        incorrect_item: acc.incorrect_item + (m.incorrect_item_count || 0),
        incorrect_item_refund: acc.incorrect_item_refund + Number(m.incorrect_item_refund || 0),
        total_refund: acc.total_refund + Number(m.total_refund || 0),
      }), {
        incorrect_orders: 0,
        missing_items: 0,
        missing_items_refund: 0,
        missing_customization: 0,
        missing_customization_refund: 0,
        wrong_order: 0,
        wrong_order_refund: 0,
        incorrect_item: 0,
        incorrect_item_refund: 0,
        total_refund: 0,
      });
    } else if (useOrderErrors && orderErrorsData) {
      // Aggregate from order_errors table (CSV import fallback)
      const distinctOrders = new Set(orderErrorsData.map(e => e.uber_order_id).filter(Boolean));
      const totalImpact = orderErrorsData.reduce((sum, e) => sum + (e.financial_impact || 0), 0);
      
      // Map error_category to standard categories
      const categoryCounts: Record<string, { count: number; refund: number }> = {};
      orderErrorsData.forEach(e => {
        const cat = e.error_category || "Autre";
        if (!categoryCounts[cat]) categoryCounts[cat] = { count: 0, refund: 0 };
        categoryCounts[cat].count += 1;
        categoryCounts[cat].refund += e.financial_impact || 0;
      });

      const mapCategory = (name: string) => categoryCounts[name] || { count: 0, refund: 0 };
      const missingItems = mapCategory("Articles manquants");
      const wrongOrder = mapCategory("Commande incorrecte");
      const incorrectItem = mapCategory("Article incorrect");
      const qualityIssues = mapCategory("Problèmes liés à la qualité des aliments");
      const other = mapCategory("Autre");

      return {
        incorrect_orders: distinctOrders.size,
        missing_items: missingItems.count,
        missing_items_refund: missingItems.refund,
        missing_customization: qualityIssues.count, // Map quality issues to this slot
        missing_customization_refund: qualityIssues.refund,
        wrong_order: wrongOrder.count,
        wrong_order_refund: wrongOrder.refund,
        incorrect_item: incorrectItem.count + other.count,
        incorrect_item_refund: incorrectItem.refund + other.refund,
        total_refund: totalImpact,
      };
    }
    
    return null;
  }, [dailyAccuracy, monthlyAccuracy, orderErrorsData, selectedMonth, periodMode, useDaily, useOrderErrors]);

  // Calculate order count from sales data
  const orderCount = useMemo(() => {
    // For quick periods (range, previous_week, 7d, 30d, current_month), use daily sales data
    const isQuickPeriod = ["range", "previous_week", "7d", "30d", "current_month"].includes(periodMode);
    
    if (isQuickPeriod) {
      if (!dailySalesData || dailySalesData.length === 0) return 0;
      return dailySalesData.reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
    }
    
    if (!salesData || salesData.length === 0) return 0;
    
    if (selectedMonth !== "all") {
      return salesData
        .filter((r: any) => r.month === selectedMonth)
        .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
    }
    
    // For year view, only count months with error data
    if (useDaily && dailyAccuracy) {
      const monthsWithData = [...new Set(dailyAccuracy.map(d => parseISO(d.date).getMonth() + 1))];
      return salesData
        .filter((r: any) => monthsWithData.includes(r.month))
        .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
    } else if (monthlyAccuracy) {
      const monthsWithData = monthlyAccuracy.map(m => m.month);
      return salesData
        .filter((r: any) => monthsWithData.includes(r.month))
        .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
    }
    
    return salesData.reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
  }, [salesData, dailySalesData, selectedMonth, dailyAccuracy, monthlyAccuracy, periodMode, useDaily]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!aggregatedData) return null;

    const totalErrors = aggregatedData.incorrect_orders;
    const totalImpact = aggregatedData.total_refund;
    const avgImpact = totalErrors > 0 ? totalImpact / totalErrors : 0;
    const errorRate = orderCount && orderCount > 0 ? (totalErrors / orderCount) * 100 : 0;
    const meetsObjective = errorRate <= objective;

    return {
      totalErrors,
      totalImpact,
      avgImpact,
      errorRate,
      orderCount,
      meetsObjective,
      hasSalesData: orderCount > 0,
    };
  }, [aggregatedData, orderCount, objective]);

  // Build evolution data for chart
  const errorEvolutionData = useMemo(() => {
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    // RANGE MODE - Show daily data for the selected range
    if (periodMode === "range") {
      // Get daily order counts from daily sales data
      const dailyOrders: Record<string, number> = {};
      (dailySalesData || []).forEach((r: any) => {
        const dateStr = r.date;
        dailyOrders[dateStr] = (dailyOrders[dateStr] || 0) + (r.order_count || 0);
      });

      // Group errors by day
      const dailyErrors: Record<string, { errors: number; refund: number }> = {};
      (dailyAccuracy || []).forEach(d => {
        const dateStr = d.date;
        if (!dailyErrors[dateStr]) {
          dailyErrors[dateStr] = { errors: 0, refund: 0 };
        }
        dailyErrors[dateStr].errors += d.incorrect_orders_count || 0;
        dailyErrors[dateStr].refund += Number(d.total_refund || 0);
      });

      // CRITICAL FIX: Use ALL days from sales data as base, not just days with errors
      // This ensures days with 0 errors are displayed as 0% instead of being omitted
      const allDates = new Set([
        ...Object.keys(dailyOrders),
        ...Object.keys(dailyErrors),
      ]);

      return Array.from(allDates)
        .sort((a, b) => a.localeCompare(b))
        .map(dateStr => {
          const date = parseISO(dateStr);
          const orders = dailyOrders[dateStr] || 0;
          const errorData = dailyErrors[dateStr] || { errors: 0, refund: 0 };
          return {
            period: dateStr,
            label: format(date, "d MMM", { locale: fr }),
            // If we have orders but no errors, that's 0% - not null
            errorRate: orders > 0 ? (errorData.errors / orders) * 100 : null,
            errorCount: errorData.errors,
            orderCount: orders,
            hasSalesData: orders > 0,
          };
        });
    }

    // DAILY VIEW (drill-down mode for month view)
    if (chartPeriodMode === "month" && chartSelectedMonth) {
      // Get daily order counts from daily sales data
      const dailyOrders: Record<string, number> = {};
      (dailySalesData || []).forEach((r: any) => {
        const dateStr = r.date;
        dailyOrders[dateStr] = (dailyOrders[dateStr] || 0) + (r.order_count || 0);
      });

      // Filter daily accuracy data for the selected month
      const filteredDailyAccuracy = (dailyAccuracy || []).filter(d => {
        const date = parseISO(d.date);
        return date.getMonth() + 1 === chartSelectedMonth;
      });

      // Group errors by day
      const dailyErrors: Record<string, { errors: number; refund: number }> = {};
      filteredDailyAccuracy.forEach(d => {
        const dateStr = d.date;
        if (!dailyErrors[dateStr]) {
          dailyErrors[dateStr] = { errors: 0, refund: 0 };
        }
        dailyErrors[dateStr].errors += d.incorrect_orders_count || 0;
        dailyErrors[dateStr].refund += Number(d.total_refund || 0);
      });

      // CRITICAL FIX: Use ALL days from sales data as base, not just days with errors
      // This ensures days with 0 errors are displayed as 0% instead of being omitted
      const allDates = new Set([
        ...Object.keys(dailyOrders),
        ...Object.keys(dailyErrors),
      ]);

      return Array.from(allDates)
        .sort((a, b) => a.localeCompare(b))
        .map(dateStr => {
          const date = parseISO(dateStr);
          const orders = dailyOrders[dateStr] || 0;
          const errorData = dailyErrors[dateStr] || { errors: 0, refund: 0 };
          return {
            period: dateStr,
            label: format(date, "d", { locale: fr }),
            // If we have orders but no errors, that's 0% - not null
            errorRate: orders > 0 ? (errorData.errors / orders) * 100 : null,
            errorCount: errorData.errors,
            orderCount: orders,
            hasSalesData: orders > 0,
          };
        });
    }

    // MONTHLY VIEW (year view)
    // Get order counts by month from sales data
    const monthlyOrders: Record<number, number> = {};
    (salesData || []).forEach((r: any) => {
      monthlyOrders[r.month] = (monthlyOrders[r.month] || 0) + (r.order_count || 0);
    });

    if (useDaily && dailyAccuracy && dailyAccuracy.length > 0) {
      // Aggregate daily data by month
      const monthlyData: Record<number, { errors: number; refund: number }> = {};
      
      dailyAccuracy.forEach(d => {
        const month = parseISO(d.date).getMonth() + 1;
        if (!monthlyData[month]) {
          monthlyData[month] = { errors: 0, refund: 0 };
        }
        monthlyData[month].errors += d.incorrect_orders_count || 0;
        monthlyData[month].refund += Number(d.total_refund || 0);
      });

      return Object.entries(monthlyData)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([month, data]) => {
          const orders = monthlyOrders[parseInt(month)] || 0;
          return {
            period: `${selectedYear}-${String(month).padStart(2, "0")}`,
            label: monthNames[parseInt(month) - 1],
            errorRate: orders > 0 ? (data.errors / orders) * 100 : null,
            errorCount: data.errors,
            orderCount: orders,
            hasSalesData: orders > 0,
          };
        });
    } else if (monthlyAccuracy && monthlyAccuracy.length > 0) {
      // Group monthly data
      const monthlyData: Record<number, { errors: number; refund: number }> = {};
      monthlyAccuracy.forEach(m => {
        if (!monthlyData[m.month]) {
          monthlyData[m.month] = { errors: 0, refund: 0 };
        }
        monthlyData[m.month].errors += m.incorrect_orders_count || 0;
        monthlyData[m.month].refund += Number(m.total_refund || 0);
      });

      return Object.entries(monthlyData)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([month, data]) => {
          const orders = monthlyOrders[parseInt(month)] || 0;
          return {
            period: `${selectedYear}-${String(month).padStart(2, "0")}`,
            label: monthNames[parseInt(month) - 1],
            errorRate: orders > 0 ? (data.errors / orders) * 100 : null,
            errorCount: data.errors,
            orderCount: orders,
            hasSalesData: orders > 0,
          };
        });
    } else if (useOrderErrors && orderErrorsData && orderErrorsData.length > 0) {
      // Aggregate order_errors by month or day
      const dailyOrders: Record<string, number> = {};
      (dailySalesData || []).forEach((r: any) => {
        dailyOrders[r.date] = (dailyOrders[r.date] || 0) + (r.order_count || 0);
      });

      // Group errors by date, counting distinct uber_order_ids
      const errorsByDate: Record<string, { orderIds: Set<string>; impact: number }> = {};
      orderErrorsData.forEach(e => {
        const d = e.error_date;
        if (!d) return;
        if (!errorsByDate[d]) errorsByDate[d] = { orderIds: new Set(), impact: 0 };
        if (e.uber_order_id) errorsByDate[d].orderIds.add(e.uber_order_id);
        errorsByDate[d].impact += e.financial_impact || 0;
      });

      if (chartPeriodMode === "month" || (periodMode as string) === "range") {
        // Daily view
        const allDates = new Set([...Object.keys(dailyOrders), ...Object.keys(errorsByDate)]);
        return Array.from(allDates)
          .sort((a, b) => a.localeCompare(b))
          .map(dateStr => {
            const date = parseISO(dateStr);
            const orders = dailyOrders[dateStr] || 0;
            const errData = errorsByDate[dateStr];
            const errors = errData ? errData.orderIds.size : 0;
            return {
              period: dateStr,
              label: format(date, "d MMM", { locale: fr }),
              errorRate: orders > 0 ? (errors / orders) * 100 : null,
              errorCount: errors,
              orderCount: orders,
              hasSalesData: orders > 0,
            };
          });
      } else {
        // Monthly aggregation
        const monthlyErrors: Record<number, { orderIds: Set<string>; impact: number }> = {};
        Object.entries(errorsByDate).forEach(([dateStr, data]) => {
          const month = parseISO(dateStr).getMonth() + 1;
          if (!monthlyErrors[month]) monthlyErrors[month] = { orderIds: new Set(), impact: 0 };
          data.orderIds.forEach(id => monthlyErrors[month].orderIds.add(id));
          monthlyErrors[month].impact += data.impact;
        });

        const monthlyOrders2: Record<number, number> = {};
        (salesData || []).forEach((r: any) => {
          monthlyOrders2[r.month] = (monthlyOrders2[r.month] || 0) + (r.order_count || 0);
        });

        return Object.entries(monthlyErrors)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([month, data]) => {
            const orders = monthlyOrders2[parseInt(month)] || 0;
            return {
              period: `${selectedYear}-${String(month).padStart(2, "0")}`,
              label: monthNames[parseInt(month) - 1],
              errorRate: orders > 0 ? (data.orderIds.size / orders) * 100 : null,
              errorCount: data.orderIds.size,
              orderCount: orders,
              hasSalesData: orders > 0,
            };
          });
      }
    }
    
    return [];
  }, [dailyAccuracy, monthlyAccuracy, orderErrorsData, salesData, dailySalesData, selectedYear, useDaily, useOrderErrors, chartPeriodMode, chartSelectedMonth, periodMode]);

  // Drill-down handlers
  const handleDrillDown = (month: number) => {
    setChartPeriodMode("month");
    setChartSelectedMonth(month);
  };

  const handleBackToYear = () => {
    setChartPeriodMode("year");
    setChartSelectedMonth(null);
  };

  const handlePrevMonth = () => {
    setChartSelectedMonth(prev => prev && prev > 1 ? prev - 1 : 12);
  };

  const handleNextMonth = () => {
    setChartSelectedMonth(prev => prev && prev < 12 ? prev + 1 : 1);
  };

  // Financial impact by category
  const categoryData = useMemo(() => {
    if (!aggregatedData) return [];

    return [
      { name: "Articles manquants", count: aggregatedData.missing_items, impact: aggregatedData.missing_items_refund, color: "#ef4444" },
      { name: useOrderErrors ? "Qualité des aliments" : "Personnalisation manquante", count: aggregatedData.missing_customization, impact: aggregatedData.missing_customization_refund, color: "#8b5cf6" },
      { name: "Mauvaise commande", count: aggregatedData.wrong_order, impact: aggregatedData.wrong_order_refund, color: "#3b82f6" },
      { name: "Article incorrect", count: aggregatedData.incorrect_item, impact: aggregatedData.incorrect_item_refund, color: "#f97316" },
    ].filter(c => c.count > 0);
  }, [aggregatedData, useOrderErrors]);

  // Calculate total for percentage
  const totalErrorCount = useMemo(() => {
    return categoryData.reduce((sum, c) => sum + c.count, 0);
  }, [categoryData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Check if Antony is selected and the date is before November 2025
  // IMPORTANT: This useMemo must be BEFORE any early returns to follow React hooks rules
  const openingCheck = useMemo(() => {
    return checkRestaurantOpeningDate(
      restaurants,
      restaurantIds,
      effectiveDateRange.endDate
    );
  }, [restaurantIds, restaurants, effectiveDateRange.endDate]);

  const isLoading = isLoadingDaily || isLoadingMonthly || isLoadingProducts || isLoadingOrderErrors;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasDaily && !hasMonthly && !hasOrderErrors) {
    // Special message for restaurant before opening
    if (openingCheck.isBeforeOpening) {
      return (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-blue-500 mb-4" />
            <p className="text-lg font-medium mb-2">Point de vente récent</p>
            <p className="text-muted-foreground text-center max-w-md">
              Le restaurant <span className="font-semibold text-foreground">{openingCheck.cityName}</span> a ouvert ses portes le <span className="font-semibold text-foreground">1er novembre 2025</span>. 
              Les données ne sont disponibles qu'à partir de cette date.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Aucune donnée disponible</p>
          <p className="text-muted-foreground text-center max-w-md">
            Importez le fichier "Résumé commandes incorrectes" (order-accuracy-inaccurate-issues-summary) depuis Uber Eats pour visualiser les statistiques.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info about data source */}
      <Alert className={`border-blue-500/50 ${useOrderErrors ? "bg-amber-500/10 border-amber-500/50" : "bg-blue-500/10"}`}>
        <Info className={`h-4 w-4 ${useOrderErrors ? "text-amber-500" : "text-blue-500"}`} />
        <AlertDescription className={useOrderErrors ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}>
          {useOrderErrors 
            ? `Source: Import CSV • ${orderErrorsData?.length || 0} lignes d'erreurs importées`
            : `Données officielles Uber Eats • Format: ${useDaily ? "Journalier" : "Mensuel"} • ${useDaily ? dailyAccuracy?.length : monthlyAccuracy?.length} enregistrements`
          }
        </AlertDescription>
      </Alert>

      {/* Warning if sales data missing */}
      {kpis && !kpis.hasSalesData && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Données de ventes manquantes. Le taux d'erreur ne peut pas être calculé. Importez le rapport "Sales Over Time".
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux d'erreurs
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis?.hasSalesData ? (kpis?.meetsObjective ? "text-primary" : "text-destructive") : "text-muted-foreground"}`}>
              {kpis?.hasSalesData ? `${kpis?.errorRate.toFixed(2)}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis?.totalErrors} erreurs{kpis?.hasSalesData ? ` / ${kpis?.orderCount} commandes` : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              vs Objectif ({objective}%)
            </CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis?.hasSalesData ? (kpis?.meetsObjective ? "text-primary" : "text-destructive") : "text-muted-foreground"}`}>
              {kpis?.hasSalesData ? (kpis?.meetsObjective ? "✓ Atteint" : "✗ Non atteint") : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis?.hasSalesData && kpis?.meetsObjective 
                ? `${(objective - (kpis?.errorRate || 0)).toFixed(2)}% sous l'objectif`
                : kpis?.hasSalesData 
                  ? `${((kpis?.errorRate || 0) - objective).toFixed(2)}% au-dessus`
                  : "Données ventes requises"
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coût total remboursements
            </CardTitle>
            <Euro className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(kpis?.totalImpact || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Impact financier sur la période
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coût moyen par erreur
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis?.avgImpact || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Moyenne par commande incorrecte
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commandes incorrectes
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalErrors}</div>
            <p className="text-xs text-muted-foreground">
              Total commandes avec problèmes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Rate Evolution */}
      <ErrorRateEvolutionChart
        data={errorEvolutionData}
        objective={objective}
        onObjectiveChange={setObjective}
        chartType={chartType}
        onChartTypeChange={setChartType}
        periodMode={chartPeriodMode}
        selectedMonth={chartSelectedMonth}
        onDrillDown={handleDrillDown}
        onBackToYear={handleBackToYear}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* Error Distribution and Financial Impact */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pie Chart - Error Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Détail du problème</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="count"
                    nameKey="name"
                    cx="35%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                    label={({ cx, cy, midAngle, outerRadius, percent }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 25;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="hsl(var(--foreground))"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-sm font-semibold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} (${totalErrorCount > 0 ? ((value / totalErrorCount) * 100).toFixed(1) : 0}%)`,
                      name
                    ]}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ paddingLeft: 20 }}
                    formatter={(value, entry: any) => (
                      <span className="text-sm" style={{ color: entry.color }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Financial Impact */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Impact financier par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={150} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => label}
                  />
                  <Bar 
                    dataKey="impact" 
                    name="Remboursements" 
                    radius={[0, 4, 4, 0]}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        {/* Top Problematic Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TOP 10 - Articles problématiques</CardTitle>
          </CardHeader>
          <CardContent>
            {productIssues && productIssues.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productIssues.map((item: any, index: number) => (
                      <TableRow key={item.id || index}>
                        <TableCell className="max-w-[200px] truncate">
                          {item.item_title}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.volume}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.score > 50 ? "destructive" : "secondary"}>
                            {item.score?.toFixed(1) || "N/A"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Aucune donnée. Importez le fichier "Top articles problématiques".
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
