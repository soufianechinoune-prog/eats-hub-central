import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Clock, TrendingUp, Euro, ShoppingBag } from "lucide-react";

interface HourlyData {
  hour: number;
  label: string;
  sales_incl_vat: number;
  refund_incl_vat: number;
  order_count: number;
  avg_basket: number;
}

interface HourlySummary {
  totalSales: number;
  totalRefund: number;
  totalOrders: number;
  avgBasket: number;
  peakHour?: number;
  peakHourOrders?: number;
}

interface HourlyBreakdownChartProps {
  data: HourlyData[];
  summary: HourlySummary | null;
}

export function HourlyBreakdownChart({ data, summary }: HourlyBreakdownChartProps) {
  const formatCurrency = (value: number) => 
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

  // Get color based on relative performance
  const getBarColor = (hourData: HourlyData) => {
    if (!data.length) return "hsl(var(--primary))";
    
    const maxOrders = Math.max(...data.map(d => d.order_count));
    const ratio = hourData.order_count / maxOrders;
    
    if (ratio >= 0.8) return "hsl(var(--chart-1))"; // Peak hours
    if (ratio >= 0.5) return "hsl(var(--chart-2))"; // Medium
    return "hsl(var(--chart-3))"; // Low
  };

  if (!data.length) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Aucune donnée disponible pour cette période
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <Euro className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{formatCurrency(summary.totalSales)}</div>
              <div className="text-xs text-muted-foreground">CA total</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <ShoppingBag className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{summary.totalOrders}</div>
              <div className="text-xs text-muted-foreground">Commandes</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{formatCurrency(summary.avgBasket)}</div>
              <div className="text-xs text-muted-foreground">Panier moyen</div>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold text-primary">{summary.peakHour}h</div>
              <div className="text-xs text-muted-foreground">
                Pic ({summary.peakHourOrders} cmd)
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hourly chart */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              yAxisId="left"
            />
            <YAxis 
              orientation="right"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              yAxisId="right"
              tickFormatter={(v) => `${v}€`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                if (name === "Commandes") return [value, name];
                return [formatCurrency(value), name];
              }}
              labelFormatter={(label) => `${label}`}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Bar 
              dataKey="order_count" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
              name="Commandes"
              yAxisId="left"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.hour === summary?.peakHour ? "hsl(var(--chart-1))" : "hsl(var(--primary))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[hsl(var(--chart-1))]"></span>
          Heure de pointe
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[hsl(var(--primary))]"></span>
          Autres heures
        </span>
      </div>
    </div>
  );
}
