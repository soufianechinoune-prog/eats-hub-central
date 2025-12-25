import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, Eye, EyeOff } from "lucide-react";
import { format, parseISO, startOfWeek, getWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface Restaurant {
  id: string;
  name: string;
  city?: string | null;
}

interface TimeSeriesDataPoint {
  restaurant_id: string;
  date: string;
  value: number;
}

interface SelectedRestaurantsRankingChartProps {
  restaurants: Restaurant[];
  selectedRestaurants: string[];
  timeSeriesData: TimeSeriesDataPoint[];
  metricLabel: string;
  formatValue: (v: number) => string;
  granularity: "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  onMonthClick?: (monthKey: string) => void;
  isClickable?: boolean;
}

// Top 10 colors - modern vibrant palette
const TOP_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
];

const GRAY_COLOR = "hsl(var(--muted-foreground) / 0.25)";

// Format rank as short ordinal
const formatRank = (rank: number): string => {
  if (rank === 1) return "1er";
  return `${rank}e`;
};

export function SelectedRestaurantsRankingChart({
  restaurants,
  selectedRestaurants,
  timeSeriesData,
  metricLabel,
  formatValue,
  granularity,
  startDate,
  endDate,
  onMonthClick,
  isClickable = true,
}: SelectedRestaurantsRankingChartProps) {
  const [showAllRestaurants, setShowAllRestaurants] = useState(false);
  const [hoveredRestaurant, setHoveredRestaurant] = useState<string | null>(null);

  const selectedRestaurantObjects = useMemo(() => {
    return restaurants.filter(r => selectedRestaurants.includes(r.id));
  }, [restaurants, selectedRestaurants]);

  // Build time periods and calculate ranks
  const { chartData, maxRank, restaurantRankings } = useMemo(() => {
    const buildBaseData = () => {
      if (granularity === "daily") {
        const days: Date[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
          days.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        
        return days.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          return { 
            dateKey: dateStr,
            label: format(day, "d MMM", { locale: fr }),
          };
        });
      } else if (granularity === "weekly") {
        const weeks = new Map<string, { weekStart: Date; weekNum: number }>();
        const current = new Date(startDate);
        while (current <= endDate) {
          const weekStart = startOfWeek(current, { weekStartsOn: 1 });
          const weekKey = format(weekStart, "yyyy-MM-dd");
          if (!weeks.has(weekKey)) {
            weeks.set(weekKey, { weekStart, weekNum: getWeek(current, { weekStartsOn: 1 }) });
          }
          current.setDate(current.getDate() + 1);
        }
        
        return Array.from(weeks.entries()).map(([weekKey, { weekNum }]) => ({
          dateKey: weekKey,
          label: `S${weekNum}`,
        }));
      } else {
        const months = new Map<string, { month: number; year: number }>();
        const current = new Date(startDate);
        while (current <= endDate) {
          const monthKey = format(current, "yyyy-MM");
          if (!months.has(monthKey)) {
            months.set(monthKey, { month: current.getMonth() + 1, year: current.getFullYear() });
          }
          current.setMonth(current.getMonth() + 1);
        }
        
        const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
        
        return Array.from(months.entries()).map(([monthKey, { month }]) => ({
          dateKey: monthKey,
          label: MONTHS_FR[month - 1],
        }));
      }
    };

    const basePeriods = buildBaseData();
    
    // Calculate CA for each restaurant at each period
    const getValueForPeriod = (restaurantId: string, dateKey: string) => {
      if (granularity === "daily") {
        const dataPoint = timeSeriesData.find(
          d => d.restaurant_id === restaurantId && d.date === dateKey
        );
        return dataPoint?.value ?? 0;
      } else if (granularity === "weekly") {
        const weekDataPoints = timeSeriesData.filter(d => {
          if (d.restaurant_id !== restaurantId) return false;
          const dataDate = parseISO(d.date);
          const dataWeekStart = startOfWeek(dataDate, { weekStartsOn: 1 });
          return format(dataWeekStart, "yyyy-MM-dd") === dateKey;
        });
        return weekDataPoints.reduce((sum, dp) => sum + dp.value, 0);
      } else {
        const monthDataPoints = timeSeriesData.filter(d => {
          if (d.restaurant_id !== restaurantId) return false;
          return d.date.startsWith(dateKey);
        });
        return monthDataPoints.reduce((sum, dp) => sum + dp.value, 0);
      }
    };

    // Build chart data with ranks
    let globalMaxRank = 1;
    const data = basePeriods.map(period => {
      const point: Record<string, any> = { 
        dateKey: period.dateKey,
        label: period.label,
      };
      
      // Calculate values and sort for ranking
      const restaurantValues = selectedRestaurantObjects
        .map(r => ({
          id: r.id,
          value: getValueForPeriod(r.id, period.dateKey),
        }))
        .filter(rv => rv.value > 0)
        .sort((a, b) => b.value - a.value);
      
      // Assign ranks
      restaurantValues.forEach((rv, index) => {
        const rank = index + 1;
        point[rv.id] = rank; // Y-axis will be rank
        point[`${rv.id}_value`] = rv.value; // Store actual value for tooltip
        if (rank > globalMaxRank) globalMaxRank = rank;
      });
      
      return point;
    });

    // Calculate average rank for each restaurant to determine top 10
    const avgRanks: { id: string; avgRank: number; name: string }[] = selectedRestaurantObjects.map(r => {
      const ranks = data
        .map(d => d[r.id] as number)
        .filter(rank => rank !== undefined);
      const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : Infinity;
      return { id: r.id, avgRank, name: r.name };
    });
    avgRanks.sort((a, b) => a.avgRank - b.avgRank);

    return { chartData: data, maxRank: globalMaxRank, restaurantRankings: avgRanks };
  }, [selectedRestaurantObjects, timeSeriesData, granularity, startDate, endDate]);

  if (selectedRestaurantObjects.length === 0 || chartData.length === 0) {
    return null;
  }

  const handlePointClick = (dateKey: string) => {
    if (granularity === "monthly" && onMonthClick) {
      onMonthClick(dateKey);
    }
  };

  const canDrillDown = granularity === "monthly" && isClickable && onMonthClick;

  // Determine which restaurants to show and their colors
  const getRestaurantStyle = (restaurantId: string) => {
    const rankIndex = restaurantRankings.findIndex(r => r.id === restaurantId);
    const isTop10 = rankIndex < 10;
    const isHovered = hoveredRestaurant === restaurantId;
    
    if (!showAllRestaurants && !isTop10) {
      return { 
        color: GRAY_COLOR, 
        opacity: isHovered ? 0.8 : 0.3, 
        strokeWidth: isHovered ? 2.5 : 1,
        isVisible: true 
      };
    }
    
    return {
      color: isTop10 ? TOP_COLORS[rankIndex % TOP_COLORS.length] : GRAY_COLOR,
      opacity: isHovered ? 1 : (hoveredRestaurant ? 0.3 : 0.8),
      strokeWidth: isHovered ? 3 : 2,
      isVisible: true,
    };
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    
    // Get all restaurants with their ranks and values for this point
    const currentPoint = chartData.find(d => d.label === label);
    if (!currentPoint) return null;

    const restaurantData = selectedRestaurantObjects
      .map(r => ({
        id: r.id,
        name: r.name,
        rank: currentPoint[r.id] as number | undefined,
        value: currentPoint[`${r.id}_value`] as number | undefined,
        style: getRestaurantStyle(r.id),
      }))
      .filter(r => r.rank !== undefined)
      .sort((a, b) => (a.rank as number) - (b.rank as number));
    
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl p-4 text-sm max-h-[400px] overflow-auto">
        <div className="font-semibold text-foreground mb-3 pb-2 border-b border-border/50 sticky top-0 bg-popover/95">
          {label}
        </div>
        <div className="space-y-1.5">
          {restaurantData.slice(0, showAllRestaurants ? undefined : 10).map((r) => (
            <div 
              key={r.id} 
              className="flex items-center justify-between gap-4 py-1 hover:bg-muted/30 rounded px-1 -mx-1"
              onMouseEnter={() => setHoveredRestaurant(r.id)}
              onMouseLeave={() => setHoveredRestaurant(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: r.style.color === GRAY_COLOR ? 'hsl(var(--muted-foreground))' : r.style.color }}
                >
                  {r.rank}
                </span>
                <span className="text-muted-foreground truncate">
                  {r.name}
                </span>
              </div>
              <span className="font-semibold tabular-nums whitespace-nowrap">
                {formatValue(r.value || 0)}
              </span>
            </div>
          ))}
          {!showAllRestaurants && restaurantData.length > 10 && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
              +{restaurantData.length - 10} autres restaurants
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom dot for endpoints only
  const EndpointDot = ({ cx, cy, payload, dataKey, stroke, index }: any) => {
    if (!cx || !cy) return null;
    
    const isFirst = index === 0;
    const isLast = index === chartData.length - 1;
    
    if (!isFirst && !isLast) return null;
    
    const rank = payload[dataKey];
    if (!rank) return null;

    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill={stroke}
          stroke="hsl(var(--background))"
          strokeWidth={2}
        />
        <text
          x={cx}
          y={cy + 3.5}
          textAnchor="middle"
          fill="white"
          fontSize={9}
          fontWeight="700"
        >
          {rank}
        </text>
      </g>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Classement {metricLabel}</span>
            <span className="text-muted-foreground font-normal">
              — Bump Chart
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedRestaurantObjects.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllRestaurants(!showAllRestaurants)}
                className="h-7 text-xs gap-1.5"
              >
                {showAllRestaurants ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Top 10 seulement
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Voir tous ({selectedRestaurantObjects.length})
                  </>
                )}
              </Button>
            )}
            {canDrillDown && (
              <span className="text-xs text-primary font-medium">
                Cliquez pour le détail
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              onClick={(data) => {
                if (canDrillDown && data?.activePayload?.[0]?.payload?.dateKey) {
                  handlePointClick(data.activePayload[0].payload.dateKey);
                }
              }}
              style={{ cursor: canDrillDown ? 'pointer' : 'default' }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                strokeOpacity={0.3}
                horizontal={true}
                vertical={false}
              />
              <XAxis 
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                dy={8}
              />
              <YAxis 
                domain={[1, Math.max(maxRank, 10)]}
                reversed={true}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                tickFormatter={(value) => formatRank(value)}
                axisLine={false}
                tickLine={false}
                width={35}
                ticks={Array.from({ length: Math.min(maxRank, 10) }, (_, i) => i + 1)}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for podium positions */}
              <ReferenceLine y={1} stroke="hsl(var(--primary))" strokeOpacity={0.2} strokeDasharray="5 5" />
              <ReferenceLine y={3} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.1} strokeDasharray="3 3" />
              
              {/* Render non-top-10 restaurants first (behind) */}
              {restaurantRankings.slice(10).map((ranking) => {
                const style = getRestaurantStyle(ranking.id);
                return (
                  <Line
                    key={ranking.id}
                    type="monotone"
                    dataKey={ranking.id}
                    name={ranking.name}
                    stroke={style.color}
                    strokeWidth={style.strokeWidth}
                    strokeOpacity={style.opacity}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                    connectNulls={false}
                    onMouseEnter={() => setHoveredRestaurant(ranking.id)}
                    onMouseLeave={() => setHoveredRestaurant(null)}
                  />
                );
              })}
              
              {/* Render top 10 restaurants on top */}
              {restaurantRankings.slice(0, 10).map((ranking, index) => {
                const style = getRestaurantStyle(ranking.id);
                return (
                  <Line
                    key={ranking.id}
                    type="monotone"
                    dataKey={ranking.id}
                    name={ranking.name}
                    stroke={style.color}
                    strokeWidth={style.strokeWidth}
                    strokeOpacity={style.opacity}
                    dot={<EndpointDot />}
                    activeDot={{ r: 8, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                    connectNulls={false}
                    onMouseEnter={() => setHoveredRestaurant(ranking.id)}
                    onMouseLeave={() => setHoveredRestaurant(null)}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Modern Legend - Top 10 */}
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {restaurantRankings.slice(0, 10).map((ranking, index) => {
            const isHovered = hoveredRestaurant === ranking.id;
            return (
              <div
                key={ranking.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  isHovered 
                    ? 'bg-muted ring-1 ring-primary/30' 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
                onMouseEnter={() => setHoveredRestaurant(ranking.id)}
                onMouseLeave={() => setHoveredRestaurant(null)}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: TOP_COLORS[index % TOP_COLORS.length] }}
                >
                  {index + 1}
                </span>
                <span className="font-medium truncate max-w-[140px] text-sm">
                  {ranking.name}
                </span>
              </div>
            );
          })}
          {restaurantRankings.length > 10 && !showAllRestaurants && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/20 text-muted-foreground text-sm">
              +{restaurantRankings.length - 10} autres
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
