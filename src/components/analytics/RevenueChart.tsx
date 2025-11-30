import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  ShoppingCart,
  BarChart3,
  LineChart as LineChartIcon,
  ChevronDown,
  Info,
  Lightbulb,
  Award,
  AlertTriangle,
  Zap,
  Calendar,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const CHART_ANIMATION_DURATION = 500;
const CHART_ANIMATION_EASING = "ease-out";

const ACTION_CATEGORY_COLORS: Record<string, string> = {
  visuals: "#8b5cf6",
  pricing: "#f59e0b",
  promotions: "#ec4899",
  marketing: "#3b82f6",
  menu: "#10b981",
  operational: "#64748b",
};

interface RevenueDataPoint {
  month: string;
  monthNum: number;
  revenue: number;
  orders: number;
  avgBasket: number;
  prevRevenue: number;
  prevOrders: number;
}

interface RestaurantAction {
  id: string;
  category: string;
  action_type: string;
  title: string;
  start_date: string;
  platform: string;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  selectedYear: number;
  prevYear: number;
  showComparison?: boolean;
  showActions?: boolean;
  actionsByMonth?: Record<number, RestaurantAction[]>;
  onActionClick?: (actionId: string) => void;
  platform?: string;
}

// Action Marker Component
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
      <text x={x} y={14} textAnchor="middle" fill={color} fontSize={9} fontWeight="bold">
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

// Legend Item Component
function LegendItem({ 
  color, 
  label, 
  isActive, 
  onClick 
}: { 
  color: string; 
  label: string; 
  isActive: boolean;
  onClick: () => void;
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
      <motion.span
        animate={{ opacity: isActive ? 1 : 0.3, scale: isActive ? 1 : 0.9 }}
        className="w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className={cn(!isActive && "line-through")}>{label}</span>
    </motion.button>
  );
}

