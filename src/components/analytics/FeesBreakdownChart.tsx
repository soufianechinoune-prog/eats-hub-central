import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Euro,
  Percent,
  ChevronDown,
  Info,
  Lightbulb,
  AlertTriangle,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
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

interface FeesBreakdownChartProps {
  data: FeesDataPoint[];
  revenueData?: RevenueDataPoint[];
  selectedYear: number;
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

export function FeesBreakdownChart({
  data,
  revenueData = [],
  selectedYear,
  showActions = false,
  actionsByMonth = {},
  onActionClick,
  platform = "global",
}: FeesBreakdownChartProps) {
  const [viewMode, setViewMode] = useState<"amounts" | "percentage">("amounts");
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

  // Calculate percentage data
  const percentageData = useMemo(() => {
    return data.map(d => {
      const revenueMonth = revenueData.find(r => r.monthNum === d.monthNum);
      const revenue = revenueMonth?.revenue || 0;
      
      return {
        ...d,
        uberPct: revenue > 0 ? (d.uber / revenue) * 100 : 0,
        marketingPct: revenue > 0 ? (d.marketing / revenue) * 100 : 0,
        offersPct: revenue > 0 ? (d.offers / revenue) * 100 : 0,
        adsPct: revenue > 0 ? (d.ads / revenue) * 100 : 0,
        totalFeesPct: revenue > 0 ? (d.totalFees / revenue) * 100 : 0,
        revenue,
      };
    });
  }, [data, revenueData]);

  // Aggregated stats
  const stats = useMemo(() => {
    const totalFees = data.reduce((sum, d) => sum + d.totalFees, 0);
    const totalUber = data.reduce((sum, d) => sum + d.uber, 0);
    const totalMarketing = data.reduce((sum, d) => sum + d.marketing, 0);
    const totalOffers = data.reduce((sum, d) => sum + d.offers, 0);
    const totalAds = data.reduce((sum, d) => sum + d.ads, 0);
    const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
    const feePercentage = totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0;
    
    // Find months with high marketing spend
    const highMarketingMonths = percentageData.filter(d => d.marketingPct > 5);
    
    return { 
      totalFees, 
      totalUber, 
      totalMarketing, 
      totalOffers, 
      totalAds,
      totalRevenue,
      feePercentage,
      highMarketingMonths,
    };
  }, [data, revenueData, percentageData]);

  const actionMonths = useMemo(() => Object.keys(actionsByMonth).map(Number), [actionsByMonth]);

  // Platform-specific insights
  const getPlatformInsights = () => {
    if (platform === "uber_eats") {
      return {
        title: "Uber Eats",
        commission: "~30%",
        tips: [
          "Commission standard : 30% (négociable si +500 commandes/mois)",
          "Marketing : optionnel, pour améliorer la visibilité",
          "Offres : réductions à votre charge, à utiliser stratégiquement",
          "Si frais marketing > 5% du CA sans impact visible, reconsidérez",
        ],
      };
    }
    if (platform === "deliveroo") {
      return {
        title: "Deliveroo",
        commission: "~25-28%",
        tips: [
          "Commissions légèrement inférieures à Uber (25-28%)",
          "Le programme Deliveroo Plus peut générer plus de commandes",
          "Les promotions ciblées sont souvent plus efficaces que les générales",
          "Analysez le ROI de chaque offre avant de la renouveler",
        ],
      };
    }
    return {
      title: "Global",
      commission: "variable",
      tips: [
        "Comparez les commissions entre plateformes pour négocier",
        "Suivez l'évolution des frais en % du CA, pas en montant absolu",
        "Un ratio frais/CA > 35% peut indiquer un problème de rentabilité",
        "Priorisez les plateformes avec le meilleur ratio net/brut",
      ],
    };
  };

  const insights = getPlatformInsights();

  // Tooltip for amounts view
  const AmountsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const revenueMonth = percentageData.find(p => p.month === label);

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
              Commission
            </span>
            <span className="font-medium">{d.uber?.toLocaleString('fr-FR')} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
              Marketing
            </span>
            <span className="font-medium">{d.marketing?.toLocaleString('fr-FR')} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
              Offres
            </span>
            <span className="font-medium">{d.offers?.toLocaleString('fr-FR')} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-4))' }} />
              Publicité
            </span>
            <span className="font-medium">{d.ads?.toLocaleString('fr-FR')} €</span>
          </div>
          
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between font-medium">
              <span>Total Frais</span>
              <span className="text-destructive">{d.totalFees?.toLocaleString('fr-FR')} €</span>
            </div>
            {revenueMonth && revenueMonth.revenue > 0 && (
              <div className="flex justify-between text-muted-foreground mt-1">
                <span>% du CA</span>
                <span>{revenueMonth.totalFeesPct?.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Tooltip for percentage view
  const PercentageTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
        <p className="font-semibold text-sm mb-2 border-b border-border pb-2">{label} {selectedYear}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Commission</span>
            <span className="font-medium">{d.uberPct?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Marketing</span>
            <span className={cn("font-medium", d.marketingPct > 5 && "text-amber-500")}>{d.marketingPct?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Offres</span>
            <span className="font-medium">{d.offersPct?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Publicité</span>
            <span className="font-medium">{d.adsPct?.toFixed(1)}%</span>
          </div>
          
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className={cn(d.totalFeesPct > 35 ? "text-destructive" : "text-foreground")}>
                {d.totalFeesPct?.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground mt-1">
              <span>CA du mois</span>
              <span>{d.revenue?.toLocaleString('fr-FR')} €</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Répartition des Frais
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
              onClick={() => setViewMode("percentage")}
              className={cn(
                "h-8 px-3 rounded-md transition-all",
                viewMode === "percentage" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Percent className="h-4 w-4 mr-1.5" />
              % du CA
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 text-destructive border-destructive/30">
            <TrendingDown className="h-3 w-3" />
            Total : {stats.totalFees.toLocaleString('fr-FR')} €
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1">
            {stats.feePercentage.toFixed(1)}% du CA
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1">
            Commission : {stats.totalUber.toLocaleString('fr-FR')} €
          </Badge>
          {stats.totalMarketing > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 bg-chart-2/10 border-chart-2/30">
              Marketing : {stats.totalMarketing.toLocaleString('fr-FR')} €
            </Badge>
          )}
          {stats.highMarketingMonths.length > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {stats.highMarketingMonths.length} mois à marketing &gt;5%
            </Badge>
          )}
        </div>

        {/* Collapsible Explanation */}
        <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Comprendre les frais ({insights.title})
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
                  <p className="font-medium text-sm mb-1">Structure des frais {insights.title}</p>
                  <ul className="text-muted-foreground text-xs space-y-1">
                    <li>• <strong>Commission</strong> : {insights.commission} prélevé sur chaque commande</li>
                    <li>• <strong>Marketing</strong> : Optionnel, pour améliorer la visibilité</li>
                    <li>• <strong>Offres</strong> : Réductions supportées par vous</li>
                    <li>• <strong>Publicité</strong> : Ads dans l'app pour plus d'impressions</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">Conseils d'optimisation</p>
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
          <LegendItem
            color="hsl(var(--chart-1))"
            label="Commission"
            isActive={!hiddenSeries.has("uber")}
            onClick={() => toggleSeries("uber")}
          />
          <LegendItem
            color="hsl(var(--chart-2))"
            label="Marketing"
            isActive={!hiddenSeries.has("marketing")}
            onClick={() => toggleSeries("marketing")}
          />
          <LegendItem
            color="hsl(var(--chart-3))"
            label="Offres"
            isActive={!hiddenSeries.has("offers")}
            onClick={() => toggleSeries("offers")}
          />
          <LegendItem
            color="hsl(var(--chart-4))"
            label="Publicité"
            isActive={!hiddenSeries.has("ads")}
            onClick={() => toggleSeries("ads")}
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
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "amounts" ? (
              <BarChart data={data}>
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
                
                {!hiddenSeries.has("uber") && (
                  <Bar 
                    dataKey="uber" 
                    name="Commission" 
                    stackId="a" 
                    fill="hsl(var(--chart-1))" 
                    animationDuration={CHART_ANIMATION_DURATION} 
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {!hiddenSeries.has("marketing") && (
                  <Bar 
                    dataKey="marketing" 
                    name="Marketing" 
                    stackId="a" 
                    fill="hsl(var(--chart-2))" 
                    animationDuration={CHART_ANIMATION_DURATION} 
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {!hiddenSeries.has("offers") && (
                  <Bar 
                    dataKey="offers" 
                    name="Offres" 
                    stackId="a" 
                    fill="hsl(var(--chart-3))" 
                    animationDuration={CHART_ANIMATION_DURATION} 
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
                {!hiddenSeries.has("ads") && (
                  <Bar 
                    dataKey="ads" 
                    name="Publicité" 
                    stackId="a" 
                    fill="hsl(var(--chart-4))" 
                    animationDuration={CHART_ANIMATION_DURATION} 
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                )}
              </BarChart>
            ) : (
              <BarChart data={percentageData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" unit="%" domain={[0, 'auto']} />
                <Tooltip content={<PercentageTooltip />} />
                
                {/* Reference line for 30% commission */}
                <ReferenceLine
                  y={30}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="8 4"
                  strokeWidth={1}
                  label={{ 
                    value: "Commission std 30%", 
                    position: "right", 
                    fill: "hsl(var(--destructive))",
                    fontSize: 10,
                  }}
                />
                
                {!hiddenSeries.has("uber") && (
                  <Bar 
                    dataKey="uberPct" 
                    name="Commission %" 
                    stackId="a" 
                    fill="hsl(var(--chart-1))" 
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
                {!hiddenSeries.has("marketing") && (
                  <Bar 
                    dataKey="marketingPct" 
                    name="Marketing %" 
                    stackId="a" 
                    fill="hsl(var(--chart-2))" 
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
                {!hiddenSeries.has("offers") && (
                  <Bar 
                    dataKey="offersPct" 
                    name="Offres %" 
                    stackId="a" 
                    fill="hsl(var(--chart-3))" 
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
                {!hiddenSeries.has("ads") && (
                  <Bar 
                    dataKey="adsPct" 
                    name="Publicité %" 
                    stackId="a" 
                    fill="hsl(var(--chart-4))" 
                    animationDuration={CHART_ANIMATION_DURATION}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
