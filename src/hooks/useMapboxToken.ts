import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMapboxToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchToken = async () => {
      try {
        console.log("Fetching Mapbox token...");
        
        const { data, error: fnError } = await supabase.functions.invoke('get-mapbox-token');
        
        if (!mounted) return;
        
        console.log("Token response:", { data, fnError });
        
        if (fnError) {
          throw new Error(fnError.message);
        }
        
        if (data?.error) {
          throw new Error(data.error);
        }

        if (!data?.token) {
          throw new Error('Token Mapbox non retourné');
        }

        setToken(data.token);
        setError(null);
      } catch (err) {
        console.error('Erreur récupération token:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchToken();

    return () => {
      mounted = false;
    };
  }, []);

  return { token, isLoading, error };
}
