import { useMemo, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, GitCompareArrows, TrendingUp, TrendingDown, Minus, FileDown, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface RankedRestaurant {
  id: string;
  name: string;
  city: string;
  value: number;
  prevValue: number;
  trend: number | null;
  rank: number;
}

interface MonthlyDataPoint {
  restaurant_id: string;
  month: number;
  value: number;
}

interface RestaurantComparisonPanelProps {
  selectedRestaurants: RankedRestaurant[];
  onRemove: (id: string) => void;
  onClear: () => void;
  monthlyData: MonthlyDataPoint[];
  metricLabel: string;
  formatValue: (v: number) => string;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
];

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function RestaurantComparisonPanel({
  selectedRestaurants,
  onRemove,
  onClear,
  monthlyData,
  metricLabel,
  formatValue,
}: RestaurantComparisonPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(async () => {
    if (!contentRef.current || selectedRestaurants.length === 0) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Comparaison de restaurants", margin, 20);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100);
      const restaurantNames = selectedRestaurants.map(r => r.name).join(" vs ");
      pdf.text(restaurantNames.length > 80 ? restaurantNames.substring(0, 80) + "..." : restaurantNames, margin, 28);
      pdf.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, margin, 34);

      // Content
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const startY = 42;

      if (imgHeight > pageHeight - startY - 15) {
        const scaleFactor = (pageHeight - startY - 15) / imgHeight;
        pdf.addImage(imgData, "PNG", margin, startY, imgWidth * scaleFactor, imgHeight * scaleFactor);
      } else {
        pdf.addImage(imgData, "PNG", margin, startY, imgWidth, imgHeight);
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text("CS Delivery Performance", margin, pageHeight - 10);

      pdf.save(`comparaison-restaurants-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
    } finally {
      setIsExporting(false);
    }
  }, [selectedRestaurants]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    return months.map(month => {
      const point: Record<string, any> = { month, monthLabel: MONTHS[month - 1] };
      
      selectedRestaurants.forEach(restaurant => {
        const dataPoint = monthlyData.find(
          d => d.restaurant_id === restaurant.id && d.month === month
        );
        point[restaurant.id] = dataPoint?.value || 0;
      });
      
      return point;
    });
  }, [selectedRestaurants, monthlyData]);

  const comparisonBarData = useMemo(() => {
    return selectedRestaurants.map((restaurant, index) => ({
      name: restaurant.name.length > 20 ? restaurant.name.substring(0, 20) + "..." : restaurant.name,
      fullName: restaurant.name,
      current: restaurant.value,
      previous: restaurant.prevValue,
      fill: COLORS[index],
    }));
  }, [selectedRestaurants]);

  if (selectedRestaurants.length === 0) return null;

  const maxValue = Math.max(...selectedRestaurants.map(r => r.value));
  const minValue = Math.min(...selectedRestaurants.map(r => r.value));
  const diff = maxValue - minValue;
  const diffPercent = minValue > 0 ? ((diff / minValue) * 100).toFixed(1) : "N/A";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium">
              Comparaison ({selectedRestaurants.length}/3 restaurants)
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToPdf}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span className="ml-1">PDF</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Effacer
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedRestaurants.map((restaurant, index) => (
            <Badge
              key={restaurant.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
              style={{ borderLeft: `3px solid ${COLORS[index]}` }}
            >
              <span className="text-xs font-medium">#{restaurant.rank}</span>
              <span className="truncate max-w-[120px]">{restaurant.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:bg-destructive/20"
                onClick={() => onRemove(restaurant.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6" ref={contentRef}>
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {selectedRestaurants.map((restaurant, index) => (
            <div
              key={restaurant.id}
              className="p-3 rounded-lg bg-background border"
              style={{ borderLeftWidth: "3px", borderLeftColor: COLORS[index] }}
            >
              <p className="text-xs text-muted-foreground truncate">{restaurant.name}</p>
              <p className="text-lg font-bold mt-1">{formatValue(restaurant.value)}</p>
              <div className="flex items-center gap-1 mt-1">
                {restaurant.trend !== null ? (
                  restaurant.trend >= 0 ? (
                    <div className="flex items-center gap-0.5 text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-xs">+{restaurant.trend.toFixed(1)}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 text-red-600">
                      <TrendingDown className="h-3 w-3" />
                      <span className="text-xs">{restaurant.trend.toFixed(1)}%</span>
                    </div>
                  )
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ecart */}
        <div className="flex items-center justify-center gap-4 py-2 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Écart max</p>
            <p className="text-lg font-semibold">{formatValue(diff)}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Différence</p>
            <p className="text-lg font-semibold">{diffPercent}%</p>
          </div>
        </div>

        {/* Evolution Chart */}
        <div>
          <p className="text-sm font-medium mb-3">Évolution mensuelle</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 10 }} 
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  className="text-muted-foreground"
                  tickFormatter={(value) => {
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                    return value.toFixed(0);
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => {
                    const restaurant = selectedRestaurants.find(r => r.id === name);
                    return [formatValue(value), restaurant?.name || name];
                  }}
                />
                {selectedRestaurants.map((restaurant, index) => (
                  <Line
                    key={restaurant.id}
                    type="monotone"
                    dataKey={restaurant.id}
                    name={restaurant.id}
                    stroke={COLORS[index]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Comparison Bar Chart */}
        <div>
          <p className="text-sm font-medium mb-3">Comparaison N vs N-1</p>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonBarData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                    return value.toFixed(0);
                  }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [
                    formatValue(value),
                    name === "current" ? "Actuel" : "N-1"
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return payload[0].payload.fullName;
                    }
                    return label;
                  }}
                />
                <Bar dataKey="current" name="current" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="previous" name="previous" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-xs text-muted-foreground">Actuel</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted-foreground opacity-50" />
              <span className="text-xs text-muted-foreground">N-1</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
