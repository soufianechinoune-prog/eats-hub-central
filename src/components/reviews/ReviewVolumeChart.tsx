import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from "recharts";

interface RatingDistribution {
  rating: number;
  count: number;
  previousCount?: number;
}

interface ReviewVolumeChartProps {
  data: RatingDistribution[];
}

const RATING_COLORS: Record<number, string> = {
  5: "hsl(142 76% 36%)",
  4: "hsl(142 71% 45%)",
  3: "hsl(45 93% 47%)",
  2: "hsl(24 95% 53%)",
  1: "hsl(0 84% 60%)"
};

export function ReviewVolumeChart({ data }: ReviewVolumeChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload.find((p: any) => p.dataKey === "count");
      const previous = payload.find((p: any) => p.dataKey === "previousCount");
      const rating = payload[0]?.payload?.rating;

      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{rating} étoile{rating > 1 ? "s" : ""}</p>
          {current && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: RATING_COLORS[rating] }} />
              <span>Actuel: <strong>{current.value}</strong> avis</span>
            </div>
          )}
          {previous?.value !== undefined && (
            <div className="flex items-center gap-2 text-sm mt-1">
              <div className="w-3 h-3 rounded bg-muted-foreground/30" />
              <span>N-1: <strong>{previous.value}</strong> avis</span>
              {current?.value !== undefined && previous.value > 0 && (
                <span className={current.value > previous.value ? "text-emerald-500" : current.value < previous.value ? "text-red-500" : "text-muted-foreground"}>
                  ({current.value > previous.value ? "+" : ""}{((current.value - previous.value) / previous.value * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const chartData = data.map(d => ({
    ...d,
    name: `${d.rating}★`
  }));

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          Volume d'Avis par Note
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => value === "count" ? "Période actuelle" : "N-1"}
            />
            
            {/* Barres période précédente (fantômes) */}
            <Bar 
              dataKey="previousCount" 
              fill="hsl(var(--muted-foreground))"
              opacity={0.2}
              radius={[4, 4, 0, 0]}
            />
            
            {/* Barres actuelles colorées */}
            <Bar 
              dataKey="count" 
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={RATING_COLORS[entry.rating]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Stats rapides */}
        <div className="flex justify-between mt-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">
              {data.filter(d => d.rating >= 4).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Avis positifs (4-5★)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-500">
              {data.filter(d => d.rating === 3).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Avis neutres (3★)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">
              {data.filter(d => d.rating <= 2).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Avis négatifs (1-2★)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
