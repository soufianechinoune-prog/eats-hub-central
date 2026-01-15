import { useMemo, useState, useEffect } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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

const MAX_SELECTION = 8;

// Extended color palette for better distinction
const COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#eab308", // yellow
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
  "#22c55e", // green
];

export const ProfitabilityEvolutionChart = ({ stats, dateRange }: ProfitabilityEvolutionChartProps) => {
  // Initialize with top performers (by profitability)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const top = stats.slice(0, Math.min(5, stats.length)).map(s => s.id);
    return new Set(top);
  });
  const [open, setOpen] = useState(false);

  // Update selection when stats change
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(stats.map(s => s.id));
      const filtered = [...prev].filter(id => validIds.has(id));
      if (filtered.length === 0 && stats.length > 0) {
        return new Set(stats.slice(0, Math.min(5, stats.length)).map(s => s.id));
      }
      return new Set(filtered);
    });
  }, [stats]);

  const selectedStats = useMemo(() => 
    stats.filter(s => selectedIds.has(s.id)), 
    [stats, selectedIds]
  );

  const chartData = useMemo(() => {
    const allDates = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    
    return allDates.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dataPoint: Record<string, any> = {
        date: dateStr,
        dateLabel: format(date, "d MMM", { locale: fr }),
      };
      
      selectedStats.forEach(restaurant => {
        const dayData = restaurant.dailyData[dateStr];
        if (dayData && dayData.sales > 0) {
          dataPoint[restaurant.id] = (dayData.payout / dayData.sales) * 100;
        } else {
          dataPoint[restaurant.id] = null;
        }
      });
      
      return dataPoint;
    });
  }, [selectedStats, dateRange]);

  // Calculate dynamic Y-axis domain based on actual data
  const { minY, maxY } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    chartData.forEach(day => {
      selectedStats.forEach(r => {
        const val = day[r.id];
        if (val !== null && val !== undefined) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      });
    });
    if (min === Infinity || max === -Infinity) {
      return { minY: 50, maxY: 80 };
    }
    const margin = (max - min) * 0.15 || 5;
    return { 
      minY: Math.floor(Math.max(0, min - margin)), 
      maxY: Math.ceil(Math.min(100, max + margin)) 
    };
  }, [chartData, selectedStats]);

  // Calculate average profitability for selected restaurants
  const avgProfitability = useMemo(() => {
    if (selectedStats.length === 0) return 0;
    const totalProfit = selectedStats.reduce((sum, s) => sum + s.profitability, 0);
    return totalProfit / selectedStats.length;
  }, [selectedStats]);

  const toggleRestaurant = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else if (newSet.size < MAX_SELECTION) {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getShortName = (name: string) => {
    // Si le nom contient "CHICKEN STREET", utiliser "CS" + ville
    if (name.toUpperCase().includes("CHICKEN STREET")) {
      const cityPart = name.replace(/chicken street\s*/i, "").trim();
      // Formater la ville en Title Case
      const formattedCity = cityPart
        .toLowerCase()
        .split(/[\s-]+/)
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return `CS ${formattedCity}`;
    }
    
    // Sinon, retourner le nom tel quel (tronqué si trop long)
    return name.length > 20 ? name.substring(0, 17) + "..." : name;
  };

  if (!stats.length) {
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
    <div className="space-y-4">
      {/* Restaurant selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span>{selectedIds.size} restaurant{selectedIds.size > 1 ? 's' : ''}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b flex justify-between items-center">
              <span className="text-sm font-medium">Sélectionner (max {MAX_SELECTION})</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set(stats.slice(0, MAX_SELECTION).map(s => s.id)))}
                >
                  Top {MAX_SELECTION}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Aucun
                </Button>
              </div>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2 space-y-1">
                {stats.map((restaurant, index) => {
                  const isSelected = selectedIds.has(restaurant.id);
                  const isDisabled = !isSelected && selectedIds.size >= MAX_SELECTION;
                  return (
                    <div
                      key={restaurant.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${isDisabled ? 'opacity-50' : ''}`}
                      onClick={() => !isDisabled && toggleRestaurant(restaurant.id)}
                    >
                      <Checkbox checked={isSelected} disabled={isDisabled} />
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm truncate flex-1">{getShortName(restaurant.name)}</span>
                      <span className="text-xs text-muted-foreground">{restaurant.profitability.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Selected badges */}
        <div className="flex flex-wrap gap-1">
          {selectedStats.map((restaurant, idx) => {
            const originalIndex = stats.findIndex(s => s.id === restaurant.id);
            return (
              <Badge
                key={restaurant.id}
                variant="outline"
                className="text-xs gap-1.5 py-0.5"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[originalIndex % COLORS.length] }}
                />
                {getShortName(restaurant.name)}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[350px]">
        {selectedStats.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Sélectionnez au moins un restaurant
          </div>
        ) : (
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
                domain={[minY, maxY]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              
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
              
              {selectedStats.map((restaurant) => {
                const originalIndex = stats.findIndex(s => s.id === restaurant.id);
                return (
                  <Line
                    key={restaurant.id}
                    type="monotone"
                    dataKey={restaurant.id}
                    name={restaurant.name}
                    stroke={COLORS[originalIndex % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
