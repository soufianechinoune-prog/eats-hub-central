import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, parseISO, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  ShoppingCart,
  Users,
  Percent,
  ArrowUp,
  ArrowDown,
  Minus,
  Info,
  Lightbulb,
  Target,
  Camera,
  Gift,
  Megaphone,
  UtensilsCrossed,
  Settings,
  Zap,
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  CalendarDays,
  LayoutList,
} from "lucide-react";
import { RevenueDataTable } from "./RevenueDataTable";
import { ConversionFunnelChart } from "./ConversionFunnelChart";
import {
  useProcessedContextualEvents,
  useProcessedContextualEventsDaily,
  renderPublicHolidayMarker,
  renderSchoolHolidayArea,
  renderFootballMatchMarker,
  renderPublicHolidayMarkerDaily,
  renderSchoolHolidayAreaDaily,
  renderFootballMatchMarkerDaily,
} from "./ContextualEventBar";
import { ConversionLeakyBucket } from "./ConversionLeakyBucket";
import { ConversionRankingByStage } from "./ConversionRankingByStage";
import { ConversionScatterPlot } from "./ConversionScatterPlot";
import { RevenuePerVisitKPI } from "./RevenuePerVisitKPI";
import { SelectedRestaurantsRankingChart } from "./SelectedRestaurantsRankingChart";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { FinancesSection } from "./FinancesSection";
import { ProfitabilityComparisonChart } from "@/components/compare/ProfitabilityComparisonChart";
import { PromotionEvolutionChart } from "./PromotionEvolutionChart";
import { CrossDataAnalysisChart } from "./CrossDataAnalysisChart";
import { useFinancesDrilldown } from "@/hooks/useFinancesDrilldown";
import { useUberOneStats } from "@/hooks/useUberOneStats";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

// Animation constants for charts
const CHART_ANIMATION_DURATION = 500;
const CHART_ANIMATION_EASING = "ease-out";

// Interactive Legend Component with animations
interface LegendItem {
  key: string;
  label: string;
  color: string;
}

