import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeCodeForToken, parseUberOAuthState } from "@/services/uberService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const UberCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const parsedState = parseUberOAuthState(state);
      const returnPath = parsedState?.returnPath || "/uber-connections";

      if (error) {
        const isInvalidScope = error === "invalid_scope";
        toast({
          title: "Erreur d'autorisation",
          description: isInvalidScope
            ? "Uber refuse l'autorisation demandée avant connexion. Le scope demandé n'est probablement pas activé pour une connexion utilisateur."
            : `Uber a refusé l'autorisation: ${error}`,
          variant: "destructive",
        });
        setStatus("error");
        setTimeout(() => navigate(returnPath), 4000);
        return;
      }

      if (!code || !state) {
        toast({
          title: "Erreur",
          description: "Paramètres d'autorisation manquants",
          variant: "destructive",
        });
        setStatus("error");
        setTimeout(() => navigate(returnPath), 3000);
        return;
      }

      try {
        // Exchange code for token
        const tokenData = await exchangeCodeForToken(code);
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        // Always create a "master" connection (restaurant_id NULL, is_master=true).
        // The user will assign stores → restaurants on the next page.
        const { data: newConnection, error: insertError } = await supabase
          .from("uber_connections")
          .insert({
            restaurant_id: null,
            is_master: true,
            account_label: `Compte Uber Manager (${new Date().toLocaleDateString("fr-FR")})`,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_type: tokenData.token_type,
            expires_at: expiresAt,
            scopes: tokenData.scope,
            raw_payload: tokenData,
          } as any)
          .select("id")
          .single();

        if (insertError) throw insertError;

        setStatus("success");
        toast({
          title: "Connexion Uber réussie",
          description: "Récupération de la liste de vos restaurants...",
        });

        // Redirect to the multi-store linking page
        setTimeout(() => {
          navigate(`/uber-link-stores?connection=${newConnection.id}`);
        }, 1200);
      } catch (error) {
        console.error("Error handling Uber callback:", error);
        setStatus("error");
        toast({
          title: "Erreur",
          description: "Impossible de finaliser la connexion à Uber Eats",
          variant: "destructive",
        });
        setTimeout(() => navigate(returnPath), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h2 className="text-2xl font-semibold">Connexion en cours...</h2>
            <p className="text-muted-foreground">
              Nous finalisons la connexion avec Uber Eats
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-green-500 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Connexion réussie !</h2>
            <p className="text-muted-foreground">
              Redirection vers la page des connexions...
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-destructive flex items-center justify-center">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Une erreur est survenue</h2>
            <p className="text-muted-foreground">
              Redirection vers la page des connexions...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default UberCallback;
