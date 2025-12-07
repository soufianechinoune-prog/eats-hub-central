import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import { useState } from "react";

interface MonthlyRating {
  month: string;
  rating: number;
  count: number;
  previousRating?: number;
  previousCount?: number;
}

interface RatingEvolutionChartProps {
  data: MonthlyRating[];
}

export function RatingEvolutionChart({ data }: RatingEvolutionChartProps) {
  const [comparisonMode, setComparisonMode] = useState<"year" | "rolling">("year");

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload.find((p: any) => p.dataKey === "rating");
      const previous = payload.find((p: any) => p.dataKey === "previousRating");

      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{label}</p>
          {current && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Note actuelle: <strong>{current.value?.toFixed(2)}</strong></span>
              <span className="text-muted-foreground">({payload[0]?.payload?.count} avis)</span>
            </div>
          )}
          {previous?.value && (
            <div className="flex items-center gap-2 text-sm mt-1">
              <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
              <span>N-1: <strong>{previous.value?.toFixed(2)}</strong></span>
              {current?.value && (
                <span className={current.value > previous.value ? "text-emerald-500" : "text-red-500"}>
                  ({current.value > previous.value ? "+" : ""}{(current.value - previous.value).toFixed(2)})
                </span>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-500" />
          Évolution de la Note Moyenne
        </CardTitle>
        <div className="flex gap-1">
          <Button
            variant={comparisonMode === "year" ? "default" : "outline"}
            size="sm"
            onClick={() => setComparisonMode("year")}
            className="text-xs"
          >
            <Calendar className="h-3 w-3 mr-1" />
            Année
          </Button>
          <Button
            variant={comparisonMode === "rolling" ? "default" : "outline"}
            size="sm"
            onClick={() => setComparisonMode("rolling")}
            className="text-xs"
          >
            4 sem.
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            {/* Zones de performance */}
            <ReferenceArea y1={4.5} y2={5} fill="hsl(var(--chart-2))" fillOpacity={0.1} />
            <ReferenceArea y1={3.5} y2={4.5} fill="hsl(45 93% 47%)" fillOpacity={0.05} />
            <ReferenceArea y1={0} y2={3.5} fill="hsl(0 84% 60%)" fillOpacity={0.05} />

            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 11 }} 
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              domain={[0, 5]} 
              ticks={[0, 1, 2, 3, 4, 5]}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Ligne N-1 */}
            <Line
              type="monotone"
              dataKey="previousRating"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
            />
            
            {/* Ligne actuelle */}
            <Line
              type="monotone"
              dataKey="rating"
              stroke="hsl(45 93% 47%)"
              strokeWidth={3}
              dot={{ fill: "hsl(45 93% 47%)", r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
              activeDot={{ r: 7, strokeWidth: 0 }}
            />

            {/* Lignes de référence */}
            <ReferenceLine y={4.5} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={3.5} stroke="hsl(45 93% 47%)" strokeDasharray="3 3" strokeOpacity={0.5} />
          </LineChart>
        </ResponsiveContainer>

        {/* Légende des zones */}
        <div className="flex justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50" />
            <span className="text-muted-foreground">Excellent (≥4.5)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50" />
            <span className="text-muted-foreground">Bon (3.5-4.5)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50" />
            <span className="text-muted-foreground">À améliorer (&lt;3.5)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
