import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChataigneOverview {
  ca_brut: number;
  commandes: number;
  panier_moyen: number;
  restos_actifs: number;
  derniere_sync: string | null;
}

export interface ChataigneMonth {
  mois: string;
  restos_actifs: number;
  commandes: number;
  ca_brut: number;
}

export interface ChataigneRestaurant {
  restaurant_id: string;
  restaurant_name: string | null;
  city: string | null;
  commandes: number;
  ca_brut: number;
  panier_moyen: number;
  dernier_jour: string | null;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export function useChataigneOverview(start: string, end: string) {
  return useQuery({
    queryKey: ["chataigne-overview", start, end],
    queryFn: async (): Promise<ChataigneOverview | null> => {
      const { data, error } = await supabase.rpc("get_chataigne_overview" as never, {
        p_start: start,
        p_end: end,
      } as never);
      if (error) throw error;
      const row = (data as unknown as ChataigneOverview[] | null)?.[0];
      if (!row) return null;
      return {
        ca_brut: num(row.ca_brut),
        commandes: num(row.commandes),
        panier_moyen: num(row.panier_moyen),
        restos_actifs: num(row.restos_actifs),
        derniere_sync: row.derniere_sync ?? null,
      };
    },
  });
}

export function useChataigneMonthly(start: string, end: string) {
  return useQuery({
    queryKey: ["chataigne-monthly", start, end],
    queryFn: async (): Promise<ChataigneMonth[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_monthly" as never, {
        p_start: start,
        p_end: end,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneMonth[] | null) ?? []).map((r) => ({
        mois: r.mois,
        restos_actifs: num(r.restos_actifs),
        commandes: num(r.commandes),
        ca_brut: num(r.ca_brut),
      }));
    },
  });
}

export function useChataigneByRestaurant(start: string, end: string) {
  return useQuery({
    queryKey: ["chataigne-by-restaurant", start, end],
    queryFn: async (): Promise<ChataigneRestaurant[]> => {
      const { data, error } = await supabase.rpc("get_chataigne_by_restaurant" as never, {
        p_start: start,
        p_end: end,
      } as never);
      if (error) throw error;
      return ((data as unknown as ChataigneRestaurant[] | null) ?? []).map((r) => ({
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        city: r.city,
        commandes: num(r.commandes),
        ca_brut: num(r.ca_brut),
        panier_moyen: num(r.panier_moyen),
        dernier_jour: r.dernier_jour ?? null,
      }));
    },
  });
}