export function RevenueChart({
  data,
  selectedYear,
  prevYear,
  showComparison = true,
  showActions = false,
  actionsByMonth = {},
  onActionClick,
  platform = "global",
}: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<"amounts" | "performance">("amounts");
  const [showExplanation, setShowExplanation] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Calculate performance data
  const performanceData = useMemo(() => {
    return data.map(d => ({
      ...d,
      revenuePerDay: d.revenue / 30,
      revenuePerOrder: d.orders > 0 ? d.revenue / d.orders : 0,
      orderVariation: d.prevOrders > 0 ? ((d.orders - d.prevOrders) / d.prevOrders) * 100 : 0,
      revenueVariation: d.prevRevenue > 0 ? ((d.revenue - d.prevRevenue) / d.prevRevenue) * 100 : 0,
    }));
  }, [data]);

  // Find best/worst months
  const { bestMonth, worstMonth } = useMemo(() => {
    const validData = data.filter(d => d.revenue > 0);
    if (validData.length === 0) return { bestMonth: null, worstMonth: null };
    
    const best = validData.reduce((max, d) => d.revenue > max.revenue ? d : max, validData[0]);
    const worst = validData.reduce((min, d) => d.revenue < min.revenue ? d : min, validData[0]);
    
    return { bestMonth: best, worstMonth: worst };
  }, [data]);

  // Aggregated stats
  const stats = useMemo(() => {
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
    const prevTotalRevenue = data.reduce((sum, d) => sum + d.prevRevenue, 0);
    const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgRevenuePerMonth = totalRevenue / data.filter(d => d.revenue > 0).length || 0;
    
    return { totalRevenue, totalOrders, prevTotalRevenue, avgBasket, avgRevenuePerMonth };
  }, [data]);

  const actionMonths = useMemo(() => Object.keys(actionsByMonth).map(Number), [actionsByMonth]);

  const hasPrevData = showComparison && data.some(d => d.prevRevenue > 0);

  // Platform-specific insights
  const getPlatformInsights = () => {
    if (platform === "uber_eats") {
      return {
        title: "Uber Eats",
        tips: [
          "Le CA dépend fortement de votre visibilité (note, ranking) et des promotions actives",
          "Un panier moyen < 18€ peut suggérer d'ajouter des formules/menus combo",
          "Les pics de CA sont souvent liés aux événements sportifs et week-ends",
        ],
        benchmark: "Panier moyen benchmark : 20-25€",
      };
    }
    if (platform === "deliveroo") {
      return {
        title: "Deliveroo",
        tips: [
          "Deliveroo favorise les restaurants avec des paniers > 20€ dans les suggestions",
          "Le ranking dépend aussi de votre temps de préparation moyen",
          "Les photos professionnelles augmentent le panier moyen de 15-20%",
        ],
        benchmark: "Panier moyen benchmark : 22-28€",
      };
    }
    return {
      title: "Global",
      tips: [
        "Analysez les performances séparément par plateforme pour identifier les leviers",
        "Les différences de CA entre plateformes révèlent votre positionnement",
        "Un panier moyen élevé indique une bonne stratégie de cross-selling",
      ],
      benchmark: "Objectif : maintenir un panier moyen > 20€",
    };
  };

  const insights = getPlatformInsights();

  // Tooltip for amounts view
  const AmountsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const variation = d.prevRevenue > 0 
      ? ((d.revenue - d.prevRevenue) / d.prevRevenue * 100) 
      : null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <Euro className="h-3 w-3 text-primary" />
              CA
            </span>
            <span className="font-bold">{d.revenue?.toLocaleString('fr-FR')} €</span>
          </div>
          
          {hasPrevData && d.prevRevenue > 0 && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span>CA {prevYear}</span>
              <span>{d.prevRevenue?.toLocaleString('fr-FR')} €</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="h-3 w-3 text-chart-2" />
              Commandes
            </span>
            <span className="font-medium">{d.orders?.toLocaleString('fr-FR')}</span>
          </div>
          
          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Panier moyen</span>
              <span className="font-medium">{d.avgBasket?.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CA / jour</span>
              <span className="font-medium">{(d.revenue / 30)?.toFixed(0)} €</span>
            </div>
          </div>
          
          {variation !== null && (
            <div className={cn(
              "text-xs font-medium pt-1",
              variation >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {variation >= 0 ? "↑" : "↓"} {Math.abs(variation).toFixed(1)}% vs {prevYear}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Tooltip for performance view
  const PerformanceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Panier moyen</span>
            <span className="font-bold text-primary">{d.avgBasket?.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span>CA / jour</span>
            <span className="font-medium">{d.revenuePerDay?.toFixed(0)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span>CA / commande</span>
            <span className="font-medium">{d.revenuePerOrder?.toFixed(2)} €</span>
          </div>
          
          {d.orderVariation !== 0 && (
            <div className="pt-2 border-t border-border">
              <div className={cn(
                "flex justify-between",
                d.orderVariation >= 0 ? "text-green-600" : "text-red-600"
              )}>
                <span>Δ Commandes vs N-1</span>
                <span>{d.orderVariation >= 0 ? "+" : ""}{d.orderVariation.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Évolution du Chiffre d'Affaires
          {hasPrevData && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({selectedYear} vs {prevYear})
            </span>
          )}
        </CardTitle>
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("amounts")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "amounts" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Euro className="h-4 w-4 mr-1.5" />
              Montants
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("performance")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "performance" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LineChartIcon className="h-4 w-4 mr-1.5" />
              Performance
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 py-1">
            <Euro className="h-3 w-3" />
            Total : {stats.totalRevenue.toLocaleString('fr-FR')} €
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1">
            <ShoppingCart className="h-3 w-3" />
            {stats.totalOrders.toLocaleString('fr-FR')} commandes
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1 bg-primary/10 border-primary/30">
            Panier moy. : {stats.avgBasket.toFixed(2)} €
          </Badge>
          {bestMonth && (
            <Badge variant="outline" className="gap-1.5 py-1 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
              <Award className="h-3 w-3" />
              Meilleur : {bestMonth.month} ({bestMonth.revenue.toLocaleString('fr-FR')} €)
            </Badge>
          )}
          {worstMonth && worstMonth.month !== bestMonth?.month && (
            <Badge variant="outline" className="gap-1.5 py-1 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Plus faible : {worstMonth.month}
            </Badge>
          )}
        </div>

        {/* Collapsible Explanation */}
        <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Comprendre ce graphique ({insights.title})
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showExplanation && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-muted/50 rounded-lg p-4 mt-2 space-y-3"
            >
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">Ce que montre ce graphique</p>
                  <p className="text-muted-foreground text-sm">
                    {viewMode === "amounts" 
                      ? "L'évolution mensuelle de votre CA et nombre de commandes. Les barres représentent le CA, la ligne les commandes."
                      : "Les indicateurs de performance : panier moyen, CA par jour, et tendances de croissance."}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">Conseils {insights.title}</p>
                  <ul className="text-muted-foreground text-xs space-y-1">
                    {insights.tips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-primary font-medium mt-2">{insights.benchmark}</p>
                </div>
              </div>
            </motion.div>
          </CollapsibleContent>
        </Collapsible>

        {/* Interactive Legend */}
        <AnimatePresence mode="wait">
          {viewMode === "amounts" ? (
            <motion.div
              key="amounts-legend"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2"
            >
              <LegendItem
                color="hsl(var(--primary))"
                label={`CA ${selectedYear}`}
                isActive={!hiddenSeries.has("revenue")}
                onClick={() => toggleSeries("revenue")}
              />
              {hasPrevData && (
                <LegendItem
                  color="hsl(var(--muted-foreground))"
                  label={`CA ${prevYear}`}
                  isActive={!hiddenSeries.has("prevRevenue")}
                  onClick={() => toggleSeries("prevRevenue")}
                />
              )}
              <LegendItem
                color="hsl(var(--chart-2))"
                label="Commandes"
                isActive={!hiddenSeries.has("orders")}
                onClick={() => toggleSeries("orders")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="performance-legend"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2"
            >
              <LegendItem
                color="hsl(var(--primary))"
                label="Panier moyen"
                isActive={!hiddenSeries.has("avgBasket")}
                onClick={() => toggleSeries("avgBasket")}
              />
              <LegendItem
                color="hsl(var(--chart-3))"
                label="CA / jour"
                isActive={!hiddenSeries.has("revenuePerDay")}
                onClick={() => toggleSeries("revenuePerDay")}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chart */}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AnimatePresence mode="wait">
              {viewMode === "amounts" ? (
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip content={<AmountsTooltip />} />
                  
                  {/* Action markers */}
                  {showActions && actionMonths.map(monthNum => {
                    const monthActions = actionsByMonth[monthNum] || [];
                    const primaryAction = monthActions[0];
                    if (!primaryAction) return null;
                    const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                    return (
                      <ReferenceLine
                        key={`action-${monthNum}`}
                        x={data.find(d => d.monthNum === monthNum)?.month}
                        yAxisId="left"
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={<ActionMarker actions={monthActions} color={color} onActionClick={onActionClick} />}
                      />
                    );
                  })}
                  
                  {/* Best month annotation */}
                  {bestMonth && (
                    <ReferenceLine
                      x={bestMonth.month}
                      yAxisId="left"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  )}
                  
                  {!hiddenSeries.has("revenue") && (
                    <Bar 
                      yAxisId="left" 
                      dataKey="revenue" 
                      name={`CA ${selectedYear}`}
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                      animationDuration={CHART_ANIMATION_DURATION} 
                      animationEasing={CHART_ANIMATION_EASING}
                    >
                      {data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={entry.month === bestMonth?.month 
                            ? "hsl(var(--chart-2))" 
                            : entry.month === worstMonth?.month 
                              ? "hsl(var(--chart-3))" 
                              : "hsl(var(--primary))"}
                        />
                      ))}
                    </Bar>
                  )}
                  {hasPrevData && !hiddenSeries.has("prevRevenue") && (
                    <Bar 
                      yAxisId="left" 
                      dataKey="prevRevenue" 
                      name={`CA ${prevYear}`}
                      fill="hsl(var(--muted-foreground))" 
                      radius={[4, 4, 0, 0]} 
                      opacity={0.4} 
                      animationDuration={CHART_ANIMATION_DURATION} 
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                  )}
                  {!hiddenSeries.has("orders") && (
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="orders" 
                      name="Commandes" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                      animationDuration={CHART_ANIMATION_DURATION} 
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                  )}
                </ComposedChart>
              ) : (
                <ComposedChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" unit=" €" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" unit=" €" />
                  <Tooltip content={<PerformanceTooltip />} />
                  
                  {/* Reference line for average basket target */}
                  <ReferenceLine
                    y={20}
                    yAxisId="left"
                    stroke="hsl(var(--chart-2))"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                    label={{ 
                      value: "Objectif 20€", 
                      position: "right", 
                      fill: "hsl(var(--chart-2))",
                      fontSize: 11,
                    }}
                  />
                  
                  {!hiddenSeries.has("avgBasket") && (
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="avgBasket" 
                      name="Panier moyen" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 5 }}
                      animationDuration={CHART_ANIMATION_DURATION}
                    />
                  )}
                  {!hiddenSeries.has("revenuePerDay") && (
                    <Bar 
                      yAxisId="right"
                      dataKey="revenuePerDay" 
                      name="CA / jour" 
                      fill="hsl(var(--chart-3))" 
                      radius={[4, 4, 0, 0]}
                      opacity={0.7}
                      animationDuration={CHART_ANIMATION_DURATION}
                    />
                  )}
                </ComposedChart>
              )}
            </AnimatePresence>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
