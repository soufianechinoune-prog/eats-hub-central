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
  Percent,
  ChevronDown,
  Info,
  Lightbulb,
  Target,
  Award,
  AlertTriangle,
  LineChart as LineChartIcon,
  BarChart3,
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

interface ProfitabilityDataPoint {
  month: string;
  monthNum: number;
  revenue: number;
  netPayout: number;
  profitability: number;
  prevProfitability: number;
}

interface RestaurantAction {
  id: string;
  category: string;
  action_type: string;
  title: string;
  start_date: string;
  platform: string;
}

interface ProfitabilityChartProps {
  data: ProfitabilityDataPoint[];
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

// Profitability zone indicator
function ProfitabilityIndicator({ value }: { value: number }) {
  if (value >= 65) {
    return (
      <Badge className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
        <Award className="h-3 w-3" />
        Excellent
      </Badge>
    );
  }
  if (value >= 50) {
    return (
      <Badge className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
        <Target className="h-3 w-3" />
        Correct
      </Badge>
    );
  }
  if (value >= 35) {
    return (
      <Badge className="gap-1 bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30">
        <AlertTriangle className="h-3 w-3" />
        Attention
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
      <AlertTriangle className="h-3 w-3" />
      Critique
    </Badge>
  );
}

export function ProfitabilityChart({
  data,
  selectedYear,
  prevYear,
  showComparison = true,
  showActions = false,
  actionsByMonth = {},
  onActionClick,
  platform = "global",
}: ProfitabilityChartProps) {
  const [viewMode, setViewMode] = useState<"evolution" | "analysis">("evolution");
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

  // Aggregated stats
  const stats = useMemo(() => {
    const validData = data.filter(d => d.profitability > 0);
    const avgProfitability = validData.length > 0 
      ? validData.reduce((sum, d) => sum + d.profitability, 0) / validData.length 
      : 0;
    
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalNet = data.reduce((sum, d) => sum + d.netPayout, 0);
    const totalLoss = totalRevenue - totalNet;
    
    // Find best/worst months
    const bestMonth = validData.length > 0 ? validData.reduce((max, d) => d.profitability > max.profitability ? d : max, validData[0]) : null;
    const worstMonth = validData.length > 0 ? validData.reduce((min, d) => d.profitability < min.profitability ? d : min, validData[0]) : null;
    
    // Trend (last 3 months)
    const lastThree = validData.slice(-3);
    const trend = lastThree.length >= 2 
      ? (lastThree[lastThree.length - 1].profitability - lastThree[0].profitability) / lastThree[0].profitability * 100 
      : 0;
    
    // Count months in each zone
    const excellentMonths = validData.filter(d => d.profitability >= 65).length;
    const correctMonths = validData.filter(d => d.profitability >= 50 && d.profitability < 65).length;
    const warningMonths = validData.filter(d => d.profitability >= 35 && d.profitability < 50).length;
    const criticalMonths = validData.filter(d => d.profitability < 35).length;
    
    return { 
      avgProfitability, 
      totalRevenue, 
      totalNet,
      totalLoss,
      bestMonth, 
      worstMonth,
      trend,
      excellentMonths,
      correctMonths,
      warningMonths,
      criticalMonths,
    };
  }, [data]);

  const actionMonths = useMemo(() => Object.keys(actionsByMonth).map(Number), [actionsByMonth]);
  const hasPrevData = showComparison && data.some(d => d.prevProfitability > 0);

  // Platform-specific insights
  const getPlatformInsights = () => {
    if (platform === "uber_eats") {
      return {
        title: "Uber Eats",
        benchmarks: {
          excellent: "> 65%",
          target: "60-65%",
          warning: "< 55%",
        },
        tips: [
          "Négociez votre commission si +500 commandes/mois",
          "Réduisez les offres à marge négative",
          "Optimisez vos dépenses marketing : surveillez le ROI",
          "Les promotions Uber impactent directement votre marge",
        ],
      };
    }
    if (platform === "deliveroo") {
      return {
        title: "Deliveroo",
        benchmarks: {
          excellent: "> 70%",
          target: "65-70%",
          warning: "< 60%",
        },
        tips: [
          "Deliveroo a des commissions plus faibles : visez une meilleure rentabilité",
          "Le programme Plus peut augmenter le volume mais surveiller l'impact net",
          "Priorisez les promotions ciblées plutôt que générales",
          "Analysez le panier moyen pour identifier des opportunités",
        ],
      };
    }
    return {
      title: "Global",
      benchmarks: {
        excellent: "> 65%",
        target: "55-65%",
        warning: "< 50%",
      },
      tips: [
        "Comparez la rentabilité entre plateformes pour optimiser votre mix",
        "Une rentabilité < 50% indique un problème structurel",
        "Identifiez la plateforme la plus rentable et priorisez-la",
        "Les écarts de rentabilité révèlent vos leviers d'optimisation",
      ],
    };
  };

  const insights = getPlatformInsights();

  // Tooltip for evolution view
  const EvolutionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const variation = d.prevProfitability > 0 
      ? d.profitability - d.prevProfitability 
      : null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Rentabilité</span>
            <span className={cn(
              "font-bold text-lg",
              d.profitability >= 65 ? "text-green-500" : 
              d.profitability >= 50 ? "text-amber-500" : 
              d.profitability >= 35 ? "text-orange-500" : "text-destructive"
            )}>{d.profitability?.toFixed(1)}%</span>
          </div>
          
          {hasPrevData && d.prevProfitability > 0 && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Rentabilité {prevYear}</span>
              <span>{d.prevProfitability?.toFixed(1)}%</span>
            </div>
          )}
          
          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CA Brut</span>
              <span>{d.revenue?.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versement Net</span>
              <span className="text-primary">{d.netPayout?.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Marge perdue</span>
              <span className="text-destructive">{(d.revenue - d.netPayout)?.toLocaleString('fr-FR')} €</span>
            </div>
          </div>
          
          {variation !== null && (
            <div className={cn(
              "text-xs font-medium pt-1 flex items-center gap-1",
              variation >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {variation >= 0 ? "+" : ""}{variation.toFixed(1)} pts vs {prevYear}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Tooltip for analysis view
  const AnalysisTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Rentabilité</span>
            <ProfitabilityIndicator value={d.profitability} />
          </div>
          <div className="flex justify-between items-center">
            <span>Taux</span>
            <span className="font-bold">{d.profitability?.toFixed(1)}%</span>
          </div>
          
          <div className="pt-2 border-t border-border">
            <div className="text-muted-foreground text-[10px] space-y-0.5">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-green-500" />
                Excellent : ≥65%
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-amber-500" />
                Correct : 50-65%
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-orange-500" />
                Attention : 35-50%
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-destructive" />
                Critique : &lt;35%
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={cn(
      "transition-all",
      stats.avgProfitability >= 65 ? "border-green-500/30" : 
      stats.avgProfitability >= 50 ? "border-amber-500/30" : 
      stats.avgProfitability >= 35 ? "border-orange-500/30" : "border-destructive/30"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Taux de Rentabilité
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
              onClick={() => setViewMode("evolution")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "evolution" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LineChartIcon className="h-4 w-4 mr-1.5" />
              Évolution
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("analysis")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "analysis" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Analyse
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn(
            "gap-1.5 py-1 text-lg font-bold",
            stats.avgProfitability >= 65 ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" : 
            stats.avgProfitability >= 50 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" : 
            stats.avgProfitability >= 35 ? "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30" : 
            "bg-destructive/10 text-destructive border-destructive/30"
          )}>
            {stats.avgProfitability.toFixed(1)}% moyenne
          </Badge>
          <ProfitabilityIndicator value={stats.avgProfitability} />
          {stats.bestMonth && (
            <Badge variant="outline" className="gap-1.5 py-1 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
              <Award className="h-3 w-3" />
              Meilleur : {stats.bestMonth.month} ({stats.bestMonth.profitability.toFixed(1)}%)
            </Badge>
          )}
          {stats.trend !== 0 && (
            <Badge variant="outline" className={cn(
              "gap-1.5 py-1",
              stats.trend >= 0 ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400" : "bg-destructive/10 border-destructive/30 text-destructive"
            )}>
              {stats.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              Tendance : {stats.trend >= 0 ? "+" : ""}{stats.trend.toFixed(1)}%
            </Badge>
          )}
        </div>

        {/* Zone distribution */}
        <div className="flex gap-2 text-xs">
          {stats.excellentMonths > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {stats.excellentMonths} excellent
            </div>
          )}
          {stats.correctMonths > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              {stats.correctMonths} correct
            </div>
          )}
          {stats.warningMonths > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 text-orange-700 dark:text-orange-400">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              {stats.warningMonths} attention
            </div>
          )}
          {stats.criticalMonths > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              {stats.criticalMonths} critique
            </div>
          )}
        </div>

        {/* Collapsible Explanation */}
        <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Comprendre la rentabilité ({insights.title})
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
                  <p className="font-medium text-sm mb-1">Formule de calcul</p>
                  <code className="text-xs bg-background px-2 py-1 rounded font-mono">
                    Rentabilité = (Versement Net ÷ CA TTC) × 100
                  </code>
                  <p className="text-muted-foreground text-xs mt-2">
                    Ce taux montre combien de votre CA vous conservez réellement après tous les frais plateforme.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">Benchmarks {insights.title}</p>
                  <ul className="text-muted-foreground text-xs space-y-1">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Excellent : {insights.benchmarks.excellent}
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      Objectif : {insights.benchmarks.target}
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      Alerte : {insights.benchmarks.warning}
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">Leviers d'amélioration</p>
                  <ul className="text-muted-foreground text-xs space-y-1">
                    {insights.tips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </CollapsibleContent>
        </Collapsible>

        {/* Interactive Legend */}
        <div className="flex flex-wrap gap-2">
          {viewMode === "evolution" ? (
            <>
              <LegendItem
                color="hsl(var(--muted))"
                label="CA TTC"
                isActive={!hiddenSeries.has("revenue")}
                onClick={() => toggleSeries("revenue")}
              />
              <LegendItem
                color="hsl(var(--primary))"
                label="Versement Net"
                isActive={!hiddenSeries.has("netPayout")}
                onClick={() => toggleSeries("netPayout")}
              />
              <LegendItem
                color="hsl(142 76% 36%)"
                label={`Rentabilité ${selectedYear}`}
                isActive={!hiddenSeries.has("profitability")}
                onClick={() => toggleSeries("profitability")}
              />
              {hasPrevData && (
                <LegendItem
                  color="hsl(var(--muted-foreground))"
                  label={`Rentabilité ${prevYear}`}
                  isActive={!hiddenSeries.has("prevProfitability")}
                  onClick={() => toggleSeries("prevProfitability")}
                />
              )}
            </>
          ) : (
            <>
              <LegendItem
                color="hsl(142 76% 36%)"
                label="Rentabilité"
                isActive={!hiddenSeries.has("profitability")}
                onClick={() => toggleSeries("profitability")}
              />
            </>
          )}
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
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "evolution" ? (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" unit="%" domain={[0, 100]} />
                <Tooltip content={<EvolutionTooltip />} />
                
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
                
                {!hiddenSeries.has("revenue") && (
                  <Bar 
                    yAxisId="left"
                    dataKey="revenue" 
                    name="CA TTC" 
                    fill="hsl(var(--muted))" 
                    radius={[4, 4, 0, 0]}
                    opacity={0.5}
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
                {!hiddenSeries.has("netPayout") && (
                  <Bar 
                    yAxisId="left"
                    dataKey="netPayout" 
                    name="Versement Net" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
                {!hiddenSeries.has("profitability") && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="profitability" 
                    name={`Rentabilité ${selectedYear}`}
                    stroke="hsl(142 76% 36%)" 
                    strokeWidth={3}
                    dot={({ cx, cy, payload }: any) => (
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={6} 
                        fill={
                          payload.profitability >= 65 ? "hsl(142 76% 36%)" : 
                          payload.profitability >= 50 ? "hsl(var(--warning))" : 
                          payload.profitability >= 35 ? "hsl(var(--chart-3))" : 
                          "hsl(var(--destructive))"
                        } 
                        stroke="white"
                        strokeWidth={2}
                      />
                    )}
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
                {hasPrevData && !hiddenSeries.has("prevProfitability") && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="prevProfitability" 
                    name={`Rentabilité ${prevYear}`}
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--muted-foreground))', r: 3 }}
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
              </ComposedChart>
            ) : (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" unit="%" domain={[0, 100]} />
                <Tooltip content={<AnalysisTooltip />} />
                
                {/* Colored zones */}
                <ReferenceArea y1={0} y2={35} fill="hsl(var(--destructive))" fillOpacity={0.1} />
                <ReferenceArea y1={35} y2={50} fill="hsl(var(--chart-3))" fillOpacity={0.1} />
                <ReferenceArea y1={50} y2={65} fill="hsl(var(--warning))" fillOpacity={0.1} />
                <ReferenceArea y1={65} y2={100} fill="hsl(142 76% 36%)" fillOpacity={0.1} />
                
                {/* Reference lines */}
                <ReferenceLine y={65} stroke="hsl(142 76% 36%)" strokeDasharray="8 4" strokeWidth={1} />
                <ReferenceLine y={50} stroke="hsl(var(--warning))" strokeDasharray="8 4" strokeWidth={1} />
                <ReferenceLine y={35} stroke="hsl(var(--destructive))" strokeDasharray="8 4" strokeWidth={1} />
                
                {!hiddenSeries.has("profitability") && (
                  <Line 
                    type="monotone" 
                    dataKey="profitability" 
                    name="Rentabilité"
                    stroke="hsl(var(--foreground))" 
                    strokeWidth={3}
                    dot={({ cx, cy, payload }: any) => (
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={8} 
                        fill={
                          payload.profitability >= 65 ? "hsl(142 76% 36%)" : 
                          payload.profitability >= 50 ? "hsl(var(--warning))" : 
                          payload.profitability >= 35 ? "hsl(var(--chart-3))" : 
                          "hsl(var(--destructive))"
                        } 
                        stroke="white"
                        strokeWidth={2}
                      />
                    )}
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
