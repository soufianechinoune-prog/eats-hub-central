import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
  date: string; // ISO date string
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
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#ec4899", // pink
  "#84cc16", // lime
];

// Custom dot that shows the value
const CustomDot = (props: any) => {
  const { cx, cy, payload, dataKey, stroke } = props;
  
  if (!cx || !cy || payload[dataKey] === undefined || payload[dataKey] === null) return null;
  
  const value = payload[dataKey];
  
  return (
    <g>
      {/* Outer circle */}
      <circle
        cx={cx}
        cy={cy}
        r={14}
        fill={stroke}
        fillOpacity={0.15}
        stroke={stroke}
        strokeWidth={2}
      />
      {/* Inner circle */}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={stroke}
      />
      {/* Value label */}
      <text
        x={cx}
        y={cy - 22}
        textAnchor="middle"
        fill={stroke}
        fontSize={10}
        fontWeight="bold"
      >
        {typeof value === 'number' ? value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : value}
      </text>
    </g>
  );
};

// Simpler dot for dense data (daily/weekly)
const SimpleDot = (props: any) => {
  const { cx, cy, stroke } = props;
  
  if (!cx || !cy) return null;
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={stroke}
      stroke="hsl(var(--background))"
      strokeWidth={2}
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
}: SelectedRestaurantsRankingChartProps) {
  // Get selected restaurant objects
  const selectedRestaurantObjects = useMemo(() => {
    return restaurants.filter(r => selectedRestaurants.includes(r.id));
  }, [restaurants, selectedRestaurants]);

  // Build chart data based on granularity
  const chartData = useMemo(() => {
    if (granularity === "daily") {
      // Generate all days in the range
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
      // Group by week
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
      
      return Array.from(weeks.entries()).map(([weekKey, { weekStart, weekNum }]) => {
        const point: Record<string, any> = { 
          dateKey: weekKey,
          label: `Sem. ${weekNum}`,
          shortLabel: `S${weekNum}`,
        };
        
        selectedRestaurantObjects.forEach(restaurant => {
          // Sum all values for this week
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
      // Monthly
      const months = new Map<string, { month: number; year: number }>();
      const current = new Date(startDate);
      while (current <= endDate) {
        const monthKey = format(current, "yyyy-MM");
        if (!months.has(monthKey)) {
          months.set(monthKey, { month: current.getMonth() + 1, year: current.getFullYear() });
        }
        current.setMonth(current.getMonth() + 1);
      }
      
      const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      
      return Array.from(months.entries()).map(([monthKey, { month }]) => {
        const point: Record<string, any> = { 
          dateKey: monthKey,
          label: MONTHS_FR[month - 1],
          shortLabel: MONTHS_FR[month - 1],
        };
        
        selectedRestaurantObjects.forEach(restaurant => {
          // Sum all values for this month
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
  }, [selectedRestaurantObjects, timeSeriesData, granularity, startDate, endDate]);

  // Calculate max value for Y axis
  const maxValue = useMemo(() => {
    let max = 0;
    chartData.forEach(point => {
      selectedRestaurantObjects.forEach(r => {
        const val = point[r.id];
        if (typeof val === 'number' && val > max) {
          max = val;
        }
      });
    });
    return max * 1.2; // Add 20% padding for labels
  }, [chartData, selectedRestaurantObjects]);

  if (selectedRestaurantObjects.length === 0 || chartData.length === 0) {
    return null;
  }

  // Use simpler dots for dense data
  const useDenseMode = granularity === "daily" || (granularity === "weekly" && chartData.length > 8);
  const DotComponent = useDenseMode ? SimpleDot : CustomDot;
  
  // Show fewer ticks for dense data
  const tickInterval = useDenseMode && chartData.length > 15 
    ? Math.ceil(chartData.length / 10) - 1 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Évolution {metricLabel} — {selectedRestaurantObjects.length === 1 
            ? selectedRestaurantObjects[0].name 
            : `${selectedRestaurantObjects.length} restaurants`}
          <span className="text-xs font-normal text-muted-foreground ml-2">
            ({granularity === "daily" ? "quotidien" : granularity === "weekly" ? "hebdomadaire" : "mensuel"})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: useDenseMode ? 20 : 40, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey={useDenseMode ? "shortLabel" : "label"}
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                interval={tickInterval}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value.toLocaleString('fr-FR');
                }}
                domain={[0, maxValue]}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => {
                  const restaurant = selectedRestaurantObjects.find(r => r.id === name);
                  return [formatValue(value), restaurant?.name || name];
                }}
                labelFormatter={(label) => label}
              />
              {selectedRestaurantObjects.map((restaurant, index) => (
                <Line
                  key={restaurant.id}
                  type="monotone"
                  dataKey={restaurant.id}
                  name={restaurant.id}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={useDenseMode ? <SimpleDot /> : <CustomDot />}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Custom Legend */}
        <div className="flex flex-wrap gap-3 mt-4 justify-center">
          {selectedRestaurantObjects.map((restaurant, index) => (
            <div
              key={restaurant.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="font-medium truncate max-w-[150px]">
                {restaurant.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
