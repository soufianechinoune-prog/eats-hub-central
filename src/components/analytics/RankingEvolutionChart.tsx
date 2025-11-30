import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface RankedRestaurant {
  id: string;
  name: string;
  city: string;
  value: number;
  prevValue: number;
  trend: number | null;
  rank: number;
}

interface MonthlyDataPoint {
  restaurant_id: string;
  month: number;
  value: number;
}

interface RankingEvolutionChartProps {
  ranking: RankedRestaurant[];
  monthlyData: MonthlyDataPoint[];
  metricLabel: string;
  formatValue: (v: number) => string;
  colorClass: string;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(160, 60%, 45%)",
  "hsl(200, 60%, 45%)",
  "hsl(280, 60%, 45%)",
  "hsl(340, 60%, 45%)",
  "hsl(40, 60%, 45%)",
];

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function RankingEvolutionChart({
  ranking,
  monthlyData,
  metricLabel,
  formatValue,
}: RankingEvolutionChartProps) {
  const [hiddenRestaurants, setHiddenRestaurants] = useState<Set<string>>(new Set());

  const top10 = ranking.slice(0, 10);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    return months.map(month => {
      const point: Record<string, any> = { month, monthLabel: MONTHS[month - 1] };
      
      top10.forEach(restaurant => {
        const dataPoint = monthlyData.find(
          d => d.restaurant_id === restaurant.id && d.month === month
        );
        point[restaurant.id] = dataPoint?.value || 0;
      });
      
      return point;
    });
  }, [top10, monthlyData]);

  const toggleRestaurant = (restaurantId: string) => {
    setHiddenRestaurants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(restaurantId)) {
        newSet.delete(restaurantId);
      } else {
        newSet.add(restaurantId);
      }
      return newSet;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Évolution mensuelle - Top 10
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value;
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => {
                  const restaurant = top10.find(r => r.id === name);
                  return [formatValue(value), restaurant?.name || name];
                }}
                labelFormatter={(label) => `${label}`}
              />
              {top10.map((restaurant, index) => (
                <Line
                  key={restaurant.id}
                  type="monotone"
                  dataKey={restaurant.id}
                  name={restaurant.id}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  hide={hiddenRestaurants.has(restaurant.id)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Custom Legend */}
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {top10.map((restaurant, index) => (
            <button
              key={restaurant.id}
              onClick={() => toggleRestaurant(restaurant.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
                hiddenRestaurants.has(restaurant.id)
                  ? "opacity-40 line-through"
                  : "opacity-100"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate max-w-[100px]">{restaurant.name}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
