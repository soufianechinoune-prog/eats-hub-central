import { useMemo, useState } from "react";
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
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWeatherEmoji, weatherCodeLabels } from "@/hooks/useWeatherData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, Thermometer, Droplets, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

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

type SortKey = "date" | "temperature" | "precipitation" | "revenue" | "orders";

export function WeatherOverlayChart({ data }: WeatherOverlayChartProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);

  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      dateLabel: format(new Date(d.date), "d MMM", { locale: fr }),
      dayOfWeek: format(new Date(d.date), "EEEE", { locale: fr }),
      weatherEmoji: getWeatherEmoji(d.weatherCode),
      weatherLabel: weatherCodeLabels[d.weatherCode] || "Inconnu",
      revenueK: d.revenue / 1000,
    }));
  }, [data]);

  // Calculate averages for comparison
  const averages = useMemo(() => {
    if (data.length === 0) return { revenue: 0, orders: 0, temperature: 0 };
    return {
      revenue: data.reduce((s, d) => s + d.revenue, 0) / data.length,
      orders: data.reduce((s, d) => s + d.orders, 0) / data.length,
      temperature: data.reduce((s, d) => s + d.temperature, 0) / data.length,
    };
  }, [data]);

  // Sorted table data
  const sortedData = useMemo(() => {
    const sorted = [...chartData].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case "date":
          comparison = a.date.localeCompare(b.date);
          break;
        case "temperature":
          comparison = a.temperature - b.temperature;
          break;
        case "precipitation":
          comparison = a.precipitation - b.precipitation;
          break;
        case "revenue":
          comparison = a.revenue - b.revenue;
          break;
        case "orders":
          comparison = a.orders - b.orders;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
    return sorted;
  }, [chartData, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "date");
    }
  };

  if (data.length === 0) {
    return null;
  }

  const SortButton = ({ column, children }: { column: SortKey; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">CA et météo sur la période</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="charts" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="charts">Graphiques</TabsTrigger>
            <TabsTrigger value="table">Tableau détaillé</TabsTrigger>
          </TabsList>

          <TabsContent value="charts">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Temperature vs Revenue */}
              <div className="h-[280px]">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Température vs CA</p>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="revenue" orientation="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}k€`} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}°`} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        const revenueDelta = d.revenue - averages.revenue;
                        const deltaPercent = (revenueDelta / averages.revenue) * 100;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
                            <div className="flex items-center gap-2 font-medium mb-1">
                              <span>{d.weatherEmoji}</span>
                              <span>{d.dateLabel}</span>
                              <span className="text-muted-foreground">({d.dayOfWeek})</span>
                            </div>
                            <div className="text-muted-foreground text-xs mb-2">{d.weatherLabel}</div>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Température:</span>
                                <span className="font-medium">{d.temperature.toFixed(1)}°C</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">CA:</span>
                                <span className="font-medium">{d.revenue.toFixed(0)}€</span>
                              </div>
                              <div className={`flex justify-between gap-4 text-xs ${deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span>vs moyenne:</span>
                                <span>{deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar yAxisId="revenue" dataKey="revenueK" name="CA" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} barSize={16} />
                    <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temp." stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Precipitation vs Orders */}
              <div className="h-[280px]">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Précipitations vs Commandes</p>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="orders" orientation="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="precip" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}mm`} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        const ordersDelta = d.orders - averages.orders;
                        const deltaPercent = (ordersDelta / averages.orders) * 100;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
                            <div className="flex items-center gap-2 font-medium mb-1">
                              <span>{d.weatherEmoji}</span>
                              <span>{d.dateLabel}</span>
                              <span className="text-muted-foreground">({d.dayOfWeek})</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Précipitations:</span>
                                <span className="font-medium">{d.precipitation.toFixed(1)}mm</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Commandes:</span>
                                <span className="font-medium">{d.orders}</span>
                              </div>
                              <div className={`flex justify-between gap-4 text-xs ${deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span>vs moyenne:</span>
                                <span>{deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area yAxisId="precip" type="monotone" dataKey="precipitation" name="Pluie" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary) / 0.4)" />
                    <Line yAxisId="orders" type="monotone" dataKey="orders" name="Cmd" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="table">
            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[100px]">
                      <SortButton column="date">Date</SortButton>
                    </TableHead>
                    <TableHead>Météo</TableHead>
                    <TableHead className="text-right">
                      <SortButton column="temperature">
                        <Thermometer className="h-3 w-3 mr-1" />
                        Temp.
                      </SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton column="precipitation">
                        <Droplets className="h-3 w-3 mr-1" />
                        Pluie
                      </SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton column="revenue">CA</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton column="orders">Cmd</SortButton>
                    </TableHead>
                    <TableHead className="text-right">vs Moy.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((row) => {
                    const revenueDelta = ((row.revenue - averages.revenue) / averages.revenue) * 100;
                    return (
                      <TableRow key={row.date}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{row.dateLabel}</span>
                            <span className="text-xs text-muted-foreground capitalize">{row.dayOfWeek}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{row.weatherEmoji}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">{row.weatherLabel}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{row.temperature.toFixed(1)}°C</TableCell>
                        <TableCell className="text-right">
                          {row.precipitation > 0 ? (
                            <span className="text-blue-600">{row.precipitation.toFixed(1)}mm</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{row.revenue.toFixed(0)}€</TableCell>
                        <TableCell className="text-right">{row.orders}</TableCell>
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end gap-1 ${revenueDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {revenueDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            <span className="text-xs font-medium">{revenueDelta >= 0 ? '+' : ''}{revenueDelta.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
