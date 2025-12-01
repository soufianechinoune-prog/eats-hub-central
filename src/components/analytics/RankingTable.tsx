import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Trophy,
  Medal,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  GitCompareArrows,
} from "lucide-react";

interface RankedRestaurant {
  id: string;
  name: string;
  city: string;
  value: number;
  prevValue: number;
  trend: number | null;
  rank: number;
}

interface RankedRestaurantWithPrevRank extends RankedRestaurant {
  prevRank: number | null;
  rankChange: number | null;
}

interface RankingTableProps {
  ranking: RankedRestaurant[];
  metricLabel: string;
  formatValue: (v: number) => string;
  selectedForComparison?: string[];
  onToggleComparison?: (restaurant: RankedRestaurant) => void;
}

type SortField = "rank" | "name" | "city" | "value" | "prevValue" | "trend" | "rankChange";
type SortDirection = "asc" | "desc";

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return (
    <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-muted-foreground">
      {rank}
    </span>
  );
}

function TrendIndicator({ trend }: { trend: number | null }) {
  if (trend === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  
  const isPositive = trend > 0;
  const isNeutral = Math.abs(trend) < 1;
  
  if (isNeutral) return <Minus className="h-4 w-4 text-muted-foreground" />;
  
  return isPositive ? (
    <div className="flex items-center gap-1 text-emerald-600">
      <TrendingUp className="h-4 w-4" />
      <span className="text-xs font-medium">+{trend.toFixed(1)}%</span>
    </div>
  ) : (
    <div className="flex items-center gap-1 text-red-600">
      <TrendingDown className="h-4 w-4" />
      <span className="text-xs font-medium">{trend.toFixed(1)}%</span>
    </div>
  );
}

function RankChangeIndicator({ change }: { change: number | null }) {
  if (change === null || change === 0) {
    return (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }
  
  // Positive change means rank improved (e.g., from 5 to 3 = +2 positions gained)
  const isPositive = change > 0;
  
  return isPositive ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 text-emerald-600">
            <ChevronUp className="h-4 w-4" />
            <span className="text-xs font-semibold">{change}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{change} position{change > 1 ? "s" : ""} gagnée{change > 1 ? "s" : ""}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 text-red-600">
            <ChevronDown className="h-4 w-4" />
            <span className="text-xs font-semibold">{Math.abs(change)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{Math.abs(change)} position{Math.abs(change) > 1 ? "s" : ""} perdue{Math.abs(change) > 1 ? "s" : ""}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RankingTable({ ranking, metricLabel, formatValue, selectedForComparison = [], onToggleComparison }: RankingTableProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Calculate previous ranks based on prevValue
  const rankingWithPrevRank = useMemo((): RankedRestaurantWithPrevRank[] => {
    // Sort by prevValue to get previous ranks
    const sortedByPrev = [...ranking]
      .filter(r => r.prevValue > 0)
      .sort((a, b) => b.prevValue - a.prevValue);
    
    const prevRankMap = new Map<string, number>();
    sortedByPrev.forEach((r, idx) => {
      prevRankMap.set(r.id, idx + 1);
    });
    
    return ranking.map(r => {
      const prevRank = prevRankMap.get(r.id) || null;
      const rankChange = prevRank !== null ? prevRank - r.rank : null;
      return { ...r, prevRank, rankChange };
    });
  }, [ranking]);

  const filteredAndSorted = useMemo(() => {
    let result = [...rankingWithPrevRank];
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        r => r.name.toLowerCase().includes(searchLower) || 
             r.city.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "rank":
          comparison = a.rank - b.rank;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "city":
          comparison = (a.city || "").localeCompare(b.city || "");
          break;
        case "value":
          comparison = a.value - b.value;
          break;
        case "prevValue":
          comparison = a.prevValue - b.prevValue;
          break;
        case "trend":
          comparison = (a.trend || 0) - (b.trend || 0);
          break;
        case "rankChange":
          comparison = (a.rankChange || 0) - (b.rankChange || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return result;
  }, [rankingWithPrevRank, search, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, page]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "rank" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const exportCSV = () => {
    const headers = ["Rang", "Δ Position", "Restaurant", "Ville", "Valeur actuelle", "Valeur N-1", "Variation %"];
    const rows = filteredAndSorted.map(r => [
      r.rank,
      r.rankChange !== null ? (r.rankChange > 0 ? `+${r.rankChange}` : r.rankChange) : "",
      r.name,
      r.city || "",
      r.value,
      r.prevValue,
      r.trend !== null ? r.trend.toFixed(1) : ""
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `classement_${metricLabel.toLowerCase().replace(/\s/g, "_")}.csv`);
    link.click();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Classement complet ({filteredAndSorted.length} restaurants)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un restaurant..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {onToggleComparison && (
                  <TableHead className="w-[40px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center">
                            <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Comparer (max 3)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                )}
                <TableHead 
                  className="w-[60px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("rank")}
                >
                  <div className="flex items-center">
                    Rang
                    <SortIcon field="rank" />
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[60px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("rankChange")}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center">
                          Δ
                          <SortIcon field="rankChange" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Variation de position vs N-1</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Restaurant
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("city")}
                >
                  <div className="flex items-center">
                    Ville
                    <SortIcon field="city" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("value")}
                >
                  <div className="flex items-center justify-end">
                    {metricLabel}
                    <SortIcon field="value" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("prevValue")}
                >
                  <div className="flex items-center justify-end">
                    N-1
                    <SortIcon field="prevValue" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("trend")}
                >
                  <div className="flex items-center justify-end">
                    Variation
                    <SortIcon field="trend" />
                  </div>
                </TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onToggleComparison ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    Aucun résultat trouvé
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((restaurant) => {
                  const isSelected = selectedForComparison.includes(restaurant.id);
                  const canSelect = selectedForComparison.length < 3 || isSelected;
                  
                  return (
                    <TableRow 
                      key={restaurant.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                    >
                      {onToggleComparison && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            disabled={!canSelect}
                            onCheckedChange={() => onToggleComparison(restaurant)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <RankMedal rank={restaurant.rank} />
                      </TableCell>
                      <TableCell>
                        <RankChangeIndicator change={restaurant.rankChange} />
                      </TableCell>
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate max-w-[200px] block">
                                {restaurant.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{restaurant.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {restaurant.city || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatValue(restaurant.value)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {restaurant.prevValue > 0 ? formatValue(restaurant.prevValue) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <TrendIndicator trend={restaurant.trend} />
                      </TableCell>
                      <TableCell>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
