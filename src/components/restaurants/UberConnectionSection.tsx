import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UberEatsIcon } from "@/components/icons/PlatformIcons";
import { CheckCircle2, Link2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const UBER_CLIENT_ID = "wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX";
const UBER_REDIRECT_URI = "https://cs-delivery-performance.com/uber-callback";
const UBER_SCOPES = "eats.store eats.store.orders.read eats.report";

interface UberConnectionSectionProps {
  restaurantId: string;
}

export const UberConnectionSection = ({ restaurantId }: UberConnectionSectionProps) => {
  const { data: connection, isLoading } = useQuery({
    queryKey: ["uber-connection", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uber_connections")
        .select("id, created_at, expires_at, scopes")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const startOAuth = () => {
    const params = new URLSearchParams({
      client_id: UBER_CLIENT_ID,
      response_type: "code",
      scope: UBER_SCOPES,
      redirect_uri: UBER_REDIRECT_URI,
      state: restaurantId,
    });
    window.location.href = `https://login.uber.com/oauth/v2/authorize?${params.toString()}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UberEatsIcon className="h-5 w-5" />
          Connexion Uber Eats
        </CardTitle>
        <CardDescription>
          Autorisez l'accès à l'API Uber Eats pour synchroniser automatiquement les commandes,
          rapports et menus.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : connection ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connecté
              </Badge>
              <p className="text-sm text-muted-foreground">
                Connecté le {format(new Date(connection.created_at), "PPP", { locale: fr })}
              </p>
              {connection.scopes && (
                <p className="text-xs text-muted-foreground font-mono break-all">
                  Scopes : {connection.scopes}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={startOAuth}>
              <Link2 className="h-4 w-4 mr-2" />
              Reconnecter
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Aucune connexion active pour ce restaurant.
            </p>
            <Button onClick={startOAuth}>
              <Link2 className="h-4 w-4 mr-2" />
              Connecter Uber Eats
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
