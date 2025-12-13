import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTagLabel, isNegativeTag } from "@/lib/reviewTagLabels";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface TagsBarChartProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  selectedTags?: string[];
}

export function TagsBarChart({ tags, onTagClick, selectedTags = [] }: TagsBarChartProps) {
  const tagStats = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    
    const sorted = Object.entries(tagCounts)
      .map(([tag, count]) => ({ 
        tag, 
        count, 
        label: getTagLabel(tag), 
        isNegative: isNegativeTag(tag) 
      }))
      .sort((a, b) => b.count - a.count);
    
    // Separate positive and negative, take top 5 of each
    const positive = sorted.filter(t => !t.isNegative).slice(0, 5);
    const negative = sorted.filter(t => t.isNegative).slice(0, 5);
    
    return { positive, negative, maxCount: Math.max(...sorted.map(t => t.count), 1) };
  }, [tags]);

  const renderBar = (item: { tag: string; count: number; label: string; isNegative: boolean }) => {
    const percentage = (item.count / tagStats.maxCount) * 100;
    const isSelected = selectedTags.includes(item.tag);
    
    return (
      <div 
        key={item.tag} 
        className={`group cursor-pointer transition-all duration-200 ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
        onClick={() => onTagClick?.(item.tag)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium truncate flex-1 ${
            isSelected ? (item.isNegative ? 'text-destructive' : 'text-emerald-600') : 'text-muted-foreground'
          }`}>
            {item.label}
          </span>
          <span className="text-xs font-semibold tabular-nums">{item.count}</span>
        </div>
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              item.isNegative 
                ? isSelected ? 'bg-destructive' : 'bg-destructive/60 group-hover:bg-destructive/80'
                : isSelected ? 'bg-emerald-500' : 'bg-emerald-500/60 group-hover:bg-emerald-500/80'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (tagStats.positive.length === 0 && tagStats.negative.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tags les plus mentionnés</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Positive Tags */}
          {tagStats.positive.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                <ThumbsUp className="h-3.5 w-3.5" />
                Points positifs
              </div>
              <div className="space-y-2">
                {tagStats.positive.map(renderBar)}
              </div>
            </div>
          )}
          
          {/* Negative Tags */}
          {tagStats.negative.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                <ThumbsDown className="h-3.5 w-3.5" />
                Points à améliorer
              </div>
              <div className="space-y-2">
                {tagStats.negative.map(renderBar)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
