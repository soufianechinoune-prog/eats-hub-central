import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface TagStats {
  tag: string;
  count: number;
  isPositive: boolean;
}

interface TagsAnalysisChartProps {
  positive: TagStats[];
  negative: TagStats[];
}

export function TagsAnalysisChart({ positive, negative }: TagsAnalysisChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{data.tag}</p>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>{data.count}</strong> mentions
          </p>
        </div>
      );
    }
    return null;
  };

  const maxCount = Math.max(
    ...positive.map(p => p.count),
    ...negative.map(n => n.count),
    1
  );

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Analyse des Tags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Tags positifs */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-full bg-emerald-500/10">
                <ThumbsUp className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="font-medium text-sm">Points forts</span>
            </div>
            {positive.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={positive.slice(0, 5)} 
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, maxCount]} />
                  <YAxis 
                    type="category" 
                    dataKey="tag" 
                    width={120}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {positive.slice(0, 5).map((entry, index) => (
                      <Cell 
                        key={`cell-pos-${index}`} 
                        fill={`hsl(142 ${70 - index * 10}% ${40 + index * 5}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Aucun tag positif
              </div>
            )}
          </div>

          {/* Tags négatifs */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-full bg-red-500/10">
                <ThumbsDown className="h-4 w-4 text-red-500" />
              </div>
              <span className="font-medium text-sm">Points à améliorer</span>
            </div>
            {negative.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={negative.slice(0, 5)} 
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, maxCount]} />
                  <YAxis 
                    type="category" 
                    dataKey="tag" 
                    width={120}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {negative.slice(0, 5).map((entry, index) => (
                      <Cell 
                        key={`cell-neg-${index}`} 
                        fill={`hsl(0 ${80 - index * 10}% ${50 + index * 5}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Aucun tag négatif
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
