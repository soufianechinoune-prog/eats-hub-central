import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeCodeForToken, fetchStores, activateStoreIntegration } from "@/services/uberService";
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
      const state = searchParams.get("state"); // restaurant_id
      const error = searchParams.get("error");

      if (error) {
        toast({
          title: "Erreur d'autorisation",
          description: `Uber a refusé l'autorisation: ${error}`,
          variant: "destructive",
        });
        setStatus("error");
        setTimeout(() => navigate("/uber-connections"), 3000);
        return;
      }

      if (!code || !state) {
        toast({
          title: "Erreur",
          description: "Paramètres d'autorisation manquants",
          variant: "destructive",
        });
        setStatus("error");
        setTimeout(() => navigate("/uber-connections"), 3000);
        return;
      }

      try {
        // Exchange code for token
        const tokenData = await exchangeCodeForToken(code);

        // Calculate expiration date
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        // Check if connection already exists
        const { data: existingConnection } = await supabase
          .from("uber_connections")
          .select("id")
          .eq("restaurant_id", state)
          .single();

        if (existingConnection) {
          // Update existing connection
          const { error: updateError } = await supabase
            .from("uber_connections")
            .update({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              token_type: tokenData.token_type,
              expires_at: expiresAt,
              scopes: tokenData.scope,
              raw_payload: tokenData,
            })
            .eq("restaurant_id", state);

          if (updateError) throw updateError;
        } else {
          // Create new connection
          const { error: insertError } = await supabase
            .from("uber_connections")
            .insert({
              restaurant_id: state,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              token_type: tokenData.token_type,
              expires_at: expiresAt,
              scopes: tokenData.scope,
              raw_payload: tokenData,
            });

          if (insertError) throw insertError;
        }

        // Fetch stores and activate integration
        try {
          const storesData = await fetchStores(tokenData.access_token);
          
          if (storesData.stores && storesData.stores.length > 0) {
            const firstStore = storesData.stores[0];
            
            // Activate integration for the first store
            await activateStoreIntegration(tokenData.access_token, firstStore.id);
            
            // Save store ID to restaurant
            await supabase
              .from("restaurants")
              .update({ uber_store_id: firstStore.id })
              .eq("id", state);
          }
        } catch (storeError) {
          console.error("Error fetching/activating stores:", storeError);
          // Continue anyway, we can fetch stores later
        }

        setStatus("success");
        toast({
          title: "Connexion réussie",
          description: "Le restaurant a été connecté à Uber Eats avec succès",
        });

        setTimeout(() => navigate("/uber-connections"), 2000);
      } catch (error) {
        console.error("Error handling Uber callback:", error);
        setStatus("error");
        toast({
          title: "Erreur",
          description: "Impossible de finaliser la connexion à Uber Eats",
          variant: "destructive",
        });
        setTimeout(() => navigate("/uber-connections"), 3000);
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
