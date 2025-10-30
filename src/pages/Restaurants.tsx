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
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Restaurants = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    city: "",
  });

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

  const handleAddRestaurant = async () => {
    if (!newRestaurant.name || !newRestaurant.city) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    // Get the first chain (assuming single chain for now)
    const { data: chains } = await supabase
      .from("chains")
      .select("id")
      .limit(1)
      .single();

    if (!chains) {
      toast({
        title: "Erreur",
        description: "Aucune chaîne trouvée",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("restaurants").insert({
      chain_id: chains.id,
      name: newRestaurant.name,
      city: newRestaurant.city,
      is_active: true,
    });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le restaurant",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Restaurant ajouté avec succès",
    });

    setIsDialogOpen(false);
    setNewRestaurant({ name: "", city: "" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurants</h2>
          <p className="text-muted-foreground">
            Gérez vos points de vente
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un restaurant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau restaurant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du restaurant</Label>
                <Input
                  id="name"
                  placeholder="Chicken Street Paris Centre"
                  value={newRestaurant.name}
                  onChange={(e) =>
                    setNewRestaurant({ ...newRestaurant, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  placeholder="Paris"
                  value={newRestaurant.city}
                  onChange={(e) =>
                    setNewRestaurant({ ...newRestaurant, city: e.target.value })
                  }
                />
              </div>
              <Button onClick={handleAddRestaurant} className="w-full">
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                <TableHead>Store ID Uber</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-center">Connexion Uber</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurants?.map((restaurant) => (
                <TableRow key={restaurant.id}>
                  <TableCell className="font-medium">
                    {restaurant.name}
                  </TableCell>
                  <TableCell>{restaurant.city}</TableCell>
                  <TableCell>
                    {restaurant.uber_store_id || (
                      <span className="text-muted-foreground">Non défini</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {restaurant.is_active ? (
                      <Badge className="bg-accent">Actif</Badge>
                    ) : (
                      <Badge variant="outline">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {Array.isArray(restaurant.uber_connections) &&
                    restaurant.uber_connections.length > 0 ? (
                      <Badge className="bg-accent">Connecté</Badge>
                    ) : (
                      <Badge variant="outline">Non connecté</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                    >
                      Voir détails
                    </Button>
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
