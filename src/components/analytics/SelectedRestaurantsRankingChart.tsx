import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, parseISO, startOfWeek, getWeek } from "date-fns";
import { fr } from "date-fns/locale";

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

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
];

// Format rank as short ordinal
const formatRank = (rank: number): string => {
  if (rank === 1) return "1er";
  return `${rank}e`;
};

// Custom dot - clean modern style
const ModernDot = (props: any) => {
  const { cx, cy, payload, dataKey, stroke, onClick, isClickable, index } = props;
  
  if (!cx || !cy || payload[dataKey] === undefined || payload[dataKey] === null) return null;
  
  const rankKey = `${dataKey}_rank`;
  const rank = payload[rankKey];
  
  if (!rank) return null;

  return (
    <g 
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
      onClick={() => isClickable && onClick?.(payload.dateKey)}
    >
      {/* Clean dot */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={stroke}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    </g>
  );
};

// Custom label renderer that handles overlaps
const RankLabel = (props: any) => {
  const { x, y, value, stroke, payload, dataKey, allRestaurants, chartData, index } = props;
  
  if (!x || !y || !value) return null;
  
  // Get all restaurants' Y positions for this data point to detect overlaps
  const currentDataPoint = chartData?.[index];
  if (!currentDataPoint) return null;
  
  // Calculate offset based on rank to spread labels vertically
  const rank = value;
  const baseOffset = -16;
  // Stagger labels: odd ranks go up, even ranks go slightly to the side
  const yOffset = baseOffset - ((rank - 1) * 2);
  const xOffset = (rank % 2 === 0) ? 8 : -8;
  
  return (
    <g>
      {/* Background pill */}
      <rect
        x={x + xOffset - 14}
        y={y + yOffset - 8}
        width={28}
        height={16}
        rx={8}
        fill={stroke}
        fillOpacity={0.9}
      />
      {/* Rank text */}
      <text
        x={x + xOffset}
        y={y + yOffset + 4}
        textAnchor="middle"
        fill="white"
        fontSize={9}
        fontWeight="600"
      >
        {formatRank(value)}
      </text>
    </g>
  );
};

// Simple dot for dense mode
const SimpleDot = (props: any) => {
  const { cx, cy, stroke, onClick, payload, isClickable } = props;
  
  if (!cx || !cy) return null;
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={stroke}
      stroke="hsl(var(--background))"
      strokeWidth={1.5}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
      onClick={() => isClickable && onClick?.(payload?.dateKey)}
    />
  );
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
  const selectedRestaurantObjects = useMemo(() => {
    return restaurants.filter(r => selectedRestaurants.includes(r.id));
  }, [restaurants, selectedRestaurants]);

  const chartData = useMemo(() => {
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
          const point: Record<string, any> = { 
            dateKey: dateStr,
            label: format(day, "d MMM", { locale: fr }),
            shortLabel: format(day, "d", { locale: fr }),
          };
          
          selectedRestaurantObjects.forEach(restaurant => {
            const dataPoint = timeSeriesData.find(
              d => d.restaurant_id === restaurant.id && d.date === dateStr
            );
            point[restaurant.id] = dataPoint?.value ?? null;
          });
          
          return point;
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
        
        return Array.from(weeks.entries()).map(([weekKey, { weekNum }]) => {
          const point: Record<string, any> = { 
            dateKey: weekKey,
            label: `Sem. ${weekNum}`,
            shortLabel: `S${weekNum}`,
          };
          
          selectedRestaurantObjects.forEach(restaurant => {
            const weekDataPoints = timeSeriesData.filter(d => {
              if (d.restaurant_id !== restaurant.id) return false;
              const dataDate = parseISO(d.date);
              const dataWeekStart = startOfWeek(dataDate, { weekStartsOn: 1 });
              return format(dataWeekStart, "yyyy-MM-dd") === weekKey;
            });
            const total = weekDataPoints.reduce((sum, dp) => sum + dp.value, 0);
            point[restaurant.id] = weekDataPoints.length > 0 ? total : null;
          });
          
          return point;
        });
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
        
        return Array.from(months.entries()).map(([monthKey, { month }]) => {
          const point: Record<string, any> = { 
            dateKey: monthKey,
            label: MONTHS_FR[month - 1],
            shortLabel: MONTHS_FR[month - 1],
          };
          
          selectedRestaurantObjects.forEach(restaurant => {
            const monthDataPoints = timeSeriesData.filter(d => {
              if (d.restaurant_id !== restaurant.id) return false;
              return d.date.startsWith(monthKey);
            });
            const total = monthDataPoints.reduce((sum, dp) => sum + dp.value, 0);
            point[restaurant.id] = monthDataPoints.length > 0 ? total : null;
          });
          
          return point;
        });
      }
    };

    const baseData = buildBaseData();
    
    // Calculate ranks for each time point
    return baseData.map(point => {
      const restaurantValues = selectedRestaurantObjects
        .map(r => ({ id: r.id, value: point[r.id] as number | null }))
        .filter(rv => rv.value !== null && rv.value > 0)
        .sort((a, b) => (b.value as number) - (a.value as number));
      
      const enrichedPoint = { ...point };
      restaurantValues.forEach((rv, index) => {
        enrichedPoint[`${rv.id}_rank`] = index + 1;
      });
      
      return enrichedPoint;
    });
  }, [selectedRestaurantObjects, timeSeriesData, granularity, startDate, endDate]);

  const maxValue = useMemo(() => {
    let max = 0;
    chartData.forEach(point => {
      selectedRestaurantObjects.forEach(r => {
        const val = point[r.id];
        if (typeof val === 'number' && val > max) max = val;
      });
    });
    return max * 1.25;
  }, [chartData, selectedRestaurantObjects]);

  if (selectedRestaurantObjects.length === 0 || chartData.length === 0) {
    return null;
  }

  const useDenseMode = granularity === "daily" || (granularity === "weekly" && chartData.length > 8);
  const tickInterval = useDenseMode && chartData.length > 15 ? Math.ceil(chartData.length / 10) - 1 : 0;

  const handlePointClick = (dateKey: string) => {
    if (granularity === "monthly" && onMonthClick) {
      onMonthClick(dateKey);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const sortedPayload = [...payload]
      .filter((entry: any) => entry.value !== null && entry.value !== undefined)
      .sort((a: any, b: any) => (b.value as number) - (a.value as number));
    
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-4 text-sm">
        <div className="font-semibold text-foreground mb-3 pb-2 border-b border-border/50">
          {label}
        </div>
        <div className="space-y-2">
          {sortedPayload.map((entry: any, idx: number) => {
            const restaurant = selectedRestaurantObjects.find(r => r.id === entry.dataKey);
            const rank = idx + 1;
            
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: entry.stroke }}
                  />
                  <span 
                    className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: entry.stroke }}
                  >
                    {formatRank(rank)}
                  </span>
                  <span className="text-muted-foreground truncate max-w-[140px]">
                    {restaurant?.name}
                  </span>
                </div>
                <span className="font-semibold tabular-nums">
                  {formatValue(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const canDrillDown = granularity === "monthly" && isClickable && onMonthClick;

  // Custom label component with smart positioning
  const SmartRankLabel = ({ x, y, value, stroke, index }: any) => {
    if (!x || !y || !value) return null;
    
    // Get current data point to check for overlaps
    const currentPoint = chartData[index];
    if (!currentPoint) return null;
    
    // Find all values at this point to determine overlap
    const allValuesAtPoint = selectedRestaurantObjects
      .map(r => ({ id: r.id, value: currentPoint[r.id], rank: currentPoint[`${r.id}_rank`] }))
      .filter(v => v.value !== null && v.rank !== undefined)
      .sort((a, b) => b.value - a.value);
    
    // Calculate vertical offset based on rank to prevent overlap
    const myRank = value;
    const baseY = -12;
    
    // Check if there are close values (potential overlaps)
    let yOffset = baseY;
    if (allValuesAtPoint.length > 1) {
      // Stagger labels based on rank position
      yOffset = baseY - (myRank - 1) * 14;
    }
    
    return (
      <g>
        {/* Pill background */}
        <rect
          x={x - 13}
          y={y + yOffset - 7}
          width={26}
          height={14}
          rx={7}
          fill={stroke}
        />
        {/* Rank text */}
        <text
          x={x}
          y={y + yOffset + 3}
          textAnchor="middle"
          fill="white"
          fontSize={8}
          fontWeight="700"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
        >
          {formatRank(value)}
        </text>
      </g>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span>Évolution {metricLabel}</span>
          <span className="text-muted-foreground font-normal">
            — {selectedRestaurantObjects.length === 1 
              ? selectedRestaurantObjects[0].name 
              : `${selectedRestaurantObjects.length} restaurants`}
          </span>
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {granularity === "daily" ? "quotidien" : granularity === "weekly" ? "hebdomadaire" : "mensuel"}
            {canDrillDown && (
              <span className="ml-2 text-primary font-medium">• Cliquez pour le détail</span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: useDenseMode ? 20 : 50, right: 20, left: 0, bottom: 5 }}
              onClick={(data) => {
                if (canDrillDown && data?.activePayload?.[0]?.payload?.dateKey) {
                  handlePointClick(data.activePayload[0].payload.dateKey);
                }
              }}
              style={{ cursor: canDrillDown ? 'pointer' : 'default' }}
            >
              <defs>
                {selectedRestaurantObjects.map((_, index) => (
                  <linearGradient key={index} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis 
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval={tickInterval}
                dy={8}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value.toLocaleString('fr-FR');
                }}
                domain={[0, maxValue]}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              {selectedRestaurantObjects.map((restaurant, index) => (
                <Line
                  key={restaurant.id}
                  type="monotone"
                  dataKey={restaurant.id}
                  name={restaurant.id}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2.5}
                  dot={useDenseMode 
                    ? <SimpleDot onClick={handlePointClick} isClickable={canDrillDown} />
                    : <ModernDot onClick={handlePointClick} isClickable={canDrillDown} />
                  }
                  activeDot={{ r: 8, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                  connectNulls={false}
                >
                  {!useDenseMode && (
                    <LabelList 
                      dataKey={`${restaurant.id}_rank`}
                      content={(props: any) => (
                        <SmartRankLabel 
                          {...props} 
                          stroke={COLORS[index % COLORS.length]}
                        />
                      )}
                    />
                  )}
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Modern Legend */}
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {selectedRestaurantObjects.map((restaurant, index) => (
            <div
              key={restaurant.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="font-medium truncate max-w-[160px]">
                {restaurant.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
