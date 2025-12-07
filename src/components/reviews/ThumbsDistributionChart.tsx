import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from "recharts";

interface ThumbsDistributionChartProps {
  thumbsUp: number;
  thumbsDown: number;
  approvalRate: number;
}

export function ThumbsDistributionChart({ thumbsUp, thumbsDown, approvalRate }: ThumbsDistributionChartProps) {
  const data = [
    { name: "Positifs", value: thumbsUp, emoji: "👍" },
    { name: "Négatifs", value: thumbsDown, emoji: "👎" }
  ];

  const COLORS = ["hsl(142 70% 45%)", "hsl(0 70% 50%)"];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{d.emoji} {d.name}</p>
          <p className="text-sm mt-1">
            <strong>{d.value}</strong> avis
          </p>
        </div>
      );
    }
    return null;
  };

  const total = thumbsUp + thumbsDown;

  if (total === 0) {
    return (
      <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Répartition des Avis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
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
          <PieChartIcon className="h-5 w-5 text-primary" />
          Répartition des Avis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Centre du donut */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold">{approvalRate.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Approbation</div>
            </div>
          </div>
        </div>
        
        {/* Légende */}
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm">{thumbsUp} 👍</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm">{thumbsDown} 👎</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
