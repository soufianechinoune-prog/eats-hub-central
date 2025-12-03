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
import { getUberAuthUrl, refreshAccessToken, getStoreStatus, setStoreStatus } from "@/services/uberService";

const UberConnections = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const redirectUri = `${window.location.origin}/uber-callback`;

  const { data: connections, refetch } = useQuery({
    queryKey: ["uber-connections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uber_connections")
        .select(`
          *,
          restaurants (name, city, uber_store_id)
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
    // Nouveau processus : on se connecte d'abord à Uber, puis on nommera la connexion
    const authUrl = getUberAuthUrl("temp"); // ID temporaire
    
    // Tente d'ouvrir dans l'onglet principal; si bloqué, fallback onglet courant puis nouvel onglet
    try {
      if (window.top && window.top !== window) {
        (window.top as Window).location.assign(authUrl);
        return;
      }
      window.location.assign(authUrl);
    } catch (err) {
      const w = window.open(authUrl, "_blank", "noopener,noreferrer");
      if (!w) {
        toast({
          title: "Redirection bloquée",
          description: "Autorisez les pop-ups puis réessayez.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ouverture dans un nouvel onglet",
          description: "Terminez l'autorisation Uber puis revenez ici.",
        });
      }
    }
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

  const handleToggleStatus = async (restaurantId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "ONLINE" ? "OFFLINE" : "ONLINE";
      await setStoreStatus(restaurantId, newStatus);
      toast({
        title: "Succès",
        description: `Restaurant ${newStatus === "ONLINE" ? "en ligne" : "hors ligne"}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de changer le statut",
        variant: "destructive",
      });
    }
  };

  const { data: storeStatuses } = useQuery({
    queryKey: ["store-statuses", connections],
    queryFn: async () => {
      if (!connections) return {};
      const statuses: Record<string, any> = {};
      for (const conn of connections) {
        try {
          const status = await getStoreStatus(conn.restaurant_id);
          statuses[conn.restaurant_id] = status;
        } catch (error) {
          console.error(`Failed to fetch status for ${conn.restaurant_id}:`, error);
        }
      }
      return statuses;
    },
    enabled: !!connections && connections.length > 0,
  });

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
          <DialogContent aria-describedby="uber-connect-description">
            <DialogHeader>
              <DialogTitle>Connecter à Uber Eats</DialogTitle>
            </DialogHeader>
            <p id="uber-connect-description" className="text-sm text-muted-foreground pb-2">
              Vous allez être redirigé vers Uber Eats pour autoriser l'accès. Une fois connecté, vous pourrez nommer cette connexion.
            </p>
            <div className="space-y-4 py-4">
              <Button onClick={handleConnectUber} className="w-full">
                Continuer vers Uber Eats
              </Button>
              <p className="text-xs text-muted-foreground">
                Après autorisation, vous reviendrez ici pour associer la connexion à un restaurant.
              </p>
              <p className="text-xs text-muted-foreground break-all">
                URL de redirection utilisée: <code>{redirectUri}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-6 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(redirectUri);
                    toast({ title: "Copié", description: "URL de redirection copiée" });
                  }}
                >Copier</Button>
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
                <TableHead>Store ID</TableHead>
                <TableHead>Statut Store</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="text-center">Statut Token</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections?.map((connection) => {
                const storeStatus = storeStatuses?.[connection.restaurant_id];
                return (
                  <TableRow key={connection.id}>
                    <TableCell className="font-medium">
                      {connection.restaurants?.name}
                    </TableCell>
                    <TableCell>{connection.restaurants?.city}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono">
                        {connection.restaurants?.uber_store_id || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {storeStatus ? (
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={storeStatus.status === "ONLINE" ? "default" : "secondary"}
                          >
                            {storeStatus.status === "ONLINE" ? "En ligne" : "Hors ligne"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(connection.restaurant_id, storeStatus.status)}
                          >
                            {storeStatus.status === "ONLINE" ? "Mettre hors ligne" : "Mettre en ligne"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chargement...</span>
                      )}
                    </TableCell>
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
                );
              })}
              {(!connections || connections.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
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
