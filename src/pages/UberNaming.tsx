import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";

const UberNaming = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  const connectionId = searchParams.get("connection");

  const { data: connection } = useQuery({
    queryKey: ["uber-connection", connectionId],
    queryFn: async () => {
      if (!connectionId) return null;
      const { data } = await supabase
        .from("uber_connections")
        .select("*")
        .eq("id", connectionId)
        .single();
      return data;
    },
    enabled: !!connectionId,
  });

  const { data: availableRestaurants } = useActiveRestaurants();

  useEffect(() => {
    if (!connectionId) {
      toast({
        title: "Erreur",
        description: "Connexion non trouvée",
        variant: "destructive",
      });
      navigate("/uber-connections");
    }
  }, [connectionId, navigate, toast]);

  const handleAssignRestaurant = async () => {
    if (!selectedRestaurant || !connectionId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un restaurant",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update the connection with the selected restaurant
      const { error } = await supabase
        .from("uber_connections")
        .update({ restaurant_id: selectedRestaurant })
        .eq("id", connectionId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Restaurant associé avec succès",
      });

      navigate("/uber-connections");
    } catch (error) {
      console.error("Error assigning restaurant:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'associer le restaurant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!connection) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Chargement...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/uber-connections")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Nommer la connexion Uber Eats
          </h2>
          <p className="text-muted-foreground">
            Associez cette connexion à un de vos restaurants
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations de la connexion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Scopes autorisés</Label>
              <p className="text-sm text-muted-foreground">
                {connection.scopes || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Date de création</Label>
              <p className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(connection.created_at))}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Statut du token</Label>
              <p className="text-sm text-muted-foreground">
                {connection.expires_at && new Date(connection.expires_at) > new Date()
                  ? "✅ Valide"
                  : "❌ Expiré"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Associer à un restaurant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            
            <Button 
              onClick={handleAssignRestaurant} 
              className="w-full"
              disabled={isLoading || !selectedRestaurant}
            >
              {isLoading ? "Association en cours..." : "Associer ce restaurant"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Cette connexion permettra de récupérer les données Uber Eats pour le restaurant sélectionné.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UberNaming;