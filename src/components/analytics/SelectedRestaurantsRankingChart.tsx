import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { TrendingUp } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  city?: string | null;
}

interface MonthlyDataPoint {
  restaurant_id: string;
  month: number;
  value: number;
}

interface SelectedRestaurantsRankingChartProps {
  restaurants: Restaurant[];
  selectedRestaurants: string[];
  monthlyData: MonthlyDataPoint[];
  metricLabel: string;
  formatValue: (v: number) => string;
  startMonth?: number;
  endMonth?: number;
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

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// Custom dot that shows the value
const CustomDot = (props: any) => {
  const { cx, cy, payload, dataKey, stroke, index, data } = props;
  
  if (!cx || !cy || payload[dataKey] === undefined || payload[dataKey] === null) return null;
  
  const value = payload[dataKey];
  
  return (
    <g>
      {/* Outer circle */}
      <circle
        cx={cx}
        cy={cy}
        r={16}
        fill={stroke}
        fillOpacity={0.15}
        stroke={stroke}
        strokeWidth={2}
      />
      {/* Inner circle */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={stroke}
      />
      {/* Value label */}
      <text
        x={cx}
        y={cy - 24}
        textAnchor="middle"
        fill={stroke}
        fontSize={11}
        fontWeight="bold"
      >
        {typeof value === 'number' ? value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : value}
      </text>
    </g>
  );
};

export function SelectedRestaurantsRankingChart({
  restaurants,
  selectedRestaurants,
  monthlyData,
  metricLabel,
  formatValue,
  startMonth = 1,
  endMonth = 12,
}: SelectedRestaurantsRankingChartProps) {
  // Get selected restaurant objects
  const selectedRestaurantObjects = useMemo(() => {
    return restaurants.filter(r => selectedRestaurants.includes(r.id));
  }, [restaurants, selectedRestaurants]);

  // Build chart data: one entry per month with values for each selected restaurant
  const chartData = useMemo(() => {
    const months = [];
    for (let m = startMonth; m <= endMonth; m++) {
      months.push(m);
    }
    
    return months.map(month => {
      const point: Record<string, any> = { 
        month, 
        monthLabel: MONTHS[month - 1] 
      };
      
      selectedRestaurantObjects.forEach(restaurant => {
        const dataPoint = monthlyData.find(
          d => d.restaurant_id === restaurant.id && d.month === month
        );
        point[restaurant.id] = dataPoint?.value ?? null;
      });
      
      return point;
    });
  }, [selectedRestaurantObjects, monthlyData, startMonth, endMonth]);

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
    return max * 1.15; // Add 15% padding for labels
  }, [chartData, selectedRestaurantObjects]);

  if (selectedRestaurantObjects.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Évolution {metricLabel} — {selectedRestaurantObjects.length === 1 
            ? selectedRestaurantObjects[0].name 
            : `${selectedRestaurantObjects.length} restaurants`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: 40, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
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
                  strokeWidth={3}
                  dot={<CustomDot />}
                  activeDot={{ r: 8, strokeWidth: 2 }}
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
