import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from "recharts";
import { MonthlyApprovalRate } from "@/hooks/useMenuItemReviewsStats";

interface ApprovalRateChartProps {
  data: MonthlyApprovalRate[];
}

export function ApprovalRateChart({ data }: ApprovalRateChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{d.monthLabel} {d.month.split("-")[0]}</p>
          <p className="text-sm mt-1">
            Taux d'approbation: <strong>{d.approvalRate.toFixed(1)}%</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {d.thumbsUp} 👍 / {d.thumbsDown} 👎 ({d.totalReviews} avis)
          </p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Évolution du Taux d'Approbation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Aucune donnée disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Évolution du Taux d'Approbation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            {/* Zones de couleur */}
            <ReferenceArea y1={80} y2={100} fill="hsl(142 70% 45%)" fillOpacity={0.1} />
            <ReferenceArea y1={60} y2={80} fill="hsl(45 90% 50%)" fillOpacity={0.1} />
            <ReferenceArea y1={0} y2={60} fill="hsl(0 70% 50%)" fillOpacity={0.1} />
            
            <XAxis 
              dataKey="monthLabel" 
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="approvalRate"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
