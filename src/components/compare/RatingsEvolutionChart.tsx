import { useMemo, useState } from "react";
import { format, eachDayOfInterval, parseISO, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

interface Review {
  review_date: string | null;
  overall_rating: number | null;
}

interface RatingsEvolutionChartProps {
  reviews: Review[];
  dateRange: { start: Date; end: Date };
}

const getRatingColor = (rating: number) => {
  if (rating >= 4.5) return "hsl(var(--chart-2))"; // green
  if (rating >= 3.5) return "hsl(var(--chart-4))"; // amber
  return "hsl(var(--destructive))"; // red
};

export function RatingsEvolutionChart({ reviews, dateRange }: RatingsEvolutionChartProps) {
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  
  // Calculate if we're in drill-down mode
  const isDrillDown = currentMonth !== null;
  
  // Determine the date range to use
  const effectiveDateRange = useMemo(() => {
    if (currentMonth) {
      return {
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      };
    }
    return dateRange;
  }, [currentMonth, dateRange]);

  // Process data for the chart
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({
      start: effectiveDateRange.start,
      end: effectiveDateRange.end,
    });

    const dailyData: Record<string, { sum: number; count: number }> = {};
    
    reviews.forEach((review) => {
      if (review.review_date && review.overall_rating) {
        const date = format(parseISO(review.review_date), "yyyy-MM-dd");
        if (!dailyData[date]) dailyData[date] = { sum: 0, count: 0 };
        dailyData[date].sum += review.overall_rating;
        dailyData[date].count += 1;
      }
    });

    return days.map((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const data = dailyData[dateKey];
      const avgRating = data && data.count > 0 ? data.sum / data.count : null;
      
      return {
        date: dateKey,
        label: format(day, "d", { locale: fr }),
        fullDate: format(day, "d MMM", { locale: fr }),
        rating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
        count: data?.count || 0,
      };
    });
  }, [reviews, effectiveDateRange]);

  // Calculate rolling average (7 days)
  const chartDataWithAverage = useMemo(() => {
    return chartData.map((item, index) => {
      const windowStart = Math.max(0, index - 6);
      const window = chartData.slice(windowStart, index + 1);
      const validRatings = window.filter(d => d.rating !== null).map(d => d.rating as number);
      const rollingAvg = validRatings.length > 0 
        ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length 
        : null;
      
      return {
        ...item,
        rollingAvg: rollingAvg ? parseFloat(rollingAvg.toFixed(2)) : null,
      };
    });
  }, [chartData]);

  // Calculate period stats
  const periodStats = useMemo(() => {
    const validRatings = chartData.filter(d => d.rating !== null);
    if (validRatings.length === 0) return { avg: 0, change: 0 };
    
    const avg = validRatings.reduce((sum, d) => sum + (d.rating || 0), 0) / validRatings.length;
    
    // Calculate change vs previous period
    const midPoint = Math.floor(validRatings.length / 2);
    const firstHalf = validRatings.slice(0, midPoint);
    const secondHalf = validRatings.slice(midPoint);
    
    const firstAvg = firstHalf.length > 0 
      ? firstHalf.reduce((sum, d) => sum + (d.rating || 0), 0) / firstHalf.length 
      : 0;
    const secondAvg = secondHalf.length > 0 
      ? secondHalf.reduce((sum, d) => sum + (d.rating || 0), 0) / secondHalf.length 
      : 0;
    
    return {
      avg: parseFloat(avg.toFixed(2)),
      change: parseFloat((secondAvg - firstAvg).toFixed(2)),
    };
  }, [chartData]);

  const handlePrevMonth = () => {
    if (currentMonth) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const handleNextMonth = () => {
    if (currentMonth) {
      const next = addMonths(currentMonth, 1);
      if (next <= new Date()) {
        setCurrentMonth(next);
      }
    }
  };

  const handleBack = () => {
    setCurrentMonth(null);
  };

  const handleBarClick = (data: any) => {
    if (!isDrillDown && data && data.date) {
      // Drill down to the month of the clicked bar
      setCurrentMonth(startOfMonth(parseISO(data.date)));
    }
  };

  const periodLabel = useMemo(() => {
    if (currentMonth) {
      return format(currentMonth, "MMMM yyyy", { locale: fr });
    }
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [currentMonth, dateRange]);

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDrillDown && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {isDrillDown && (
              <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {periodLabel}
            </CardTitle>
            {isDrillDown && (
              <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Badge variant="secondary" className="ml-2">
              {periodStats.avg.toFixed(2)}
              {periodStats.change !== 0 && (
                <span className={periodStats.change > 0 ? "text-emerald-500 ml-1" : "text-red-500 ml-1"}>
                  {periodStats.change > 0 ? "▲" : "▼"} {Math.abs(periodStats.change).toFixed(2)}
                </span>
              )}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>Excellent (≥4.5)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-amber-500" />
              <span>Bon (3.5-4.5)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-red-500" />
              <span>À améliorer (&lt;3.5)</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartDataWithAverage.some(d => d.rating !== null) ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartDataWithAverage} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              {/* Background zones */}
              <ReferenceArea y1={4.5} y2={5} fill="hsl(var(--chart-2))" fillOpacity={0.1} />
              <ReferenceArea y1={3.5} y2={4.5} fill="hsl(var(--chart-4))" fillOpacity={0.05} />
              <ReferenceArea y1={0} y2={3.5} fill="hsl(var(--destructive))" fillOpacity={0.05} />
              
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
              <XAxis 
                dataKey="label"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                domain={[4.2, 4.7]}
                tick={{ fill: 'hsl(var(--primary))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === "rating") return [value?.toFixed(2) + " / 5", "Note du jour"];
                  if (name === "rollingAvg") return [value?.toFixed(2), "Moyenne mobile"];
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `${payload[0].payload.fullDate} (${payload[0].payload.count} avis)`;
                  }
                  return label;
                }}
              />
              
              {/* Reference lines */}
              <ReferenceLine y={4.5} stroke="hsl(var(--chart-2))" strokeDasharray="5 5" strokeOpacity={0.5} />
              <ReferenceLine y={3.5} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" strokeOpacity={0.5} />
              
              <Bar 
                dataKey="rating" 
                radius={[4, 4, 0, 0]}
                onClick={(data) => handleBarClick(data)}
                cursor={!isDrillDown ? "pointer" : "default"}
              >
                {chartDataWithAverage.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.rating ? getRatingColor(entry.rating) : "hsl(var(--muted))"}
                  />
                ))}
              </Bar>
              
              <Line
                type="monotone"
                dataKey="rollingAvg"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                yAxisId="right"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Aucune donnée disponible pour cette période
          </div>
        )}
      </CardContent>
    </Card>
  );
}
