import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantScope } from "@/hooks/useChataigne";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const strOr = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const scopeKey = (ids: RestaurantScope) =>
  ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(",");

export interface CrossStoreSummary {
  clients: number;
  clients_mono: number;
  clients_multi: number;
  multi_pct: number;
  ca_total: number;
  ca_multi: number;
  ca_multi_pct: number;
  panier_mono: number;
  panier_multi: number;
  freq_mono: number;
  freq_multi: number;
  restaurants_moy: number;
}

export interface CrossStoreProfil {
  profil: string;
  clients: number;
  commandes: number;
  ca: number;
  panier_moyen: number;
}

export interface CrossStorePair {
  resto_a: string;
  resto_b: string;
  clients_communs: number;
  commandes: number;
  ca: number;
}

export interface CrossStoreRestaurant {
  restaurant_id: string;
  nom: string;
  clients: number;
  clients_partages: number;
  partage_pct: number;
  commandes: number;
  ca: number;
  ca_partage: number;
}

export interface CrossStoreData {
  summary: CrossStoreSummary;
  profils: CrossStoreProfil[];
  paires: CrossStorePair[];
  restaurants: CrossStoreRestaurant[];
  snapshot_at: string;
}

export function useChataigneCrossStore(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-cross-store", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<CrossStoreData> => {
      const { data, error } = await supabase.rpc("get_chataigne_cross_store" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, unknown>;
      const s = (raw.summary ?? {}) as Record<string, unknown>;
      const arr = (k: string) =>
        Array.isArray(raw[k]) ? (raw[k] as Record<string, unknown>[]) : [];
      return {
        summary: {
          clients: num(s.clients),
          clients_mono: num(s.clients_mono),
          clients_multi: num(s.clients_multi),
          multi_pct: num(s.multi_pct),
          ca_total: num(s.ca_total),
          ca_multi: num(s.ca_multi),
          ca_multi_pct: num(s.ca_multi_pct),
          panier_mono: num(s.panier_mono),
          panier_multi: num(s.panier_multi),
          freq_mono: num(s.freq_mono),
          freq_multi: num(s.freq_multi),
          restaurants_moy: num(s.restaurants_moy),
        },
        profils: arr("profils").map((x) => ({
          profil: strOr(x.profil),
          clients: num(x.clients),
          commandes: num(x.commandes),
          ca: num(x.ca),
          panier_moyen: num(x.panier_moyen),
        })),
        paires: arr("paires").map((x) => ({
          resto_a: strOr(x.resto_a),
          resto_b: strOr(x.resto_b),
          clients_communs: num(x.clients_communs),
          commandes: num(x.commandes),
          ca: num(x.ca),
        })),
        restaurants: arr("restaurants").map((x) => ({
          restaurant_id: strOr(x.restaurant_id),
          nom: strOr(x.nom),
          clients: num(x.clients),
          clients_partages: num(x.clients_partages),
          partage_pct: num(x.partage_pct),
          commandes: num(x.commandes),
          ca: num(x.ca),
          ca_partage: num(x.ca_partage),
        })),
        snapshot_at: strOr(raw.snapshot_at),
      };
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}
