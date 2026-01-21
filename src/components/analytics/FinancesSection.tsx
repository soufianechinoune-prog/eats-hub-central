import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfitabilityComparisonTable } from "./ProfitabilityComparisonTable";
import { OrdersAnalysisSection } from "./OrdersAnalysisSection";
import { ProfitabilityComparisonChart } from "@/components/compare/ProfitabilityComparisonChart";
import { BarChart3, FileText, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyProfitabilityRow {
  restaurant_id: string;
  day: string;
  sales: number;
  payout: number;
  net_payout: number;
  meal_voucher: number;
  orders_count: number;
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
}: FinancesSectionProps) {
  const [activeTab, setActiveTab] = useState<"synthese" | "detail">("synthese");

  return (
    <div className="space-y-4">
      {/* Sub-tabs navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-muted/50 p-1 h-auto">
          <TabsTrigger 
            value="synthese" 
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium",
              "data-[state=active]:bg-background data-[state=active]:shadow-sm"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Synthèse</span>
          </TabsTrigger>
          <TabsTrigger 
            value="detail"
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium",
              "data-[state=active]:bg-background data-[state=active]:shadow-sm"
            )}
          >
            <FileText className="h-4 w-4" />
            <span>Détail</span>
          </TabsTrigger>
        </TabsList>

        {/* Synthèse Tab - KPIs + Profitability Chart + Comparison Table */}
        <TabsContent value="synthese" className="mt-4 space-y-6">
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
            />
          )}

          {/* Profitability Comparison Table */}
          {dailyPayoutsData && dailyPayoutsData.length > 0 && (
            <ProfitabilityComparisonTable
              payouts={dailyPayoutsData}
              restaurants={restaurants}
            />
          )}
        </TabsContent>

        {/* Détail Tab - Orders Analysis */}
        <TabsContent value="detail" className="mt-4">
          {restaurants && restaurants.length > 0 && (
            <OrdersAnalysisSection
              restaurants={restaurants}
              selectedRestaurants={selectedRestaurants}
              startDate={startDate}
              endDate={endDate}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
