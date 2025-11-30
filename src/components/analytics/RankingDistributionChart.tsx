import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

interface RankedRestaurant {
  id: string;
  name: string;
  city: string;
  value: number;
  prevValue: number;
  trend: number | null;
  rank: number;
}

interface RankingDistributionChartProps {
  ranking: RankedRestaurant[];
  metricLabel: string;
  formatValue: (v: number) => string;
  colorClass: string;
}

export function RankingDistributionChart({
  ranking,
  metricLabel,
  formatValue,
}: RankingDistributionChartProps) {
  const chartData = useMemo(() => {
    return ranking.map(r => ({
      name: r.name,
      shortName: r.name.length > 15 ? r.name.substring(0, 15) + "..." : r.name,
      value: r.value,
      rank: r.rank,
    }));
  }, [ranking]);

  const average = useMemo(() => {
    if (ranking.length === 0) return 0;
    return ranking.reduce((sum, r) => sum + r.value, 0) / ranking.length;
  }, [ranking]);

  const getBarColor = (value: number) => {
    if (value >= average * 1.2) return "hsl(142, 76%, 36%)"; // Green - above average
    if (value >= average * 0.8) return "hsl(38, 92%, 50%)"; // Amber - near average
    return "hsl(0, 84%, 60%)"; // Red - below average
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Distribution - Tous les restaurants
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
              <XAxis 
                type="number"
                tick={{ fontSize: 10 }} 
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value;
                }}
              />
              <YAxis 
                type="category"
                dataKey="shortName" 
                tick={{ fontSize: 10 }} 
                className="text-muted-foreground"
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [formatValue(value), metricLabel]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item?.name || label;
                }}
              />
              <ReferenceLine 
                x={average} 
                stroke="hsl(var(--primary))" 
                strokeDasharray="5 5"
                label={{ 
                  value: `Moy: ${formatValue(average)}`, 
                  position: "top",
                  fontSize: 10,
                  fill: "hsl(var(--primary))"
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(142, 76%, 36%)" }} />
            <span>&gt;20% moy.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(38, 92%, 50%)" }} />
            <span>±20% moy.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(0, 84%, 60%)" }} />
            <span>&lt;20% moy.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
