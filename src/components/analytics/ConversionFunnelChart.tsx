import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import type { PeriodMode } from "@/contexts/AnalyticsContext";
import { startOfWeek, endOfWeek, parseISO, format, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { deduplicateWeeklyConversion } from "@/lib/deduplicateWeeklyConversion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Eye,
  ShoppingCart,
  Package,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  BarChart3,
  LineChart as LineChartIcon,
  Info,
  Lightbulb,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { ConversionFunnelUberStyle } from "./ConversionFunnelUberStyle";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Label,
} from "recharts";

const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

// Animation constants
const CHART_ANIMATION_DURATION = 500;
const CHART_ANIMATION_EASING = "ease-out";

// Action category colors
const ACTION_CATEGORY_COLORS: Record<string, string> = {
  visuals: "#8b5cf6",
  pricing: "#f59e0b",
  promotions: "#ec4899",
  marketing: "#3b82f6",
  menu: "#10b981",
  operational: "#64748b",
};

interface ConversionDataPoint {
  month: string;
  monthNum: number;
  visits: number;
  views: number;
  cart: number;
  orders: number;
  conversionRate: number;
  prevVisits: number;
  prevConversionRate: number;
}

interface RestaurantAction {
  id: string;
  category: string;
  action_type: string;
  title: string;
  start_date: string;
  platform: string;
}

interface ConversionFunnelChartProps {
  data: ConversionDataPoint[];
  rawConversionData?: any[];
  selectedYear: number;
  granularity?: "daily" | "weekly" | "monthly";
  showActions?: boolean;
  actions?: RestaurantAction[];
  actionsByMonth?: Record<number, RestaurantAction[]>;
  onActionClick?: (actionId: string) => void;
  periodMode?: PeriodMode;
}

const getPeriodLabel = (periodMode?: PeriodMode): string => {
  if (periodMode === "month") return "Tout le mois";
  return "Toute la période";
};

// Rate calculation helpers
const calcRate = (numerator: number, denominator: number): number => {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
};

// Custom Rate Annotation Label
function RateAnnotation({ 
  x, 
  y, 
  rate, 
  label,
  position = "right"
}: { 
  x: number; 
  y: number; 
  rate: number;
  label: string;
  position?: "left" | "right";
}) {
  const xOffset = position === "right" ? 10 : -10;
  return (
    <g>
      <rect
        x={x + xOffset - (position === "left" ? 60 : 0)}
        y={y - 12}
        width={56}
        height={24}
        rx={4}
        fill="hsl(var(--background))"
        stroke="hsl(var(--border))"
        strokeWidth={1}
      />
      <text
        x={x + xOffset + (position === "left" ? -32 : 28)}
        y={y + 4}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={11}
        fontWeight={600}
      >
        {rate.toFixed(1)}%
      </text>
    </g>
  );
}

// Legend Item Component
function LegendItem({ 
  color, 
  label, 
  isActive, 
  onClick,
  icon: Icon
}: { 
  color: string; 
  label: string; 
  isActive: boolean;
  onClick: () => void;
  icon?: any;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
        isActive
          ? "bg-background shadow-sm border-border hover:shadow-md"
          : "bg-muted/50 text-muted-foreground border-transparent opacity-50"
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" style={{ color: isActive ? color : undefined }} />}
      <motion.span
        animate={{ opacity: isActive ? 1 : 0.3, scale: isActive ? 1 : 0.9 }}
        className="w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className={cn(!isActive && "line-through")}>{label}</span>
    </motion.button>
  );
}