interface InteractiveLegendProps {
  items: LegendItem[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}

function InteractiveLegend({ items, hiddenKeys, onToggle, onReset }: InteractiveLegendProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((item, index) => {
        const isHidden = hiddenKeys.has(item.key);
        return (
          <motion.button
            key={item.key}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            onClick={() => onToggle(item.key)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
              isHidden
                ? "bg-muted/50 text-muted-foreground border-transparent opacity-50"
                : "bg-background shadow-sm border-border hover:shadow-md"
            )}
          >
            <motion.span
              animate={{ 
                opacity: isHidden ? 0.3 : 1,
                scale: isHidden ? 0.8 : 1
              }}
              transition={{ duration: 0.2 }}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className={cn(
              "transition-all duration-200",
              isHidden && "line-through"
            )}>
              {item.label}
            </span>
          </motion.button>
        );
      })}
      <AnimatePresence>
        {hiddenKeys.size > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-2 transition-colors"
          >
            Tout afficher
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

interface MonthlyRevenue {
  month: number;
  revenue_ttc: number;
  order_count: number;
}

interface MonthlyConversion {
  month: number;
  visits: number;
  menu_views: number;
  add_to_cart: number;
  orders: number;
}

interface MonthlyFees {
  month: number;
  uber_fee: number;
  marketing_fee: number;
  offers_cost: number;
  ads_cost: number;
  net_payout: number;
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

export interface ChartActionsConfig {
  global: boolean;
  revenue: boolean;
  conversionFunnel: boolean;
  conversionRate: boolean;
  fees: boolean;
  netPayout: boolean;
  profitability: boolean;
  avgBasket: boolean;
}

export type ActionCategoryFilter = Set<string>;

interface ContextualEvent {
  id: string;
  description: string;
  start_date: string;
  end_date: string;
  type: "school_holiday" | "football_match" | "public_holiday";
  color: { bg: string; text: string; border: string };
  icon: string;
}

interface DailyProfitabilityRow {
  restaurant_id: string;
  day: string;
  sales: number;
  payout: number; // Total: net_payout + meal_voucher (backward compat)
  net_payout: number; // What Uber pays (without meal vouchers)
  meal_voucher: number; // External payment from Swile/Edenred
  orders_count: number;
}

interface AnalyticsChartsProps {
  revenueData: MonthlyRevenue[] | undefined;
  conversionData: MonthlyConversion[] | undefined;
  feesData: MonthlyFees[] | undefined;
  prevRevenueData?: MonthlyRevenue[] | undefined;
  prevConversionData?: MonthlyConversion[] | undefined;
  prevFeesData?: MonthlyFees[] | undefined;
  // Payouts data from payouts table
  payoutsData?: any[];
  prevPayoutsData?: any[];
  // Daily payouts data for drill-down
  dailyPayoutsData?: any[];
  startMonth?: number;
  endMonth?: number;
  selectedYear: number;
  // Direct date range props for cross-year periods
  startDate?: Date;
  endDate?: Date;
  showComparison?: boolean;
  actions?: RestaurantAction[];
  chartActionsConfig?: ChartActionsConfig;
  onChartActionsConfigChange?: (config: ChartActionsConfig) => void;
  onActionClick?: (actionId: string) => void;
  viewMode?: "all" | "revenue" | "conversion" | "finances";
  restaurants?: { id: string; name: string; city?: string }[];
  selectedRestaurants?: string[];
  allConversionData?: MonthlyConversion[];
  granularity?: "daily" | "weekly" | "monthly";
  comparisonMode?: "yearOverYear" | "rollingPeriod";
  onComparisonModeChange?: (mode: "yearOverYear" | "rollingPeriod") => void;
  // Drill-down props (synchronized with global context)
  drillDownMonth?: number | null;
  onDrillDownChange?: (month: number | null) => void;
  // Contextual events
  contextualEvents?: ContextualEvent[];
  // Profitability comparison chart props
  profitabilityData?: DailyProfitabilityRow[];
  prevProfitabilityData?: DailyProfitabilityRow[];
  profitabilityDateRange?: { start: Date; end: Date };
  profitabilityPrevDateRange?: { start: Date; end: Date };
  profitabilityComparisonMode?: "yearOverYear" | "rollingPeriod";
  onProfitabilityComparisonModeChange?: (mode: "yearOverYear" | "rollingPeriod") => void;
  // Action filtering props for FinancesSection
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
}

// Action category colors
const ACTION_CATEGORY_COLORS: Record<string, string> = {
  visuals: "#8b5cf6",
  pricing: "#f59e0b",
  promotions: "#ec4899",
  marketing: "#3b82f6",
  menu: "#10b981",
  operational: "#64748b",
  events: "#059669",
};

const ACTION_CATEGORY_ICONS: Record<string, any> = {
  visuals: Camera,
  pricing: Euro,
  promotions: Gift,
  marketing: Megaphone,
  menu: UtensilsCrossed,
  operational: Settings,
};

const ACTION_CATEGORY_LABELS: Record<string, string> = {
  visuals: "Visuels",
  pricing: "Prix",
  promotions: "Promotions",
  marketing: "Marketing",
  menu: "Menu",
  operational: "Opérations",
  events: "Événements",
};

// Helper to calculate variation percentage
const calcVariation = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

// Component for variation indicator
function VariationIndicator({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  const variation = calcVariation(current, previous);
  
  if (variation === null) return <span className="text-xs text-muted-foreground">--</span>;
  
  const isPositive = inverse ? variation < 0 : variation > 0;
  const isNeutral = Math.abs(variation) < 0.5;
  
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isNeutral ? "text-muted-foreground" : isPositive ? "text-green-600" : "text-red-600"}`}>
      {isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {Math.abs(variation).toFixed(1)}%
    </span>
  );
}

// Mini toggle button for per-chart action visibility
function ChartActionToggle({
  chartKey,
  config,
  onChange,
  hasActions,
}: {
  chartKey: keyof Omit<ChartActionsConfig, "global">;
  config: ChartActionsConfig;
  onChange: (config: ChartActionsConfig) => void;
  hasActions: boolean;
}) {
  // Always hide if global toggle is off
  if (!config.global) return null;

  const isActive = config[chartKey];
  const isDisabled = !hasActions;
  
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isDisabled}
            className={cn(
              "h-7 w-7 p-0 rounded-full transition-colors",
              isDisabled
                ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed opacity-50"
                : isActive 
                  ? "bg-primary/10 text-primary hover:bg-primary/20" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => !isDisabled && onChange({ ...config, [chartKey]: !isActive })}
          >
            <Zap className={cn("h-3.5 w-3.5", !isDisabled && isActive && "fill-primary")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">
            {isDisabled 
              ? "Aucune action enregistrée pour cette période"
              : isActive 
                ? "Masquer les actions" 
                : "Afficher les actions"}
          </p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

// Custom label component for action markers with tooltip
function ActionMarkerLabel({
  viewBox,
  actions,
  color,
  onActionClick,
}: {
  viewBox?: { x?: number; y?: number };
  actions: RestaurantAction[];
  color: string;
  onActionClick?: (actionId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  if (!viewBox?.x) return null;
  
  const x = viewBox.x;
  const y = 10; // Position at top of chart

  const handleMarkerClick = () => {
    if (actions.length === 1 && onActionClick) {
      onActionClick(actions[0].id);
    }
  };
  
  return (
    <g>
      {/* Invisible larger hit area for easier hovering */}
      <rect
        x={x - 12}
        y={y - 8}
        width={24}
        height={20}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleMarkerClick}
      />
      {/* Icon circle */}
      <circle
        cx={x}
        cy={y}
        r={8}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleMarkerClick}
      />
      {/* Zap icon or count */}
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontWeight="bold"
        style={{ pointerEvents: "none" }}
      >
        {actions.length > 1 ? actions.length : "⚡"}
      </text>
      
      {/* Tooltip - positioned to the left to avoid overlap with chart tooltip */}
      {isHovered && (
        <foreignObject
          x={x - 220}
          y={y + 14}
          width={210}
          height={Math.min(actions.length * 70 + 30, 220)}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div
            className="bg-popover border border-border rounded-lg shadow-xl p-2.5 text-xs pointer-events-auto"
            style={{ zIndex: 9999 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="font-medium text-foreground mb-2 flex items-center gap-1.5 pb-1.5 border-b border-border">
              <Zap className="h-3.5 w-3.5" style={{ color }} />
              {actions.length} action{actions.length > 1 ? "s" : ""}
            </div>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {actions.map((action, idx) => {
                const Icon = ACTION_CATEGORY_ICONS[action.category] || Zap;
                const categoryColor = ACTION_CATEGORY_COLORS[action.category] || "#64748b";
                const date = new Date(action.start_date);
                const formattedDate = date.toLocaleDateString("fr-FR", { 
                  day: "numeric", 
                  month: "short",
                  year: "numeric"
                });
                
                return (
                  <div 
                    key={action.id || idx} 
                    className="flex items-start gap-2 p-1.5 rounded bg-muted/50 hover:bg-muted cursor-pointer transition-colors group"
                    onClick={() => onActionClick?.(action.id)}
                  >
                    <Icon 
                      className="h-3.5 w-3.5 mt-0.5 shrink-0" 
                      style={{ color: categoryColor }} 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {action.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span 
                          className="text-[10px] px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: `${categoryColor}20`,
                            color: categoryColor 
                          }}
                        >
                          {ACTION_CATEGORY_LABELS[action.category] || action.category}
                        </span>
                        <span className="text-[10px]">{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export function AnalyticsCharts({
  revenueData,
  conversionData,
  feesData,
  prevRevenueData,
  prevConversionData,
  prevFeesData,
  payoutsData,
  prevPayoutsData,
  dailyPayoutsData,
  startMonth = 1,
  endMonth = 12,
  selectedYear,
  startDate: propStartDate,
  endDate: propEndDate,
  showComparison = true,
  actions,
  chartActionsConfig,
  onChartActionsConfigChange,
  onActionClick,
  viewMode = "all",
  restaurants = [],
  selectedRestaurants = [],
  allConversionData,
  granularity = "monthly",
  comparisonMode = "yearOverYear",
  onComparisonModeChange,
  drillDownMonth,
  onDrillDownChange,
  contextualEvents = [],
  // Profitability chart props (renamed to avoid conflict with local profitabilityData)
  profitabilityData: chartProfitabilityData,
  prevProfitabilityData: chartPrevProfitabilityData,
  profitabilityDateRange,
  profitabilityPrevDateRange,
  profitabilityComparisonMode = "yearOverYear",
  onProfitabilityComparisonModeChange,
  // Action filtering props for FinancesSection
  globalActions = [],
  selectedActionIds,
  onActionToggle,
  onSelectAllCategory,
  onSelectAll,
  showHolidays = true,
  showSchoolHolidays = true,
  showFootballMatches = true,
  onHolidaysToggle,
  onSchoolHolidaysToggle,
  onFootballMatchesToggle,
}: AnalyticsChartsProps) {
  const navigate = useNavigate();
  const { selectedPlatform } = useAnalyticsContext();
  const prevYear = selectedYear - 1;
  
  // Determine restaurant IDs for profitability data
  const restaurantIds = selectedRestaurants?.length > 0 
    ? selectedRestaurants 
    : restaurants?.map(r => r.id) || [];
  
  // Compute date ranges for profitability chart - always use selected dates
  const profitStartDate = useMemo(() => {
    return propStartDate || new Date(selectedYear, startMonth - 1, 1);
  }, [propStartDate, selectedYear, startMonth]);
  
  const profitEndDate = useMemo(() => {
    return propEndDate || new Date(selectedYear, endMonth, 0);
  }, [propEndDate, selectedYear, endMonth]);
  
  // N-1 dates for comparison (always previous year)
  const profitPrevStartDate = useMemo(() => {
    return new Date(profitStartDate.getFullYear() - 1, profitStartDate.getMonth(), profitStartDate.getDate());
  }, [profitStartDate]);
  
  const profitPrevEndDate = useMemo(() => {
    return new Date(profitEndDate.getFullYear() - 1, profitEndDate.getMonth(), profitEndDate.getDate());
  }, [profitEndDate]);
  
  // Fetch profitability data for the chart in Revenue section
  const { dailyData: revenueProfitabilityData, isLoading: isProfitabilityLoading } = useFinancesDrilldown({
    restaurantIds,
    startDate: profitStartDate,
    endDate: profitEndDate,
    granularity: 'daily',
    enabled: viewMode === 'revenue' && restaurantIds.length > 0,
  });
  
  // Fetch N-1 profitability data for comparison
  const { dailyData: revenueProfitabilityPrevData, isLoading: isProfitabilityPrevLoading } = useFinancesDrilldown({
    restaurantIds,
    startDate: profitPrevStartDate,
    endDate: profitPrevEndDate,
    granularity: 'daily',
    enabled: viewMode === 'revenue' && restaurantIds.length > 0,
  });
  
  // Fetch Uber One stats for the Cross Data Analysis chart
  const { evolution: uberOneEvolution, isLoading: isUberOneLoading } = useUberOneStats({
    restaurantIds,
    startDate: profitStartDate,
    endDate: profitEndDate,
    periodMode: granularity === "daily" ? "month" : "year",
    platform: selectedPlatform,
  });
  
  // Transform Uber One data to match chart format
  const uberOneDataForChart = useMemo(() => {
    return uberOneEvolution?.map(e => ({
      date: e.month, // YYYY-MM-DD or YYYY-MM
      uberOnePercent: e.uberOnePercent,
      uberOneCount: e.uberOneCount,
      totalOrders: e.totalOrders,
    })) || [];
  }, [uberOneEvolution]);
  
  // Dynamic labels based on comparison mode
  const currentLabel = comparisonMode === "rollingPeriod" ? "Cette période" : String(selectedYear);
  const prevLabel = comparisonMode === "rollingPeriod" ? "Période précédente" : String(prevYear);
  const comparisonSuffix = comparisonMode === "rollingPeriod" 
    ? "(vs 4 sem. avant)" 
    : `(${selectedYear} vs ${prevYear})`;

  // Handle profitability chart click to navigate to Finances
  const handleProfitabilityClick = (monthNum: number) => {
    if (onDrillDownChange) {
      onDrillDownChange(monthNum);
    }
    navigate("/analytics/finances");
  };
  
  // Compute actual date ranges for rolling period labels (will be populated from data)
  const rollingPeriodDateRanges = useMemo(() => {
    if (comparisonMode !== "rollingPeriod" || !revenueData || revenueData.length === 0) {
      return { currentRange: '', prevRange: '' };
    }
    
    const isDailyData = 'date' in revenueData[0];
    if (!isDailyData) return { currentRange: '', prevRange: '' };
    
    // Get current period dates
    const currentDates = revenueData.map((d: any) => d.date).filter(Boolean).sort();
    const prevDates = prevRevenueData?.map((d: any) => d.date).filter(Boolean).sort() || [];
    
    if (currentDates.length === 0) return { currentRange: '', prevRange: '' };
    
    const formatRange = (dates: string[]) => {
      if (dates.length === 0) return '';
      const first = new Date(dates[0]);
      const last = new Date(dates[dates.length - 1]);
      return `${format(first, 'd MMM', { locale: fr })} - ${format(last, 'd MMM', { locale: fr })}`;
    };
    
    return {
      currentRange: formatRange(currentDates),
      prevRange: formatRange(prevDates),
    };
  }, [comparisonMode, revenueData, prevRevenueData]);
  
  // Chart type toggle state (bar or line)
  const [revenueChartType, setRevenueChartType] = useState<'bar' | 'line'>('bar');
  
  // View mode toggle state (chart or table)
  const [revenueViewMode, setRevenueViewMode] = useState<'chart' | 'table'>('chart');
  
  // Objectif de conversion configurable (persisté dans localStorage)
  const [conversionTarget, setConversionTarget] = useState<number>(() => {
    const saved = localStorage.getItem('conversionTarget');
    return saved ? Number(saved) : 5;
  });

  // State for interactive legends - hidden chart elements
  const [hiddenFeesBars, setHiddenFeesBars] = useState<Set<string>>(new Set());
  const [hiddenRevenueBars, setHiddenRevenueBars] = useState<Set<string>>(new Set());
  const [hiddenNetPayoutBars, setHiddenNetPayoutBars] = useState<Set<string>>(new Set());
  const [hiddenProfitBars, setHiddenProfitBars] = useState<Set<string>>(new Set());
  
  // State for payout detail sheet
  const [selectedPayoutDate, setSelectedPayoutDate] = useState<string | null>(null);
  const [payoutDetailOpen, setPayoutDetailOpen] = useState(false);

  const createToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (dataKey: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  const toggleFeesBar = createToggle(setHiddenFeesBars);
  const toggleRevenueBar = createToggle(setHiddenRevenueBars);
  const toggleNetPayoutBar = createToggle(setHiddenNetPayoutBars);
  const toggleProfitBar = createToggle(setHiddenProfitBars);

  useEffect(() => {
    localStorage.setItem('conversionTarget', String(conversionTarget));
  }, [conversionTarget]);

  // Actions are already filtered by parent component - use directly
  const filteredActions = actions || [];

  // Separate punctual actions from period events (events with start_date and end_date)
  const { punctualActions, periodEvents } = useMemo(() => {
    const punctual: RestaurantAction[] = [];
    const periods: RestaurantAction[] = [];
    
    filteredActions.forEach(action => {
      // Events category with both start and end date are period events
      if (action.category === "events" && action.end_date) {
        periods.push(action);
      } else {
        punctual.push(action);
      }
    });
    
    return { punctualActions: punctual, periodEvents: periods };
  }, [filteredActions]);

  // Group punctual actions by month for reference lines
  const actionsByMonth = useMemo(() => {
    if (!punctualActions || punctualActions.length === 0) return {};
    
    const byMonth: Record<number, RestaurantAction[]> = {};
    punctualActions.forEach(action => {
      const month = new Date(action.start_date).getMonth() + 1;
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(action);
    });
    return byMonth;
  }, [punctualActions]);

  // Get unique months with punctual actions within the range
  const actionMonths = useMemo(() => {
    return Object.keys(actionsByMonth)
      .map(Number)
      .filter(m => m >= startMonth && m <= endMonth);
  }, [actionsByMonth, startMonth, endMonth]);

  // Period events data for ReferenceArea rendering
  // For categorical X-axis, we need to extend x2 to the NEXT month to ensure the area has width
  const periodEventsData = useMemo(() => {
    return periodEvents.map(event => {
      const eventStartMonth = new Date(event.start_date).getMonth();
      const eventEndMonth = event.end_date ? new Date(event.end_date).getMonth() : eventStartMonth;
      // Extend x2 to next month to include the full end month on categorical axis
      const x2MonthIndex = Math.min(eventEndMonth + 1, 11);
      return {
        ...event,
        x1: MONTHS[eventStartMonth],
        x2: MONTHS[x2MonthIndex],
        startMonthIndex: eventStartMonth,
        endMonthIndex: eventEndMonth,
        color: ACTION_CATEGORY_COLORS[event.category] || "#059669",
      };
    }).filter(e => {
      // Filter to events within the displayed range
      const startMonthNum = e.startMonthIndex + 1;
      const endMonthNum = e.endMonthIndex + 1;
      return startMonthNum <= endMonth && endMonthNum >= startMonth;
    });
  }, [periodEvents, startMonth, endMonth]);

  // Process contextual events into categorized groups for differentiated rendering (YEAR view)
  const { holidays, schoolHolidays, footballMatches } = useProcessedContextualEvents(
    contextualEvents,
    startMonth,
    endMonth,
    MONTHS
  );

  // Determine if we are in a DAILY view (either explicit daily granularity, or drilldown on a month)
  const isDailyView = granularity === "daily" || !!drillDownMonth;

  // When in daily mode without drillDownMonth (e.g. global "Données quotidiennes"),
  // if a single month is selected we use it as the active month for contextual events/actions.
  const activeDailyMonth = useMemo(() => {
    if (drillDownMonth) return drillDownMonth;
    if (granularity === "daily" && startMonth === endMonth) return startMonth;
    return null;
  }, [drillDownMonth, granularity, startMonth, endMonth]);

  // Format function for daily X-axis values - MUST match the chart's X-axis format
  const formatDailyXValue = useMemo(() => {
    // In drilldown mode, the chart uses just the day number as string (e.g., "1", "2", ...)
    return (date: Date) => String(date.getDate());
  }, []);

  // Process contextual events for DAILY view (drilldown or global daily mode)
  const { 
    holidays: dailyHolidays, 
    schoolHolidays: dailySchoolHolidays, 
    footballMatches: dailyFootballMatches 
  } = useProcessedContextualEventsDaily(
    contextualEvents,
    activeDailyMonth,
    selectedYear,
    formatDailyXValue
  );

  // Actions filtered for daily view (drilldown month or selected daily month)
  const dailyActions = useMemo(() => {
    if (!isDailyView || !punctualActions || punctualActions.length === 0) return [];

    return punctualActions
      .filter(action => {
        const actionDate = new Date(action.start_date);
        const actionMonth = actionDate.getMonth() + 1;
        const actionYear = actionDate.getFullYear();

        // If we have an active month, restrict to it, otherwise keep all dates in the selected year
        if (activeDailyMonth) {
          return actionMonth === activeDailyMonth && actionYear === selectedYear;
        }
        return actionYear === selectedYear;
      })
      .map(action => ({
        ...action,
        // Use day number as string to match daily X-axis domain ("1", "2", ...)
        xValue: String(new Date(action.start_date).getDate()),
      }));
  }, [punctualActions, isDailyView, activeDailyMonth, selectedYear]);

  // Helper to check if actions should be shown for a specific chart
  const shouldShowActionsForChart = (chartKey: keyof Omit<ChartActionsConfig, "global">) => {
    if (!chartActionsConfig?.global) return false;
    return chartActionsConfig[chartKey] !== false;
  };

  const hasActions = actions && actions.length > 0;

  // Handler for chart toggle (with fallback if no handler provided)
  const handleChartToggle = (config: ChartActionsConfig) => {
    onChartActionsConfigChange?.(config);
  };

  // Default config if none provided
  const config: ChartActionsConfig = chartActionsConfig || {
    global: true,
    revenue: true,
    conversionFunnel: true,
    conversionRate: true,
    fees: true,
    netPayout: true,
    profitability: true,
    avgBasket: true,
  };
  
  // Filter months for range
  const filterByRange = (monthNum: number) => {
    return monthNum >= startMonth && monthNum <= endMonth;
  };

  // Aggregate revenue data
  const aggregatedRevenueData = useMemo(() => {
    if (!revenueData) return [];
    
    // Detect if we have daily data (presence of 'date' field)
    const isDailyData = revenueData.length > 0 && 'date' in revenueData[0];
    
    // ROLLING PERIOD MODE: Align by day index (not calendar date)
    if (isDailyData && comparisonMode === "rollingPeriod") {
      // Group current data by date
      const currentDailyMap: { [key: string]: { revenue: number; orders: number; date: string } } = {};
      revenueData.forEach((item: any) => {
        if (!currentDailyMap[item.date]) {
          currentDailyMap[item.date] = { revenue: 0, orders: 0, date: item.date };
        }
        currentDailyMap[item.date].revenue += Number(item.revenue_ttc) || 0;
        currentDailyMap[item.date].orders += item.order_count || 0;
      });
      
      // Group previous data by date
      const prevDailyMap: { [key: string]: { revenue: number; orders: number; date: string } } = {};
      prevRevenueData?.forEach((item: any) => {
        if (!prevDailyMap[item.date]) {
          prevDailyMap[item.date] = { revenue: 0, orders: 0, date: item.date };
        }
        prevDailyMap[item.date].revenue += Number(item.revenue_ttc) || 0;
        prevDailyMap[item.date].orders += item.order_count || 0;
      });
      
      // Sort current dates and previous dates
      const currentDates = Object.keys(currentDailyMap).sort();
      const prevDates = Object.keys(prevDailyMap).sort();
      
      // Merge by index (day 1 current → day 1 previous, etc.)
      return currentDates.map((dateStr, index) => {
        const date = new Date(dateStr);
        const currentData = currentDailyMap[dateStr];
        const prevDateStr = prevDates[index];
        const prevData = prevDateStr ? prevDailyMap[prevDateStr] : null;
        const prevDate = prevDateStr ? new Date(prevDateStr) : null;
        
        return {
          month: format(date, 'dd/MM', { locale: fr }),
          monthNum: date.getDate(),
          dayIndex: index + 1,
          fullDate: dateStr,
          currentDate: dateStr,
          prevDate: prevDateStr || null,
          // Day of week for tooltip (e.g., "lun.", "mar.")
          dayOfWeek: format(date, 'EEE', { locale: fr }),
          prevDayOfWeek: prevDate ? format(prevDate, 'EEE', { locale: fr }) : null,
          revenue: currentData.revenue,
          orders: currentData.orders,
          avgBasket: currentData.orders > 0 
            ? currentData.revenue / currentData.orders 
            : 0,
          prevRevenue: prevData?.revenue || 0,
          prevOrders: prevData?.orders || 0,
        };
      });
    }
    
    if (isDailyData && granularity === "weekly") {
      // Weekly granularity: group by week
      const weeklyMap: { [key: string]: { revenue: number; orders: number; weekStart: Date } } = {};
      const prevWeeklyMap: { [key: string]: { revenue: number; orders: number; weekStart: Date } } = {};
      
      revenueData.forEach((item: any) => {
        const weekStart = startOfWeek(parseISO(item.date), { locale: fr });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!weeklyMap[weekKey]) {
          weeklyMap[weekKey] = { revenue: 0, orders: 0, weekStart };
        }
        weeklyMap[weekKey].revenue += Number(item.revenue_ttc) || 0;
        weeklyMap[weekKey].orders += item.order_count || 0;
      });
      
      prevRevenueData?.forEach((item: any) => {
        const weekStart = startOfWeek(parseISO(item.date), { locale: fr });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!prevWeeklyMap[weekKey]) {
          prevWeeklyMap[weekKey] = { revenue: 0, orders: 0, weekStart };
        }
        prevWeeklyMap[weekKey].revenue += Number(item.revenue_ttc) || 0;
        prevWeeklyMap[weekKey].orders += item.order_count || 0;
      });
      
      // Sort by week and format labels
      return Object.keys(weeklyMap)
        .sort()
        .map(weekKey => {
          const weekStart = weeklyMap[weekKey].weekStart;
          const prevWeekStart = new Date(weekStart);
          prevWeekStart.setFullYear(prevWeekStart.getFullYear() - 1);
          const prevWeekKey = format(prevWeekStart, 'yyyy-MM-dd');
          
          return {
            month: format(weekStart, 'dd/MM', { locale: fr }), // Week start date label
            monthNum: weekStart.getDate(),
            fullDate: weekKey,
            revenue: weeklyMap[weekKey].revenue,
            orders: weeklyMap[weekKey].orders,
            avgBasket: weeklyMap[weekKey].orders > 0 
              ? weeklyMap[weekKey].revenue / weeklyMap[weekKey].orders 
              : 0,
            prevRevenue: prevWeeklyMap[prevWeekKey]?.revenue || 0,
            prevOrders: prevWeeklyMap[prevWeekKey]?.orders || 0,
          };
        });
    } else if (isDailyData) {
      // Daily granularity: group by date
      const dailyMap: { [key: string]: { revenue: number; orders: number; date: string } } = {};
      const prevDailyMap: { [key: string]: { revenue: number; orders: number; date: string } } = {};
      
      revenueData.forEach((item: any) => {
        if (!dailyMap[item.date]) {
          dailyMap[item.date] = { revenue: 0, orders: 0, date: item.date };
        }
        dailyMap[item.date].revenue += Number(item.revenue_ttc) || 0;
        dailyMap[item.date].orders += item.order_count || 0;
      });
      
      prevRevenueData?.forEach((item: any) => {
        if (!prevDailyMap[item.date]) {
          prevDailyMap[item.date] = { revenue: 0, orders: 0, date: item.date };
        }
        prevDailyMap[item.date].revenue += Number(item.revenue_ttc) || 0;
        prevDailyMap[item.date].orders += item.order_count || 0;
      });
      
      // Sort by date and format labels
      return Object.keys(dailyMap)
        .sort()
        .map(dateStr => {
          const date = new Date(dateStr);
          const prevDate = new Date(date);
          prevDate.setFullYear(prevDate.getFullYear() - 1);
          const prevDateStr = prevDate.toISOString().split('T')[0];
          
          return {
            month: format(date, 'dd/MM', { locale: fr }), // Short date label
            monthNum: date.getDate(),
            fullDate: dateStr,
            revenue: dailyMap[dateStr].revenue,
            orders: dailyMap[dateStr].orders,
            avgBasket: dailyMap[dateStr].orders > 0 
              ? dailyMap[dateStr].revenue / dailyMap[dateStr].orders 
              : 0,
            prevRevenue: prevDailyMap[prevDateStr]?.revenue || 0,
            prevOrders: prevDailyMap[prevDateStr]?.orders || 0,
          };
        });
    } else {
      // Monthly granularity: group by month (existing behavior)
      const monthlyData: { [key: number]: { revenue: number; orders: number } } = {};
      const prevMonthlyData: { [key: number]: { revenue: number; orders: number } } = {};
      
      revenueData.forEach((item: any) => {
        if (!monthlyData[item.month]) {
          monthlyData[item.month] = { revenue: 0, orders: 0 };
        }
        monthlyData[item.month].revenue += Number(item.revenue_ttc) || 0;
        monthlyData[item.month].orders += item.order_count || 0;
      });

      prevRevenueData?.forEach((item: any) => {
        if (!prevMonthlyData[item.month]) {
          prevMonthlyData[item.month] = { revenue: 0, orders: 0 };
        }
        prevMonthlyData[item.month].revenue += Number(item.revenue_ttc) || 0;
        prevMonthlyData[item.month].orders += item.order_count || 0;
      });
      
      return Array.from({ length: 12 }, (_, i) => ({
        month: MONTHS[i],
        monthNum: i + 1,
        revenue: monthlyData[i + 1]?.revenue || 0,
        orders: monthlyData[i + 1]?.orders || 0,
        avgBasket: monthlyData[i + 1]?.orders > 0 
          ? monthlyData[i + 1].revenue / monthlyData[i + 1].orders 
          : 0,
        prevRevenue: prevMonthlyData[i + 1]?.revenue || 0,
        prevOrders: prevMonthlyData[i + 1]?.orders || 0,
      })).filter(d => filterByRange(d.monthNum));
    }
  }, [revenueData, prevRevenueData, startMonth, endMonth, granularity, comparisonMode]);

  // Drill-down data for specific month (daily view)
  // Drill-down chart data - uses revenueData directly when in month mode (granularity is daily)
  // We also enrich with football match data for tooltip display
  const drillDownChartData = useMemo(() => {
    if (!drillDownMonth || granularity !== "daily" || !revenueData) return [];
    
    const dailyMap: { [key: string]: { revenue: number; orders: number; date: string } } = {};
    const prevDailyMap: { [key: string]: { revenue: number; orders: number; date: string } } = {};
    
    // revenueData already contains daily data when periodMode is "month"
    revenueData.forEach((item: any) => {
      const dateKey = item.date;
      if (!dateKey) return;
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { revenue: 0, orders: 0, date: dateKey };
      }
      dailyMap[dateKey].revenue += Number(item.revenue_ttc) || 0;
      dailyMap[dateKey].orders += item.order_count || 0;
    });
    
    prevRevenueData?.forEach((item: any) => {
      const dateKey = item.date;
      if (!dateKey) return;
      if (!prevDailyMap[dateKey]) {
        prevDailyMap[dateKey] = { revenue: 0, orders: 0, date: dateKey };
      }
      prevDailyMap[dateKey].revenue += Number(item.revenue_ttc) || 0;
      prevDailyMap[dateKey].orders += item.order_count || 0;
    });
    
    const currentDates = Object.keys(dailyMap).sort();
    const prevDates = Object.keys(prevDailyMap).sort();
    
    // Rolling period mode: align by index (day 1 vs day 1, etc.)
    if (comparisonMode === "rollingPeriod") {
      return currentDates.map((dateStr, index) => {
        const date = new Date(dateStr);
        const dayNum = date.getDate();
        const prevDateStr = prevDates[index] || null;
        const prevDate = prevDateStr ? new Date(prevDateStr) : null;
        
        return {
          month: String(dayNum),
          monthNum: dayNum,
          dayIndex: index + 1,
          fullDate: dateStr,
          currentDate: dateStr,
          prevDate: prevDateStr,
          dayOfWeek: format(date, 'EEE', { locale: fr }),
          prevDayOfWeek: prevDate ? format(prevDate, 'EEE', { locale: fr }) : null,
          revenue: dailyMap[dateStr].revenue,
          orders: dailyMap[dateStr].orders,
          avgBasket: dailyMap[dateStr].orders > 0 
            ? dailyMap[dateStr].revenue / dailyMap[dateStr].orders 
            : 0,
          prevRevenue: prevDateStr && prevDailyMap[prevDateStr] ? prevDailyMap[prevDateStr].revenue : 0,
          prevOrders: prevDateStr && prevDailyMap[prevDateStr] ? prevDailyMap[prevDateStr].orders : 0,
        };
      });
    }
    
    // Year-over-year mode: align by day number
    return currentDates.map(dateStr => {
      const date = new Date(dateStr);
      const dayNum = date.getDate();
      const prevDateStr = prevDates.find(d => new Date(d).getDate() === dayNum) || null;
      const prevDate = prevDateStr ? new Date(prevDateStr) : null;
      
      return {
        month: String(dayNum),
        monthNum: dayNum,
        fullDate: dateStr,
        currentDate: dateStr,
        prevDate: prevDateStr,
        dayOfWeek: format(date, 'EEE', { locale: fr }),
        prevDayOfWeek: prevDate ? format(prevDate, 'EEE', { locale: fr }) : null,
        revenue: dailyMap[dateStr].revenue,
        orders: dailyMap[dateStr].orders,
        avgBasket: dailyMap[dateStr].orders > 0 
          ? dailyMap[dateStr].revenue / dailyMap[dateStr].orders 
          : 0,
        prevRevenue: prevDateStr && prevDailyMap[prevDateStr] ? prevDailyMap[prevDateStr].revenue : 0,
        prevOrders: prevDateStr && prevDailyMap[prevDateStr] ? prevDailyMap[prevDateStr].orders : 0,
      };
    });
  }, [drillDownMonth, granularity, revenueData, prevRevenueData, comparisonMode]);

  // Calculate drill-down month totals
  const drillDownMonthTotals = useMemo(() => {
    if (!drillDownChartData || drillDownChartData.length === 0) return null;
    
    const totalRevenue = drillDownChartData.reduce((sum, d) => sum + (d.revenue || 0), 0);
    const totalPrevRevenue = drillDownChartData.reduce((sum, d) => sum + (d.prevRevenue || 0), 0);
    const variation = totalPrevRevenue > 0 
      ? ((totalRevenue - totalPrevRevenue) / totalPrevRevenue) * 100 
      : totalRevenue > 0 ? 100 : 0;
    
    return {
      revenue: totalRevenue,
      prevRevenue: totalPrevRevenue,
      variation,
    };
  }, [drillDownChartData]);

  // Handle bar/line click for drill-down
  const handleRevenueBarClick = (data: any) => {
    if (drillDownMonth) return; // Already in drill-down
    
    // Support both BarChart (data.monthNum) and LineChart (data.activePayload) click formats
    const monthNum = data?.monthNum || data?.activePayload?.[0]?.payload?.monthNum;
    
    if (monthNum && onDrillDownChange) {
      onDrillDownChange(monthNum);
    }
  };

  // Handle back from drill-down
  const handleBackFromDrillDown = () => {
    onDrillDownChange?.(null);
  };

  // Navigate to previous/next month in drill-down
  const handlePrevMonth = () => {
    if (drillDownMonth && drillDownMonth > 1) {
      onDrillDownChange?.(drillDownMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (drillDownMonth && drillDownMonth < 12) {
      onDrillDownChange?.(drillDownMonth + 1);
    }
  };

  const aggregatedConversionData = useMemo(() => {
    if (!conversionData) return [];
    
    const isDailyData = conversionData.length > 0 && 'date' in conversionData[0];
    
    if (isDailyData && granularity === "weekly") {
      // Weekly granularity: group by week
      const weeklyMap: { [key: string]: { visits: number; views: number; cart: number; orders: number; weekStart: Date } } = {};
      const prevWeeklyMap: { [key: string]: { visits: number; views: number; cart: number; orders: number; weekStart: Date } } = {};
      
      conversionData.forEach((item: any) => {
        const weekStart = startOfWeek(parseISO(item.date), { locale: fr });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!weeklyMap[weekKey]) {
          weeklyMap[weekKey] = { visits: 0, views: 0, cart: 0, orders: 0, weekStart };
        }
        weeklyMap[weekKey].visits += item.visits || 0;
        weeklyMap[weekKey].views += item.menu_views || 0;
        weeklyMap[weekKey].cart += item.add_to_cart || 0;
        weeklyMap[weekKey].orders += item.orders || 0;
      });
      
      prevConversionData?.forEach((item: any) => {
        const weekStart = startOfWeek(parseISO(item.date), { locale: fr });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!prevWeeklyMap[weekKey]) {
          prevWeeklyMap[weekKey] = { visits: 0, views: 0, cart: 0, orders: 0, weekStart };
        }
        prevWeeklyMap[weekKey].visits += item.visits || 0;
        prevWeeklyMap[weekKey].views += item.menu_views || 0;
        prevWeeklyMap[weekKey].cart += item.add_to_cart || 0;
        prevWeeklyMap[weekKey].orders += item.orders || 0;
      });
      
      return Object.keys(weeklyMap)
        .sort()
        .map(weekKey => {
          const weekStart = weeklyMap[weekKey].weekStart;
          const prevWeekStart = new Date(weekStart);
          prevWeekStart.setFullYear(prevWeekStart.getFullYear() - 1);
          const prevWeekKey = format(prevWeekStart, 'yyyy-MM-dd');
          
          const data = weeklyMap[weekKey];
          const prevData = prevWeeklyMap[prevWeekKey];
          
          return {
            month: format(weekStart, 'dd/MM', { locale: fr }), // Week start date label
            monthNum: weekStart.getDate(),
            fullDate: weekKey,
            visits: data.visits,
            views: data.views,
            cart: data.cart,
            orders: data.orders,
            conversionRate: data.visits > 0 ? ((data.orders / data.visits) * 100) : 0,
            prevVisits: prevData?.visits || 0,
            prevConversionRate: prevData && prevData.visits > 0 ? ((prevData.orders / prevData.visits) * 100) : 0,
          };
        });
    } else if (isDailyData) {
      const dailyMap: { [key: string]: { visits: number; views: number; cart: number; orders: number; date: string } } = {};
      const prevDailyMap: { [key: string]: { visits: number; views: number; cart: number; orders: number; date: string } } = {};
      
      conversionData.forEach((item: any) => {
        if (!dailyMap[item.date]) {
          dailyMap[item.date] = { visits: 0, views: 0, cart: 0, orders: 0, date: item.date };
        }
        dailyMap[item.date].visits += item.visits || 0;
        dailyMap[item.date].views += item.menu_views || 0;
        dailyMap[item.date].cart += item.add_to_cart || 0;
        dailyMap[item.date].orders += item.orders || 0;
      });
      
      prevConversionData?.forEach((item: any) => {
        if (!prevDailyMap[item.date]) {
          prevDailyMap[item.date] = { visits: 0, views: 0, cart: 0, orders: 0, date: item.date };
        }
        prevDailyMap[item.date].visits += item.visits || 0;
        prevDailyMap[item.date].views += item.menu_views || 0;
        prevDailyMap[item.date].cart += item.add_to_cart || 0;
        prevDailyMap[item.date].orders += item.orders || 0;
      });
      
      return Object.keys(dailyMap)
        .sort()
        .map(dateStr => {
          const date = new Date(dateStr);
          const prevDate = new Date(date);
          prevDate.setFullYear(prevDate.getFullYear() - 1);
          const prevDateStr = prevDate.toISOString().split('T')[0];
          
          const data = dailyMap[dateStr];
          const prevData = prevDailyMap[prevDateStr];
          
          return {
            month: format(date, 'dd/MM', { locale: fr }),
            monthNum: date.getDate(),
            fullDate: dateStr,
            visits: data.visits,
            views: data.views,
            cart: data.cart,
            orders: data.orders,
            conversionRate: data.visits > 0 ? ((data.orders / data.visits) * 100) : 0,
            prevVisits: prevData?.visits || 0,
            prevConversionRate: prevData && prevData.visits > 0 ? ((prevData.orders / prevData.visits) * 100) : 0,
          };
        });
    } else {
      const monthlyData: { [key: number]: { visits: number; views: number; cart: number; orders: number } } = {};
      const prevMonthlyData: { [key: number]: { visits: number; views: number; cart: number; orders: number } } = {};
      
      conversionData.forEach((item: any) => {
        if (!monthlyData[item.month]) {
          monthlyData[item.month] = { visits: 0, views: 0, cart: 0, orders: 0 };
        }
        monthlyData[item.month].visits += item.visits || 0;
        monthlyData[item.month].views += item.menu_views || 0;
        monthlyData[item.month].cart += item.add_to_cart || 0;
        monthlyData[item.month].orders += item.orders || 0;
      });

      prevConversionData?.forEach((item: any) => {
        if (!prevMonthlyData[item.month]) {
          prevMonthlyData[item.month] = { visits: 0, views: 0, cart: 0, orders: 0 };
        }
        prevMonthlyData[item.month].visits += item.visits || 0;
        prevMonthlyData[item.month].views += item.menu_views || 0;
        prevMonthlyData[item.month].cart += item.add_to_cart || 0;
        prevMonthlyData[item.month].orders += item.orders || 0;
      });
      
      return Array.from({ length: 12 }, (_, i) => {
        const data = monthlyData[i + 1];
        const prevData = prevMonthlyData[i + 1];
        return {
          month: MONTHS[i],
          monthNum: i + 1,
          visits: data?.visits || 0,
          views: data?.views || 0,
          cart: data?.cart || 0,
          orders: data?.orders || 0,
          conversionRate: data?.visits > 0 ? ((data.orders / data.visits) * 100) : 0,
          prevVisits: prevData?.visits || 0,
          prevConversionRate: prevData?.visits > 0 ? ((prevData.orders / prevData.visits) * 100) : 0,
        };
      }).filter(d => filterByRange(d.monthNum));
    }
  }, [conversionData, prevConversionData, startMonth, endMonth, granularity]);

  // Aggregate fees data
  const aggregatedFeesData = useMemo(() => {
    if (!feesData) return [];
    
    const monthlyData: { [key: number]: { uber: number; marketing: number; offers: number; ads: number; net: number } } = {};
    const prevMonthlyData: { [key: number]: { uber: number; marketing: number; offers: number; ads: number; net: number } } = {};
    
    feesData.forEach((item) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { uber: 0, marketing: 0, offers: 0, ads: 0, net: 0 };
      }
      monthlyData[item.month].uber += Number(item.uber_fee) || 0;
      monthlyData[item.month].marketing += Number(item.marketing_fee) || 0;
      monthlyData[item.month].offers += Number(item.offers_cost) || 0;
      monthlyData[item.month].ads += Number(item.ads_cost) || 0;
      monthlyData[item.month].net += Number(item.net_payout) || 0;
    });

    prevFeesData?.forEach((item) => {
      if (!prevMonthlyData[item.month]) {
        prevMonthlyData[item.month] = { uber: 0, marketing: 0, offers: 0, ads: 0, net: 0 };
      }
      prevMonthlyData[item.month].uber += Number(item.uber_fee) || 0;
      prevMonthlyData[item.month].marketing += Number(item.marketing_fee) || 0;
      prevMonthlyData[item.month].offers += Number(item.offers_cost) || 0;
      prevMonthlyData[item.month].ads += Number(item.ads_cost) || 0;
      prevMonthlyData[item.month].net += Number(item.net_payout) || 0;
    });
    
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      monthNum: i + 1,
      uber: monthlyData[i + 1]?.uber || 0,
      marketing: monthlyData[i + 1]?.marketing || 0,
      offers: monthlyData[i + 1]?.offers || 0,
      ads: monthlyData[i + 1]?.ads || 0,
      net: monthlyData[i + 1]?.net || 0,
      totalFees: (monthlyData[i + 1]?.uber || 0) + 
                 (monthlyData[i + 1]?.marketing || 0) + 
                 (monthlyData[i + 1]?.offers || 0) + 
                 (monthlyData[i + 1]?.ads || 0),
      prevNet: prevMonthlyData[i + 1]?.net || 0,
      prevTotalFees: (prevMonthlyData[i + 1]?.uber || 0) + 
                     (prevMonthlyData[i + 1]?.marketing || 0) + 
                     (prevMonthlyData[i + 1]?.offers || 0) + 
                     (prevMonthlyData[i + 1]?.ads || 0),
    })).filter(d => filterByRange(d.monthNum));
  }, [feesData, prevFeesData, startMonth, endMonth]);

  // Aggregate payouts data (from payouts table - Uber payout summaries)
  const aggregatedPayoutsData = useMemo(() => {
    if (!payoutsData || payoutsData.length === 0) return [];
    
    const monthlyData: { [key: number]: { 
      sales: number; 
      refund: number; 
      itemPromo: number; 
      uberFee: number; 
      deliveryPromo: number;
      otherPayments: number;
      marketingFee: number;
      netPayout: number; 
      orderCount: number;
      tips: number;
    } } = {};
    
    const prevMonthlyData: { [key: number]: { 
      sales: number; 
      refund: number; 
      itemPromo: number; 
      uberFee: number; 
      deliveryPromo: number;
      otherPayments: number;
      marketingFee: number;
      netPayout: number; 
      orderCount: number;
    } } = {};
    
    payoutsData.forEach((item: any) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { 
          sales: 0, refund: 0, itemPromo: 0, uberFee: 0, 
          deliveryPromo: 0, otherPayments: 0, marketingFee: 0, netPayout: 0, orderCount: 0, tips: 0 
        };
      }
      monthlyData[item.month].sales += Number(item.sales_incl_vat) || 0;
      monthlyData[item.month].refund += Number(item.refund_incl_vat) || 0;
      monthlyData[item.month].itemPromo += Number(item.item_promo_incl_vat) || 0;
      monthlyData[item.month].uberFee += Number(item.uber_fee_incl_vat) || 0;
      monthlyData[item.month].deliveryPromo += Number(item.delivery_promo_incl_vat) || 0;
      monthlyData[item.month].otherPayments += Number(item.other_payments_incl_vat) || 0;
      monthlyData[item.month].marketingFee += Number(item.marketing_fee_adjustment) || 0;
      monthlyData[item.month].netPayout += Number(item.net_payout) || 0;
      monthlyData[item.month].orderCount += Number(item.order_count) || 0;
      monthlyData[item.month].tips += Number(item.tips) || 0;
    });

    prevPayoutsData?.forEach((item: any) => {
      if (!prevMonthlyData[item.month]) {
        prevMonthlyData[item.month] = { 
          sales: 0, refund: 0, itemPromo: 0, uberFee: 0,
          deliveryPromo: 0, otherPayments: 0, marketingFee: 0, netPayout: 0, orderCount: 0 
        };
      }
      prevMonthlyData[item.month].sales += Number(item.sales_incl_vat) || 0;
      prevMonthlyData[item.month].refund += Number(item.refund_incl_vat) || 0;
      prevMonthlyData[item.month].itemPromo += Number(item.item_promo_incl_vat) || 0;
      prevMonthlyData[item.month].uberFee += Number(item.uber_fee_incl_vat) || 0;
      prevMonthlyData[item.month].deliveryPromo += Number(item.delivery_promo_incl_vat) || 0;
      prevMonthlyData[item.month].otherPayments += Number(item.other_payments_incl_vat) || 0;
      prevMonthlyData[item.month].marketingFee += Number(item.marketing_fee_adjustment) || 0;
      prevMonthlyData[item.month].netPayout += Number(item.net_payout) || 0;
      prevMonthlyData[item.month].orderCount += Number(item.order_count) || 0;
    });
    
    return Array.from({ length: 12 }, (_, i) => {
      const data = monthlyData[i + 1];
      const prevData = prevMonthlyData[i + 1];
      const totalFees = (data?.uberFee || 0) + 
                        (data?.itemPromo || 0) + 
                        (data?.refund || 0);
      const prevTotalFees = (prevData?.uberFee || 0) + 
                            (prevData?.itemPromo || 0) + 
                            (prevData?.refund || 0);
      return {
        month: MONTHS[i],
        monthNum: i + 1,
        // Map to same structure as aggregatedFeesData for chart compatibility
        uber: data?.uberFee || 0,
        marketing: Math.abs(data?.marketingFee || 0), // marketing_fee_adjustment
        offers: data?.itemPromo || 0,
        ads: Math.abs(data?.otherPayments || 0), // other_payments_incl_vat = Uber Ads/sponsoring
        net: data?.netPayout || 0,
        totalFees,
        prevNet: prevData?.netPayout || 0,
        prevTotalFees,
        // Additional payouts-specific fields
        sales: data?.sales || 0,
        refund: data?.refund || 0,
        orderCount: data?.orderCount || 0,
        tips: data?.tips || 0,
        prevSales: prevData?.sales || 0,
      };
    }).filter(d => filterByRange(d.monthNum) && (d.net !== 0 || d.sales !== 0));
  }, [payoutsData, prevPayoutsData, startMonth, endMonth]);

  // Use payouts data if available, otherwise fall back to fees data
  const effectiveFeesData = aggregatedPayoutsData.length > 0 ? aggregatedPayoutsData : aggregatedFeesData;
  const hasPayoutsData = aggregatedPayoutsData.length > 0;

  // Drill-down data for finances: aggregate dailyPayoutsData by payout_date
  const drillDownFeesData = useMemo(() => {
    if (!drillDownMonth || !dailyPayoutsData || dailyPayoutsData.length === 0) return [];
    
    // Group by payout_date
    const byDate: Record<string, {
      sales: number;
      uber: number;
      marketing: number;
      offers: number;
      ads: number;
      net: number;
      totalFees: number;
      orderCount: number;
    }> = {};
    
    dailyPayoutsData.forEach((item: any) => {
      const dateKey = item.payout_date;
      if (!byDate[dateKey]) {
        byDate[dateKey] = { sales: 0, uber: 0, marketing: 0, offers: 0, ads: 0, net: 0, totalFees: 0, orderCount: 0 };
      }
      byDate[dateKey].sales += Number(item.sales_incl_vat) || 0;
      byDate[dateKey].uber += Number(item.uber_fee_after_promo_incl_vat) || 0;
      byDate[dateKey].marketing += Math.abs(Number(item.marketing_fee_adjustment) || 0);
      byDate[dateKey].offers += Number(item.item_promo_incl_vat) || 0;
      byDate[dateKey].ads += Math.abs(Number(item.other_payments_incl_vat) || 0);
      byDate[dateKey].net += Number(item.net_payout) || 0;
      byDate[dateKey].orderCount += Number(item.order_count) || 0;
    });
    
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, data]) => {
        const date = new Date(dateStr);
        const totalFees = data.uber + data.offers + data.marketing + data.ads;
        const profitability = data.sales > 0 ? (data.net / data.sales) * 100 : 0;
        return {
          date: dateStr,
          label: format(date, 'd MMM', { locale: fr }),
          ...data,
          totalFees,
          profitability,
        };
      });
  }, [drillDownMonth, dailyPayoutsData]);

  // Drill-down profitability data
  const drillDownProfitabilityData = useMemo(() => {
    return drillDownFeesData.map(d => ({
      month: d.label,
      date: d.date,
      revenue: d.sales,
      netPayout: d.net,
      profitability: d.profitability,
    }));
  }, [drillDownFeesData]);

  // Handler for clicking on a month bar in finances charts
  const handleFinancesBarClick = (data: any) => {
    if (drillDownMonth || !onDrillDownChange) return;
    const monthNum = data?.activePayload?.[0]?.payload?.monthNum;
    if (monthNum) {
      onDrillDownChange(monthNum);
    }
  };

  // Handler for clicking on a bar in drill-down mode to open detail sheet
  const handleDrillDownBarClick = (data: any) => {
    if (!drillDownMonth) return;
    const dateStr = data?.activePayload?.[0]?.payload?.date;
    if (dateStr) {
      setSelectedPayoutDate(dateStr);
      setPayoutDetailOpen(true);
    }
  };
  
  // Get payouts for selected date
  const selectedDatePayouts = useMemo(() => {
    if (!selectedPayoutDate || !dailyPayoutsData) return [];
    return dailyPayoutsData.filter((p: any) => p.payout_date === selectedPayoutDate);
  }, [selectedPayoutDate, dailyPayoutsData]);

  // Profitability data - use payouts when available
  const profitabilityData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      
      // Use payouts data for revenue if available, otherwise use aggregatedRevenueData
      const payoutsMonth = aggregatedPayoutsData.find(p => p.monthNum === monthNum);
      const revenueMonth = aggregatedRevenueData.find(r => r.monthNum === monthNum);
      
      // Prefer payouts.sales over revenueData for consistency in Finances view
      const revenue = payoutsMonth?.sales || revenueMonth?.revenue || 0;
      const netPayout = payoutsMonth?.net || effectiveFeesData.find(f => f.monthNum === monthNum)?.net || 0;
      const profitability = revenue > 0 ? (netPayout / revenue) * 100 : 0;

      const prevRevenue = payoutsMonth?.prevSales || revenueMonth?.prevRevenue || 0;
      const prevNet = payoutsMonth?.prevNet || effectiveFeesData.find(f => f.monthNum === monthNum)?.prevNet || 0;
      const prevProfitability = prevRevenue > 0 ? (prevNet / prevRevenue) * 100 : 0;
      
      return {
        month: MONTHS[i],
        monthNum,
        revenue,
        netPayout,
        profitability,
        prevProfitability,
      };
    }).filter(d => filterByRange(d.monthNum));
  }, [aggregatedRevenueData, effectiveFeesData, aggregatedPayoutsData, startMonth, endMonth]);

  // Determine if showing multi-restaurant view
  const isMultiRestaurant = selectedRestaurants.length === 0 || selectedRestaurants.length > 1;

  // Average Basket Evolution data
  const averageBasketData = useMemo(() => {
    return aggregatedRevenueData.map(item => ({
      month: item.month,
      monthNum: item.monthNum,
      avgBasket: item.avgBasket,
      avgBasketN1: item.prevOrders > 0 ? item.prevRevenue / item.prevOrders : 0,
      orders: item.orders,
      prevOrders: item.prevOrders,
    }));
  }, [aggregatedRevenueData]);

  // Filter out months with no data to prevent 0 values from distorting the chart
  const filteredAvgBasketData = useMemo(() => {
    return averageBasketData.filter(d => d.avgBasket > 0 || d.avgBasketN1 > 0);
  }, [averageBasketData]);

  // Prepare chart data: avoid drawing lines down to 0 when there is no data
  const chartAvgBasketData = useMemo(() => {
    return filteredAvgBasketData.map(d => ({
      ...d,
      avgBasket: d.avgBasket > 0 ? d.avgBasket : null,
      avgBasketN1: d.avgBasketN1 > 0 ? d.avgBasketN1 : null,
    }));
  }, [filteredAvgBasketData]);

  // Calculate dynamic domain for average basket chart to zoom on variations
  const avgBasketDomain = useMemo(() => {
    const values = filteredAvgBasketData.flatMap(d => 
      [d.avgBasket, d.avgBasketN1].filter(v => v > 0)
    );
    if (values.length === 0) return [0, 100];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // If variations are very small, tighten the axis around the values
    let padding: number;
    if (range < 1) {
      padding = Math.max(range * 2, 0.2);
    } else {
      padding = Math.max(range * 0.2, 1);
    }
    
    return [
      Math.floor(min - padding),
      Math.ceil(max + padding)
    ];
  }, [filteredAvgBasketData]);

  // Top 10 Restaurants by Revenue (aggregated over period)
  const topRestaurantsData = useMemo(() => {
    if (!revenueData || !restaurants || restaurants.length === 0) return [];
    
    // Group by restaurant_id and sum revenue
    const restaurantTotals: Record<string, { revenue: number; orders: number }> = {};
    
    revenueData.forEach((item: any) => {
      const restaurantId = item.restaurant_id;
      if (!restaurantTotals[restaurantId]) {
        restaurantTotals[restaurantId] = { revenue: 0, orders: 0 };
      }
      restaurantTotals[restaurantId].revenue += Number(item.revenue_ttc) || 0;
      restaurantTotals[restaurantId].orders += item.order_count || 0;
    });

    // Map to restaurant names and sort by revenue
    const restaurantList = Object.entries(restaurantTotals)
      .map(([id, data]) => {
        const restaurant = restaurants.find(r => r.id === id);
        return {
          id,
          name: restaurant?.name || id,
          city: restaurant?.city || '',
          revenue: data.revenue,
          orders: data.orders,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10

    return restaurantList;
  }, [revenueData, restaurants]);

  // Revenue by Restaurant (monthly evolution)
  const revenueByRestaurantData = useMemo(() => {
    if (!revenueData || !restaurants || restaurants.length === 0) return [];
    
    // Get unique restaurant IDs
    const restaurantIds = Array.from(new Set(revenueData.map((item: any) => item.restaurant_id)));
    const topRestaurantIds = restaurantIds.slice(0, 10); // Limit to 10 for readability
    
    // Build monthly data with series per restaurant
    const monthlyData: Record<number, any> = {};
    
    Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      if (!filterByRange(monthNum)) return;
      
      monthlyData[monthNum] = {
        month: MONTHS[i],
        monthNum,
      };
      
      topRestaurantIds.forEach(restaurantId => {
        const restaurant = restaurants.find(r => r.id === restaurantId);
        const restaurantName = restaurant?.name || restaurantId;
        monthlyData[monthNum][restaurantName] = 0;
      });
    });

    // Fill in revenue data
    revenueData.forEach((item: any) => {
      const restaurantId = item.restaurant_id;
      if (!topRestaurantIds.includes(restaurantId)) return;
      if (!filterByRange(item.month)) return;
      
      const restaurant = restaurants.find(r => r.id === restaurantId);
      const restaurantName = restaurant?.name || restaurantId;
      
      if (monthlyData[item.month]) {
        monthlyData[item.month][restaurantName] += Number(item.revenue_ttc) || 0;
      }
    });

    return Object.values(monthlyData).filter(d => d.monthNum);
  }, [revenueData, restaurants, startMonth, endMonth]);

  // Colors for restaurant series
  const restaurantColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#06b6d4',
  ];

  // Dynamic Y-axis domain for conversion rate chart (inclut l'objectif)
  const conversionYDomain = useMemo(() => {
    const rates = aggregatedConversionData
      .map(d => [d.conversionRate, d.prevConversionRate])
      .flat()
      .filter(r => r > 0);
    
    // Inclure l'objectif dans le calcul du domain
    rates.push(conversionTarget);
    
    if (rates.length === 0) return [0, 10];
    
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const padding = (max - min) * 0.3 || 1; // 30% de marge, minimum 1
    
    return [
      Math.max(0, Math.floor(min - padding)),
      Math.ceil(max + padding)
    ];
  }, [aggregatedConversionData, conversionTarget]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = aggregatedRevenueData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = aggregatedRevenueData.reduce((sum, d) => sum + d.orders, 0);
    const totalVisits = aggregatedConversionData.reduce((sum, d) => sum + d.visits, 0);
    const totalConvOrders = aggregatedConversionData.reduce((sum, d) => sum + d.orders, 0);
    const totalFees = effectiveFeesData.reduce((sum, d) => sum + d.totalFees, 0);
    const totalNet = effectiveFeesData.reduce((sum, d) => sum + d.net, 0);
    const profitability = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

    // Previous year totals
    const prevTotalRevenue = aggregatedRevenueData.reduce((sum, d) => sum + d.prevRevenue, 0);
    const prevTotalOrders = aggregatedRevenueData.reduce((sum, d) => sum + d.prevOrders, 0);
    const prevTotalVisits = aggregatedConversionData.reduce((sum, d) => sum + d.prevVisits, 0);
    const prevTotalFees = effectiveFeesData.reduce((sum, d) => sum + d.prevTotalFees, 0);
    const prevTotalNet = effectiveFeesData.reduce((sum, d) => sum + d.prevNet, 0);
    const prevProfitability = prevTotalRevenue > 0 ? (prevTotalNet / prevTotalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalOrders,
      avgBasket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      conversionRate: totalVisits > 0 ? (totalConvOrders / totalVisits) * 100 : 0,
      totalFees,
      totalNet,
      feePercentage: totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0,
      profitability,
      // Previous year
      prevTotalRevenue,
      prevTotalOrders,
      prevAvgBasket: prevTotalOrders > 0 ? prevTotalRevenue / prevTotalOrders : 0,
      prevConversionRate: prevTotalVisits > 0 ? (aggregatedConversionData.reduce((sum, d) => sum + (d.prevVisits > 0 ? d.orders : 0), 0) / prevTotalVisits) * 100 : 0,
      prevTotalFees,
      prevProfitability,
    };
  }, [aggregatedRevenueData, aggregatedConversionData, effectiveFeesData]);

  const hasData = aggregatedRevenueData.some(d => d.revenue > 0) || 
                  aggregatedConversionData.some(d => d.visits > 0) || 
                  effectiveFeesData.some(d => d.totalFees > 0) ||
                  hasPayoutsData;

  const hasPrevData = showComparison && (
    aggregatedRevenueData.some(d => d.prevRevenue > 0) || 
    effectiveFeesData.some(d => d.prevTotalFees > 0)
  );

  // Check if drill-down data has comparison data (for rolling period mode)
  const hasDrillDownPrevData = showComparison && drillDownChartData.some(d => d.prevRevenue > 0);

  // Prepare time series data per restaurant for ranking evolution chart (adaptive granularity)
  // This provides data in { restaurant_id, date (ISO string), value } format
  const revenueByRestaurantTimeSeries = useMemo(() => {
    if (!revenueData) return [];
    
    // Check if we have daily data (presence of 'date' field)
    const hasDailyData = revenueData.length > 0 && 'date' in revenueData[0];
    
    if (hasDailyData) {
      // Use daily data directly - filter to valid entries with restaurant_id and date
      return revenueData
        .filter((r: any) => r.restaurant_id && r.date)
        .map((r: any) => ({
          restaurant_id: r.restaurant_id,
          date: r.date, // Already in ISO format
          value: Number(r.revenue_ttc) || 0,
        }));
    } else {
      // Monthly data - convert month number to ISO date string (first day of month)
      return revenueData
        .filter((r: any) => r.restaurant_id && r.month >= startMonth && r.month <= endMonth)
        .map((r: any) => ({
          restaurant_id: r.restaurant_id,
          date: `${selectedYear}-${String(r.month).padStart(2, '0')}-01`,
          value: Number(r.revenue_ttc) || 0,
        }));
    }
  }, [revenueData, startMonth, endMonth, selectedYear]);

  const conversionByRestaurantTimeSeries = useMemo(() => {
    if (!conversionData) return [];
    
    // Check if we have daily data (presence of 'date' field)
    const hasDailyData = conversionData.length > 0 && 'date' in conversionData[0];
    
    if (hasDailyData) {
      // Use daily data directly
      return conversionData
        .filter((r: any) => r.restaurant_id && r.date)
        .map((r: any) => ({
          restaurant_id: r.restaurant_id,
          date: r.date,
          value: r.visits > 0 ? (Number(r.orders) / Number(r.visits)) * 100 : 0,
        }));
    } else {
      // Monthly data
      return conversionData
        .filter((r: any) => r.restaurant_id && r.month >= startMonth && r.month <= endMonth)
        .map((r: any) => ({
          restaurant_id: r.restaurant_id,
          date: `${selectedYear}-${String(r.month).padStart(2, '0')}-01`,
          value: r.visits > 0 ? (Number(r.orders) / Number(r.visits)) * 100 : 0,
        }));
    }
  }, [conversionData, startMonth, endMonth, selectedYear]);

  // Compute startDate and endDate based on period selection
  const chartDateRange = useMemo(() => {
    const startDate = new Date(selectedYear, startMonth - 1, 1);
    const endDate = new Date(selectedYear, endMonth, 0); // Last day of endMonth
    return { startDate, endDate };
  }, [selectedYear, startMonth, endMonth]);

  const formatCurrency = (v: number) => 
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-lg">
            Aucune donnée disponible pour cette période
          </p>
          <p className="text-muted-foreground mt-2">
            Commencez par saisir vos données dans les pages de saisie
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine which sections to show based on viewMode
  const showKPIs = viewMode === "all" || viewMode === "revenue" || viewMode === "conversion" || viewMode === "finances";
  const showRevenue = viewMode === "all" || viewMode === "revenue";
  const showConversion = viewMode === "all" || viewMode === "conversion";
  const showFinances = viewMode === "all" || viewMode === "finances";

  // Determine which KPIs to show based on viewMode
  const showRevenueKPIs = viewMode === "all" || viewMode === "revenue";
  const showConversionKPIs = viewMode === "all" || viewMode === "conversion";
  const showFinanceKPIs = viewMode === "all" || viewMode === "finances";

  return (
    <div className="space-y-6">
      {/* Actions are now filtered by ActionFilterPopover in parent */}


      {/* Revenue Chart with N-1 comparison */}
      {showRevenue && (
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            {drillDownMonth ? (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={handleBackFromDrillDown}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
            
            {drillDownMonth ? (
              <div className="flex items-center gap-2">
                {/* Month Navigation */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handlePrevMonth}
                  disabled={drillDownMonth <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[100px] text-center">
                  CA {MONTHS[drillDownMonth - 1]} {selectedYear}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleNextMonth}
                  disabled={drillDownMonth >= 12}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {hasPrevData && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (vs {MONTHS[drillDownMonth - 1]} {prevLabel})
                  </span>
                )}
              </div>
            ) : (
              <>
                <span>Évolution du Chiffre d'Affaires</span>
                {hasPrevData && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.currentRange
                      ? `(${rollingPeriodDateRanges.currentRange} vs ${rollingPeriodDateRanges.prevRange})`
                      : comparisonSuffix
                    }
                  </span>
                )}
              </>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Inline KPIs - always visible */}
            {(() => {
              const displayRevenue = drillDownMonth && drillDownMonthTotals 
                ? drillDownMonthTotals.revenue 
                : kpis.totalRevenue;
              const displayPrevRevenue = drillDownMonth && drillDownMonthTotals 
                ? drillDownMonthTotals.prevRevenue 
                : kpis.prevTotalRevenue;
              const variation = drillDownMonth && drillDownMonthTotals
                ? drillDownMonthTotals.variation
                : calcVariation(kpis.totalRevenue, kpis.prevTotalRevenue);
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 rounded-xl mt-1"
                >
                  <div className="flex items-center gap-2.5">
                    <Euro className="h-5 w-5 text-primary" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground leading-tight">
                        {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.currentRange 
                          ? rollingPeriodDateRanges.currentRange 
                          : currentLabel}
                      </p>
                      <p className="text-base font-bold leading-tight">{displayRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                    </div>
                  </div>
                  {hasPrevData && (
                    <>
                      <div className="h-10 w-px bg-border" />
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground leading-tight">
                          {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.prevRange 
                            ? rollingPeriodDateRanges.prevRange 
                            : prevLabel}
                        </p>
                        <p className="text-sm text-muted-foreground leading-tight">{displayPrevRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                      </div>
                      <div className="h-10 w-px bg-border" />
                      <div className={cn(
                        "flex items-center gap-1 font-semibold text-base",
                        variation > 0 && "text-emerald-500",
                        variation < 0 && "text-red-500",
                        variation === 0 && "text-muted-foreground"
                      )}>
                        {variation > 0 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : variation < 0 ? (
                          <ArrowDown className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        <span>{variation > 0 ? "+" : ""}{variation.toFixed(1)}%</span>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })()}
            
            {/* View Mode Toggle (Chart/Table) */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button 
                variant={revenueViewMode === 'chart' ? 'secondary' : 'ghost'} 
                size="sm"
                className="h-7 px-2 gap-1"
                onClick={() => setRevenueViewMode('chart')}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Graphique</span>
              </Button>
              <Button 
                variant={revenueViewMode === 'table' ? 'secondary' : 'ghost'} 
                size="sm"
                className="h-7 px-2 gap-1"
                onClick={() => setRevenueViewMode('table')}
              >
                <LayoutList className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Tableau</span>
              </Button>
            </div>
            
            {/* Chart Type Toggle (only visible in chart mode) */}
            {revenueViewMode === 'chart' && (
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button 
                  variant={revenueChartType === 'bar' ? 'secondary' : 'ghost'} 
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setRevenueChartType('bar')}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button 
                  variant={revenueChartType === 'line' ? 'secondary' : 'ghost'} 
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setRevenueChartType('line')}
                >
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Rolling Period Toggle - only for 2025+ with daily data */}
            {selectedYear >= 2025 && onComparisonModeChange && (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={comparisonMode === 'rollingPeriod' ? 'default' : 'outline'} 
                      size="sm"
                      className={cn(
                        "h-8 gap-1.5 transition-all",
                        comparisonMode === 'rollingPeriod' && "bg-amber-600 hover:bg-amber-700 text-white border-0"
                      )}
                      onClick={() => {
                        const newMode = comparisonMode === 'rollingPeriod' ? 'yearOverYear' : 'rollingPeriod';
                        onComparisonModeChange(newMode);
                        
                        // Auto drill-down to current month when activating rollingPeriod in year view
                        if (newMode === 'rollingPeriod' && !drillDownMonth && onDrillDownChange) {
                          const currentMonth = new Date().getMonth() + 1;
                          onDrillDownChange(currentMonth);
                        }
                      }}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      <span className="text-xs">4 sem.</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium">Période glissante</p>
                    <p className="text-xs text-muted-foreground">Comparer avec 4 semaines avant (même jour)</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
            
            <ChartActionToggle
              chartKey="revenue"
              config={config}
              onChange={handleChartToggle}
              hasActions={!!hasActions}
            />
          </div>
        </CardHeader>
        <CardContent>
          {revenueViewMode === 'table' ? (
            <RevenueDataTable 
              data={drillDownMonth ? drillDownChartData : aggregatedRevenueData}
              showComparison={drillDownMonth ? hasDrillDownPrevData : hasPrevData}
              selectedYear={selectedYear}
              comparisonMode={comparisonMode}
            />
          ) : (
            <>
              {/* Interactive Legend */}
              <InteractiveLegend
                items={[
                  { 
                    key: 'revenue', 
                    label: `CA ${comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.currentRange 
                      ? rollingPeriodDateRanges.currentRange 
                      : currentLabel}`, 
                    color: 'hsl(var(--primary))' 
                  },
                  ...((drillDownMonth ? hasDrillDownPrevData : hasPrevData) ? [{ 
                    key: 'prevRevenue', 
                    label: `CA ${comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.prevRange 
                      ? rollingPeriodDateRanges.prevRange 
                      : prevLabel}`, 
                    color: 'hsl(var(--muted-foreground))' 
                  }] : []),
                ]}
                hiddenKeys={hiddenRevenueBars}
                onToggle={toggleRevenueBar}
                onReset={() => setHiddenRevenueBars(new Set())}
              />
              
              {/* Drill-down hint */}
              {!drillDownMonth && granularity === "monthly" && (
                <p className="text-xs text-muted-foreground mb-2">
                  💡 Cliquez sur un mois pour voir le détail journalier
                </p>
              )}
          
          <div className="h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={drillDownMonth ? `drill-${drillDownMonth}` : 'year'}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  {revenueChartType === 'bar' ? (
                    <BarChart data={drillDownMonth ? drillDownChartData : aggregatedRevenueData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const data = payload[0]?.payload;
                            if (!data) return null;
                            
                            // Calculate variation
                            const variation = data.prevRevenue > 0 
                              ? ((data.revenue - data.prevRevenue) / data.prevRevenue) * 100 
                              : data.revenue > 0 ? 100 : 0;
                            const variationColor = variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-muted-foreground';
                            
                            // Rolling period mode: show aligned dates
                            if (comparisonMode === "rollingPeriod" && data.currentDate && data.prevDate) {
                              const currentDate = new Date(data.currentDate);
                              const prevDate = new Date(data.prevDate);
                              return (
                                <div className="bg-background border border-border rounded-lg p-3 shadow-lg min-w-[220px]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={`text-sm font-semibold ${variationColor}`}>
                                      {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-0.5 bg-primary rounded" />
                                      <span className="text-xs text-muted-foreground">
                                        {format(currentDate, 'EEE d MMM', { locale: fr })}
                                      </span>
                                      <span className="font-semibold ml-auto" style={{ color: 'hsl(var(--primary))' }}>
                                        {data.revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-0.5 bg-muted-foreground rounded opacity-50" style={{ borderStyle: 'dashed' }} />
                                      <span className="text-xs text-muted-foreground">
                                        {format(prevDate, 'EEE d MMM', { locale: fr })}
                                      </span>
                                      <span className="text-sm text-muted-foreground ml-auto">
                                        {(data.prevRevenue || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-medium mb-2">
                                  {drillDownMonth ? `${data.dayOfWeek ? `${data.dayOfWeek}. ` : ""}${label} ${MONTHS[drillDownMonth - 1]}` : label}
                                </p>
                                <p className="text-sm" style={{ color: 'hsl(var(--primary))' }}>
                                  CA {currentLabel}: {(data.revenue || 0).toLocaleString('fr-FR')} €
                                </p>
                                {hasPrevData && (
                                  <>
                                    <p className="text-sm text-muted-foreground">
                                      CA {prevLabel}: {(data.prevRevenue || 0).toLocaleString('fr-FR')} €
                                    </p>
                                    <p className={`text-sm font-medium mt-1 ${variationColor}`}>
                                      {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                                    </p>
                                  </>
                                )}
                                {/* Football matches in tooltip */}
                                {(() => {
                                  // Get matches for this day - label is the day number as string
                                  const matchesForDay = dailyFootballMatches.filter((match) => match.x1 === label);
                                  if (matchesForDay.length === 0) return null;
                                  return (
                                    <div className="mt-2 pt-2 border-t border-border/60">
                                      {matchesForDay.map((match) => (
                                        <div key={match.id} className="text-xs space-y-0.5">
                                          <div className="font-semibold flex items-center gap-1">
                                            <span>⚽</span>
                                            <span>{match.home_team} vs {match.away_team}</span>
                                          </div>
                                          {(match.time || match.venue) && (
                                            <p className="text-[11px] text-muted-foreground">
                                              {match.time}{match.time && match.venue ? ' • ' : ''}{match.venue}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          }}
                        />
                        {/* Period events as ReferenceArea (e.g., Ramadan) - only in year view */}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && periodEventsData.map(event => (
                          <ReferenceArea
                            key={`period-${event.id}`}
                            x1={event.x1}
                            x2={event.x2}
                            fill={event.color}
                            fillOpacity={0.25}
                            stroke={event.color}
                            strokeOpacity={0.6}
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            label={{
                              value: `🌙 ${event.title} 🌙`,
                              position: 'insideTop',
                              fill: event.color,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />
                        ))}
                        {/* Contextual events - YEAR VIEW (no school holidays - only visible in daily drill-down) */}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && holidays.map(event => 
                          renderPublicHolidayMarker(event)
                        )}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && footballMatches.map(event => 
                          renderFootballMatchMarker(event)
                        )}
                        {/* Contextual events - DAILY VIEW */}
                        {isDailyView && activeDailyMonth && shouldShowActionsForChart("revenue") && dailySchoolHolidays.map(event => 
                          renderSchoolHolidayAreaDaily(event)
                        )}
                        {isDailyView && activeDailyMonth && shouldShowActionsForChart("revenue") && dailyHolidays.map(event => 
                          renderPublicHolidayMarkerDaily(event)
                        )}
                        {/* Football match markers - DAILY VIEW: simple line, details shown in tooltip */}
                        {isDailyView && activeDailyMonth && shouldShowActionsForChart("revenue") && dailyFootballMatches.map(event => (
                          <ReferenceLine
                            key={`match-daily-${event.id}`}
                            x={event.x1}
                            stroke="rgba(59, 130, 246, 0.6)"
                            strokeWidth={1.5}
                            strokeDasharray="2 2"
                          />
                        ))}
                        {/* Punctual action markers - YEAR VIEW */}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && actionMonths.map(monthNum => {
                          const monthActions = actionsByMonth[monthNum] || [];
                          const primaryAction = monthActions[0];
                          if (!primaryAction) return null;
                          const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                          return (
                            <ReferenceLine
                              key={`action-${monthNum}`}
                              x={MONTHS[monthNum - 1]}
                              stroke={color}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                            />
                          );
                        })}
                        {/* Punctual action markers - DAILY VIEW */}
                        {isDailyView && shouldShowActionsForChart("revenue") && dailyActions.map(action => {
                          const color = ACTION_CATEGORY_COLORS[action.category] || "#64748b";
                          return (
                            <ReferenceLine
                              key={`action-daily-${action.id}`}
                              x={action.xValue}
                              stroke={color}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={<ActionMarkerLabel actions={[action]} color={color} onActionClick={onActionClick} />}
                            />
                          );
                        })}
                        {/* Barre N-1 (gris) */}
                        {hasPrevData && !hiddenRevenueBars.has('prevRevenue') && (
                          <Bar 
                            dataKey="prevRevenue" 
                            fill="hsl(var(--muted-foreground))" 
                            opacity={0.5} 
                            radius={[4, 4, 0, 0]} 
                            animationDuration={CHART_ANIMATION_DURATION} 
                            animationEasing={CHART_ANIMATION_EASING}
                            cursor={!drillDownMonth ? "pointer" : undefined}
                            onClick={!drillDownMonth ? handleRevenueBarClick : undefined}
                          />
                        )}
                        {/* Barre N (bleu) */}
                        {!hiddenRevenueBars.has('revenue') && (
                          <Bar 
                            dataKey="revenue" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]} 
                            animationDuration={CHART_ANIMATION_DURATION} 
                            animationEasing={CHART_ANIMATION_EASING}
                            cursor={!drillDownMonth ? "pointer" : undefined}
                            onClick={!drillDownMonth ? handleRevenueBarClick : undefined}
                          />
                        )}
                      </BarChart>
                    ) : (
                      <LineChart 
                        data={drillDownMonth ? drillDownChartData : aggregatedRevenueData}
                        onClick={!drillDownMonth ? handleRevenueBarClick : undefined}
                        style={{ cursor: !drillDownMonth ? 'pointer' : undefined }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const data = payload[0]?.payload;
                            if (!data) return null;
                            
                            const variation = data.prevRevenue > 0 
                              ? ((data.revenue - data.prevRevenue) / data.prevRevenue) * 100 
                              : data.revenue > 0 ? 100 : 0;
                            const variationColor = variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-muted-foreground';
                            
                            if (comparisonMode === "rollingPeriod" && data.currentDate && data.prevDate) {
                              const currentDate = new Date(data.currentDate);
                              const prevDate = new Date(data.prevDate);
                              return (
                                <div className="bg-background border border-border rounded-lg p-3 shadow-lg min-w-[220px]">
                                  <div className="space-y-0.5 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-primary">—</span>
                                      <span className="text-muted-foreground">{format(currentDate, 'EEE d MMM.', { locale: fr })}</span>
                                      <span className={variationColor}>{variation > 0 ? '↑' : variation < 0 ? '↓' : ''}{Math.abs(variation).toFixed(0)}%</span>
                                      <span className="text-foreground">{data.revenue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">---</span>
                                      <span className="text-muted-foreground">{format(prevDate, 'EEE d MMM.', { locale: fr })}</span>
                                      <span className="text-muted-foreground ml-auto">{(data.prevRevenue || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-medium mb-2">
                                  {drillDownMonth ? `${data.dayOfWeek ? `${data.dayOfWeek}. ` : ''}${label} ${MONTHS[drillDownMonth - 1]}` : label}
                                </p>
                                <p className="text-sm" style={{ color: 'hsl(var(--primary))' }}>
                                  CA {currentLabel}: {(data.revenue || 0).toLocaleString('fr-FR')} €
                                </p>
                                {(drillDownMonth ? hasDrillDownPrevData : hasPrevData) && (
                                  <>
                                    <p className="text-sm text-muted-foreground">
                                      CA {prevLabel}: {(data.prevRevenue || 0).toLocaleString('fr-FR')} €
                                    </p>
                                    <p className={`text-sm font-medium mt-1 ${variationColor}`}>
                                      {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                                    </p>
                                  </>
                                )}
                                {/* Football matches in tooltip */}
                                {(() => {
                                  const matchesForDay = dailyFootballMatches.filter((match) => match.x1 === label);
                                  if (matchesForDay.length === 0) return null;
                                  return (
                                    <div className="mt-2 pt-2 border-t border-border/60">
                                      {matchesForDay.map((match) => (
                                        <div key={match.id} className="text-xs space-y-0.5">
                                          <div className="font-semibold flex items-center gap-1">
                                            <span>⚽</span>
                                            <span>{match.home_team} vs {match.away_team}</span>
                                          </div>
                                          {(match.time || match.venue) && (
                                            <p className="text-[11px] text-muted-foreground">
                                              {match.time}{match.time && match.venue ? ' • ' : ''}{match.venue}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          }}
                        />
                        {/* Period events as ReferenceArea (e.g., Ramadan) - only in year view */}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && periodEventsData.map(event => (
                          <ReferenceArea
                            key={`period-line-${event.id}`}
                            x1={event.x1}
                            x2={event.x2}
                            fill={event.color}
                            fillOpacity={0.25}
                            stroke={event.color}
                            strokeOpacity={0.6}
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            label={{
                              value: `🌙 ${event.title} 🌙`,
                              position: 'insideTop',
                              fill: event.color,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />
                        ))}
                        {/* Contextual events - YEAR VIEW (no school holidays - only visible in daily drill-down) */}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && holidays.map(event => 
                          renderPublicHolidayMarker(event)
                        )}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && footballMatches.map(event => 
                          renderFootballMatchMarker(event)
                        )}
                        {/* Contextual events - DAILY VIEW */}
                        {isDailyView && activeDailyMonth && shouldShowActionsForChart("revenue") && dailySchoolHolidays.map(event => 
                          renderSchoolHolidayAreaDaily(event)
                        )}
                        {isDailyView && activeDailyMonth && shouldShowActionsForChart("revenue") && dailyHolidays.map(event => 
                          renderPublicHolidayMarkerDaily(event)
                        )}
                        {/* Football match markers - DAILY VIEW: simple line, details shown in tooltip */}
                        {isDailyView && activeDailyMonth && shouldShowActionsForChart("revenue") && dailyFootballMatches.map(event => (
                          <ReferenceLine
                            key={`match-line-daily-${event.id}`}
                            x={event.x1}
                            stroke="rgba(59, 130, 246, 0.6)"
                            strokeWidth={1.5}
                            strokeDasharray="2 2"
                          />
                        ))}
                        {/* Punctual action markers - YEAR VIEW */}
                        {!drillDownMonth && shouldShowActionsForChart("revenue") && actionMonths.map(monthNum => {
                          const monthActions = actionsByMonth[monthNum] || [];
                          const primaryAction = monthActions[0];
                          if (!primaryAction) return null;
                          const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                          return (
                            <ReferenceLine
                              key={`action-line-${monthNum}`}
                              x={MONTHS[monthNum - 1]}
                              stroke={color}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                            />
                          );
                        })}
                        {/* Punctual action markers - DAILY VIEW */}
                        {isDailyView && shouldShowActionsForChart("revenue") && dailyActions.map(action => {
                          const color = ACTION_CATEGORY_COLORS[action.category] || "#64748b";
                          return (
                            <ReferenceLine
                              key={`action-daily-line-${action.id}`}
                              x={action.xValue}
                              stroke={color}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={<ActionMarkerLabel actions={[action]} color={color} onActionClick={onActionClick} />}
                            />
                          );
                        })}
                        {/* Line N-1 (gris, dashed for rolling period) */}
                        {(drillDownMonth ? hasDrillDownPrevData : hasPrevData) && !hiddenRevenueBars.has('prevRevenue') && (
                          <Line 
                            type="monotone"
                            dataKey="prevRevenue" 
                            stroke="hsl(var(--muted-foreground))" 
                            strokeWidth={2}
                            strokeDasharray={comparisonMode === "rollingPeriod" ? "5 5" : undefined}
                            dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5 }}
                            animationDuration={CHART_ANIMATION_DURATION} 
                            animationEasing={CHART_ANIMATION_EASING}
                          />
                        )}
                        {/* Line N (bleu) */}
                        {!hiddenRevenueBars.has('revenue') && (
                          <Line 
                            type="monotone"
                            dataKey="revenue" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5 }}
                            animationDuration={CHART_ANIMATION_DURATION} 
                            animationEasing={CHART_ANIMATION_EASING}
                          />
                        )}
                      </LineChart>
                    )}
                </ResponsiveContainer>
              </motion.div>
            </AnimatePresence>
          </div>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Orders Evolution Chart */}
      {showRevenue && (
      <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Évolution des Commandes
            {hasPrevData && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.currentRange
                  ? `(${rollingPeriodDateRanges.currentRange} vs ${rollingPeriodDateRanges.prevRange})`
                  : comparisonSuffix
                }
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Inline KPIs */}
            {(() => {
              const totalOrders = aggregatedRevenueData.reduce((sum, d) => sum + (d.orders || 0), 0);
              const totalPrevOrders = aggregatedRevenueData.reduce((sum, d) => sum + (d.prevOrders || 0), 0);
              const ordersVariation = calcVariation(totalOrders, totalPrevOrders);
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 rounded-xl mt-1"
                >
                  <div className="flex items-center gap-2.5">
                    <ShoppingCart className="h-5 w-5 text-chart-2" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground leading-tight">
                        {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.currentRange 
                          ? rollingPeriodDateRanges.currentRange 
                          : currentLabel}
                      </p>
                      <p className="text-base font-bold leading-tight">{totalOrders.toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                  {hasPrevData && (
                    <>
                      <div className="h-10 w-px bg-border" />
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground leading-tight">
                          {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.prevRange 
                            ? rollingPeriodDateRanges.prevRange 
                            : prevLabel}
                        </p>
                        <p className="text-sm text-muted-foreground leading-tight">{totalPrevOrders.toLocaleString('fr-FR')}</p>
                      </div>
                      <div className="h-10 w-px bg-border" />
                      <div className={cn(
                        "flex items-center gap-1 font-semibold text-base",
                        ordersVariation > 0 && "text-emerald-500",
                        ordersVariation < 0 && "text-red-500",
                        ordersVariation === 0 && "text-muted-foreground"
                      )}>
                        {ordersVariation > 0 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : ordersVariation < 0 ? (
                          <ArrowDown className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        <span>{ordersVariation > 0 ? "+" : ""}{ordersVariation.toFixed(1)}%</span>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })()}
            <ChartActionToggle
              chartKey="revenue"
              config={config}
              onChange={handleChartToggle}
              hasActions={!!hasActions}
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* Interactive Legend */}
          <InteractiveLegend
            items={[
              { key: 'orders', label: `Commandes ${currentLabel}`, color: 'hsl(var(--chart-2))' },
              ...(hasPrevData ? [{ key: 'prevOrders', label: `Commandes ${prevLabel}`, color: 'hsl(var(--muted-foreground))' }] : []),
            ]}
            hiddenKeys={hiddenRevenueBars}
            onToggle={toggleRevenueBar}
            onReset={() => setHiddenRevenueBars(new Set())}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aggregatedRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [value.toLocaleString('fr-FR'), 'Commandes']}
                />
                {/* Period events as ReferenceArea */}
                {shouldShowActionsForChart("revenue") && periodEventsData.map(event => (
                  <ReferenceArea
                    key={`period-orders-${event.id}`}
                    x1={event.x1}
                    x2={event.x2}
                    fill={event.color}
                    fillOpacity={0.25}
                    stroke={event.color}
                    strokeOpacity={0.6}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    label={{
                      value: `🌙 ${event.title} 🌙`,
                      position: 'insideTop',
                      fill: event.color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                ))}
                {/* Action markers */}
                {shouldShowActionsForChart("revenue") && actionMonths.map(monthNum => {
                  const monthActions = actionsByMonth[monthNum] || [];
                  const primaryAction = monthActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  return (
                    <ReferenceLine
                      key={`action-orders-${monthNum}`}
                      x={MONTHS[monthNum - 1]}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
                {/* Ligne N-1 pointillée */}
                {hasPrevData && !hiddenRevenueBars.has('prevOrders') && (
                  <Line 
                    type="monotone" 
                    dataKey="prevOrders" 
                    name={`Commandes ${prevLabel}`} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--muted-foreground))', r: 3 }} 
                    opacity={0.6}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {/* Ligne N solide */}
                {!hiddenRevenueBars.has('orders') && (
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    name={`Commandes ${selectedYear}`} 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--chart-2))', r: 4 }} 
                    animationDuration={CHART_ANIMATION_DURATION} 
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Average Basket Evolution Chart */}
      {showRevenue && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Évolution du Panier Moyen
            {hasPrevData && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.currentRange
                  ? `(${rollingPeriodDateRanges.currentRange} vs ${rollingPeriodDateRanges.prevRange})`
                  : `(${selectedYear} vs ${prevYear})`
                }
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Inline KPIs */}
            {(() => {
              const validBaskets = chartAvgBasketData.filter(d => d.avgBasket > 0);
              const validPrevBaskets = chartAvgBasketData.filter(d => d.avgBasketN1 && d.avgBasketN1 > 0);
              const avgBasket = validBaskets.length > 0 
                ? validBaskets.reduce((sum, d) => sum + d.avgBasket, 0) / validBaskets.length 
                : 0;
              const avgPrevBasket = validPrevBaskets.length > 0 
                ? validPrevBaskets.reduce((sum, d) => sum + (d.avgBasketN1 || 0), 0) / validPrevBaskets.length 
                : 0;
              const basketVariation = calcVariation(avgBasket, avgPrevBasket);
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 rounded-xl mt-1"
                >
                  <div className="flex items-center gap-2.5">
                    <Euro className="h-5 w-5 text-chart-1" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground leading-tight">
                        {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.currentRange 
                          ? rollingPeriodDateRanges.currentRange 
                          : selectedYear}
                      </p>
                      <p className="text-base font-bold leading-tight">{avgBasket.toFixed(2)} €</p>
                    </div>
                  </div>
                  {hasPrevData && avgPrevBasket > 0 && (
                    <>
                      <div className="h-10 w-px bg-border" />
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground leading-tight">
                          {comparisonMode === "rollingPeriod" && rollingPeriodDateRanges.prevRange 
                            ? rollingPeriodDateRanges.prevRange 
                            : prevYear}
                        </p>
                        <p className="text-sm text-muted-foreground leading-tight">{avgPrevBasket.toFixed(2)} €</p>
                      </div>
                      <div className="h-10 w-px bg-border" />
                      <div className={cn(
                        "flex items-center gap-1 font-semibold text-base",
                        basketVariation > 0 && "text-emerald-500",
                        basketVariation < 0 && "text-red-500",
                        basketVariation === 0 && "text-muted-foreground"
                      )}>
                        {basketVariation > 0 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : basketVariation < 0 ? (
                          <ArrowDown className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        <span>{basketVariation > 0 ? "+" : ""}{basketVariation.toFixed(1)}%</span>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })()}
            <ChartActionToggle
              chartKey="avgBasket"
              config={config}
              onChange={handleChartToggle}
              hasActions={!!hasActions}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartAvgBasketData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis 
                  className="text-xs" 
                  domain={avgBasketDomain}
                  tickFormatter={(value) => `${value}€`}
                  allowDataOverflow={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string, props: any) => {
                    const item = props.payload;
                    if (name.includes(String(selectedYear))) {
                      return [
                        `${value.toFixed(2)} €`,
                        `Panier moyen ${selectedYear} (${item?.orders?.toLocaleString('fr-FR') || 0} commandes)`
                      ];
                    }
                    return [
                      `${value.toFixed(2)} €`,
                      `Panier moyen ${prevYear} (${item?.prevOrders?.toLocaleString('fr-FR') || 0} commandes)`
                    ];
                  }}
                  labelFormatter={(label) => label}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgBasket" 
                  name={`Panier moyen ${selectedYear}`} 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--chart-1))', r: 4 }} 
                  animationDuration={CHART_ANIMATION_DURATION} 
                  animationEasing={CHART_ANIMATION_EASING}
                />
                {hasPrevData && (
                  <Line 
                    type="monotone" 
                    dataKey="avgBasketN1" 
                    name={`Panier moyen ${prevYear}`} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--muted-foreground))', r: 3 }} 
                    opacity={0.6}
                    animationDuration={CHART_ANIMATION_DURATION} 
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {/* Period events as ReferenceArea */}
                {shouldShowActionsForChart("avgBasket") && periodEventsData.map(event => (
                  <ReferenceArea
                    key={`period-avgbasket-${event.id}`}
                    x1={event.x1}
                    x2={event.x2}
                    fill={event.color}
                    fillOpacity={0.25}
                    stroke={event.color}
                    strokeOpacity={0.6}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    label={{
                      value: `🌙 ${event.title} 🌙`,
                      position: 'insideTop',
                      fill: event.color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                ))}
                {/* Action markers */}
                {shouldShowActionsForChart("avgBasket") && actionMonths.map(monthNum => {
                  const monthActions = actionsByMonth[monthNum] || [];
                  const primaryAction = monthActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  return (
                    <ReferenceLine
                      key={`action-avgbasket-${monthNum}`}
                      x={MONTHS[monthNum - 1]}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Profitability Chart in Revenue Section - wrapped in Card for consistent design */}
      {showRevenue && (
        <Card>
          <CardContent className="pt-6">
            <ProfitabilityComparisonChart
              dailyOrdersData={revenueProfitabilityData || []}
              previousDailyOrdersData={revenueProfitabilityPrevData || []}
              dateRange={{
                start: profitStartDate,
                end: profitEndDate,
              }}
              previousDateRange={{
                start: profitPrevStartDate,
                end: profitPrevEndDate,
              }}
              isLoading={isProfitabilityLoading || isProfitabilityPrevLoading || !revenueProfitabilityData}
              comparisonMode={comparisonMode}
              onComparisonModeChange={onComparisonModeChange}
              onMonthClick={handleProfitabilityClick}
              restaurantIds={selectedRestaurants}
              platform={selectedPlatform}
              showActions={chartActionsConfig?.global}
              selectedActionIds={selectedActionIds}
              rollingPeriodRanges={rollingPeriodDateRanges}
            />
          </CardContent>
        </Card>
      )}

      {/* Promotion Evolution Chart */}
      {showRevenue && revenueProfitabilityData && revenueProfitabilityData.length > 0 && (
        <PromotionEvolutionChart
          data={revenueProfitabilityData}
          previousData={revenueProfitabilityPrevData || undefined}
          granularity={granularity}
          isLoading={isProfitabilityLoading}
          selectedYear={selectedYear}
        />
      )}

      {/* Cross Data Analysis Chart (CA / Promos / Rentabilité / Uber One) */}
      {showRevenue && revenueProfitabilityData && revenueProfitabilityData.length > 0 && (
        <CrossDataAnalysisChart
          data={revenueProfitabilityData}
          previousData={revenueProfitabilityPrevData || undefined}
          granularity={granularity}
          isLoading={isProfitabilityLoading}
          uberOneData={uberOneDataForChart}
        />
      )}

      {showRevenue && isMultiRestaurant && topRestaurantsData.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top 10 Restaurants par CA
            <span className="text-sm font-normal text-muted-foreground ml-2">(Période sélectionnée)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRestaurantsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  className="text-xs" 
                  width={150}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string, props: any) => {
                    const totalRevenue = topRestaurantsData.reduce((sum, r) => sum + r.revenue, 0);
                    const percentage = totalRevenue > 0 ? ((value / totalRevenue) * 100).toFixed(1) : '0';
                    return [
                      `${value.toLocaleString('fr-FR')} € (${percentage}%)`,
                      `${props.payload.orders} commandes`
                    ];
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const index = topRestaurantsData.findIndex(r => r.name === payload[0].payload.name);
                      const medals = ['🥇', '🥈', '🥉'];
                      const medal = index < 3 ? medals[index] : `#${index + 1}`;
                      return `${medal} ${label}`;
                    }
                    return label;
                  }}
                />
                <Bar 
                  dataKey="revenue" 
                  name="Chiffre d'affaires" 
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Revenue Distribution by Restaurant (Monthly) */}
      {showRevenue && isMultiRestaurant && revenueByRestaurantData.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Répartition mensuelle par Restaurant
            <span className="text-sm font-normal text-muted-foreground ml-2">(Max 10 restaurants)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByRestaurantData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => value.toLocaleString('fr-FR') + ' €'}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {/* Dynamically render bars for each restaurant */}
                {topRestaurantsData.slice(0, 10).map((restaurant, index) => (
                  <Bar 
                    key={restaurant.id}
                    dataKey={restaurant.name}
                    name={restaurant.name}
                    fill={restaurantColors[index % restaurantColors.length]}
                    radius={[4, 4, 0, 0]}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Conversion Funnel Chart - New Enhanced Component */}
      {showConversion && (
      <ConversionFunnelChart
        data={aggregatedConversionData}
        selectedYear={selectedYear}
        showActions={shouldShowActionsForChart("conversionFunnel")}
        actions={filteredActions}
        actionsByMonth={actionsByMonth}
        onActionClick={onActionClick}
      />
      )}

      {/* Taux de Conversion Global - moved to 2nd position */}
      {showConversion && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Taux de Conversion Global
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
          {/* Input objectif en haut à droite */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
              <Target className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-medium">Objectif :</span>
              <Input
                type="number"
                value={conversionTarget}
                onChange={(e) => setConversionTarget(Number(e.target.value) || 0)}
                className="w-16 h-7 text-center text-sm"
                min={0}
                max={100}
                step={0.5}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <ChartActionToggle
              chartKey="conversionRate"
              config={config}
              onChange={handleChartToggle}
              hasActions={!!hasActions}
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* Section explicative */}
          <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm mb-1">Comment c'est calculé ?</p>
                <p className="text-muted-foreground text-sm">
                  <code className="bg-background px-2 py-0.5 rounded text-xs font-mono">
                    Taux = (Commandes ÷ Visites) × 100
                  </code>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm mb-1">Ce que ça révèle</p>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>• Plus le taux est élevé, mieux votre page convertit les visiteurs en clients</li>
                  <li>• Un taux faible peut indiquer : photos peu attrayantes, prix mal positionnés, ou menu confus</li>
                  <li>• <span className="text-green-600 dark:text-green-400 font-medium">Benchmark : 5-10% = correct, &gt;10% = excellent</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aggregatedConversionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" unit="%" domain={conversionYDomain} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload;
                    const variation = data?.prevConversionRate > 0 
                      ? ((data.conversionRate - data.prevConversionRate) / data.prevConversionRate * 100)
                      : null;
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium mb-2">{label}</p>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">Taux {selectedYear} :</span>{" "}
                            <span className="font-medium">{data?.conversionRate?.toFixed(2)}%</span>
                          </p>
                          {hasPrevData && data?.prevConversionRate > 0 && (
                            <p>
                              <span className="text-muted-foreground">Taux {prevYear} :</span>{" "}
                              <span className="font-medium">{data?.prevConversionRate?.toFixed(2)}%</span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground pt-1 border-t border-border mt-1">
                            {data?.visits?.toLocaleString('fr-FR')} visites → {data?.orders?.toLocaleString('fr-FR')} commandes
                          </p>
                          {variation !== null && (
                            <p className={`text-xs font-medium ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {variation >= 0 ? '↑' : '↓'} {Math.abs(variation).toFixed(1)}% vs {prevYear}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                {/* Period events as ReferenceArea */}
                {shouldShowActionsForChart("conversionRate") && periodEventsData.map(event => (
                  <ReferenceArea
                    key={`period-conv-${event.id}`}
                    x1={event.x1}
                    x2={event.x2}
                    fill={event.color}
                    fillOpacity={0.25}
                    stroke={event.color}
                    strokeOpacity={0.6}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                  />
                ))}
                {/* Action markers */}
                {shouldShowActionsForChart("conversionRate") && actionMonths.map(monthNum => {
                  const monthActions = actionsByMonth[monthNum] || [];
                  const primaryAction = monthActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  return (
                    <ReferenceLine
                      key={`action-conv-${monthNum}`}
                      x={MONTHS[monthNum - 1]}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
                {/* Zone rouge semi-transparente pour les valeurs en dessous de l'objectif */}
                <ReferenceArea
                  y1={0}
                  y2={conversionTarget}
                  fill="#ef4444"
                  fillOpacity={0.1}
                  stroke="none"
                />
                {/* Ligne de référence pour l'objectif */}
                <ReferenceLine 
                  y={conversionTarget} 
                  stroke="#22c55e" 
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{ 
                    value: `Objectif ${conversionTarget}%`, 
                    position: 'right', 
                    fill: '#22c55e',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                />
                <Line
                  type="monotone" 
                  dataKey="conversionRate" 
                  name={`Taux ${selectedYear}`}
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={({ cx, cy, payload }: { cx: number; cy: number; payload: { conversionRate: number } }) => {
                    const isBelow = payload.conversionRate > 0 && payload.conversionRate < conversionTarget;
                    return (
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={6} 
                        fill={isBelow ? '#ef4444' : 'hsl(var(--primary))'} 
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 8, strokeWidth: 2 }}
                />
                {hasPrevData && (
                  <Line 
                    type="monotone" 
                    dataKey="prevConversionRate" 
                    name={`Taux ${prevYear}`}
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 1, r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Restaurant ranking charts - always show to see position even with single restaurant */}
      {showConversion && allConversionData && allConversionData.length > 0 && (
        (() => {
          // Calculate per-restaurant data from ALL restaurants
          const perRestaurantData = (() => {
            const restaurantMap: Record<string, { visits: number; views: number; cart: number; orders: number }> = {};
            
            allConversionData.forEach((item: any) => {
              const restaurantId = item.restaurant_id;
              if (!restaurantId) return;
              
              if (!restaurantMap[restaurantId]) {
                restaurantMap[restaurantId] = { visits: 0, views: 0, cart: 0, orders: 0 };
              }
              restaurantMap[restaurantId].visits += item.visits || 0;
              restaurantMap[restaurantId].views += item.menu_views || 0;
              restaurantMap[restaurantId].cart += item.add_to_cart || 0;
              restaurantMap[restaurantId].orders += item.orders || 0;
            });
            
            return Object.entries(restaurantMap).map(([restaurantId, data]) => {
              const restaurant = restaurants.find(r => r.id === restaurantId);
              return {
                restaurantId,
                restaurantName: restaurant?.name || 'Restaurant inconnu',
                isSelected: selectedRestaurants.includes(restaurantId),
                ...data,
              };
            }).filter(r => r.visits > 0);
          })();

          if (perRestaurantData.length < 2) return null;

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ConversionRankingByStage 
                data={perRestaurantData} 
                highlightedRestaurants={selectedRestaurants}
              />
              <ConversionScatterPlot 
                data={perRestaurantData}
                highlightedRestaurants={selectedRestaurants}
              />
            </div>
          );
        })()
      )}

      {/* Leaky Bucket Analysis + Revenue per Visit KPI - moved to bottom of conversion section */}
      {showConversion && aggregatedConversionData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConversionLeakyBucket
              data={{
                visits: aggregatedConversionData.reduce((sum, d) => sum + d.visits, 0),
                views: aggregatedConversionData.reduce((sum, d) => sum + d.views, 0),
                cart: aggregatedConversionData.reduce((sum, d) => sum + d.cart, 0),
                orders: aggregatedConversionData.reduce((sum, d) => sum + d.orders, 0),
              }}
            />
          </div>
          <div className="flex flex-col gap-4">
            <RevenuePerVisitKPI
              visits={aggregatedConversionData.reduce((sum, d) => sum + d.visits, 0)}
              revenue={aggregatedRevenueData.reduce((sum, d) => sum + d.revenue, 0)}
              previousVisits={aggregatedConversionData.reduce((sum, d) => sum + d.prevVisits, 0)}
              previousRevenue={aggregatedRevenueData.reduce((sum, d) => sum + d.prevRevenue, 0)}
            />
          </div>
        </div>
      )}

      {/* Payout Detail Sheet */}
      <PayoutDetailSheet
        open={payoutDetailOpen}
        onOpenChange={setPayoutDetailOpen}
        selectedDate={selectedPayoutDate}
        payouts={selectedDatePayouts}
        restaurants={restaurants}
      />
      
      {/* Finances Section - Synthèse + Détail tabs */}
      {showFinances && restaurants && restaurants.length > 0 && (
        <FinancesSection
          dailyPayoutsData={dailyPayoutsData || []}
          restaurants={restaurants}
          selectedRestaurants={selectedRestaurants || []}
          startDate={propStartDate || (() => {
            const year = selectedYear;
            const month = drillDownMonth ?? startMonth ?? 1;
            return new Date(year, month - 1, 1);
          })()}
          endDate={propEndDate || (() => {
            const year = selectedYear;
            const month = drillDownMonth ?? endMonth ?? 12;
            return new Date(year, month, 0);
          })()}
          dateRange={profitabilityDateRange}
          previousDateRange={profitabilityPrevDateRange}
          profitabilityComparisonMode={profitabilityComparisonMode}
          onProfitabilityComparisonModeChange={onProfitabilityComparisonModeChange}
          onMonthDrillDown={handleProfitabilityClick}
          selectedPlatform={selectedPlatform}
          // Action filtering props
          showActions={chartActionsConfig?.global}
          onShowActionsChange={(value) => onChartActionsConfigChange?.({ ...chartActionsConfig!, global: value })}
          globalActions={globalActions}
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
          granularity={granularity}
        />
      )}
    </div>
  );
}
