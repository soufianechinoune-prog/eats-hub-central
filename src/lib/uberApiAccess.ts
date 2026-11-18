import { supabase } from "@/integrations/supabase/client";

/**
 * Accès API Uber constaté, par restaurant (fonction get_uber_api_access_status, migration 20261118090000).
 * On se fie à ce qu'Uber renvoie vraiment, pas à la date de provisionnement :
 *   ok            : des commandes arrivent par l'API (14 derniers jours) ;
 *   refuse        : Uber a refusé l'accès, et aucune commande API n'est arrivée depuis ;
 *   silencieux    : ni refus ni commande API récente (fermé, en pause, ou accès à vérifier) ;
 *   non_configure : aucun identifiant de magasin Uber dans Mijotek.
 */
export type UberApiAccessStatus = "ok" | "refuse" | "silencieux" | "non_configure";

export interface UberApiAccess {
  restaurant_id: string;
  chain_id: string | null;
  status: UberApiAccessStatus;
  last_api_order_at: string | null;
  last_refusal_at: string | null;
  refusal_reason: string | null;
  request_id: string | null;
  requested_at: string | null;
  requested_by_name: string | null;
}

/** Ce qu'on affiche : le statut seul, ou « accès demandé » si une demande est en cours. */
export type UberApiAccessDisplay = UberApiAccessStatus | "demande";

export function uberApiAccessDisplay(access: Pick<UberApiAccess, "status" | "request_id"> | undefined): UberApiAccessDisplay {
  if (!access) return "non_configure";
  // Une demande en cours ne compte que tant que l'accès n'est pas revenu.
  if (access.request_id && access.status !== "ok") return "demande";
  return access.status;
}

const DAY_MS = 86_400_000;
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));
}

/** Nombre de restaurants à traiter : accès refusé sans demande, ou demande toujours en attente. */
export function countAccessToFollow(rows: UberApiAccess[]) {
  let toRequest = 0, waiting = 0;
  for (const r of rows) {
    const d = uberApiAccessDisplay(r);
    if (d === "refuse") toRequest++;
    else if (d === "demande") waiting++;
  }
  return { toRequest, waiting };
}

type RpcResult = PromiseLike<{ data: UberApiAccess[] | null; error: Error | null }>;
type Write<T> = PromiseLike<{ data: T | null; error: Error | null }>;
// Fonction et table pas encore dans les types générés. On garde les appels sur l'objet client :
// extraire ses méthodes leur fait perdre leur contexte.
const client = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => RpcResult;
  from: (t: string) => {
    insert: (row: { restaurant_id: string; note?: string | null }) => Write<null>;
    update: (row: { cancelled_at: string }) => { eq: (k: string, v: string) => Write<null> };
  };
};

export async function fetchUberApiAccess(chainId?: string | null): Promise<UberApiAccess[]> {
  const { data, error } = await client.rpc("get_uber_api_access_status", { p_chain_id: chainId ?? null });
  if (error) throw error;
  return data ?? [];
}

export async function recordUberApiAccessRequest(restaurantId: string, note?: string | null) {
  const { error } = await client.from("uber_api_access_requests").insert({ restaurant_id: restaurantId, note: note ?? null });
  if (error) throw error;
}

export async function cancelUberApiAccessRequest(requestId: string) {
  const { error } = await client.from("uber_api_access_requests").update({ cancelled_at: new Date().toISOString() }).eq("id", requestId);
  if (error) throw error;
}
