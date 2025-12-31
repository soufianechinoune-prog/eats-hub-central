import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeatherEmoji } from "@/hooks/useWeatherData";

interface WeatherDataPoint {
  date: string;
  temperature: number;
  precipitation: number;
  weatherCode: number;
  revenue: number;
  orders: number;
}

interface WeatherOverlayChartProps {
  data: WeatherDataPoint[];
}

export function WeatherOverlayChart({ data }: WeatherOverlayChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      dateLabel: format(new Date(d.date), "d MMM", { locale: fr }),
      weatherEmoji: getWeatherEmoji(d.weatherCode),
      revenueK: d.revenue / 1000,
    }));
  }, [data]);

  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">CA et météo sur la période</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="revenue"
                orientation="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}k€`}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="temp"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}°C`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{data.weatherEmoji}</span>
                        <span className="font-medium">{data.dateLabel}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">CA:</span>
                          <span className="font-medium">{data.revenue.toFixed(0)}€</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Commandes:</span>
                          <span className="font-medium">{data.orders}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Température:</span>
                          <span className="font-medium">{data.temperature.toFixed(1)}°C</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Précipitations:</span>
                          <span className="font-medium">{data.precipitation.toFixed(1)}mm</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend />
              
              {/* Precipitation area (subtle background) */}
              <Area
                yAxisId="temp"
                type="monotone"
                dataKey="precipitation"
                name="Précipitations (mm)"
                fill="hsl(var(--primary) / 0.1)"
                stroke="hsl(var(--primary) / 0.3)"
                strokeWidth={0}
              />
              
              {/* Revenue bars */}
              <Bar
                yAxisId="revenue"
                dataKey="revenueK"
                name="CA (k€)"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              
              {/* Temperature line */}
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Température (°C)"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--destructive))" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
