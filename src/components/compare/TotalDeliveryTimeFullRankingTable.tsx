import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

interface RestaurantTotalDeliveryTime {
  id: string;
  name: string;
  avgTotalTime: number;
  orderCount: number;
}

interface TotalDeliveryTimeFullRankingTableProps {
  data: RestaurantTotalDeliveryTime[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  dateRange?: { start: Date; end: Date };
}

type SortField = "rank" | "name" | "avgTotalTime" | "orderCount";
type SortDirection = "asc" | "desc";

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
};

const getStatusBadge = (totalTime: number) => {
  if (totalTime === 0) {
    return <Badge className="bg-muted text-muted-foreground border-muted">Aucune donnée</Badge>;
  }
  if (totalTime < 10) {
    return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Très rapide</Badge>;
  }
  if (totalTime < 15) {
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Rapide</Badge>;
  }
  if (totalTime < 20) {
    return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">Lent</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Très lent</Badge>;
};

const getBarColor = (totalTime: number) => {
  if (totalTime === 0) return "bg-muted";
  if (totalTime < 10) return "bg-emerald-500";
  if (totalTime < 15) return "bg-green-500";
  if (totalTime < 20) return "bg-orange-500";
  return "bg-red-500";
};

export const TotalDeliveryTimeFullRankingTable = ({ 
  data, 
  onExportPDF,
  isExporting = false,
  dateRange
}: TotalDeliveryTimeFullRankingTableProps) => {
  const navigate = useNavigate();
  const { setSelectedRestaurants, setVisibleRestaurants, setDateRange, setPeriodMode } = useAnalyticsContext();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleRowClick = (restaurantId: string) => {
    // Set the restaurant in context
    setVisibleRestaurants([restaurantId]);
    setSelectedRestaurants([restaurantId]);
    
    // Synchronize the date range
    if (dateRange) {
      setDateRange({ from: dateRange.start, to: dateRange.end });
      setPeriodMode("range");
    }
    
    navigate("/analytics/operations?tab=totalDelivery");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      // Default sort direction: rank/avgTotalTime asc (fastest first), name asc, orderCount desc
      setSortDirection(field === "orderCount" ? "desc" : "asc");
    }
  };

  // Calculate global rank based on original sorted data - must be before filteredAndSortedData
  const rankedData = useMemo(() => {
    const sortedByTime = [...data].sort((a, b) => a.avgTotalTime - b.avgTotalTime);
    const rankMap = new Map<string, number>();
    sortedByTime.forEach((r, idx) => rankMap.set(r.id, idx + 1));
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
        case "avgTotalTime":
          comparison = a.avgTotalTime - b.avgTotalTime;
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

  // Calculate max time for bar scaling
  const maxTime = useMemo(() => {
    return Math.max(...data.map(d => d.avgTotalTime), 1);
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
            <Truck className="h-5 w-5 text-violet-500" />
            Classement par rapidité ({data.length} restaurants)
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
                <TableHead className="text-center w-28">
                  <button 
                    className="flex items-center justify-center hover:text-foreground transition-colors mx-auto"
                    onClick={() => handleSort("avgTotalTime")}
                  >
                    Temps
                    <SortIcon field="avgTotalTime" />
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
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun restaurant trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((restaurant) => {
                  const rank = rankedData.get(restaurant.id) || 0;
                  const barWidth = (restaurant.avgTotalTime / maxTime) * 100;
                  
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
                                className={`h-full rounded-full ${getBarColor(restaurant.avgTotalTime)}`}
                                style={{ width: `${Math.min(barWidth, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Truck className="h-4 w-4 text-violet-500" />
                          <span className="font-semibold">{formatMinutesToDisplay(restaurant.avgTotalTime)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{restaurant.orderCount.toLocaleString('fr-FR')}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(restaurant.avgTotalTime)}
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
