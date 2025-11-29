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
import { ChevronRight, MapPin, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RestaurantFormDialog } from "@/components/restaurants/RestaurantFormDialog";

const Restaurants = () => {
  const navigate = useNavigate();

  const { data: restaurants, refetch } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select(`
          *,
          uber_connections (id)
        `)
        .order("city", { ascending: true });
      return data || [];
    },
  });

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
        <CardHeader>
          <CardTitle>Liste des restaurants</CardTitle>
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
              {restaurants?.map((restaurant) => (
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Restaurants;
