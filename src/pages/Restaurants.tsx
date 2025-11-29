import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, MapPin, Phone, Filter, Search, Mail, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { RestaurantFormDialog } from "@/components/restaurants/RestaurantFormDialog";
import { RestaurantShareActions } from "@/components/restaurants/RestaurantShareActions";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STORAGE_KEY = "restaurants-preferences";

const Restaurants = () => {
  const navigate = useNavigate();
  
  // Load preferences from localStorage
  const savedPrefs = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const [departmentFilter, setDepartmentFilter] = useState<string>(savedPrefs?.departmentFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>(savedPrefs?.statusFilter ?? "all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(savedPrefs?.sortColumn ?? null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(savedPrefs?.sortDirection ?? "asc");

  // Persist preferences to localStorage
  useEffect(() => {
    const prefs = {
      departmentFilter,
      statusFilter,
      sortColumn,
      sortDirection,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [departmentFilter, statusFilter, sortColumn, sortDirection]);

  const { data: restaurants, refetch } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select(`
          *,
          uber_connections (id)
        `)
        .order("postal_code", { ascending: true })
        .order("city", { ascending: true });
      return data || [];
    },
  });

  // Extract unique departments from postal codes with count
  const departments = useMemo(() => {
    if (!restaurants) return [];
    const deptCounts = new Map<string, number>();
    restaurants.forEach((r) => {
      if (r.postal_code && r.postal_code.length >= 2) {
        const dept = r.postal_code.substring(0, 2);
        deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
      }
    });
    return Array.from(deptCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [restaurants]);

  // Helper to get API status
  const getApiStatus = (r: typeof restaurants[0]) => {
    if (Array.isArray(r.uber_connections) && r.uber_connections.length > 0) return "connected";
    if (r.uber_store_id) return "pending";
    return "disconnected";
  };

  // Filter restaurants by department, status, and search query
  const filteredRestaurants = useMemo(() => {
    if (!restaurants) return [];
    
    let filtered = restaurants;
    
    // Filter by department
    if (departmentFilter !== "all") {
      filtered = filtered.filter(
        (r) => r.postal_code && r.postal_code.startsWith(departmentFilter)
      );
    }

    // Filter by API status
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => getApiStatus(r) === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.city?.toLowerCase().includes(query) ||
          r.street?.toLowerCase().includes(query) ||
          r.manager_first_name?.toLowerCase().includes(query) ||
          r.manager_last_name?.toLowerCase().includes(query) ||
          r.account_manager_name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [restaurants, departmentFilter, statusFilter, searchQuery]);

  // Sort restaurants
  const sortedRestaurants = useMemo(() => {
    if (!sortColumn) return filteredRestaurants;
    
    return [...filteredRestaurants].sort((a, b) => {
      let aVal: string | null = null;
      let bVal: string | null = null;
      
      switch (sortColumn) {
        case "name":
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
          break;
        case "city":
          aVal = a.city?.toLowerCase() || "";
          bVal = b.city?.toLowerCase() || "";
          break;
        case "manager":
          aVal = `${a.manager_first_name || ""} ${a.manager_last_name || ""}`.toLowerCase().trim();
          bVal = `${b.manager_first_name || ""} ${b.manager_last_name || ""}`.toLowerCase().trim();
          break;
        case "account_manager":
          aVal = a.account_manager_name?.toLowerCase() || "";
          bVal = b.account_manager_name?.toLowerCase() || "";
          break;
        case "status":
          aVal = getApiStatus(a);
          bVal = getApiStatus(b);
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRestaurants, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5" /> 
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedRestaurants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRestaurants.map((r) => r.id)));
    }
  };

  const selectedRestaurants = sortedRestaurants.filter((r) => selectedIds.has(r.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurants</h2>
          <p className="text-muted-foreground">
            Gérez vos points de vente - Cliquez sur un restaurant pour accéder à ses données
          </p>
        </div>
        <RestaurantFormDialog onSuccess={refetch} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Liste des restaurants</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Statut API" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="connected">Connecté</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="disconnected">Non connecté</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les départements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements ({restaurants?.length || 0})</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.code} value={dept.code}>
                      Département {dept.code} ({dept.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={sortedRestaurants.length > 0 && selectedIds.size === sortedRestaurants.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1.5">
                    Nom
                    <SortIcon column="name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("city")}
                >
                  <div className="flex items-center gap-1.5">
                    Ville
                    <SortIcon column="city" />
                  </div>
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("manager")}
                >
                  <div className="flex items-center gap-1.5">
                    Gérant
                    <SortIcon column="manager" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("account_manager")}
                >
                  <div className="flex items-center gap-1.5">
                    Account Manager
                    <SortIcon column="account_manager" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    Statut API
                    <SortIcon column="status" />
                  </div>
                </TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRestaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {departmentFilter === "all" 
                      ? "Aucun restaurant trouvé" 
                      : `Aucun restaurant dans le département ${departmentFilter}`}
                  </TableCell>
                </TableRow>
              ) : (
                sortedRestaurants.map((restaurant) => (
                  <TableRow 
                    key={restaurant.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(restaurant.id)}
                        onCheckedChange={() => toggleSelect(restaurant.id)}
                        aria-label={`Sélectionner ${restaurant.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium" onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.name}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {restaurant.postal_code && `${restaurant.postal_code} `}{restaurant.city}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.restaurant_phone ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {restaurant.restaurant_phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.manager_first_name || restaurant.manager_last_name ? (
                        `${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim()
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.account_manager_name ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                                {restaurant.account_manager_name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1.5">
                                <p className="font-medium">{restaurant.account_manager_name}</p>
                                {restaurant.account_manager_title && (
                                  <p className="text-xs text-muted-foreground">{restaurant.account_manager_title}</p>
                                )}
                                {restaurant.account_manager_phone && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Phone className="h-3 w-3" />
                                    {restaurant.account_manager_phone}
                                  </div>
                                )}
                                {restaurant.account_manager_email && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Mail className="h-3 w-3" />
                                    {restaurant.account_manager_email}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center" onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {Array.isArray(restaurant.uber_connections) && restaurant.uber_connections.length > 0 ? (
                        <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">Connecté</Badge>
                      ) : restaurant.uber_store_id ? (
                        <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">En attente</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Non connecté</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RestaurantShareActions
        selectedRestaurants={selectedRestaurants}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default Restaurants;
