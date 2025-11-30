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
  Percent,
  ChevronDown,
  Info,
  Lightbulb,
  AlertTriangle,
  Zap,
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
  ReferenceArea,
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

interface FeesDataPoint {
  month: string;
  monthNum: number;
  uber: number;
  marketing: number;
  offers: number;
  ads: number;
  net: number;
  totalFees: number;
  prevNet: number;
  prevTotalFees: number;
}

interface RevenueDataPoint {
  month: string;
  monthNum: number;
  revenue: number;
}

interface RestaurantAction {
  id: string;
  category: string;
  action_type: string;
  title: string;
  start_date: string;
  platform: string;
}

interface NetPayoutChartProps {
  data: FeesDataPoint[];
  revenueData?: RevenueDataPoint[];
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

export function NetPayoutChart({
  data,
  revenueData = [],
  selectedYear,
  prevYear,
  showComparison = true,
  showActions = false,
  actionsByMonth = {},
  onActionClick,
  platform = "global",
}: NetPayoutChartProps) {
  const [viewMode, setViewMode] = useState<"amounts" | "ratio">("amounts");
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

  // Calculate ratio data
  const ratioData = useMemo(() => {
    return data.map(d => {
      const revenueMonth = revenueData.find(r => r.monthNum === d.monthNum);
      const revenue = revenueMonth?.revenue || 0;
      
      return {
        ...d,
        netRatio: revenue > 0 ? (d.net / revenue) * 100 : 0,
        feesRatio: revenue > 0 ? (d.totalFees / revenue) * 100 : 0,
        revenue,
        // Danger indicator
        isDanger: d.totalFees > d.net,
      };
    });
  }, [data, revenueData]);

  // Aggregated stats
  const stats = useMemo(() => {
    const totalNet = data.reduce((sum, d) => sum + d.net, 0);
    const totalFees = data.reduce((sum, d) => sum + d.totalFees, 0);
    const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
    const avgNetRatio = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;
    const prevTotalNet = data.reduce((sum, d) => sum + d.prevNet, 0);
    
    // Find danger months
    const dangerMonths = ratioData.filter(d => d.isDanger);
    
    // Best/worst months
    const validData = data.filter(d => d.net > 0);
    const bestMonth = validData.length > 0 ? validData.reduce((max, d) => d.net > max.net ? d : max, validData[0]) : null;
    const worstMonth = validData.length > 0 ? validData.reduce((min, d) => d.net < min.net ? d : min, validData[0]) : null;
    
    return { 
      totalNet, 
      totalFees, 
      totalRevenue,
      avgNetRatio,
      prevTotalNet,
      dangerMonths,
      bestMonth,
      worstMonth,
    };
  }, [data, revenueData, ratioData]);

  const actionMonths = useMemo(() => Object.keys(actionsByMonth).map(Number), [actionsByMonth]);
  const hasPrevData = showComparison && data.some(d => d.prevNet > 0);

  // Platform-specific insights
  const getPlatformInsights = () => {
    if (platform === "uber_eats") {
      return {
        title: "Uber Eats",
        tips: [
          "Le versement net est ce que vous recevez après déduction de tous les frais",
          "Les offres Uber sont souvent à votre charge : une offre -20% peut diviser votre marge par 2",
          "Surveillez l'écart Frais/Net : un ratio > 0.5 signifie que vous donnez plus de la moitié à la plateforme",
        ],
        formula: "Net = CA - Commission - Marketing - Offres - Publicité",
      };
    }
    if (platform === "deliveroo") {
      return {
        title: "Deliveroo",
        tips: [
          "Deliveroo a généralement des commissions légèrement inférieures",
          "Le programme Plus peut augmenter les commandes mais surveiller l'impact sur le net",
          "Les promotions ciblées sont souvent plus rentables que les générales",
        ],
        formula: "Net = CA - Commission - Frais marketing - Offres",
      };
    }
    return {
      title: "Global",
      tips: [
        "Comparez le net entre plateformes pour identifier la plus rentable",
        "Un ratio Net/CA < 60% peut indiquer une dépendance excessive aux promotions",
        "Optimisez d'abord les frais marketing si le ratio est mauvais",
      ],
      formula: "Net = CA Brut - Σ(tous les frais plateforme)",
    };
  };

  const insights = getPlatformInsights();

  // Tooltip for amounts view
  const AmountsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const ratioMonth = ratioData.find(r => r.month === label);
    const variation = d.prevNet > 0 ? ((d.net - d.prevNet) / d.prevNet * 100) : null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-primary" />
              Versement Net
            </span>
            <span className="font-bold text-primary">{d.net?.toLocaleString('fr-FR')} €</span>
          </div>
          
          {hasPrevData && d.prevNet > 0 && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Versement {prevYear}</span>
              <span>{d.prevNet?.toLocaleString('fr-FR')} €</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="h-3 w-3 text-destructive" />
              Total Frais
            </span>
            <span className="font-medium text-destructive">{d.totalFees?.toLocaleString('fr-FR')} €</span>
          </div>
          
          {ratioMonth && ratioMonth.revenue > 0 && (
            <div className="pt-2 border-t border-border space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CA Brut</span>
                <span>{ratioMonth.revenue?.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net représente</span>
                <span className={cn(
                  "font-medium",
                  ratioMonth.netRatio < 60 ? "text-amber-500" : "text-green-500"
                )}>{ratioMonth.netRatio?.toFixed(1)}% du CA</span>
              </div>
            </div>
          )}
          
          {variation !== null && (
            <div className={cn(
              "text-xs font-medium pt-1",
              variation >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {variation >= 0 ? "↑" : "↓"} {Math.abs(variation).toFixed(1)}% vs {prevYear}
            </div>
          )}
          
          {d.totalFees > d.net && (
            <div className="flex items-center gap-1.5 text-destructive bg-destructive/10 rounded p-1.5 mt-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs">Frais supérieurs au versement !</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Tooltip for ratio view
  const RatioTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Ratio Net/CA</span>
            <span className={cn(
              "font-bold",
              d.netRatio < 50 ? "text-destructive" : d.netRatio < 65 ? "text-amber-500" : "text-green-500"
            )}>{d.netRatio?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Ratio Frais/CA</span>
            <span className="font-medium">{d.feesRatio?.toFixed(1)}%</span>
          </div>
          
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net</span>
              <span>{d.net?.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CA</span>
              <span>{d.revenue?.toLocaleString('fr-FR')} €</span>
            </div>
          </div>
          
          {d.isDanger && (
            <div className="flex items-center gap-1.5 text-destructive bg-destructive/10 rounded p-1.5">
              <AlertTriangle className="h-3 w-3" />
              <span>Zone critique</span>
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
          Versement Net vs Frais Totaux
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
              Montants €
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("ratio")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "ratio" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Percent className="h-4 w-4 mr-1.5" />
              Ratio
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 bg-primary/10 border-primary/30">
            <TrendingUp className="h-3 w-3" />
            Net total : {stats.totalNet.toLocaleString('fr-FR')} €
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1 text-destructive border-destructive/30">
            <TrendingDown className="h-3 w-3" />
            Frais totaux : {stats.totalFees.toLocaleString('fr-FR')} €
          </Badge>
          <Badge variant="outline" className={cn(
            "gap-1.5 py-1",
            stats.avgNetRatio < 60 ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400" : "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
          )}>
            Ratio Net/CA : {stats.avgNetRatio.toFixed(1)}%
          </Badge>
          {stats.dangerMonths.length > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 bg-destructive/10 border-destructive/30 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {stats.dangerMonths.length} mois à risque
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
                  <p className="font-medium text-sm mb-1">Ce que ça révèle</p>
                  <p className="text-muted-foreground text-sm">
                    Le versement net est ce que vous recevez réellement. Si les frais dépassent le versement, vous travaillez à perte.
                  </p>
                  <code className="text-xs bg-background px-2 py-1 rounded mt-2 inline-block font-mono">
                    {insights.formula}
                  </code>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">Points d'attention</p>
                  <ul className="text-muted-foreground text-xs space-y-1">
                    {insights.tips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">Zone de danger</p>
                  <p className="text-muted-foreground text-xs">
                    Quand les frais dépassent le versement net (zone rouge), vous perdez de l'argent sur cette plateforme.
                  </p>
                </div>
              </div>
            </motion.div>
          </CollapsibleContent>
        </Collapsible>

        {/* Interactive Legend */}
        <div className="flex flex-wrap gap-2">
          <LegendItem
            color="hsl(var(--primary))"
            label={`Versement ${selectedYear}`}
            isActive={!hiddenSeries.has("net")}
            onClick={() => toggleSeries("net")}
          />
          {hasPrevData && (
            <LegendItem
              color="hsl(var(--muted-foreground))"
              label={`Versement ${prevYear}`}
              isActive={!hiddenSeries.has("prevNet")}
              onClick={() => toggleSeries("prevNet")}
            />
          )}
          <LegendItem
            color="hsl(var(--destructive))"
            label="Total Frais"
            isActive={!hiddenSeries.has("totalFees")}
            onClick={() => toggleSeries("totalFees")}
          />
          {hiddenSeries.size > 0 && (
            <button
              onClick={() => setHiddenSeries(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
            >
              Tout afficher
            </button>
          )}
        </div>

        {/* Chart */}
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "amounts" ? (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
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
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={<ActionMarker actions={monthActions} color={color} onActionClick={onActionClick} />}
                    />
                  );
                })}
                
                {!hiddenSeries.has("net") && (
                  <Bar 
                    dataKey="net" 
                    name={`Versement ${selectedYear}`}
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    animationDuration={CHART_ANIMATION_DURATION} 
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {hasPrevData && !hiddenSeries.has("prevNet") && (
                  <Bar 
                    dataKey="prevNet" 
                    name={`Versement ${prevYear}`}
                    fill="hsl(var(--muted-foreground))" 
                    radius={[4, 4, 0, 0]} 
                    opacity={0.4}
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
                {!hiddenSeries.has("totalFees") && (
                  <Line 
                    type="monotone" 
                    dataKey="totalFees" 
                    name="Total Frais" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--destructive))', r: 4 }}
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
              </ComposedChart>
            ) : (
              <ComposedChart data={ratioData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" unit="%" domain={[0, 100]} />
                <Tooltip content={<RatioTooltip />} />
                
                {/* Danger zone (below 50%) */}
                <ReferenceArea
                  y1={0}
                  y2={50}
                  fill="hsl(var(--destructive))"
                  fillOpacity={0.1}
                />
                
                {/* Warning zone (50-60%) */}
                <ReferenceArea
                  y1={50}
                  y2={60}
                  fill="hsl(var(--warning))"
                  fillOpacity={0.1}
                />
                
                {/* Reference lines */}
                <ReferenceLine
                  y={60}
                  stroke="hsl(var(--chart-2))"
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{ 
                    value: "Objectif 60%", 
                    position: "right", 
                    fill: "hsl(var(--chart-2))",
                    fontSize: 11,
                  }}
                />
                
                <Line 
                  type="monotone" 
                  dataKey="netRatio" 
                  name="Ratio Net/CA" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={({ cx, cy, payload }: any) => (
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={6} 
                      fill={payload.netRatio < 50 ? "hsl(var(--destructive))" : payload.netRatio < 60 ? "hsl(var(--warning))" : "hsl(var(--primary))"} 
                      stroke="white"
                      strokeWidth={2}
                    />
                  )}
                  animationDuration={CHART_ANIMATION_DURATION}
                />
                <Line 
                  type="monotone" 
                  dataKey="feesRatio" 
                  name="Ratio Frais/CA" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(var(--destructive))', r: 3 }}
                  animationDuration={CHART_ANIMATION_DURATION}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
