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
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
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
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "restaurants-preferences";

const Restaurants = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Load preferences from localStorage
  const savedPrefs = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const [statusFilter, setStatusFilter] = useState<string>(savedPrefs?.statusFilter ?? "all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(savedPrefs?.sortColumn ?? null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(savedPrefs?.sortDirection ?? "asc");

  // Persist preferences to localStorage
  useEffect(() => {
    const prefs = {
      statusFilter,
      sortColumn,
      sortDirection,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [statusFilter, sortColumn, sortDirection]);

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

  // Helper to get Uber API status
  const getUberStatus = (r: typeof restaurants[0]) => {
    if (Array.isArray(r.uber_connections) && r.uber_connections.length > 0) return "connected";
    if (r.uber_store_id) return "pending";
    return "disconnected";
  };

  // Helper to get Deliveroo status
  const getDeliverooStatus = (r: typeof restaurants[0]) => {
    if (r.deliveroo_store_id) return "configured";
    return "not_configured";
  };

  // Filter restaurants by status and search query
  const filteredRestaurants = useMemo(() => {
    if (!restaurants) return [];
    
    let filtered = restaurants;

    // Filter by API status (Uber)
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => getUberStatus(r) === statusFilter);
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
  }, [restaurants, statusFilter, searchQuery]);

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
        case "deliveroo_account_manager":
          aVal = a.deliveroo_account_manager_name?.toLowerCase() || "";
          bVal = b.deliveroo_account_manager_name?.toLowerCase() || "";
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
                    AM Uber
                    <SortIcon column="account_manager" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("deliveroo_account_manager")}
                >
                  <div className="flex items-center gap-1.5">
                    AM Deliveroo
                    <SortIcon column="deliveroo_account_manager" />
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    Connexions
                  </div>
                </TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRestaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Aucun restaurant trouvé
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
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.deliveroo_account_manager_name ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                                {restaurant.deliveroo_account_manager_name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1.5">
                                <p className="font-medium">{restaurant.deliveroo_account_manager_name}</p>
                                {restaurant.deliveroo_account_manager_title && (
                                  <p className="text-xs text-muted-foreground">{restaurant.deliveroo_account_manager_title}</p>
                                )}
                                {restaurant.deliveroo_account_manager_phone && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Phone className="h-3 w-3" />
                                    {restaurant.deliveroo_account_manager_phone}
                                  </div>
                                )}
                                {restaurant.deliveroo_account_manager_email && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Mail className="h-3 w-3" />
                                    {restaurant.deliveroo_account_manager_email}
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
                      <div className="flex items-center justify-center gap-3">
                        {/* Uber indicator */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5">
                                <UberEatsLogo size={14} />
                                <span 
                                  className={`h-2 w-2 rounded-full ${
                                    Array.isArray(restaurant.uber_connections) && restaurant.uber_connections.length > 0
                                      ? "bg-green-500"
                                      : restaurant.uber_store_id
                                      ? "bg-yellow-500"
                                      : "bg-gray-300"
                                  }`}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {Array.isArray(restaurant.uber_connections) && restaurant.uber_connections.length > 0
                                ? "Uber Eats connecté"
                                : restaurant.uber_store_id
                                ? "Uber Eats en attente"
                                : "Uber Eats non connecté"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {/* Deliveroo indicator */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5">
                                <DeliverooLogo size={14} />
                                <span 
                                  className={`h-2 w-2 rounded-full ${
                                    restaurant.deliveroo_store_id
                                      ? "bg-cyan-500"
                                      : "bg-gray-300"
                                  }`}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {restaurant.deliveroo_store_id
                                ? "Deliveroo configuré"
                                : "Deliveroo non configuré"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
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
        onDelete={async (ids) => {
          const { error } = await supabase
            .from("restaurants")
            .delete()
            .in("id", ids);
          
          if (error) throw error;
          
          setSelectedIds(new Set());
          refetch();
        }}
      />
    </div>
  );
};

export default Restaurants;
