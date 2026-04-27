import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeCodeForToken, parseUberOAuthState } from "@/services/uberService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const UBER_POS_PROVISIONING_SCOPE = "eats.pos_provisioning";
const UBER_CLIENT_ID = "wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX";

const UberCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorDetails, setErrorDetails] = useState<{
    error: string;
    description: string;
    returnPath: string;
  } | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description") || searchParams.get("error_message") || "";
      const parsedState = parseUberOAuthState(state);
      const returnPath = parsedState?.returnPath || "/uber-connections";

      if (error) {
        const isInvalidScope = error === "invalid_scope";
        const description = isInvalidScope
          ? `Uber refuse le scope ${UBER_POS_PROVISIONING_SCOPE}. Ce scope doit être activé côté Uber Eats Marketplace pour cette application.`
          : `Uber a refusé l'autorisation: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`;
        setErrorDetails({ error, description, returnPath });
        toast({
          title: "Erreur d'autorisation",
          description,
          variant: "destructive",
        });
        setStatus("error");
        if (!isInvalidScope) {
          setTimeout(() => navigate(returnPath), 4000);
        }
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
            <h2 className="text-2xl font-semibold">Autorisation Uber bloquée</h2>
            {errorDetails?.error === "invalid_scope" ? (
              <div className="mx-auto max-w-2xl space-y-4 text-left">
                <p className="text-center text-muted-foreground">
                  Uber refuse le scope nécessaire au mapping multi-restaurant.
                </p>
                <div className="rounded-md border bg-card p-4 text-sm shadow-sm space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                    <span className="font-medium text-muted-foreground">Scope demandé</span>
                    <code className="break-all rounded bg-muted px-2 py-1">{UBER_POS_PROVISIONING_SCOPE}</code>
                    <span className="font-medium text-muted-foreground">Client Uber</span>
                    <code className="break-all rounded bg-muted px-2 py-1">{UBER_CLIENT_ID}</code>
                    <span className="font-medium text-muted-foreground">URL de redirection</span>
                    <code className="break-all rounded bg-muted px-2 py-1">{window.location.origin}/uber-callback</code>
                    <span className="font-medium text-muted-foreground">Erreur brute</span>
                    <code className="break-all rounded bg-muted px-2 py-1">{errorDetails.error}</code>
                  </div>
                  <p className="text-muted-foreground">
                    Ce n'est pas lié au restaurant sélectionné : l'application Uber doit être whitelistée pour
                    <code className="mx-1 rounded bg-muted px-1 py-0.5">{UBER_POS_PROVISIONING_SCOPE}</code>
                    avant que la page de connexion Uber puisse s'ouvrir.
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => navigate(errorDetails.returnPath)}>
                    Retour
                  </Button>
                  <Button onClick={() => navigate("/uber-connections")}>Connexions Uber</Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Redirection vers la page des connexions...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UberCallback;
