import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { ProductStats } from "@/hooks/useMenuItemReviewsStats";

interface TopFlopProductsChartProps {
  topProducts: ProductStats[];
  flopProducts: ProductStats[];
}

export function TopFlopProductsChart({ topProducts, flopProducts }: TopFlopProductsChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg max-w-[200px]">
          <p className="font-medium text-sm truncate">{d.itemTitle}</p>
          <p className="text-sm mt-1">
            Taux: <strong>{d.approvalRate.toFixed(1)}%</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {d.thumbsUp} 👍 / {d.thumbsDown} 👎 ({d.count} avis)
          </p>
        </div>
      );
    }
    return null;
  };

  // Tronquer les noms longs pour l'affichage
  const truncateName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + "...";
  };

  const topData = topProducts.map(p => ({
    ...p,
    displayName: truncateName(p.itemTitle)
  }));

  const flopData = flopProducts.map(p => ({
    ...p,
    displayName: truncateName(p.itemTitle)
  }));

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "";
  };

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">Top & Flop Produits</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Top produits */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-full bg-emerald-500/10">
                <Award className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="font-medium text-sm">Top 5</span>
            </div>
            {topData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={topData} 
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis 
                    type="category" 
                    dataKey="displayName" 
                    width={100}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value, index) => `${getMedal(index)} ${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="approvalRate" radius={[0, 4, 4, 0]}>
                    {topData.map((entry, index) => (
                      <Cell 
                        key={`cell-top-${index}`} 
                        fill={`hsl(142 ${70 - index * 10}% ${40 + index * 5}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Aucun produit
              </div>
            )}
          </div>

          {/* Flop produits */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-full bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <span className="font-medium text-sm">À améliorer</span>
            </div>
            {flopData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={flopData} 
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis 
                    type="category" 
                    dataKey="displayName" 
                    width={100}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="approvalRate" radius={[0, 4, 4, 0]}>
                    {flopData.map((entry, index) => (
                      <Cell 
                        key={`cell-flop-${index}`} 
                        fill={`hsl(0 ${80 - index * 10}% ${50 + index * 5}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Aucun produit
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
