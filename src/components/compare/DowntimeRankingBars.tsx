import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { extractCityName } from "@/lib/restaurantUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface RestaurantStat {
  id: string;
  name: string;
  totalOfflineMinutes: number;
  availabilityRate: number;
}

export type SortDirection = "asc" | "desc";

interface DowntimeRankingBarsProps {
  stats: RestaurantStat[];
  dateRange: { start: Date; end: Date };
  sortDirection: SortDirection;
  onSortDirectionChange: (dir: SortDirection) => void;
}

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const getMedal = (index: number): string => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
};

const getBarColor = (availabilityRate: number): string => {
  if (availabilityRate === 100) return "bg-emerald-500";
  if (availabilityRate >= 99) return "bg-emerald-400";
  if (availabilityRate >= 98) return "bg-amber-400";
  if (availabilityRate >= 95) return "bg-orange-400";
  return "bg-red-500";
};

const getStatusLabel = (availabilityRate: number): { text: string; color: string } => {
  if (availabilityRate === 100) return { text: "Parfait", color: "text-emerald-500" };
  if (availabilityRate >= 99) return { text: "Excellent", color: "text-emerald-400" };
  if (availabilityRate >= 98) return { text: "Bon", color: "text-amber-500" };
  if (availabilityRate >= 95) return { text: "À surveiller", color: "text-orange-500" };
  return { text: "Critique", color: "text-red-500" };
};

export const DowntimeRankingBars = ({ stats, dateRange, sortDirection, onSortDirectionChange }: DowntimeRankingBarsProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { 
    setSelectedRestaurants, 
    setVisibleRestaurants,
    setPeriodMode, 
    setDateRange: setContextDateRange 
  } = useAnalyticsContext();

  // Filter and sort stats
  const filteredAndSortedStats = useMemo(() => {
    let filtered = stats;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = stats.filter(stat => 
        stat.name.toLowerCase().includes(query) ||
        extractCityName(stat.name).toLowerCase().includes(query)
      );
    }
    
    // Apply sort
    return [...filtered].sort((a, b) => {
      if (sortDirection === "desc") {
        return b.availabilityRate - a.availabilityRate; // Best first
      }
      return a.availabilityRate - b.availabilityRate; // Worst first
    });
  }, [stats, searchQuery, sortDirection]);

  const toggleSort = () => {
    onSortDirectionChange(sortDirection === "desc" ? "asc" : "desc");
  };

  const handleRestaurantClick = (restaurantId: string) => {
    // REMPLACER la sélection par ce seul restaurant
    setVisibleRestaurants([restaurantId]);
    setSelectedRestaurants([restaurantId]);
    
    // Utiliser la période de la page Comparaison (range)
    setPeriodMode("range");
    setContextDateRange({ from: dateRange.start, to: dateRange.end });
    
    // Mettre à jour localStorage pour persister le contexte
    const currentState = localStorage.getItem("analytics-context");
    const state = currentState ? JSON.parse(currentState) : {};
    const updatedState = {
      ...state,
      selectedRestaurants: [restaurantId],
      visibleRestaurants: [restaurantId],
      periodMode: "range",
      dateRange: {
        from: dateRange.start.toISOString(),
        to: dateRange.end.toISOString(),
      },
    };
    localStorage.setItem("analytics-context", JSON.stringify(updatedState));
    
    // Naviguer vers l'onglet Disponibilité
    navigate("/analytics/operations?tab=availability");
  };

  if (stats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Sort controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un restaurant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSort}
          className="flex items-center gap-2"
        >
          {sortDirection === "desc" ? (
            <>
              <ArrowDown className="h-4 w-4" />
              <span>Meilleurs d'abord</span>
            </>
          ) : (
            <>
              <ArrowUp className="h-4 w-4" />
              <span>Moins bons d'abord</span>
            </>
          )}
        </Button>
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {filteredAndSortedStats.length} résultat{filteredAndSortedStats.length > 1 ? "s" : ""} sur {stats.length}
        </p>
      )}

      {/* Restaurant list */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {filteredAndSortedStats.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucun restaurant trouvé pour "{searchQuery}"
          </div>
        ) : (
          filteredAndSortedStats.map((stat, index) => {
            const barWidth = stat.availabilityRate;
            const status = getStatusLabel(stat.availabilityRate);
            const cityName = extractCityName(stat.name);
            // Only show medals for top 3 when sorted by best first and no search filter
            const showMedal = sortDirection === "desc" && !searchQuery && index < 3;
            
            return (
              <motion.div
                key={stat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                className="space-y-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
                onClick={() => handleRestaurantClick(stat.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg w-6">{showMedal ? getMedal(index) : ""}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium hover:text-primary transition-colors">{cityName}</span>
                      </TooltipTrigger>
                      <TooltipContent>{stat.name}</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-sm font-medium", status.color)}>
                      {status.text}
                    </span>
                    <span className="font-semibold tabular-nums min-w-[80px] text-right">
                      {stat.availabilityRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: Math.min(index * 0.05, 0.5) }}
                    className={cn("h-full rounded-full", getBarColor(stat.availabilityRate))}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Temps hors ligne: {formatMinutesToDisplay(stat.totalOfflineMinutes)}</span>
                  {stat.availabilityRate === 100 && (
                    <span className="text-emerald-500">✓ 100% en ligne</span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
