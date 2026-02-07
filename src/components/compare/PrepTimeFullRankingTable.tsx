import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface RestaurantPrepTime {
  id: string;
  name: string;
  avgPrepTime: number;
  orderCount: number;
}

interface PrepTimeFullRankingTableProps {
  data: RestaurantPrepTime[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  dateRange?: { start: Date; end: Date };
}

type SortField = "rank" | "name" | "avgPrepTime" | "orderCount";
type SortDirection = "asc" | "desc";

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
};

const getStatusBadge = (prepTime: number) => {
  if (prepTime <= 4) {
    return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Excellent</Badge>;
  }
  if (prepTime <= 5) {
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Très bien</Badge>;
  }
  if (prepTime <= 6) {
    return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Bon</Badge>;
  }
  if (prepTime <= 8) {
    return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">À surveiller</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Lent</Badge>;
};

const getBarColor = (prepTime: number) => {
  if (prepTime <= 4) return "bg-emerald-500";
  if (prepTime <= 5) return "bg-green-500";
  if (prepTime <= 6) return "bg-amber-500";
  if (prepTime <= 8) return "bg-orange-500";
  return "bg-red-500";
};

const ITEMS_PER_PAGE = 25;

export const PrepTimeFullRankingTable = ({ 
  data, 
  onExportPDF,
  isExporting = false,
  dateRange
}: PrepTimeFullRankingTableProps) => {
  const navigate = useNavigate();
  const { setSelectedRestaurants, setVisibleRestaurants, setDateRange, setPeriodMode } = useAnalyticsContext();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const handleRowClick = (restaurantId: string) => {
    // Set the restaurant in context
    setVisibleRestaurants([restaurantId]);
    setSelectedRestaurants([restaurantId]);
    
    // Synchronize the date range from PrepTimeComparison page
    if (dateRange) {
      setDateRange({ from: dateRange.start, to: dateRange.end });
      setPeriodMode("range");
    }
    
    navigate("/analytics/operations?tab=prepTime");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      // Default sort direction: rank/avgPrepTime asc (fastest first), name asc, orderCount desc
      setSortDirection(field === "orderCount" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  // Calculate global rank based on original sorted data - must be before filteredAndSortedData
  const rankedData = useMemo(() => {
    const sortedByPrepTime = [...data].sort((a, b) => a.avgPrepTime - b.avgPrepTime);
    const rankMap = new Map<string, number>();
    sortedByPrepTime.forEach((r, idx) => rankMap.set(r.id, idx + 1));
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
        case "avgPrepTime":
          comparison = a.avgPrepTime - b.avgPrepTime;
          break;
        case "orderCount":
          comparison = a.orderCount - b.orderCount;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [data, searchQuery, sortField, sortDirection, rankedData]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedData, currentPage]);

  // Calculate max prep time for bar scaling
  const maxPrepTime = useMemo(() => {
    return Math.max(...data.map(d => d.avgPrepTime), 1);
  }, [data]);

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
            <Clock className="h-5 w-5 text-amber-500" />
            Classement par rapidité ({data.length} restaurants)
          </CardTitle>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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
        <div className="rounded-lg border overflow-hidden">
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
                <TableHead className="text-center w-28">
                  <button 
                    className="flex items-center justify-center hover:text-foreground transition-colors mx-auto"
                    onClick={() => handleSort("avgPrepTime")}
                  >
                    Temps
                    <SortIcon field="avgPrepTime" />
                  </button>
                </TableHead>
                <TableHead className="text-center w-28">
                  <button 
                    className="flex items-center justify-center hover:text-foreground transition-colors mx-auto"
                    onClick={() => handleSort("orderCount")}
                  >
                    Commandes
                    <SortIcon field="orderCount" />
                  </button>
                </TableHead>
                <TableHead className="text-center w-28">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun restaurant trouvé
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((restaurant) => {
                  const rank = rankedData.get(restaurant.id) || 0;
                  const barWidth = (restaurant.avgPrepTime / maxPrepTime) * 100;
                  
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
                                className={`h-full rounded-full ${getBarColor(restaurant.avgPrepTime)}`}
                                style={{ width: `${Math.min(barWidth, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span className="font-semibold">{formatMinutesToDisplay(restaurant.avgPrepTime)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{restaurant.orderCount.toLocaleString('fr-FR')}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(restaurant.avgPrepTime)}
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
              Page {currentPage} sur {totalPages} ({filteredAndSortedData.length} restaurants)
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