// Action Marker for charts
function ActionMarker({
  viewBox,
  actions,
  color,
  onActionClick,
}: {
  viewBox?: { x?: number };
  actions: RestaurantAction[];
  color: string;
  onActionClick?: (actionId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  if (!viewBox?.x) return null;
  const x = viewBox.x;

  return (
    <g>
      <circle
        cx={x}
        cy={10}
        r={8}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => actions.length === 1 && onActionClick?.(actions[0].id)}
      />
      <text
        x={x}
        y={14}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontWeight="bold"
      >
        {actions.length > 1 ? actions.length : "⚡"}
      </text>
      {isHovered && (
        <foreignObject x={x - 100} y={24} width={200} height={100}>
          <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs">
            {actions.map((a, i) => (
              <div key={i} className="truncate">{a.title}</div>
            ))}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export function ConversionFunnelChart({
  data,
  rawConversionData,
  selectedYear,
  granularity = "monthly",
  showActions = false,
  actions = [],
  actionsByMonth = {},
  onActionClick,
}: ConversionFunnelChartProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<"volumes" | "rates">("volumes");
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  
  // Hidden areas state for interactive legend
  const [hiddenAreas, setHiddenAreas] = useState<Set<string>>(new Set());

  const toggleArea = (key: string) => {
    setHiddenAreas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Calculate rate data for Taux % view
  const rateData = useMemo(() => {
    return data.map(d => ({
      ...d,
      visitsToViews: calcRate(d.views, d.visits),
      viewsToCart: calcRate(d.cart, d.views),
      cartToOrders: calcRate(d.orders, d.cart),
      overallRate: calcRate(d.orders, d.visits),
      // Previous month comparison for alerts
      prevVisitsToViews: 0,
      prevViewsToCart: 0,
      prevCartToOrders: 0,
    })).map((d, i, arr) => {
      if (i === 0) return d;
      const prev = arr[i - 1];
      return {
        ...d,
        prevVisitsToViews: prev.visitsToViews,
        prevViewsToCart: prev.viewsToCart,
        prevCartToOrders: prev.cartToOrders,
      };
    });
  }, [data]);

  // Compute weekly breakdown from raw daily data
  const weeklyBreakdown = useMemo(() => {
    if (!rawConversionData || rawConversionData.length === 0 || granularity !== "weekly") return [];
    
    const weeklyMap: Record<string, { visits: number; views: number; cart: number; orders: number; weekStart: Date }> = {};
    
    // Deduplicate: keep one row per (restaurant, week) before summing
    const deduped = deduplicateWeeklyConversion(rawConversionData as any[]);
    deduped.forEach((item: any) => {
      if (!item.date) return;
      const ws = startOfWeek(parseISO(item.date), { locale: fr });
      const key = format(ws, 'yyyy-MM-dd');
      if (!weeklyMap[key]) {
        weeklyMap[key] = { visits: 0, views: 0, cart: 0, orders: 0, weekStart: ws };
      }
      weeklyMap[key].visits += item.visits || 0;
      weeklyMap[key].views += item.menu_views || 0;
      weeklyMap[key].cart += item.add_to_cart || 0;
      weeklyMap[key].orders += item.orders || 0;
    });
    
    return Object.keys(weeklyMap).sort().map((key, idx) => {
      const w = weeklyMap[key];
      const we = endOfWeek(w.weekStart, { locale: fr });
      return {
        key,
        label: isSameMonth(w.weekStart, we)
          ? `${format(w.weekStart, 'd')}-${format(we, 'd MMM', { locale: fr })}`
          : `${format(w.weekStart, 'd MMM', { locale: fr })} - ${format(we, 'd MMM', { locale: fr })}`,
        range: `${format(w.weekStart, 'dd/MM')} - ${format(we, 'dd/MM')}`,
        visits: w.visits,
        views: w.views,
        cart: w.cart,
        orders: w.orders,
      };
    });
  }, [rawConversionData, granularity]);

  // Determine which data to use for the funnel (selected week or full period)
  const activeFunnelSource = useMemo(() => {
    if (selectedWeek && weeklyBreakdown.length > 0) {
      const week = weeklyBreakdown.find(w => w.key === selectedWeek);
      if (week) return { visits: week.visits, views: week.views, cart: week.cart, orders: week.orders };
    }
    // Full period
    return data.reduce(
      (acc, d) => ({
        visits: acc.visits + d.visits,
        views: acc.views + d.views,
        cart: acc.cart + d.cart,
        orders: acc.orders + d.orders,
      }),
      { visits: 0, views: 0, cart: 0, orders: 0 }
    );
  }, [data, selectedWeek, weeklyBreakdown]);

  // WoW comparison
  const wowComparison = useMemo(() => {
    if (!selectedWeek || weeklyBreakdown.length === 0) return null;
    const idx = weeklyBreakdown.findIndex(w => w.key === selectedWeek);
    if (idx <= 0) return null;
    const curr = weeklyBreakdown[idx];
    const prev = weeklyBreakdown[idx - 1];
    const visitsDelta = prev.visits > 0 ? ((curr.visits - prev.visits) / prev.visits) * 100 : 0;
    const ordersDelta = prev.orders > 0 ? ((curr.orders - prev.orders) / prev.orders) * 100 : 0;
    const currRate = curr.visits > 0 ? (curr.orders / curr.visits) * 100 : 0;
    const prevRate = prev.visits > 0 ? (prev.orders / prev.visits) * 100 : 0;
    const rateDelta = prevRate > 0 ? currRate - prevRate : 0;
    return { prevLabel: prev.label, visitsDelta, ordersDelta, rateDelta };
  }, [selectedWeek, weeklyBreakdown]);

  // Calculate aggregated funnel metrics
  const funnelMetrics = useMemo(() => {
    const totals = activeFunnelSource;

    return {
      ...totals,
      visitsToViewsRate: calcRate(totals.views, totals.visits),
      viewsToCartRate: calcRate(totals.cart, totals.views),
      cartToOrdersRate: calcRate(totals.orders, totals.cart),
      overallRate: calcRate(totals.orders, totals.visits),
      // Loss percentages
      lossAfterVisit: 100 - calcRate(totals.views, totals.visits),
      lossAfterMenu: 100 - calcRate(totals.cart, totals.views),
      lossAfterCart: 100 - calcRate(totals.orders, totals.cart),
    };
  }, [activeFunnelSource]);

  // Detect significant drops (>10% month over month)
  const alertMonths = useMemo(() => {
    const alerts: { month: string; metric: string; drop: number }[] = [];
    rateData.forEach((d, i) => {
      if (i === 0) return;
      const prev = rateData[i - 1];
      
      if (prev.visitsToViews > 0) {
        const drop = ((prev.visitsToViews - d.visitsToViews) / prev.visitsToViews) * 100;
        if (drop > 10) alerts.push({ month: d.month, metric: "Visites→Menu", drop });
      }
      if (prev.viewsToCart > 0) {
        const drop = ((prev.viewsToCart - d.viewsToCart) / prev.viewsToCart) * 100;
        if (drop > 10) alerts.push({ month: d.month, metric: "Menu→Panier", drop });
      }
      if (prev.cartToOrders > 0) {
        const drop = ((prev.cartToOrders - d.cartToOrders) / prev.cartToOrders) * 100;
        if (drop > 10) alerts.push({ month: d.month, metric: "Panier→Cmd", drop });
      }
    });
    return alerts;
  }, [rateData]);

  // Action months
  const actionMonths = useMemo(() => {
    return Object.keys(actionsByMonth).map(Number);
  }, [actionsByMonth]);

  // Custom tooltip for volumes view
  const VolumesTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <Users className="h-3 w-3" style={{ color: 'hsl(var(--chart-1))' }} />
              Visites
            </span>
            <span className="font-medium">{d.visits?.toLocaleString('fr-FR')}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground pl-4">
            <TrendingDown className="h-3 w-3" />
            <span>{calcRate(d.views, d.visits).toFixed(1)}% consultent le menu</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <Eye className="h-3 w-3" style={{ color: 'hsl(var(--chart-2))' }} />
              Vues menu
            </span>
            <span className="font-medium">{d.views?.toLocaleString('fr-FR')}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground pl-4">
            <TrendingDown className="h-3 w-3" />
            <span>{calcRate(d.cart, d.views).toFixed(1)}% ajoutent au panier</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="h-3 w-3" style={{ color: 'hsl(var(--chart-3))' }} />
              Ajouts panier
            </span>
            <span className="font-medium">{d.cart?.toLocaleString('fr-FR')}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground pl-4">
            <TrendingDown className="h-3 w-3" />
            <span>{calcRate(d.orders, d.cart).toFixed(1)}% finalisent</span>
          </div>
          
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="flex items-center gap-1.5 font-medium">
              <Package className="h-3 w-3" style={{ color: 'hsl(var(--chart-4))' }} />
              Commandes
            </span>
            <span className="font-bold">{d.orders?.toLocaleString('fr-FR')}</span>
          </div>
          
          <div className="bg-muted/50 rounded p-2 mt-2">
            <span className="text-muted-foreground">Taux global : </span>
            <span className="font-bold text-primary">{calcRate(d.orders, d.visits).toFixed(2)}%</span>
          </div>
        </div>
      </div>
    );
  };

  // Custom tooltip for rates view
  const RatesTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Visites → Menu</span>
            <span className="font-medium">{d.visitsToViews?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Menu → Panier</span>
            <span className="font-medium">{d.viewsToCart?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Panier → Commande</span>
            <span className="font-medium">{d.cartToOrders?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border font-medium">
            <span>Taux global</span>
            <span className="text-primary">{d.overallRate?.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Funnel de Conversion
        </CardTitle>
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("volumes")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "volumes" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Volumes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("rates")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "rates" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LineChartIcon className="h-4 w-4 mr-1.5" />
              Taux %
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Week Selector Pills */}
        {weeklyBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedWeek(null)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                !selectedWeek
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
              )}
            >
              {getPeriodLabel(periodMode)}
            </button>
            {weeklyBreakdown.map(w => (
              <TooltipProvider key={w.key}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedWeek(selectedWeek === w.key ? null : w.key)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                        selectedWeek === w.key
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {w.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>{w.range}</p></TooltipContent>
                </UITooltip>
              </TooltipProvider>
            ))}
          </div>
        )}

        {/* WoW Comparison */}
        {wowComparison && selectedWeek && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              vs {wowComparison.prevLabel}
            </Badge>
            <Badge variant={wowComparison.visitsDelta >= 0 ? "default" : "destructive"} className="gap-1">
              Visites {wowComparison.visitsDelta >= 0 ? "+" : ""}{wowComparison.visitsDelta.toFixed(1)}%
            </Badge>
            <Badge variant={wowComparison.ordersDelta >= 0 ? "default" : "destructive"} className="gap-1">
              Commandes {wowComparison.ordersDelta >= 0 ? "+" : ""}{wowComparison.ordersDelta.toFixed(1)}%
            </Badge>
            <Badge variant={wowComparison.rateDelta >= 0 ? "default" : "destructive"} className="gap-1">
              Taux {wowComparison.rateDelta >= 0 ? "+" : ""}{wowComparison.rateDelta.toFixed(2)}pts
            </Badge>
          </div>
        )}

        {/* Funnel Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1.5 py-1 cursor-help">
                  <Users className="h-3 w-3" />
                  {funnelMetrics.visits.toLocaleString('fr-FR')} visites
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Nombre total de visites sur la période</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          
          <span className="text-muted-foreground self-center">→</span>
          <Badge variant="outline" className="gap-1.5 py-1 bg-chart-1/10 border-chart-1/30">
            <span className="text-xs font-medium">{funnelMetrics.visitsToViewsRate.toFixed(1)}%</span>
          </Badge>
          <span className="text-muted-foreground self-center">→</span>
          
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1.5 py-1 cursor-help">
                  <Eye className="h-3 w-3" />
                  {funnelMetrics.views.toLocaleString('fr-FR')} vues menu
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-destructive">{funnelMetrics.lossAfterVisit.toFixed(1)}% des visiteurs partent sans consulter le menu</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          
          <span className="text-muted-foreground self-center">→</span>
          <Badge variant="outline" className="gap-1.5 py-1 bg-chart-2/10 border-chart-2/30">
            <span className="text-xs font-medium">{funnelMetrics.viewsToCartRate.toFixed(1)}%</span>
          </Badge>
          <span className="text-muted-foreground self-center">→</span>
          
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1.5 py-1 cursor-help">
                  <ShoppingCart className="h-3 w-3" />
                  {funnelMetrics.cart.toLocaleString('fr-FR')} paniers
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-destructive">{funnelMetrics.lossAfterMenu.toFixed(1)}% partent après avoir vu le menu</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          
          <span className="text-muted-foreground self-center">→</span>
          <Badge variant="outline" className="gap-1.5 py-1 bg-chart-3/10 border-chart-3/30">
            <span className="text-xs font-medium">{funnelMetrics.cartToOrdersRate.toFixed(1)}%</span>
          </Badge>
          <span className="text-muted-foreground self-center">→</span>
          
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1.5 py-1 font-semibold cursor-help">
                  <Package className="h-3 w-3" />
                  {funnelMetrics.orders.toLocaleString('fr-FR')} commandes
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Taux de conversion global : <strong>{funnelMetrics.overallRate.toFixed(2)}%</strong></p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>

        {/* Uber-style vertical funnel chart */}
        <ConversionFunnelUberStyle
          data={{
            visits: funnelMetrics.visits,
            views: funnelMetrics.views,
            cart: funnelMetrics.cart,
            orders: funnelMetrics.orders,
          }}
          previousData={data.length > 0 && data[0].prevVisits > 0 ? {
            visits: data.reduce((acc, d) => acc + d.prevVisits, 0),
            views: Math.round(data.reduce((acc, d) => acc + d.prevVisits * (d.prevConversionRate / 100 || 0.25), 0)),
            cart: Math.round(data.reduce((acc, d) => acc + d.prevVisits * (d.prevConversionRate / 100 || 0.25) * 0.4, 0)),
            orders: Math.round(data.reduce((acc, d) => acc + d.prevVisits * d.prevConversionRate / 100, 0)),
          } : undefined}
          className="mb-4"
        />

        {/* Interactive Legend for Volumes view */}
        <AnimatePresence mode="wait">
          {viewMode === "volumes" && (
            <motion.div
              key="volumes-legend"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-wrap gap-2"
            >
              <LegendItem
                color="hsl(var(--chart-1))"
                label="Visites"
                icon={Users}
                isActive={!hiddenAreas.has('visits')}
                onClick={() => toggleArea('visits')}
              />
              <LegendItem
                color="hsl(var(--chart-2))"
                label="Vues menu"
                icon={Eye}
                isActive={!hiddenAreas.has('views')}
                onClick={() => toggleArea('views')}
              />
              <LegendItem
                color="hsl(var(--chart-3))"
                label="Ajouts panier"
                icon={ShoppingCart}
                isActive={!hiddenAreas.has('cart')}
                onClick={() => toggleArea('cart')}
              />
              <LegendItem
                color="hsl(var(--chart-4))"
                label="Commandes"
                icon={Package}
                isActive={!hiddenAreas.has('orders')}
                onClick={() => toggleArea('orders')}
              />
              {hiddenAreas.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setHiddenAreas(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                >
                  Tout afficher
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chart */}
        <div className="h-[320px]">
          <AnimatePresence mode="wait">
            {viewMode === "volumes" ? (
              <motion.div
                key="volumes-chart"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip content={<VolumesTooltip />} />
                    
                    {/* Action markers */}
                    {showActions && actionMonths.map(monthNum => {
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
                          label={<ActionMarker actions={monthActions} color={color} onActionClick={onActionClick} />}
                        />
                      );
                    })}
                    
                    {!hiddenAreas.has('visits') && (
                      <Area 
                        type="monotone" 
                        dataKey="visits" 
                        name="Visites" 
                        stroke="hsl(var(--chart-1))" 
                        fill="hsl(var(--chart-1))" 
                        fillOpacity={0.7}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    )}
                    {!hiddenAreas.has('views') && (
                      <Area 
                        type="monotone" 
                        dataKey="views" 
                        name="Vues menu" 
                        stroke="hsl(var(--chart-2))" 
                        fill="hsl(var(--chart-2))" 
                        fillOpacity={0.7}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    )}
                    {!hiddenAreas.has('cart') && (
                      <Area 
                        type="monotone" 
                        dataKey="cart" 
                        name="Ajouts panier" 
                        stroke="hsl(var(--chart-3))" 
                        fill="hsl(var(--chart-3))" 
                        fillOpacity={0.7}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    )}
                    {!hiddenAreas.has('orders') && (
                      <Area 
                        type="monotone" 
                        dataKey="orders" 
                        name="Commandes" 
                        stroke="hsl(var(--chart-4))" 
                        fill="hsl(var(--chart-4))" 
                        fillOpacity={0.7}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            ) : (
              <motion.div
                key="rates-chart"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rateData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis 
                      className="text-xs" 
                      domain={[0, 100]} 
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<RatesTooltip />} />
                    
                    {/* Reference zones for performance */}
                    <ReferenceArea y1={50} y2={100} fill="#22c55e" fillOpacity={0.05} />
                    <ReferenceArea y1={30} y2={50} fill="#f59e0b" fillOpacity={0.05} />
                    <ReferenceArea y1={0} y2={30} fill="#ef4444" fillOpacity={0.05} />
                    
                    {/* Reference lines for benchmarks */}
                    <ReferenceLine y={50} stroke="#22c55e" strokeDasharray="8 4" strokeOpacity={0.5}>
                      <Label value="Excellent" position="right" fill="#22c55e" fontSize={10} />
                    </ReferenceLine>
                    <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="8 4" strokeOpacity={0.5}>
                      <Label value="Correct" position="right" fill="#f59e0b" fontSize={10} />
                    </ReferenceLine>
                    
                    {/* Action markers */}
                    {showActions && actionMonths.map(monthNum => {
                      const monthActions = actionsByMonth[monthNum] || [];
                      const primaryAction = monthActions[0];
                      if (!primaryAction) return null;
                      const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                      return (
                        <ReferenceLine
                          key={`action-rate-${monthNum}`}
                          x={MONTHS[monthNum - 1]}
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={<ActionMarker actions={monthActions} color={color} onActionClick={onActionClick} />}
                        />
                      );
                    })}
                    
                    <Line
                      type="monotone"
                      dataKey="visitsToViews"
                      name="Visites → Menu"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(var(--chart-1))', r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                    <Line
                      type="monotone"
                      dataKey="viewsToCart"
                      name="Menu → Panier"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                    <Line
                      type="monotone"
                      dataKey="cartToOrders"
                      name="Panier → Commande"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                    <Line
                      type="monotone"
                      dataKey="overallRate"
                      name="Taux global"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: 'hsl(var(--primary))', r: 5, strokeWidth: 2, stroke: 'white' }}
                      activeDot={{ r: 8, strokeWidth: 2 }}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapsible Explanation Section */}
        <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Comprendre le funnel de conversion
              </span>
              <motion.div animate={{ rotate: showExplanation ? 180 : 0 }}>
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-muted/50 rounded-lg p-4 mt-2 space-y-4"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-1 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Les 4 étapes du parcours client</p>
                      <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                        <li><strong>Visites</strong> : Nombre de personnes qui voient votre restaurant</li>
                        <li><strong>Vues menu</strong> : Ceux qui cliquent pour voir votre carte</li>
                        <li><strong>Ajouts panier</strong> : Ceux qui ajoutent un produit</li>
                        <li><strong>Commandes</strong> : Ceux qui finalisent l'achat</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500 mt-1 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Points de fuite identifiés</p>
                      <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                        <li className={funnelMetrics.lossAfterVisit > 80 ? "text-destructive" : ""}>
                          • {funnelMetrics.lossAfterVisit.toFixed(0)}% partent avant de voir le menu 
                          {funnelMetrics.lossAfterVisit > 80 && " ⚠️"}
                        </li>
                        <li className={funnelMetrics.lossAfterMenu > 70 ? "text-destructive" : ""}>
                          • {funnelMetrics.lossAfterMenu.toFixed(0)}% partent après avoir vu le menu
                          {funnelMetrics.lossAfterMenu > 70 && " ⚠️"}
                        </li>
                        <li className={funnelMetrics.lossAfterCart > 50 ? "text-destructive" : ""}>
                          • {funnelMetrics.lossAfterCart.toFixed(0)}% abandonnent leur panier
                          {funnelMetrics.lossAfterCart > 50 && " ⚠️"}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">💡 Conseil :</strong> Un taux "Visites→Menu" &lt; 20% peut indiquer un problème avec votre photo principale ou votre positionnement prix affiché.
                  Un taux "Panier→Commande" &lt; 50% suggère des frais de livraison trop élevés ou des délais de livraison trop longs.
                </p>
              </div>
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
