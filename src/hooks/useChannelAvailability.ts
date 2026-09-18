import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export interface ChannelAvailability {
  uber: boolean;
  deliveroo: boolean;
  cash: boolean;
  dishop: boolean;
  chataigne: boolean;
}

/**
 * Détecte les canaux disponibles pour la marque active.
 * Utilisé par la navigation par canal sur les pages autres que la Vue d'ensemble
 * (qui, elle, calcule déjà la disponibilité à partir de ses propres données).
 * Lecture seule : aucun impact sur les chiffres affichés.
 */
export function useChannelAvailability(): ChannelAvailability {
  const { selectedChainId } = useAnalyticsContext();

  const { data } = useQuery({
    queryKey: ["channel-availability", selectedChainId],
    enabled: !!selectedChainId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ChannelAvailability> => {
      const chainId = selectedChainId as string;

      const { data: restos, error: rErr } = await supabase
        .from("restaurants")
        .select("id")
        .eq("chain_id", chainId);
      if (rErr) throw rErr;
      const ids = (restos ?? []).map((r) => r.id);

      const [deliverooCount, dishopCount, uberCount, chataigneCount] = await Promise.all([
        ids.length
          ? supabase
              .from("restaurant_deliveroo_ids")
              .select("id", { count: "exact", head: true })
              .in("restaurant_id", ids)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        supabase
          .from("dishop_shop_mapping")
          .select("id", { count: "exact", head: true })
          .eq("chain_id", chainId),
        ids.length
          ? supabase
              .from("restaurant_uber_ids")
              .select("id", { count: "exact", head: true })
              .in("restaurant_id", ids)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        ids.length
          ? supabase
              .from("chataigne_orders")
              .select("id", { count: "exact", head: true })
              .in("restaurant_id", ids)
              .limit(1)
          : Promise.resolve({ count: 0 } as { count: number | null }),
      ]);

      return {
        uber: (uberCount.count ?? 0) > 0,
        deliveroo: (deliverooCount.count ?? 0) > 0,
        cash: true,
        dishop: (dishopCount.count ?? 0) > 0,
        chataigne: (chataigneCount.count ?? 0) > 0,
      };
    },
  });

  return (
    data ?? { uber: true, deliveroo: true, cash: true, dishop: false, chataigne: true }
  );
}
