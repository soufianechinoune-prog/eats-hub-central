import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, Sparkles } from "lucide-react";
import { useActiveChainPOSConnection } from "@/hooks/usePOSConnectors";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export function PosEmptyState() {
  const navigate = useNavigate();
  const { selectedChainId } = useAnalyticsContext();
  const { data: activeConnection, isLoading } = useActiveChainPOSConnection();

  if (!selectedChainId) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Sélectionnez une marque dans la barre latérale pour voir les données caisse.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Chargement…
        </CardContent>
      </Card>
    );
  }

  if (!activeConnection) {
    return (
      <Card className="border-amber-200 dark:border-amber-900/40">
        <CardContent className="p-12 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Plug className="h-7 w-7 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Aucune caisse connectée</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Pour afficher les analyses des ventes en caisse (Splash360, Zelty, etc.),
              connectez d'abord votre logiciel de caisse dans les intégrations.
            </p>
          </div>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            onClick={() => navigate("/settings/integrations")}
          >
            <Plug className="h-4 w-4" />
            Connecter une caisse
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-900/40">
      <CardContent className="p-12 flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            Module Caisse — bientôt disponible
          </h3>
          <p className="text-muted-foreground mt-1 max-w-md">
            Votre caisse <strong>{activeConnection.connector?.name ?? "POS"}</strong> est
            bien connectée et les données sont en cours d'importation. Les analyses
            détaillées (CA caisse, panier moyen, comparaison livraison vs sur place)
            arrivent très prochainement.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/settings/integrations")}
        >
          Gérer la connexion
        </Button>
      </CardContent>
    </Card>
  );
}
