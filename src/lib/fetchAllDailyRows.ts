import { supabase } from "@/integrations/supabase/client";

/**
 * Appelle une RPC « une ligne par restaurant et par jour » et rapatrie TOUTES les lignes.
 *
 * L'API ne renvoie jamais plus de 1 000 lignes par appel. Sans pagination, un mois sur
 * ~100 restaurants (≈ 3 000 lignes) s'arrête au 10 du mois (constat du 20/11/2026, Revenus & Ventes).
 * Les RPC concernées trient par date puis restaurant (migration 20261120083000), ce qui rend les
 * paquets stables d'un appel à l'autre.
 */
export const DAILY_RPC_PAGE_SIZE = 1000;

export interface DailyRpcParams {
  p_start_date: string;
  p_end_date: string;
  p_restaurant_ids: string[] | null;
}

/** Paramètres libres : sert aussi aux RPC mensuelles (p_year…). */
export type RpcParams = DailyRpcParams | Record<string, unknown>;

type RangeableRpc = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

export async function fetchAllDailyRows<T>(fn: string, params: RpcParams): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += DAILY_RPC_PAGE_SIZE) {
    // On garde l'appel sur l'objet client : extraire supabase.rpc lui fait perdre son contexte.
    const query = (supabase.rpc as unknown as (f: string, p: RpcParams) => RangeableRpc)
      .call(supabase, fn, params);
    const { data, error } = await query.range(from, from + DAILY_RPC_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < DAILY_RPC_PAGE_SIZE) break;
  }
  return all;
}
