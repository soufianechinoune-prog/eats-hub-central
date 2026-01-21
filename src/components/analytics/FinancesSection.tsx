import { ProfitabilityComparisonTable } from "./ProfitabilityComparisonTable";
import { OrdersAnalysisSection } from "./OrdersAnalysisSection";
import { ProfitabilityComparisonChart } from "@/components/compare/ProfitabilityComparisonChart";
import { Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ActionFilterPopover } from "./ActionFilterPopover";

interface DailyProfitabilityRow {
  restaurant_id: string;
  day: string;
  sales: number;
  payout: number;
  net_payout: number;
  meal_voucher: number;
  orders_count: number;
}

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
  restaurants: { id: string; name: string; city?: string }[];
  selectedRestaurants: string[];
  startDate: Date;
  endDate: Date;
  // Profitability chart props
  profitabilityData?: DailyProfitabilityRow[];
  prevProfitabilityData?: DailyProfitabilityRow[];
  profitabilityDateRange?: { start: Date; end: Date };
  profitabilityPrevDateRange?: { start: Date; end: Date };
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
  profitabilityData,
  prevProfitabilityData,
  profitabilityDateRange,
  profitabilityPrevDateRange,
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

      {/* Profitability Comparison Chart - évolution N vs N-1 */}
      {profitabilityData && profitabilityData.length > 0 && profitabilityDateRange && profitabilityPrevDateRange && (
        <ProfitabilityComparisonChart
          currentPeriodData={profitabilityData}
          previousPeriodData={prevProfitabilityData || []}
          dateRange={profitabilityDateRange}
          previousDateRange={profitabilityPrevDateRange}
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
