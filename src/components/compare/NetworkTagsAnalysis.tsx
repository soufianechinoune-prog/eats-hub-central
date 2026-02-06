import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react";
import { getTagLabel, isNegativeTag } from "@/lib/reviewTagLabels";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface TagData {
  tag: string;
  count: number;
}

interface NetworkTagsAnalysisProps {
  reviews: Array<{ tags?: string[] | null }>;
}

export function NetworkTagsAnalysis({ reviews }: NetworkTagsAnalysisProps) {
  // Aggregate all tags
  const tagCounts: Record<string, number> = {};
  
  reviews.forEach(review => {
    if (review.tags) {
      review.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });

  // Split into positive and negative
  const positiveTags: TagData[] = [];
  const negativeTags: TagData[] = [];

  Object.entries(tagCounts).forEach(([tag, count]) => {
    const data = { tag: getTagLabel(tag), count };
    if (isNegativeTag(tag)) {
      negativeTags.push(data);
    } else {
      positiveTags.push(data);
    }
  });

  // Sort by count descending and take top 5
  positiveTags.sort((a, b) => b.count - a.count);
  negativeTags.sort((a, b) => b.count - a.count);

  const topPositive = positiveTags.slice(0, 5);
  const topNegative = negativeTags.slice(0, 5);

  const maxCount = Math.max(
    ...topPositive.map(p => p.count),
    ...topNegative.map(n => n.count),
    1
  );

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

  const totalTags = Object.values(tagCounts).reduce((a, b) => a + b, 0);

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Analyse des Tags Réseau
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({totalTags} tags collectés)
          </span>
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
              <span className="font-medium text-sm">Points forts du réseau</span>
            </div>
            {topPositive.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={topPositive} 
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, maxCount]} />
                  <YAxis 
                    type="category" 
                    dataKey="tag" 
                    width={130}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {topPositive.map((_, index) => (
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
            {topNegative.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={topNegative} 
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, maxCount]} />
                  <YAxis 
                    type="category" 
                    dataKey="tag" 
                    width={130}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {topNegative.map((_, index) => (
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
