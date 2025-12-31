import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { calculateLinearRegression, calculateRSquared } from "@/lib/correlationUtils";

interface DataPoint {
  avgRating: number;
  value: number;
  date: string;
}

interface CorrelationScatterPlotProps {
  data: DataPoint[];
  valueLabel: string;
  valueFormatter?: (v: number) => string;
}

export function CorrelationScatterPlot({
  data,
  valueLabel,
  valueFormatter = (v) => v.toLocaleString("fr-FR"),
}: CorrelationScatterPlotProps) {
  const chartConfig = {
    scatter: {
      label: valueLabel,
      color: "hsl(var(--primary))",
    },
  };

  const { regression, rSquared, trendLineData } = useMemo(() => {
    const ratings = data.map((d) => d.avgRating);
    const values = data.map((d) => d.value);
    const reg = calculateLinearRegression(ratings, values);
    const r2 = calculateRSquared(ratings, values);

    // Create trend line points
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    const trendLine = [
      { x: minRating, y: reg.slope * minRating + reg.intercept },
      { x: maxRating, y: reg.slope * maxRating + reg.intercept },
    ];

    return { regression: reg, rSquared: r2, trendLineData: trendLine };
  }, [data]);

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Dispersion Notes / {valueLabel}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            R² = <span className="font-mono font-medium text-foreground">{rSquared.toFixed(3)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                type="number"
                dataKey="avgRating"
                name="Note"
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11 }}
                label={{
                  value: "Note moyenne",
                  position: "insideBottom",
                  offset: -5,
                  style: { fontSize: 11 },
                }}
              />
              <YAxis
                type="number"
                dataKey="value"
                name={valueLabel}
                domain={[0, maxValue * 1.1]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => valueFormatter(v)}
                label={{
                  value: valueLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle", fontSize: 11 },
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as DataPoint;
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
                      <p className="font-medium mb-1">{point.date}</p>
                      <div className="space-y-1 text-muted-foreground">
                        <p>Note : <span className="text-foreground font-medium">{point.avgRating.toFixed(2)}</span></p>
                        <p>{valueLabel} : <span className="text-foreground font-medium">{valueFormatter(point.value)}</span></p>
                      </div>
                    </div>
                  );
                }}
              />
              {/* Trend line */}
              <ReferenceLine
                segment={[
                  { x: trendLineData[0].x, y: trendLineData[0].y },
                  { x: trendLineData[1].x, y: trendLineData[1].y },
                ]}
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Scatter
                data={data}
                fill="hsl(var(--primary))"
                opacity={0.7}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartContainer>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Ligne de tendance : {valueLabel} = {regression.slope.toFixed(0)} × Note {regression.intercept >= 0 ? "+" : ""} {regression.intercept.toFixed(0)}
        </p>
      </CardContent>
    </Card>
  );
}
