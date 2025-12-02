import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { ConversionFunnelChart } from "./ConversionFunnelChart";
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

interface AnalyticsChartsProps {
  revenueData: MonthlyRevenue[] | undefined;
  conversionData: MonthlyConversion[] | undefined;
  feesData: MonthlyFees[] | undefined;
  prevRevenueData?: MonthlyRevenue[] | undefined;
  prevConversionData?: MonthlyConversion[] | undefined;
  prevFeesData?: MonthlyFees[] | undefined;
  startMonth?: number;
  endMonth?: number;
  selectedYear: number;
  showComparison?: boolean;
  actions?: RestaurantAction[];
  chartActionsConfig?: ChartActionsConfig;
  onChartActionsConfigChange?: (config: ChartActionsConfig) => void;
  onActionClick?: (actionId: string) => void;
  selectedCategories?: ActionCategoryFilter;
  onCategoryToggle?: (category: string) => void;
  viewMode?: "all" | "revenue" | "conversion" | "finances";
  restaurants?: { id: string; name: string; city?: string }[];
  selectedRestaurants?: string[];
}

// Action category colors
const ACTION_CATEGORY_COLORS: Record<string, string> = {
  visuals: "#8b5cf6",
  pricing: "#f59e0b",
  promotions: "#ec4899",
  marketing: "#3b82f6",
  menu: "#10b981",
  operational: "#64748b",
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
  if (!config.global || !hasActions) return null;

  const isActive = config[chartKey];
  
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0 rounded-full transition-colors",
              isActive 
                ? "bg-primary/10 text-primary hover:bg-primary/20" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onChange({ ...config, [chartKey]: !isActive })}
          >
            <Zap className={cn("h-3.5 w-3.5", isActive && "fill-primary")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">
            {isActive ? "Masquer les actions" : "Afficher les actions"}
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
  startMonth = 1,
  endMonth = 12,
  selectedYear,
  showComparison = true,
  actions,
  chartActionsConfig,
  onChartActionsConfigChange,
  onActionClick,
  selectedCategories,
  onCategoryToggle,
  viewMode = "all",
  restaurants = [],
  selectedRestaurants = [],
}: AnalyticsChartsProps) {
  const prevYear = selectedYear - 1;
  
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

  // Filter actions by selected categories
  const filteredActions = useMemo(() => {
    if (!actions || actions.length === 0) return [];
    if (!selectedCategories || selectedCategories.size === 0) return actions;
    return actions.filter(a => selectedCategories.has(a.category));
  }, [actions, selectedCategories]);

  // Group actions by month for reference lines (using filtered actions)
  const actionsByMonth = useMemo(() => {
    if (!filteredActions || filteredActions.length === 0) return {};
    
    const byMonth: Record<number, RestaurantAction[]> = {};
    filteredActions.forEach(action => {
      const month = new Date(action.start_date).getMonth() + 1;
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(action);
    });
    return byMonth;
  }, [filteredActions]);

  // Get unique months with actions within the range
  const actionMonths = useMemo(() => {
    return Object.keys(actionsByMonth)
      .map(Number)
      .filter(m => m >= startMonth && m <= endMonth);
  }, [actionsByMonth, startMonth, endMonth]);

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
    
    if (isDailyData) {
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
  }, [revenueData, prevRevenueData, startMonth, endMonth]);

  // Aggregate conversion data
  const aggregatedConversionData = useMemo(() => {
    if (!conversionData) return [];
    
    const isDailyData = conversionData.length > 0 && 'date' in conversionData[0];
    
    if (isDailyData) {
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
  }, [conversionData, prevConversionData, startMonth, endMonth]);

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

  // Profitability data
  const profitabilityData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const revenueMonth = aggregatedRevenueData.find(r => r.monthNum === monthNum);
      const feesMonth = aggregatedFeesData.find(f => f.monthNum === monthNum);
      
      const revenue = revenueMonth?.revenue || 0;
      const netPayout = feesMonth?.net || 0;
      const profitability = revenue > 0 ? (netPayout / revenue) * 100 : 0;

      const prevRevenue = revenueMonth?.prevRevenue || 0;
      const prevNet = feesMonth?.prevNet || 0;
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
  }, [aggregatedRevenueData, aggregatedFeesData, startMonth, endMonth]);

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
    const totalFees = aggregatedFeesData.reduce((sum, d) => sum + d.totalFees, 0);
    const totalNet = aggregatedFeesData.reduce((sum, d) => sum + d.net, 0);
    const profitability = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

    // Previous year totals
    const prevTotalRevenue = aggregatedRevenueData.reduce((sum, d) => sum + d.prevRevenue, 0);
    const prevTotalOrders = aggregatedRevenueData.reduce((sum, d) => sum + d.prevOrders, 0);
    const prevTotalVisits = aggregatedConversionData.reduce((sum, d) => sum + d.prevVisits, 0);
    const prevTotalFees = aggregatedFeesData.reduce((sum, d) => sum + d.prevTotalFees, 0);
    const prevTotalNet = aggregatedFeesData.reduce((sum, d) => sum + d.prevNet, 0);
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
  }, [aggregatedRevenueData, aggregatedConversionData, aggregatedFeesData]);

  const hasData = aggregatedRevenueData.some(d => d.revenue > 0) || 
                  aggregatedConversionData.some(d => d.visits > 0) || 
                  aggregatedFeesData.some(d => d.totalFees > 0);

  const hasPrevData = showComparison && (
    aggregatedRevenueData.some(d => d.prevRevenue > 0) || 
    aggregatedFeesData.some(d => d.prevTotalFees > 0)
  );

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
      {/* KPI Cards */}
      {showKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {showRevenueKPIs && (
        <>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">CA Total</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.totalRevenue} previous={kpis.prevTotalRevenue} />}
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.totalRevenue.toLocaleString("fr-FR")} €
            </p>
            {hasPrevData && (
              <p className="text-xs text-muted-foreground">
                {prevYear}: {kpis.prevTotalRevenue.toLocaleString("fr-FR")} €
              </p>
            )}
          </CardContent>
        </Card>
        </>
        )}
        
        {showConversionKPIs && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Commandes</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.totalOrders} previous={kpis.prevTotalOrders} />}
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.totalOrders.toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-muted-foreground">
              Panier moy. {kpis.avgBasket.toFixed(2)} €
            </p>
          </CardContent>
        </Card>
        )}
        
        {showFinanceKPIs && (
        <>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Taux Conv.</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.conversionRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-sm text-muted-foreground">Frais Totaux</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.totalFees} previous={kpis.prevTotalFees} inverse />}
            </div>
            <p className="text-2xl font-bold mt-2">
              {kpis.totalFees.toLocaleString("fr-FR")} €
            </p>
            <p className="text-xs text-muted-foreground">
              {kpis.feePercentage.toFixed(1)}% du CA
            </p>
          </CardContent>
        </Card>

        <Card className={kpis.profitability > 60 ? "border-green-500/50" : kpis.profitability > 40 ? "border-amber-500/50" : "border-destructive/50"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${kpis.profitability > 60 ? "text-green-500" : kpis.profitability > 40 ? "text-amber-500" : "text-destructive"}`} />
                <span className="text-sm text-muted-foreground">% Rentabilité</span>
              </div>
              {hasPrevData && <VariationIndicator current={kpis.profitability} previous={kpis.prevProfitability} />}
            </div>
            <p className={`text-2xl font-bold mt-2 ${kpis.profitability > 60 ? "text-green-500" : kpis.profitability > 40 ? "text-amber-500" : "text-destructive"}`}>
              {kpis.profitability.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Versement / CA
            </p>
          </CardContent>
        </Card>
        </>
        )}
        </div>
      )}

      {/* Actions Legend */}
      {config.global && actions && actions.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Actions affichées ({filteredActions.length}/{actions.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ACTION_CATEGORY_LABELS).map(([key, label]) => {
                  const count = actions.filter(a => a.category === key).length;
                  if (count === 0) return null;
                  const Icon = ACTION_CATEGORY_ICONS[key] || Zap;
                  const isSelected = !selectedCategories || selectedCategories.size === 0 || selectedCategories.has(key);
                  const categoryColor = ACTION_CATEGORY_COLORS[key];
                  
                  return (
                    <button
                      key={key}
                      onClick={() => onCategoryToggle?.(key)}
                      className={cn(
                        "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-all cursor-pointer border",
                        isSelected 
                          ? "bg-background shadow-sm border-border"
                          : "bg-muted/50 opacity-50 border-transparent hover:opacity-75"
                      )}
                      style={{
                        borderColor: isSelected ? categoryColor : undefined,
                      }}
                    >
                      <div 
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-opacity",
                          !isSelected && "opacity-40"
                        )}
                        style={{ backgroundColor: categoryColor }} 
                      />
                      <Icon 
                        className={cn(
                          "h-3 w-3 transition-opacity",
                          !isSelected && "opacity-40"
                        )} 
                        style={{ color: categoryColor }} 
                      />
                      <span className={cn(!isSelected && "line-through")}>{label} ({count})</span>
                    </button>
                  );
                })}
              </div>
              {selectedCategories && selectedCategories.size > 0 && (
                <button
                  onClick={() => {
                    // Clear all filters by toggling all selected categories off
                    selectedCategories.forEach(cat => onCategoryToggle?.(cat));
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Chart with N-1 comparison */}
      {showRevenue && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Évolution du Chiffre d'Affaires
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
          <ChartActionToggle
            chartKey="revenue"
            config={config}
            onChange={handleChartToggle}
            hasActions={!!hasActions}
          />
        </CardHeader>
        <CardContent>
          {/* Interactive Legend */}
          <InteractiveLegend
            items={[
              { key: 'revenue', label: `CA ${selectedYear}`, color: 'hsl(var(--primary))' },
              ...(hasPrevData ? [{ key: 'prevRevenue', label: `CA ${prevYear}`, color: 'hsl(var(--muted-foreground))' }] : []),
              { key: 'orders', label: 'Commandes', color: 'hsl(var(--chart-2))' },
            ]}
            hiddenKeys={hiddenRevenueBars}
            onToggle={toggleRevenueBar}
            onReset={() => setHiddenRevenueBars(new Set())}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggregatedRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name.includes('€')) return [value.toLocaleString('fr-FR') + ' €', name];
                    return [value.toLocaleString('fr-FR'), name];
                  }}
                />
                {/* Action markers */}
                {shouldShowActionsForChart("revenue") && actionMonths.map(monthNum => {
                  const monthActions = actionsByMonth[monthNum] || [];
                  const primaryAction = monthActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  return (
                    <ReferenceLine
                      key={`action-${monthNum}`}
                      x={MONTHS[monthNum - 1]}
                      yAxisId="left"
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
                {!hiddenRevenueBars.has('revenue') && <Bar yAxisId="left" dataKey="revenue" name={`CA ${selectedYear} (€)`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
                {hasPrevData && !hiddenRevenueBars.has('prevRevenue') && (
                  <Bar yAxisId="left" dataKey="prevRevenue" name={`CA ${prevYear} (€)`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />
                )}
                {!hiddenRevenueBars.has('orders') && <Line yAxisId="right" type="monotone" dataKey="orders" name="Commandes" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: 'hsl(var(--chart-2))' }} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
              </ComposedChart>
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
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
          <ChartActionToggle
            chartKey="avgBasket"
            config={config}
            onChange={handleChartToggle}
            hasActions={!!hasActions}
          />
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
                  formatter={(value: number, name: string) => {
                    const item = averageBasketData.find(d => d.monthNum === (averageBasketData.indexOf(d as any) + 1));
                    if (name.includes(String(selectedYear))) {
                      return [
                        `${value.toFixed(2)} €`,
                        `${name} (${item?.orders || 0} commandes)`
                      ];
                    }
                    return [
                      `${value.toFixed(2)} €`,
                      `${name} (${item?.prevOrders || 0} commandes)`
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

      {/* Top 10 Restaurants by Revenue */}
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

      {/* Conversion Rate Chart with N-1 */}
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

      {/* Fees Breakdown Chart */}
      {showFinances && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Répartition des Frais
          </CardTitle>
          <ChartActionToggle
            chartKey="fees"
            config={config}
            onChange={handleChartToggle}
            hasActions={!!hasActions}
          />
        </CardHeader>
        <CardContent>
          {/* Interactive Legend */}
          <InteractiveLegend
            items={[
              { key: 'uber', label: 'Commission', color: 'hsl(var(--chart-1))' },
              { key: 'marketing', label: 'Marketing', color: 'hsl(var(--chart-2))' },
              { key: 'offers', label: 'Offres', color: 'hsl(var(--chart-3))' },
              { key: 'ads', label: 'Publicité', color: 'hsl(var(--chart-4))' },
            ]}
            hiddenKeys={hiddenFeesBars}
            onToggle={toggleFeesBar}
            onReset={() => setHiddenFeesBars(new Set())}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregatedFeesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [value.toLocaleString('fr-FR') + ' €', name]}
                />
                {/* Action markers */}
                {shouldShowActionsForChart("fees") && actionMonths.map(monthNum => {
                  const monthActions = actionsByMonth[monthNum] || [];
                  const primaryAction = monthActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  return (
                    <ReferenceLine
                      key={`action-fees-${monthNum}`}
                      x={MONTHS[monthNum - 1]}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
                {!hiddenFeesBars.has('uber') && <Bar dataKey="uber" name="Commission" stackId="a" fill="hsl(var(--chart-1))" animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
                {!hiddenFeesBars.has('marketing') && <Bar dataKey="marketing" name="Marketing" stackId="a" fill="hsl(var(--chart-2))" animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
                {!hiddenFeesBars.has('offers') && <Bar dataKey="offers" name="Offres" stackId="a" fill="hsl(var(--chart-3))" animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
                {!hiddenFeesBars.has('ads') && <Bar dataKey="ads" name="Publicité" stackId="a" fill="hsl(var(--chart-4))" animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Net Payout Chart with N-1 */}
      {showFinances && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Versement Net vs Frais Totaux
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
          <ChartActionToggle
            chartKey="netPayout"
            config={config}
            onChange={handleChartToggle}
            hasActions={!!hasActions}
          />
        </CardHeader>
        <CardContent>
          {/* Interactive Legend */}
          <InteractiveLegend
            items={[
              { key: 'net', label: `Versement ${selectedYear}`, color: 'hsl(var(--primary))' },
              ...(hasPrevData ? [{ key: 'prevNet', label: `Versement ${prevYear}`, color: 'hsl(var(--muted-foreground))' }] : []),
              { key: 'totalFees', label: 'Total Frais', color: 'hsl(var(--destructive))' },
            ]}
            hiddenKeys={hiddenNetPayoutBars}
            onToggle={toggleNetPayoutBar}
            onReset={() => setHiddenNetPayoutBars(new Set())}
          />
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggregatedFeesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [value.toLocaleString('fr-FR') + ' €', name]}
                />
                {/* Action markers */}
                {shouldShowActionsForChart("netPayout") && actionMonths.map(monthNum => {
                  const monthActions = actionsByMonth[monthNum] || [];
                  const primaryAction = monthActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  return (
                    <ReferenceLine
                      key={`action-net-${monthNum}`}
                      x={MONTHS[monthNum - 1]}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
                {!hiddenNetPayoutBars.has('net') && <Bar dataKey="net" name={`Versement ${selectedYear}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
                {hasPrevData && !hiddenNetPayoutBars.has('prevNet') && (
                  <Bar dataKey="prevNet" name={`Versement ${prevYear}`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />
                )}
                {!hiddenNetPayoutBars.has('totalFees') && <Line type="monotone" dataKey="totalFees" name="Total Frais" stroke="hsl(var(--destructive))" strokeWidth={2} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Profitability Rate Chart with N-1 */}
      {showFinances && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Taux de Rentabilité
            {hasPrevData && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedYear} vs {prevYear})</span>}
          </CardTitle>
          <ChartActionToggle
            chartKey="profitability"
            config={config}
            onChange={handleChartToggle}
            hasActions={!!hasActions}
          />
        </CardHeader>
        <CardContent>
          {/* Interactive Legend */}
          <InteractiveLegend
            items={[
              { key: 'revenue', label: 'CA TTC', color: 'hsl(var(--muted))' },
              { key: 'netPayout', label: 'Versement Net', color: 'hsl(var(--primary))' },
              { key: 'profitability', label: `Rentabilité ${selectedYear}`, color: 'hsl(142.1 76.2% 36.3%)' },
              ...(hasPrevData ? [{ key: 'prevProfitability', label: `Rentabilité ${prevYear}`, color: 'hsl(var(--muted-foreground))' }] : []),
            ]}
            hiddenKeys={hiddenProfitBars}
            onToggle={toggleProfitBar}
            onReset={() => setHiddenProfitBars(new Set())}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={profitabilityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" unit="%" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name.includes('Rentabilité')) return [value.toFixed(1) + '%', name];
                    return [value.toLocaleString('fr-FR') + ' €', name];
                  }}
                />
                {/* Action markers */}
                {shouldShowActionsForChart("profitability") && actionMonths.map(monthNum => {
                  const monthActions = actionsByMonth[monthNum] || [];
                  const primaryAction = monthActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  return (
                    <ReferenceLine
                      key={`action-profit-${monthNum}`}
                      x={MONTHS[monthNum - 1]}
                      yAxisId="left"
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarkerLabel actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
                {!hiddenProfitBars.has('revenue') && <Bar yAxisId="left" dataKey="revenue" name="CA TTC" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} opacity={0.5} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
                {!hiddenProfitBars.has('netPayout') && <Bar yAxisId="left" dataKey="netPayout" name="Versement Net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} animationDuration={CHART_ANIMATION_DURATION} animationEasing={CHART_ANIMATION_EASING} />}
                {!hiddenProfitBars.has('profitability') && (
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="profitability" 
                    name={`Rentabilité ${selectedYear}`}
                    stroke="hsl(142.1 76.2% 36.3%)" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(142.1 76.2% 36.3%)', strokeWidth: 2, r: 4 }}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {hasPrevData && !hiddenProfitBars.has('prevProfitability') && (
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="prevProfitability" 
                    name={`Rentabilité ${prevYear}`}
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 1, r: 3 }}
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
