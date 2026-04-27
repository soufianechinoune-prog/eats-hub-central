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
  const [rawParams, setRawParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description") || searchParams.get("error_message") || "";
      const allParams: Record<string, string> = {};
      searchParams.forEach((value, key) => { allParams[key] = value; });
      setRawParams(allParams);
      const parsedState = parseUberOAuthState(state);
      const returnPath = parsedState?.returnPath || "/uber-connections";

      if (error) {
        console.error("Uber OAuth error - full payload:", allParams);
        const description = errorDescription
          ? `${error} — ${errorDescription}`
          : `Uber a refusé l'autorisation: ${error}`;
        setErrorDetails({ error, description, returnPath });
        toast({
          title: "Erreur d'autorisation Uber",
          description,
          variant: "destructive",
        });
        setStatus("error");
        // Don't auto-redirect on errors so the user can read the details
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
            <h2 className="text-2xl font-semibold">Autorisation Uber refusée</h2>
            <div className="mx-auto max-w-3xl space-y-4 text-left">
              <p className="text-center text-muted-foreground">
                {errorDetails?.description || "Uber n'a pas autorisé la connexion."}
              </p>
              <div className="rounded-md border bg-card p-4 text-sm shadow-sm space-y-3">
                <div className="font-medium text-foreground">Détails techniques renvoyés par Uber</div>
                <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
                  <span className="font-medium text-muted-foreground">Erreur</span>
                  <code className="break-all rounded bg-muted px-2 py-1">{errorDetails?.error || "—"}</code>
                  <span className="font-medium text-muted-foreground">Description complète</span>
                  <code className="break-all rounded bg-muted px-2 py-1 whitespace-pre-wrap">
                    {rawParams.error_description || rawParams.error_message || "(aucune description fournie par Uber)"}
                  </code>
                  <span className="font-medium text-muted-foreground">Scopes demandés</span>
                  <code className="break-all rounded bg-muted px-2 py-1">eats.store eats.report</code>
                  <span className="font-medium text-muted-foreground">Client Uber</span>
                  <code className="break-all rounded bg-muted px-2 py-1">{UBER_CLIENT_ID}</code>
                  <span className="font-medium text-muted-foreground">URL de redirection</span>
                  <code className="break-all rounded bg-muted px-2 py-1">{window.location.origin}/uber-callback</code>
                </div>
                {Object.keys(rawParams).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Voir tous les paramètres bruts ({Object.keys(rawParams).length})
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2">
                      {JSON.stringify(rawParams, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => navigate(errorDetails?.returnPath || "/uber-connections")}>
                  Retour
                </Button>
                <Button onClick={() => navigate("/uber-connections")}>Connexions Uber</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UberCallback;
