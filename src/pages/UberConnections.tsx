import { useState } from "react";
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
import { Link as LinkIcon, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getUberAuthUrl, refreshAccessToken } from "@/services/uberService";

const UberConnections = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");

  const { data: connections, refetch } = useQuery({
    queryKey: ["uber-connections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uber_connections")
        .select(`
          *,
          restaurants (name, city)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: availableRestaurants } = useQuery({
    queryKey: ["available-restaurants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const handleConnectUber = () => {
    if (!selectedRestaurant) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un restaurant",
        variant: "destructive",
      });
      return;
    }

    // Redirect to Uber OAuth
    const authUrl = getUberAuthUrl(selectedRestaurant);
    window.location.href = authUrl;
  };

  const handleRefreshToken = async (restaurantId: string) => {
    try {
      await refreshAccessToken(restaurantId);
      toast({
        title: "Succès",
        description: "Token rafraîchi avec succès",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de rafraîchir le token",
        variant: "destructive",
      });
    }
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return true;
    return new Date(expiresAt) <= new Date();
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Connexions Uber Eats</h2>
          <p className="text-muted-foreground">
            Gérez les connexions OAuth de vos restaurants
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <LinkIcon className="mr-2 h-4 w-4" />
              Connecter un restaurant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connecter à Uber Eats</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant">Sélectionnez un restaurant</Label>
                <Select
                  value={selectedRestaurant}
                  onValueChange={setSelectedRestaurant}
                >
                  <SelectTrigger id="restaurant">
                    <SelectValue placeholder="Choisir un restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRestaurants?.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name} - {restaurant.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleConnectUber} className="w-full">
                Continuer vers Uber Eats
              </Button>
              <p className="text-xs text-muted-foreground">
                Vous serez redirigé vers Uber Eats pour autoriser l'accès à ce
                restaurant.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connexions actives</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="text-center">Statut Token</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections?.map((connection) => (
                <TableRow key={connection.id}>
                  <TableCell className="font-medium">
                    {connection.restaurants?.name}
                  </TableCell>
                  <TableCell>{connection.restaurants?.city}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {connection.scopes || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(connection.created_at)}</TableCell>
                  <TableCell className="text-center">
                    {isTokenExpired(connection.expires_at) ? (
                      <Badge variant="destructive">Expiré</Badge>
                    ) : (
                      <Badge className="bg-accent">Valide</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleRefreshToken(connection.restaurant_id)
                      }
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!connections || connections.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucune connexion pour le moment
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UberConnections;
