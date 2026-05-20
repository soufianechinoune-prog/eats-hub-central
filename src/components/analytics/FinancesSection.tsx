import { useMemo, useRef, useState, useEffect } from "react";
import { ProfitabilityComparisonTable } from "./ProfitabilityComparisonTable";
import { OrdersAnalysisSection } from "./OrdersAnalysisSection";
import { ProfitabilityComparisonChart } from "@/components/compare/ProfitabilityComparisonChart";
import { Zap, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ActionFilterPopover } from "./ActionFilterPopover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const SENTINEL_UUID = "00000000-0000-0000-0000-000000000000";

interface RestaurantAction {
  id: string;
  category: string;
  action_type: string;
  title: string;
  start_date: string;
  end_date?: string;
  platform: string;
}

interface FinancesSectionProps {
  dailyPayoutsData: any[];
  advertisingData?: { payout_date: string; restaurant_id: string; amount: number }[];
  restaurants: { id: string; name: string; city?: string }[];
  selectedRestaurants: string[];
  startDate: Date;
  endDate: Date;
  dateRange?: { start: Date; end: Date };
  previousDateRange?: { start: Date; end: Date };
  profitabilityComparisonMode?: "yearOverYear" | "rollingPeriod";
  onProfitabilityComparisonModeChange?: (mode: "yearOverYear" | "rollingPeriod") => void;
  onMonthDrillDown?: (month: number | null) => void;
  selectedPlatform?: "uber_eats" | "deliveroo" | "global";
  showActions?: boolean;
  onShowActionsChange?: (value: boolean) => void;
  globalActions?: RestaurantAction[];
  selectedActionIds?: Set<string>;
  onActionToggle?: (actionId: string) => void;
  onSelectAllCategory?: (category: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  showHolidays?: boolean;
  showSchoolHolidays?: boolean;
  showFootballMatches?: boolean;
  onHolidaysToggle?: (value: boolean) => void;
  onSchoolHolidaysToggle?: (value: boolean) => void;
  onFootballMatchesToggle?: (value: boolean) => void;
  granularity?: "daily" | "weekly" | "monthly";
  isPayoutsLoading?: boolean;
}

export function FinancesSection({
  dailyPayoutsData,
  advertisingData,
  restaurants,
  selectedRestaurants,
  startDate,
  endDate,
  dateRange,
  previousDateRange,
  profitabilityComparisonMode = "yearOverYear",
  onProfitabilityComparisonModeChange,
  onMonthDrillDown,
  selectedPlatform,
  showActions = false,
  onShowActionsChange,
  globalActions = [],
  selectedActionIds = new Set<string>(),
  onActionToggle,
  onSelectAllCategory,
  onSelectAll,
  showHolidays = true,
  showSchoolHolidays = true,
  showFootballMatches = true,
  onHolidaysToggle,
  onSchoolHolidaysToggle,
  onFootballMatchesToggle,
  granularity = "monthly",
  isPayoutsLoading = false,
}: FinancesSectionProps) {
  const hasActions = globalActions.length > 0;

  const activeIds = useMemo(() => 
    selectedRestaurants.length > 0 
      ? selectedRestaurants 
      : restaurants?.map(r => r.id) || [],
    [selectedRestaurants, restaurants]
  );

  // Use RPC for fast server-side aggregation instead of fetching all individual orders
  const { data: rpcData, isLoading: isChartLoading } = useQuery({
    queryKey: ['profitability-daily-rpc', activeIds, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profitability_daily', {
        p_restaurant_ids: activeIds,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      return data || [];
    },
    enabled: activeIds.length > 0,
    retry: false,
  });

  // Map RPC data to DailyOrderData format for the chart
  const { chartDailyData, dailyDataByRestaurant } = useMemo(() => {
    if (!rpcData || rpcData.length === 0) return { chartDailyData: [], dailyDataByRestaurant: {} };

    // Aggregate all restaurants per day for the main chart
    const dayMap: Record<string, any> = {};
    const byRestaurant: Record<string, any[]> = {};

    for (const row of rpcData) {
      const dateStr = row.day;
      if (!dayMap[dateStr]) {
        dayMap[dateStr] = {
          date: dateStr,
          label: dateStr,
          sales_incl_vat: 0,
          net_payout: 0,
          meal_voucher_amount: 0,
          promo_incl_vat: 0,
          order_count: 0,
          uber_fee_incl_vat: 0,
          refund_incl_vat: 0,
          avg_basket: 0,
          total_payout: 0,
        };
      }
      const d = dayMap[dateStr];
      const sales = Number(row.sales) || 0;
      const netPayout = Number(row.net_payout) || 0;
      const payout = Number(row.payout) || 0;
      const mealVoucher = Number(row.meal_voucher) || 0;
      const promo = Number(row.item_promo_incl_vat) || 0;
      const orders = Number(row.orders_count) || 0;

      d.sales_incl_vat += sales;
      d.net_payout += netPayout;
      d.meal_voucher_amount += mealVoucher;
      d.promo_incl_vat += promo;
      d.order_count += orders;
      d.uber_fee_incl_vat += (payout - netPayout);
      d.total_payout += payout;

      // Per-restaurant
      const rid = row.restaurant_id;
      if (!byRestaurant[rid]) byRestaurant[rid] = [];
      byRestaurant[rid].push({
        date: dateStr,
        label: dateStr,
        sales_incl_vat: sales,
        net_payout: netPayout,
        meal_voucher_amount: mealVoucher,
        promo_incl_vat: promo,
        order_count: orders,
        uber_fee_incl_vat: payout - netPayout,
        refund_incl_vat: 0,
        avg_basket: orders > 0 ? sales / orders : 0,
        total_payout: payout,
        restaurant_id: rid,
      });
    }

    const dailyData = Object.values(dayMap).map((d: any) => ({
      ...d,
      avg_basket: d.order_count > 0 ? d.sales_incl_vat / d.order_count : 0,
    })).sort((a: any, b: any) => a.date.localeCompare(b.date));

    return { chartDailyData: dailyData, dailyDataByRestaurant: byRestaurant };
  }, [rpcData]);

  const chartRestaurantDetails = useMemo(() => {
    return restaurants?.filter(r => activeIds.includes(r.id)) || [];
  }, [restaurants, activeIds]);

  return (
    <div className="space-y-6">
      {/* Info bandeau : découpage UTC pour aligner avec le CSV Uber */}
      <div className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2">
        📅 Découpage journalier en <strong>UTC</strong> pour correspondre au rapport CSV Uber Eats. Les autres écrans (Overview, Operations…) utilisent l'heure de Paris.
      </div>

      {/* === Actions Control Bar === */}
      <div className="flex flex-col gap-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <Label htmlFor="show-actions-finances" className="text-sm font-medium cursor-pointer">
                Afficher les actions
              </Label>
            </div>
            <Switch
              id="show-actions-finances"
              checked={showActions}
              onCheckedChange={onShowActionsChange}
              disabled={!hasActions}
            />
            {!hasActions && (
              <span className="text-xs text-muted-foreground">Aucune action sur la période</span>
            )}
          </div>
          <Badge variant={granularity === "daily" ? "default" : "secondary"} className="text-xs">
            {granularity === "daily" ? "📅 Données quotidiennes" : "📆 Données mensuelles"}
          </Badge>
        </div>
        
        {/* Filtres granulaires (ActionFilterPopover) */}
        {showActions && hasActions && onActionToggle && onSelectAllCategory && onSelectAll && (
          <ActionFilterPopover
            actions={globalActions}
            selectedActionIds={selectedActionIds}
            onActionToggle={onActionToggle}
            onSelectAllCategory={onSelectAllCategory}
            onSelectAll={onSelectAll}
            showHolidays={showHolidays}
            showSchoolHolidays={showSchoolHolidays}
            showFootballMatches={showFootballMatches}
            onHolidaysToggle={onHolidaysToggle}
            onSchoolHolidaysToggle={onSchoolHolidaysToggle}
            onFootballMatchesToggle={onFootballMatchesToggle}
          />
        )}
      </div>

      {/* Loading indicator when no data is available yet */}
      {(isPayoutsLoading || ((!chartDailyData || chartDailyData.length === 0) && (!dailyPayoutsData || dailyPayoutsData.length === 0) && isChartLoading)) && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement des données financières…</p>
        </div>
      )}

      {/* Profitability Comparison Chart */}
      {chartDailyData && chartDailyData.length > 0 && dateRange && previousDateRange && (
        <ProfitabilityComparisonChart
          dailyOrdersData={chartDailyData}
          dateRange={dateRange}
          previousDateRange={previousDateRange}
          isLoading={isChartLoading}
          comparisonMode={profitabilityComparisonMode}
          onComparisonModeChange={onProfitabilityComparisonModeChange}
          onMonthClick={onMonthDrillDown}
          restaurantIds={selectedRestaurants}
          platform={selectedPlatform}
          showActions={showActions}
          selectedActionIds={selectedActionIds}
          dailyOrdersDataByRestaurant={dailyDataByRestaurant}
          restaurantDetails={chartRestaurantDetails}
        />
      )}

      {/* Profitability Comparison Table */}
      {dailyPayoutsData && dailyPayoutsData.length > 0 && (
        <ProfitabilityComparisonTable
          payouts={dailyPayoutsData}
          restaurants={restaurants}
          advertisingData={advertisingData}
          platform={selectedPlatform}
        />
      )}

      {/* Orders Analysis Section */}
      {restaurants && restaurants.length > 0 && (
        <OrdersAnalysisSection
          restaurants={restaurants}
          selectedRestaurants={selectedRestaurants}
          startDate={startDate}
          endDate={endDate}
          platform={selectedPlatform}
        />
      )}
    </div>
  );
}
