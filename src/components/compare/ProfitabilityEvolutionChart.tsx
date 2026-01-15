import { useMemo } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

interface RestaurantStats {
  id: string;
  name: string;
  profitability: number;
  dailyData: Record<string, { sales: number; payout: number; orders: number }>;
}

interface ProfitabilityEvolutionChartProps {
  stats: RestaurantStats[];
  dateRange: { start: Date; end: Date };
}

// Colors for each restaurant line
const COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export const ProfitabilityEvolutionChart = ({ stats, dateRange }: ProfitabilityEvolutionChartProps) => {
  const chartData = useMemo(() => {
    // Generate all dates in the range
    const allDates = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    
    return allDates.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dataPoint: Record<string, any> = {
        date: dateStr,
        dateLabel: format(date, "d MMM", { locale: fr }),
      };
      
      stats.forEach(restaurant => {
        const dayData = restaurant.dailyData[dateStr];
        if (dayData && dayData.sales > 0) {
          dataPoint[restaurant.id] = (dayData.payout / dayData.sales) * 100;
        } else {
          dataPoint[restaurant.id] = null;
        }
      });
      
      return dataPoint;
    });
  }, [stats, dateRange]);

  // Calculate average profitability line
  const avgProfitability = useMemo(() => {
    const totalProfit = stats.reduce((sum, s) => sum + s.profitability, 0);
    return stats.length > 0 ? totalProfit / stats.length : 0;
  }, [stats]);

  if (!stats.length || chartData.length === 0) {
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
    <div className="h-[400px]">
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
            domain={[50, 80]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
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
          
          {stats.map((restaurant, index) => (
            <Line
              key={restaurant.id}
              type="monotone"
              dataKey={restaurant.id}
              name={restaurant.name}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
