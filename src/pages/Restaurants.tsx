import { useState, useMemo } from "react";
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
import { ChevronRight, MapPin, Phone, Filter, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RestaurantFormDialog } from "@/components/restaurants/RestaurantFormDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Restaurants = () => {
  const navigate = useNavigate();
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  // Filter restaurants by department and search query
  const filteredRestaurants = useMemo(() => {
    if (!restaurants) return [];
    
    let filtered = restaurants;
    
    // Filter by department
    if (departmentFilter !== "all") {
      filtered = filtered.filter(
        (r) => r.postal_code && r.postal_code.startsWith(departmentFilter)
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.city?.toLowerCase().includes(query) ||
          r.street?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [restaurants, departmentFilter, searchQuery]);

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
                <TableHead>Nom</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Gérant</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-center">Connexion Uber</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRestaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {departmentFilter === "all" 
                      ? "Aucun restaurant trouvé" 
                      : `Aucun restaurant dans le département ${departmentFilter}`}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <TableRow 
                    key={restaurant.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                  >
                    <TableCell className="font-medium">
                      {restaurant.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {restaurant.postal_code && `${restaurant.postal_code} `}{restaurant.city}
                      </div>
                    </TableCell>
                    <TableCell>
                      {restaurant.restaurant_phone ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {restaurant.restaurant_phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {restaurant.manager_first_name && restaurant.manager_last_name ? (
                        `${restaurant.manager_first_name} ${restaurant.manager_last_name}`
                      ) : (
                        <span className="text-muted-foreground">Non renseigné</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {restaurant.is_active ? (
                        <Badge className="bg-accent text-accent-foreground">Actif</Badge>
                      ) : (
                        <Badge variant="outline">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {Array.isArray(restaurant.uber_connections) &&
                      restaurant.uber_connections.length > 0 ? (
                        <Badge className="bg-accent text-accent-foreground">Connecté</Badge>
                      ) : (
                        <Badge variant="outline">Non connecté</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Restaurants;
