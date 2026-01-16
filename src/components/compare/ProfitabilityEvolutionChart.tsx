import { useMemo, useState, useEffect, useRef } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Zap, Camera, Euro, Gift, Megaphone, UtensilsCrossed, Settings } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useRestaurantActions, ACTION_CATEGORY_COLORS, ACTION_CATEGORY_LABELS, RestaurantAction } from "@/hooks/useRestaurantActions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface RestaurantStats {
  id: string;
  name: string;
  profitability: number;
  dailyData: Record<string, { sales: number; payout: number; orders: number }>;
}

interface ProfitabilityEvolutionChartProps {
  stats: RestaurantStats[];
  dateRange: { start: Date; end: Date };
  restaurantIds?: string[];
}

const MAX_SELECTION = 8;

// Extended color palette for better distinction
const COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#eab308", // yellow
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
  "#22c55e", // green
];

// Category icons mapping
const ACTION_CATEGORY_ICONS: Record<string, any> = {
  visuals: Camera,
  pricing: Euro,
  promotions: Gift,
  marketing: Megaphone,
  menu: UtensilsCrossed,
  operational: Settings,
};

// Action tooltip data type for HTML overlay
interface ActionTooltipData {
  x: number;
  y: number;
  actions: RestaurantAction[];
  color: string;
}

// Action marker label component - simplified, only renders the marker
const ActionMarkerLabel = ({ 
  viewBox, 
  actions, 
  color, 
  onHover,
  onLeave,
  onActionClick
}: { 
  viewBox?: { x?: number; y?: number };
  actions: RestaurantAction[]; 
  color: string;
  onHover: (x: number, actions: RestaurantAction[], color: string) => void;
  onLeave: () => void;
  onActionClick?: (actionId: string) => void;
}) => {
  if (!viewBox?.x) return null;
  
  const x = viewBox.x;
  const y = 10;

  const handleMarkerClick = () => {
    if (actions.length === 1 && onActionClick) {
      onActionClick(actions[0].id);
    }
  };
  
  return (
    <g>
      {/* Zone de clic invisible plus grande */}
      <rect
        x={x - 12}
        y={y - 8}
        width={24}
        height={20}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHover(x, actions, color)}
        onMouseLeave={onLeave}
        onClick={handleMarkerClick}
      />
      {/* Halo blanc pour meilleure lisibilité */}
      <circle
        cx={x}
        cy={y}
        r={10}
        fill="white"
        fillOpacity={0.9}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHover(x, actions, color)}
        onMouseLeave={onLeave}
        onClick={handleMarkerClick}
      />
      {/* Cercle principal */}
      <circle
        cx={x}
        cy={y}
        r={8}
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={2.5}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHover(x, actions, color)}
        onMouseLeave={onLeave}
        onClick={handleMarkerClick}
      />
      {/* Icône ou nombre */}
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
    </g>
  );
};

