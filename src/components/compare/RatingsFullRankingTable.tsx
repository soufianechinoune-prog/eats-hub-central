import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RestaurantRating {
  id: string;
  name: string;
  avgRating: number;
  totalReviews: number;
}

interface RatingsFullRankingTableProps {
  data: RestaurantRating[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  dateRange?: { start: Date; end: Date };
}

type SortField = "rank" | "name" | "avgRating" | "totalReviews";
type SortDirection = "asc" | "desc";

const getStatusBadge = (rating: number) => {
  if (rating >= 4.7) {
    return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Excellent</Badge>;
  }
  if (rating >= 4.5) {
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Très bien</Badge>;
  }
  if (rating >= 4.2) {
    return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Bon</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">À surveiller</Badge>;
};

const getBarColor = (rating: number) => {
  if (rating >= 4.7) return "bg-emerald-500";
  if (rating >= 4.5) return "bg-green-500";
  if (rating >= 4.2) return "bg-amber-500";
  return "bg-red-500";
};

export const RatingsFullRankingTable = ({ 
  data, 
  onExportPDF,
  isExporting = false,
  dateRange
}: RatingsFullRankingTableProps) => {
  const navigate = useNavigate();
  const { setSelectedRestaurants, setVisibleRestaurants, setDateRange, setPeriodMode } = useAnalyticsContext();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleRowClick = (restaurantId: string) => {
    // Set the restaurant in context
    setVisibleRestaurants([restaurantId]);
    setSelectedRestaurants([restaurantId]);
    
    // Synchronize the date range from RatingsComparison page
    if (dateRange) {
      setDateRange({ from: dateRange.start, to: dateRange.end });
      setPeriodMode("range");
    }
    
    navigate("/analytics/reviews");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  // Calculate global rank based on original sorted data - must be before filteredAndSortedData
  const rankedData = useMemo(() => {
    const sortedByRating = [...data].sort((a, b) => b.avgRating - a.avgRating);
    const rankMap = new Map<string, number>();
    sortedByRating.forEach((r, idx) => rankMap.set(r.id, idx + 1));
    return rankMap;
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "rank":
          const rankA = rankedData.get(a.id) || 999;
          const rankB = rankedData.get(b.id) || 999;
          comparison = rankA - rankB;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "avgRating":
          comparison = a.avgRating - b.avgRating;
          break;
        case "totalReviews":
          comparison = a.totalReviews - b.totalReviews;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [data, searchQuery, sortField, sortDirection, rankedData]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1 text-primary" />
      : <ArrowDown className="h-4 w-4 ml-1 text-primary" />;
  };

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Classement complet ({data.length} restaurants)
          </CardTitle>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            
            {onExportPDF && (
              <Button 
                onClick={onExportPDF} 
                disabled={isExporting}
                variant="outline"
                className="gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Export...
                  </>
                ) : (
                  <>📄 Export PDF</>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-lg border overflow-hidden max-h-[700px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16 text-center">
                  <button 
                    className="flex items-center justify-center hover:text-foreground transition-colors mx-auto"
                    onClick={() => handleSort("rank")}
                  >
                    #
                    <SortIcon field="rank" />
                  </button>
                </TableHead>
                <TableHead className="min-w-[280px]">
                  <button 
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    Restaurant
                    <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead className="text-center w-24">
                  <button 
                    className="flex items-center justify-center hover:text-foreground transition-colors mx-auto"
                    onClick={() => handleSort("avgRating")}
                  >
                    Note
                    <SortIcon field="avgRating" />
                  </button>
                </TableHead>
                <TableHead className="text-center w-24">
                  <button 
                    className="flex items-center justify-center hover:text-foreground transition-colors mx-auto"
                    onClick={() => handleSort("totalReviews")}
                  >
                    Avis
                    <SortIcon field="totalReviews" />
                  </button>
                </TableHead>
                <TableHead className="text-center w-28">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun restaurant trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((restaurant) => {
                  const rank = rankedData.get(restaurant.id) || 0;
                  return (
                    <TableRow 
                      key={restaurant.id} 
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => handleRowClick(restaurant.id)}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {rank}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="font-medium">{restaurant.name}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden min-w-[400px]">
                              <div 
                                className={`h-full rounded-full ${getBarColor(restaurant.avgRating)}`}
                                style={{ width: `${(restaurant.avgRating / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="font-semibold">{restaurant.avgRating.toFixed(2)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{restaurant.totalReviews}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(restaurant.avgRating)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
