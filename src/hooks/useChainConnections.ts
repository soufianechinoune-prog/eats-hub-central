import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChainConnectionsData {
  // restaurant_id -> connecté à Splash360
  splashRestaurantIds: Set<string>;
  // connector_id (e.g. 'dishop', 'splash360', 'zelty', 'chataigne') actifs au niveau de la chaîne
  activeChainConnectors: Set<string>;
}

/**
 * Charge en une fois toutes les connexions transverses d'une chaîne :
 * - les mappings Splash360 par restaurant
 * - les connecteurs actifs au niveau de la chaîne (Dishop, Châtaigne, etc.)
 *
 * Utilisé pour afficher dynamiquement les badges de connexion sur la liste des restaurants.
 */
export function useChainConnections(chainId: string | null | undefined) {
  return useQuery<ChainConnectionsData>({
    queryKey: ["chain-connections", chainId],
    enabled: !!chainId,
    staleTime: 60_000,
    queryFn: async () => {
      const [splashRes, connRes] = await Promise.all([
        supabase
          .from("splash360_restaurant_mapping")
          .select("restaurant_id")
          .eq("chain_id", chainId!),
        supabase
          .from("chain_pos_connections")
          .select("connector_id, is_active")
          .eq("chain_id", chainId!)
          .eq("is_active", true),
      ]);

      const splashRestaurantIds = new Set<string>(
        (splashRes.data ?? [])
          .map((r: any) => r.restaurant_id)
          .filter(Boolean)
      );

      const activeChainConnectors = new Set<string>(
        (connRes.data ?? [])
          .map((r: any) => r.connector_id)
          .filter(Boolean)
      );

      return { splashRestaurantIds, activeChainConnectors };
    },
  });
}