// HTML Action Tooltip component - rendered outside SVG
const ActionTooltipOverlay = ({
  tooltip,
  chartWidth,
  onMouseEnter,
  onMouseLeave,
  onActionClick
}: {
  tooltip: ActionTooltipData;
  chartWidth: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onActionClick?: (actionId: string) => void;
}) => {
  const tooltipWidth = 260;
  const tooltipHeight = Math.min(tooltip.actions.length * 70 + 50, 280);
  
  // Calcul position X avec anti-clipping
  let left = tooltip.x + 20; // Par défaut à droite du marqueur
  if (left + tooltipWidth > chartWidth - 10) {
    left = tooltip.x - tooltipWidth - 20; // À gauche si pas de place à droite
  }
  if (left < 10) {
    left = 10; // Minimum 10px du bord
  }
  
  // Position Y fixe en haut du chart (30px du haut)
  const top = 30;

  return (
    <div
      className="absolute bg-popover border border-border rounded-lg shadow-2xl p-3 text-xs"
      style={{
        left,
        top,
        width: tooltipWidth,
        maxHeight: tooltipHeight,
        zIndex: 9999,
        pointerEvents: "auto"
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="font-semibold text-foreground mb-2.5 flex items-center gap-2 pb-2 border-b border-border">
        <Zap className="h-4 w-4" style={{ color: tooltip.color }} />
        <span>{tooltip.actions.length} action{tooltip.actions.length > 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {tooltip.actions.map((action, idx) => {
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
              className="flex items-start gap-2.5 p-2 rounded-md bg-muted/60 hover:bg-muted cursor-pointer transition-colors group"
              onClick={() => onActionClick?.(action.id)}
            >
              <Icon 
                className="h-4 w-4 mt-0.5 shrink-0" 
                style={{ color: categoryColor }} 
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate group-hover:text-primary transition-colors text-[13px]">
                  {action.title}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <span 
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: `${categoryColor}20`,
                      color: categoryColor 
                    }}
                  >
                    {ACTION_CATEGORY_LABELS[action.category] || action.category}
                  </span>
                  <span className="text-[11px]">{formattedDate}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ProfitabilityEvolutionChart = ({ stats, dateRange, restaurantIds }: ProfitabilityEvolutionChartProps) => {
  // Initialize with top performers (by profitability)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const top = stats.slice(0, Math.min(5, stats.length)).map(s => s.id);
    return new Set(top);
  });
  const [open, setOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [chartWidth, setChartWidth] = useState(800);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // State for HTML overlay action tooltip
  const [actionTooltip, setActionTooltip] = useState<ActionTooltipData | null>(null);
  const actionTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Handlers for action tooltip with delay
  const handleActionHover = (x: number, actions: RestaurantAction[], color: string) => {
    if (actionTooltipTimeoutRef.current) {
      clearTimeout(actionTooltipTimeoutRef.current);
      actionTooltipTimeoutRef.current = null;
    }
    setActionTooltip({ x, y: 30, actions, color });
  };
  
  const handleActionLeave = () => {
    actionTooltipTimeoutRef.current = setTimeout(() => {
      setActionTooltip(null);
    }, 150); // Petit délai pour permettre de passer au tooltip
  };
  
  const handleTooltipEnter = () => {
    if (actionTooltipTimeoutRef.current) {
      clearTimeout(actionTooltipTimeoutRef.current);
      actionTooltipTimeoutRef.current = null;
    }
  };
  
  const handleTooltipLeave = () => {
    setActionTooltip(null);
  };

  // Track chart width for tooltip positioning
  useEffect(() => {
    const updateWidth = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Update selection when stats change
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(stats.map(s => s.id));
      const filtered = [...prev].filter(id => validIds.has(id));
      if (filtered.length === 0 && stats.length > 0) {
        return new Set(stats.slice(0, Math.min(5, stats.length)).map(s => s.id));
      }
      return new Set(filtered);
    });
  }, [stats]);

  const selectedStats = useMemo(() => 
    stats.filter(s => selectedIds.has(s.id)), 
    [stats, selectedIds]
  );

  // Fetch actions for the selected restaurants
  const year = dateRange.start.getFullYear();
  const { data: actions = [] } = useRestaurantActions(
    year,
    restaurantIds,
    "uber_eats"
  );

  // Group actions by date
  const actionsByDate = useMemo(() => {
    const map: Record<string, RestaurantAction[]> = {};
    actions.forEach(action => {
      const dateStr = format(new Date(action.start_date), "yyyy-MM-dd");
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(action);
    });
    return map;
  }, [actions]);

  // Filter action dates within the displayed period
  const actionDates = useMemo(() => {
    return Object.keys(actionsByDate).filter(dateStr => {
      const date = parseISO(dateStr);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [actionsByDate, dateRange]);

  const chartData = useMemo(() => {
    // NOUVEAU: Générer TOUS les jours de la période (pas seulement ceux avec data)
    const allDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    
    return allDays.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dataPoint: Record<string, any> = {
        date: dateStr,
        dateLabel: format(day, "d MMM", { locale: fr }),
      };
      
      selectedStats.forEach(restaurant => {
        const dayData = restaurant.dailyData[dateStr];
        if (dayData && dayData.sales > 0) {
          dataPoint[restaurant.id] = (dayData.payout / dayData.sales) * 100;
        } else {
          dataPoint[restaurant.id] = null;
        }
      });
      
      return dataPoint;
    });
  }, [selectedStats, dateRange]);

  // Calculate dynamic Y-axis domain based on actual data
  const { minY, maxY } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    chartData.forEach(day => {
      selectedStats.forEach(r => {
        const val = day[r.id];
        if (val !== null && val !== undefined) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      });
    });
    if (min === Infinity || max === -Infinity) {
      return { minY: 50, maxY: 80 };
    }
    const margin = (max - min) * 0.15 || 5;
    return { 
      minY: Math.floor(Math.max(0, min - margin)), 
      maxY: Math.ceil(Math.min(100, max + margin)) 
    };
  }, [chartData, selectedStats]);

  // Calculate average profitability for selected restaurants
  const avgProfitability = useMemo(() => {
    if (selectedStats.length === 0) return 0;
    const totalProfit = selectedStats.reduce((sum, s) => sum + s.profitability, 0);
    return totalProfit / selectedStats.length;
  }, [selectedStats]);

  const toggleRestaurant = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else if (newSet.size < MAX_SELECTION) {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getShortName = (name: string) => {
    // Si le nom contient "CHICKEN STREET", utiliser "CS" + ville
    if (name.toUpperCase().includes("CHICKEN STREET")) {
      const cityPart = name.replace(/chicken street\s*/i, "").trim();
      // Formater la ville en Title Case
      const formattedCity = cityPart
        .toLowerCase()
        .split(/[\s-]+/)
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return `CS ${formattedCity}`;
    }
    
    // Sinon, retourner le nom tel quel (tronqué si trop long)
    return name.length > 20 ? name.substring(0, 17) + "..." : name;
  };

  if (!stats.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée d'évolution disponible
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{label}</p>
        <div className="space-y-1">
          {payload
            .filter((p: any) => p.value !== null)
            .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
            .map((entry: any) => (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.stroke }}
                  />
                  <span className="text-muted-foreground">{entry.name}</span>
                </div>
                <span className="font-medium">{entry.value?.toFixed(1)}%</span>
              </div>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Restaurant selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span>{selectedIds.size} restaurant{selectedIds.size > 1 ? 's' : ''}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b flex justify-between items-center">
              <span className="text-sm font-medium">Sélectionner (max {MAX_SELECTION})</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set(stats.slice(0, MAX_SELECTION).map(s => s.id)))}
                >
                  Top {MAX_SELECTION}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Aucun
                </Button>
              </div>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2 space-y-1">
                {stats.map((restaurant, index) => {
                  const isSelected = selectedIds.has(restaurant.id);
                  const isDisabled = !isSelected && selectedIds.size >= MAX_SELECTION;
                  return (
                    <div
                      key={restaurant.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${isDisabled ? 'opacity-50' : ''}`}
                      onClick={() => !isDisabled && toggleRestaurant(restaurant.id)}
                    >
                      <Checkbox checked={isSelected} disabled={isDisabled} />
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm truncate flex-1">{getShortName(restaurant.name)}</span>
                      <span className="text-xs text-muted-foreground">{restaurant.profitability.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Actions toggle */}
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <Label 
            htmlFor="show-profitability-actions" 
            className="text-sm font-medium cursor-pointer"
          >
            Afficher les actions
          </Label>
          <Switch
            id="show-profitability-actions"
            checked={showActions}
            onCheckedChange={setShowActions}
            disabled={actions.length === 0}
          />
        </div>

        {/* Selected badges */}
        <div className="flex flex-wrap gap-1">
          {selectedStats.map((restaurant, idx) => {
            const originalIndex = stats.findIndex(s => s.id === restaurant.id);
            return (
              <Badge
                key={restaurant.id}
                variant="outline"
                className="text-xs gap-1.5 py-0.5"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[originalIndex % COLORS.length] }}
                />
                {getShortName(restaurant.name)}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[350px] relative overflow-visible" ref={chartContainerRef}>
        {selectedStats.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Sélectionnez au moins un restaurant
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="dateLabel" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  domain={[minY, maxY]}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                {/* N'affiche le tooltip Recharts que si pas de tooltip action */}
                {!actionTooltip && <Tooltip content={<CustomTooltip />} />}
                
                {/* Average reference line */}
                <ReferenceLine 
                  y={avgProfitability} 
                  stroke="#888" 
                  strokeDasharray="5 5"
                  label={{ 
                    value: `Moy: ${avgProfitability.toFixed(1)}%`, 
                    position: 'right',
                    fill: '#888',
                    fontSize: 11
                  }}
                />
                
                {/* Action markers */}
                {showActions && actionDates.map(dateStr => {
                  const dateLabel = format(parseISO(dateStr), "d MMM", { locale: fr });
                  const dayActions = actionsByDate[dateStr] || [];
                  const primaryAction = dayActions[0];
                  if (!primaryAction) return null;
                  const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                  
                  return (
                      <ReferenceLine
                        key={`action-${dateStr}`}
                        x={dateLabel}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        label={(props) => (
                          <ActionMarkerLabel 
                            viewBox={props.viewBox} 
                            actions={dayActions} 
                            color={color}
                            onHover={handleActionHover}
                            onLeave={handleActionLeave}
                            onActionClick={(id) => {
                              console.log("Action clicked:", id);
                            }}
                          />
                        )}
                      />
                  );
                })}
                
                {selectedStats.map((restaurant) => {
                  const originalIndex = stats.findIndex(s => s.id === restaurant.id);
                  return (
                    <Line
                      key={restaurant.id}
                      type="monotone"
                      dataKey={restaurant.id}
                      name={restaurant.name}
                      stroke={COLORS[originalIndex % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
            
            {/* HTML Overlay for Action Tooltip - Toujours visible et opaque */}
            {actionTooltip && (
              <ActionTooltipOverlay
                tooltip={actionTooltip}
                chartWidth={chartWidth}
                onMouseEnter={handleTooltipEnter}
                onMouseLeave={handleTooltipLeave}
                onActionClick={(id) => {
                  console.log("Action clicked:", id);
                  setActionTooltip(null);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
