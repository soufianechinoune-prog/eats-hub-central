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
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <div className="max-h-[640px] overflow-y-auto divide-y divide-border/40">
          {filteredAndSortedStats.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Aucun restaurant trouvé pour "{searchQuery}"
            </div>
          ) : (
            filteredAndSortedStats.map((stat, index) => {
              const barWidth = stat.availabilityRate;
              const status = getStatusLabel(stat.availabilityRate);
              const cityName = extractCityName(stat.name);
              const showMedal = sortDirection === "desc" && !searchQuery && index < 3;
              const isPerfect = stat.availabilityRate === 100;

              const rankBadgeClass = showMedal
                ? index === 0
                  ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                  : index === 1
                    ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30"
                    : "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30"
                : "";

              const statusBgClass = isPerfect
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : stat.availabilityRate >= 99
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : stat.availabilityRate >= 98
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                    : stat.availabilityRate >= 95
                      ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                      : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400";

              return (
                <motion.div
                  key={stat.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.4) }}
                  className="group flex items-center gap-4 md:gap-6 px-4 md:px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => handleRestaurantClick(stat.id)}
                >
                  {/* Rank */}
                  <div className="w-7 flex justify-center shrink-0">
                    {showMedal ? (
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shadow-sm",
                        rankBadgeClass
                      )}>
                        {index + 1}
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="w-40 md:w-52 shrink-0 min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate block">
                          {cityName}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{stat.name}</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Bar + status badge */}
                  <div className="flex-1 flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.7, ease: "easeOut", delay: Math.min(index * 0.02, 0.4) }}
                        className={cn(
                          "h-full rounded-full",
                          getBarColor(stat.availabilityRate),
                          isPerfect && "shadow-[0_0_8px_hsl(var(--primary)/0.15)]"
                        )}
                      />
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-center w-[96px] shrink-0",
                      statusBgClass
                    )}>
                      {status.text}
                    </span>
                  </div>

                  {/* Numeric */}
                  <div className="w-24 md:w-28 text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums text-foreground">
                      {stat.availabilityRate.toFixed(1)}%
                    </div>
                    <div className={cn(
                      "text-[10px] font-medium tabular-nums",
                      isPerfect ? "text-muted-foreground" : "text-rose-500"
                    )}>
                      {formatMinutesToDisplay(stat.totalOfflineMinutes)}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
