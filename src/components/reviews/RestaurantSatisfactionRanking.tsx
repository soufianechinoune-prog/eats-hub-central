import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Building2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MenuItemReview {
  id: string;
  restaurant_id: string;
  tags: string[] | null;
  thumb_up: number | null;
  thumb_down: number | null;
  rating: number;
}

interface Restaurant {
  id: string;
  name: string;
  city: string;
}

interface RestaurantSatisfactionRankingProps {
  reviews: MenuItemReview[];
  restaurants: Restaurant[];
}

// Mapping des catégories vers les tags
const CATEGORY_TAGS = {
  taste: { positive: "item_tasty", negative: "item_not_tasty", label: "Goût" },
  temperature: { positive: "item_perfect_temperature", negative: "item_cold_melted", label: "Température" },
  portion: { positive: "item_good_portion", negative: "item_small_portion", label: "Portion" },
  presentation: { positive: "item_nice_presentation", negative: "item_messy_presentation", label: "Présentation" },
  freshness: { positive: "item_fresh", negative: "item_soggy_leaky", label: "Fraîcheur & texture" },
};

type CategoryKey = keyof typeof CATEGORY_TAGS;

interface CategoryStat {
  positive: number;
  negative: number;
  total: number;
  rate: number | null;
}

interface RestaurantStats {
  restaurantId: string;
  restaurantName: string;
  city: string;
  avgRating: number;
  totalReviews: number;
  categories: Record<CategoryKey, CategoryStat>;
}

// Composant cercle de progression
function CircularProgress({ 
  value, 
  total, 
  size = 48 
}: { 
  value: number | null; 
  total: number;
  size?: number;
}) {
  if (total === 0 || value === null) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ width: size + 20 }}>
        <span className="text-xs text-muted-foreground">-</span>
      </div>
    );
  }

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const remaining = circumference - progress;

  // Couleur selon le pourcentage
  let strokeColor = "hsl(var(--destructive))"; // Rouge < 50%
  let textColor = "text-destructive";
  if (value >= 75) {
    strokeColor = "hsl(142, 71%, 45%)"; // Vert
    textColor = "text-green-600";
  } else if (value >= 50) {
    strokeColor = "hsl(38, 92%, 50%)"; // Orange
    textColor = "text-orange-500";
  }

  return (
    <div className="flex flex-col items-center justify-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${remaining}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${textColor}`}>
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">({total})</span>
    </div>
  );
}

export function RestaurantSatisfactionRanking({ 
  reviews, 
  restaurants 
}: RestaurantSatisfactionRankingProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Calculer les stats par restaurant
  const restaurantStats = useMemo(() => {
    const statsMap = new Map<string, RestaurantStats>();

    // Initialiser pour chaque restaurant
    restaurants.forEach((r) => {
      statsMap.set(r.id, {
        restaurantId: r.id,
        restaurantName: r.name,
        city: r.city,
        avgRating: 0,
        totalReviews: 0,
        categories: {
          taste: { positive: 0, negative: 0, total: 0, rate: null },
          temperature: { positive: 0, negative: 0, total: 0, rate: null },
          portion: { positive: 0, negative: 0, total: 0, rate: null },
          presentation: { positive: 0, negative: 0, total: 0, rate: null },
          freshness: { positive: 0, negative: 0, total: 0, rate: null },
        },
      });
    });

    // Agréger les avis
    let ratingSum = new Map<string, { sum: number; count: number }>();

    reviews.forEach((review) => {
      const stats = statsMap.get(review.restaurant_id);
      if (!stats) return;

      stats.totalReviews += 1;

      // Rating moyen
      if (!ratingSum.has(review.restaurant_id)) {
        ratingSum.set(review.restaurant_id, { sum: 0, count: 0 });
      }
      const rs = ratingSum.get(review.restaurant_id)!;
      rs.sum += review.rating;
      rs.count += 1;

      // Compter les tags par catégorie
      const tags = review.tags || [];
      Object.entries(CATEGORY_TAGS).forEach(([key, config]) => {
        const catKey = key as CategoryKey;
        if (tags.includes(config.positive)) {
          stats.categories[catKey].positive += 1;
        }
        if (tags.includes(config.negative)) {
          stats.categories[catKey].negative += 1;
        }
      });
    });

    // Calculer les moyennes et taux
    statsMap.forEach((stats, restaurantId) => {
      const rs = ratingSum.get(restaurantId);
      if (rs && rs.count > 0) {
        stats.avgRating = rs.sum / rs.count;
      }

      Object.keys(stats.categories).forEach((key) => {
        const catKey = key as CategoryKey;
        const cat = stats.categories[catKey];
        cat.total = cat.positive + cat.negative;
        if (cat.total > 0) {
          cat.rate = (cat.positive / cat.total) * 100;
        }
      });
    });

    return Array.from(statsMap.values())
      .filter((s) => s.totalReviews > 0)
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [reviews, restaurants]);

  // Filtrer par recherche
  const filteredStats = useMemo(() => {
    if (!searchTerm) return restaurantStats;
    const term = searchTerm.toLowerCase();
    return restaurantStats.filter(
      (s) =>
        s.restaurantName.toLowerCase().includes(term) ||
        s.city.toLowerCase().includes(term)
    );
  }, [restaurantStats, searchTerm]);

  const categoryKeys = Object.keys(CATEGORY_TAGS) as CategoryKey[];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Classement des établissements</CardTitle>
          </div>
          <div className="flex items-center gap-4">
            {/* Légende */}
            <div className="hidden md:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">75-100%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">50-74%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-muted-foreground">0-49%</span>
              </div>
            </div>
            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[300px] sticky left-0 bg-muted/50">
                  Établissement
                </TableHead>
                <TableHead className="text-center w-[100px]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 mx-auto">
                        Moy. avis
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Note moyenne des avis produits
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                {categoryKeys.map((key) => (
                  <TableHead key={key} className="text-center min-w-[90px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          {CATEGORY_TAGS[key].label}
                        </TooltipTrigger>
                        <TooltipContent>
                          Taux de satisfaction : {CATEGORY_TAGS[key].label.toLowerCase()}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={7} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    Aucun établissement trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredStats.map((stats) => (
                  <TableRow key={stats.restaurantId} className="hover:bg-muted/30">
                    <TableCell className="sticky left-0 bg-background">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate max-w-[280px]">
                          {stats.restaurantName.replace("CHICKEN STREET ", "")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stats.city}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className="font-bold"
                      >
                        {stats.avgRating.toFixed(1)}
                      </Badge>
                    </TableCell>
                    {categoryKeys.map((key) => (
                      <TableCell key={key} className="text-center">
                        <CircularProgress 
                          value={stats.categories[key].rate} 
                          total={stats.categories[key].total}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
