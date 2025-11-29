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
import { Plus, ChevronRight } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

interface RestaurantForm {
  name: string;
  address: string;
  city: string;
  siren: string;
  manager_first_name: string;
  manager_last_name: string;
  phone: string;
  tablet_email: string;
  tablet_password: string;
  account_manager_name: string;
  account_manager_title: string;
  account_manager_phone: string;
  account_manager_email: string;
}

const initialFormState: RestaurantForm = {
  name: "",
  address: "",
  city: "",
  siren: "",
  manager_first_name: "",
  manager_last_name: "",
  phone: "",
  tablet_email: "",
  tablet_password: "",
  account_manager_name: "",
  account_manager_title: "",
  account_manager_phone: "",
  account_manager_email: "",
};

const Restaurants = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState<RestaurantForm>(initialFormState);

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

  const handleInputChange = (field: keyof RestaurantForm, value: string) => {
    setNewRestaurant(prev => ({ ...prev, [field]: value }));
  };

  const handleAddRestaurant = async () => {
    if (!newRestaurant.name || !newRestaurant.city) {
      toast({
        title: "Erreur",
        description: "Le nom et la ville sont obligatoires",
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
      address: newRestaurant.address || null,
      city: newRestaurant.city,
      siren: newRestaurant.siren || null,
      manager_first_name: newRestaurant.manager_first_name || null,
      manager_last_name: newRestaurant.manager_last_name || null,
      phone: newRestaurant.phone || null,
      tablet_email: newRestaurant.tablet_email || null,
      tablet_password: newRestaurant.tablet_password || null,
      account_manager_name: newRestaurant.account_manager_name || null,
      account_manager_title: newRestaurant.account_manager_title || null,
      account_manager_phone: newRestaurant.account_manager_phone || null,
      account_manager_email: newRestaurant.account_manager_email || null,
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
    setNewRestaurant(initialFormState);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurants</h2>
          <p className="text-muted-foreground">
            Gérez vos points de vente - Cliquez sur un restaurant pour accéder à ses données
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un restaurant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouveau restaurant</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Informations générales */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Informations générales
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du restaurant *</Label>
                    <Input
                      id="name"
                      placeholder="Chicken Street Athis-Mons"
                      value={newRestaurant.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siren">SIREN</Label>
                    <Input
                      id="siren"
                      placeholder="123 456 789"
                      value={newRestaurant.siren}
                      onChange={(e) => handleInputChange("siren", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    placeholder="123 Avenue de la République"
                    value={newRestaurant.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville *</Label>
                  <Input
                    id="city"
                    placeholder="Athis-Mons"
                    value={newRestaurant.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Gérant */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Gérant
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manager_first_name">Prénom</Label>
                    <Input
                      id="manager_first_name"
                      placeholder="Jean"
                      value={newRestaurant.manager_first_name}
                      onChange={(e) => handleInputChange("manager_first_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manager_last_name">Nom</Label>
                    <Input
                      id="manager_last_name"
                      placeholder="Dupont"
                      value={newRestaurant.manager_last_name}
                      onChange={(e) => handleInputChange("manager_last_name", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    placeholder="06 12 34 56 78"
                    value={newRestaurant.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Accès Tablette Uber */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Accès Tablette Uber
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tablet_email">Email</Label>
                    <Input
                      id="tablet_email"
                      type="email"
                      placeholder="restaurant@email.com"
                      value={newRestaurant.tablet_email}
                      onChange={(e) => handleInputChange("tablet_email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tablet_password">Mot de passe</Label>
                    <Input
                      id="tablet_password"
                      type="password"
                      placeholder="••••••••"
                      value={newRestaurant.tablet_password}
                      onChange={(e) => handleInputChange("tablet_password", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Account Manager Uber */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Account Manager Uber
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_manager_name">Nom complet</Label>
                    <Input
                      id="account_manager_name"
                      placeholder="Camille LAMPIN"
                      value={newRestaurant.account_manager_name}
                      onChange={(e) => handleInputChange("account_manager_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_manager_title">Titre</Label>
                    <Input
                      id="account_manager_title"
                      placeholder="Account Manager Territory, France"
                      value={newRestaurant.account_manager_title}
                      onChange={(e) => handleInputChange("account_manager_title", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_manager_phone">Téléphone</Label>
                    <Input
                      id="account_manager_phone"
                      placeholder="07 87 77 86 58"
                      value={newRestaurant.account_manager_phone}
                      onChange={(e) => handleInputChange("account_manager_phone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_manager_email">Email</Label>
                    <Input
                      id="account_manager_email"
                      type="email"
                      placeholder="camille.lampin@uber.com"
                      value={newRestaurant.account_manager_email}
                      onChange={(e) => handleInputChange("account_manager_email", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleAddRestaurant} className="w-full">
                Créer le restaurant
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                >
                  <TableCell className="font-medium">
                    {restaurant.name}
                  </TableCell>
                  <TableCell>{restaurant.city}</TableCell>
                  <TableCell>
                    {restaurant.manager_first_name && restaurant.manager_last_name ? (
                      `${restaurant.manager_first_name} ${restaurant.manager_last_name}`
                    ) : (
                      <span className="text-muted-foreground">Non renseigné</span>
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
