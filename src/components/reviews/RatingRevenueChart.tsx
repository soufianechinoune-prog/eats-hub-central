import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import { Euro, ShoppingCart, BarChart3, TrendingUp } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DataPoint {
  date: string;
  avgRating: number;
  revenue: number;
  orders: number;
}

interface RatingRevenueChartProps {
  data: DataPoint[];
}

export function RatingRevenueChart({ data }: RatingRevenueChartProps) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const chartConfig = {
    avgRating: {
      label: "Moyenne 90 jours",
      color: "hsl(var(--primary))",
    },
    revenue: {
      label: "CA (€)",
      color: "hsl(var(--chart-2))",
    },
    orders: {
      label: "Commandes",
      color: "hsl(var(--chart-3))",
    },
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const maxValue = Math.max(...data.map((d) => (metric === "revenue" ? d.revenue : d.orders)));

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">
          Évolution Notes & Performances
        </CardTitle>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={chartType}
            onValueChange={(value) => value && setChartType(value as "bar" | "line")}
            size="sm"
          >
            <ToggleGroupItem value="bar" aria-label="Barres" className="h-8 w-8 p-0">
              <BarChart3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="line" aria-label="Courbes" className="h-8 w-8 p-0">
              <TrendingUp className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex gap-1">
            <Button
              variant={metric === "revenue" ? "default" : "outline"}
              size="sm"
              onClick={() => setMetric("revenue")}
              className="h-8 gap-1.5"
            >
              <Euro className="h-3.5 w-3.5" />
              CA
            </Button>
            <Button
              variant={metric === "orders" ? "default" : "outline"}
              size="sm"
              onClick={() => setMetric("orders")}
              className="h-8 gap-1.5"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Commandes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                yAxisId="left"
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                label={{
                  value: "Note",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle", fontSize: 11 },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, maxValue * 1.1]}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v) =>
                  metric === "revenue" ? `${(v / 1000).toFixed(0)}k€` : v.toString()
                }
                label={{
                  value: metric === "revenue" ? "CA (€)" : "Commandes",
                  angle: 90,
                  position: "insideRight",
                  style: { textAnchor: "middle", fontSize: 11 },
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
                      <p className="font-medium mb-2">{formatDate(label)}</p>
                      {payload.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-muted-foreground">{entry.name}:</span>
                          <span className="font-medium">
                            {entry.dataKey === "avgRating"
                              ? (entry.value as number).toFixed(2)
                              : entry.dataKey === "revenue"
                              ? `${(entry.value as number).toLocaleString("fr-FR")} €`
                              : entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              {chartType === "bar" ? (
                <Bar
                  yAxisId="right"
                  dataKey={metric}
                  name={metric === "revenue" ? "CA (€)" : "Commandes"}
                  fill={metric === "revenue" ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))"}
                  opacity={0.4}
                  radius={[4, 4, 0, 0]}
                />
              ) : (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={metric}
                  name={metric === "revenue" ? "CA (€)" : "Commandes"}
                  stroke={metric === "revenue" ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))"}
                  strokeWidth={2}
                  dot={{ r: 3, fill: metric === "revenue" ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))" }}
                  activeDot={{ r: 5 }}
                />
              )}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgRating"
                name="Moyenne 90 jours"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
