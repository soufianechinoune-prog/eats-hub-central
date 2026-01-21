import { ProfitabilityComparisonTable } from "./ProfitabilityComparisonTable";
import { OrdersAnalysisSection } from "./OrdersAnalysisSection";
import { ProfitabilityComparisonChart } from "@/components/compare/ProfitabilityComparisonChart";
import { Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ActionFilterPopover } from "./ActionFilterPopover";
import { useFinancesDrilldown } from "@/hooks/useFinancesDrilldown";
// The chart only needs these fields for aggregation and calculation

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
  dailyPayoutsData: any[]; // Uses actual payout data from the table
  restaurants: { id: string; name: string; city?: string }[];
  selectedRestaurants: string[];
  startDate: Date;
  endDate: Date;
  // Date ranges for chart
  dateRange?: { start: Date; end: Date };
  previousDateRange?: { start: Date; end: Date };
  profitabilityComparisonMode?: "yearOverYear" | "rollingPeriod";
  onProfitabilityComparisonModeChange?: (mode: "yearOverYear" | "rollingPeriod") => void;
  onMonthDrillDown?: (month: number | null) => void;
  // Platform for actions filtering
  selectedPlatform?: string;
  // Action filtering props (aligned with Revenus & Ventes)
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
}

export function FinancesSection({
  dailyPayoutsData,
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
  // Action props
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
}: FinancesSectionProps) {
  const hasActions = globalActions.length > 0;

  // Fetch daily data from orders table for the chart (same source as "Par Jour" table)
  const { dailyData: chartDailyData, isLoading: isChartLoading } = useFinancesDrilldown({
    restaurantIds: selectedRestaurants.length > 0 
      ? selectedRestaurants 
      : restaurants?.map(r => r.id) || [],
    startDate,
    endDate,
    granularity: 'daily',
    enabled: true,
  });

  return (
    <div className="space-y-6">
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

      {/* Profitability Comparison Chart - utilise les données journalières (table orders) */}
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
        />
      )}

      {/* Profitability Comparison Table */}
      {dailyPayoutsData && dailyPayoutsData.length > 0 && (
        <ProfitabilityComparisonTable
          payouts={dailyPayoutsData}
          restaurants={restaurants}
        />
      )}

      {/* Orders Analysis Section (anciennement onglet "Détail") */}
      {restaurants && restaurants.length > 0 && (
        <OrdersAnalysisSection
          restaurants={restaurants}
          selectedRestaurants={selectedRestaurants}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
}
