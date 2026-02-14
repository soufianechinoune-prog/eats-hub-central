import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { ChevronRight, MapPin, Phone, Filter, Search, Mail, ArrowUpDown, ArrowUp, ArrowDown, Star, CheckCircle2, Download, FileText } from "lucide-react";
import { useRestaurantsExport } from "@/hooks/useRestaurantsExport";
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
import { cn } from "@/lib/utils";

const STORAGE_KEY = "restaurants-preferences";

const Restaurants = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { exportCSV, exportPDF } = useRestaurantsExport();
  
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
          *
        `)
        .order("postal_code", { ascending: true })
        .order("city", { ascending: true });
      return data || [];
    },
  });

  // Helper to get Uber status based on csv_verified
  const getUberStatus = (r: typeof restaurants[0]) => {
    if (r.csv_verified) return "connected";
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

  // Sort restaurants - pinned first, then by column
  const sortedRestaurants = useMemo(() => {
    let sorted = [...filteredRestaurants];
    
    // Sort by column if selected
    if (sortColumn) {
      sorted.sort((a, b) => {
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
          case "uber_opening_date":
            aVal = (a as any).uber_opening_date || "";
            bVal = (b as any).uber_opening_date || "";
            break;
          case "deliveroo_account_manager":
            aVal = a.deliveroo_account_manager_name?.toLowerCase() || "";
            bVal = b.deliveroo_account_manager_name?.toLowerCase() || "";
            break;
          case "is_succursale":
            aVal = (a as any).is_succursale ? "1" : "0";
            bVal = (b as any).is_succursale ? "1" : "0";
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    // Always put pinned restaurants first
    sorted.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });
    
    return sorted;
  }, [filteredRestaurants, sortColumn, sortDirection]);

  const pinnedCount = useMemo(() => 
    restaurants?.filter(r => r.is_pinned).length || 0
  , [restaurants]);

  const togglePin = async (id: string, currentPinned: boolean) => {
    const { error } = await supabase
      .from("restaurants")
      .update({ is_pinned: !currentPinned })
      .eq("id", id);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'épingle",
        variant: "destructive",
      });
    } else {
      refetch();
      toast({
        title: currentPinned ? "Restaurant désépinglé" : "Restaurant épinglé",
        description: currentPinned 
          ? "Le restaurant n'apparaîtra plus en priorité" 
          : "Le restaurant apparaîtra en haut des listes",
      });
    }
  };

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
          <div className="flex items-center gap-3">
            <CardTitle>Liste des restaurants</CardTitle>
            {pinnedCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                {pinnedCount} épinglé{pinnedCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="outline" className="text-muted-foreground">
              {restaurants?.length || 0} restaurant{(restaurants?.length || 0) > 1 ? "s" : ""} au total
            </Badge>
          </div>
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
                  <SelectItem value="connected">Validé</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="disconnected">Non connecté</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCSV(sortedRestaurants)}
                title="Exporter en CSV"
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPDF(sortedRestaurants)}
                title="Exporter en PDF"
              >
                <FileText className="h-4 w-4 mr-1" />
                PDF
              </Button>
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
                <TableHead className="w-12 text-center">
                  <Star className="h-4 w-4 mx-auto text-muted-foreground" />
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
                  onClick={() => handleSort("uber_opening_date")}
                >
                  <div className="flex items-center gap-1.5">
                    Ouverture Uber
                    <SortIcon column="uber_opening_date" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("deliveroo_account_manager")}
                >
                  <div className="flex items-center gap-1.5">
                    Statut
                    <SortIcon column="deliveroo_account_manager" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none text-center"
                  onClick={() => handleSort("is_succursale")}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    Succursale
                    <SortIcon column="is_succursale" />
                  </div>
                </TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRestaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Aucun restaurant trouvé
                  </TableCell>
                </TableRow>
              ) : (
                sortedRestaurants.map((restaurant) => (
                  <TableRow 
                    key={restaurant.id} 
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      restaurant.is_pinned && "bg-amber-500/5"
                    )}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(restaurant.id)}
                        onCheckedChange={() => toggleSelect(restaurant.id)}
                        aria-label={`Sélectionner ${restaurant.name}`}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                      <button
                        onClick={() => togglePin(restaurant.id, !!restaurant.is_pinned)}
                        className="p-1 rounded-md hover:bg-muted transition-colors"
                        title={restaurant.is_pinned ? "Désépingler" : "Épingler"}
                      >
                        <Star 
                          className={cn(
                            "h-4 w-4 transition-colors",
                            restaurant.is_pinned 
                              ? "fill-amber-500 text-amber-500" 
                              : "text-muted-foreground/40 hover:text-amber-500"
                          )} 
                        />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium" onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.name}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {restaurant.postal_code && `${restaurant.postal_code} `}{restaurant.city}
                        {(restaurant as any).csv_verified && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>Vérifié via CSV Uber</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.manager_whatsapp ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {restaurant.manager_whatsapp}
                        </div>
                      ) : restaurant.restaurant_phone ? (
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
                      {(restaurant as any).uber_opening_date ? (
                        <span className="text-sm">
                          {new Date((restaurant as any).uber_opening_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                      {restaurant.is_active === false && !(restaurant as any).uber_opening_date && !(restaurant as any).uber_closing_date ? (
                        <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">
                          🚀 Bientôt
                        </Badge>
                      ) : restaurant.is_active === false ? (
                        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                          Fermé{(restaurant as any).uber_closing_date 
                            ? ` le ${new Date((restaurant as any).uber_closing_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` 
                            : ''}
                        </Badge>
                      ) : restaurant.deliveroo_account_manager_name ? (
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
                      {(restaurant as any).is_succursale ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          Succursale
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Franchise</span>
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
        onDelete={async (ids, forceDelete) => {
          if (forceDelete) {
            // Delete all related data first for each restaurant
            for (const restaurantId of ids) {
              await supabase.from("order_items").delete().eq("restaurant_id", restaurantId);
              await supabase.from("order_errors").delete().eq("restaurant_id", restaurantId);
              await supabase.from("order_history").delete().eq("restaurant_id", restaurantId);
              await supabase.from("customer_reviews").delete().eq("restaurant_id", restaurantId);
              await supabase.from("menu_item_reviews").delete().eq("restaurant_id", restaurantId);
              await supabase.from("delivery_stats").delete().eq("restaurant_id", restaurantId);
              await supabase.from("downtime_logs").delete().eq("restaurant_id", restaurantId);
              await supabase.from("daily_revenue").delete().eq("restaurant_id", restaurantId);
              await supabase.from("daily_sales_uber").delete().eq("restaurant_id", restaurantId);
              await supabase.from("daily_conversion").delete().eq("restaurant_id", restaurantId);
              await supabase.from("daily_order_accuracy").delete().eq("restaurant_id", restaurantId);
              await supabase.from("monthly_revenue").delete().eq("restaurant_id", restaurantId);
              await supabase.from("monthly_fees").delete().eq("restaurant_id", restaurantId);
              await supabase.from("monthly_conversion").delete().eq("restaurant_id", restaurantId);
              await supabase.from("monthly_order_accuracy").delete().eq("restaurant_id", restaurantId);
              await supabase.from("hourly_availability").delete().eq("restaurant_id", restaurantId);
              await supabase.from("message_history").delete().eq("restaurant_id", restaurantId);
              await supabase.from("restaurant_actions").delete().eq("restaurant_id", restaurantId);
              await supabase.from("uber_connections").delete().eq("restaurant_id", restaurantId);
            }
          }
          
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
