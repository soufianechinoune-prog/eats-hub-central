import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonthConsolidation {
  year: number;
  month: number; // 1-12
  ordersTotal: number;
  ordersWithPayoutDate: number;
  coveragePct: number; // 0-100
  storesPendingAuth: number;
}

/** Nombre de mois glissants toujours surveillés, même hors période affichée. */
const ROLLING_MONTHS = 3;

function rollingStart(startDateStr: string): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (ROLLING_MONTHS - 1));
  const rolling = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return startDateStr < rolling ? startDateStr : rolling;
}

/**
 * Option B — les versements sont recalculés depuis `orders.payout_date`.
 * Tant que la file de backfill Uber n'a pas rattaché 100 % des commandes d'un
 * mois à un cycle de versement, ce mois est « en consolidation ».
 *
 * Périmètre : uniquement les restaurants dont l'accès API Uber est actif — les
 * boutiques non provisionnées ne peuvent jamais atteindre 100 % et fausseraient
 * l'indicateur (elles sont comptées à part via `storesPendingAuth`).
 */
export function usePayoutsConsolidation(
  restaurantIds: string[] | undefined,
  startDateStr: string,
  endDateStr: string,
  enabled: boolean = true,
) {
  const idsKey = (restaurantIds || []).join(",");
  const effectiveStart = rollingStart(startDateStr);

  return useQuery({
    queryKey: ["payouts-consolidation", idsKey, effectiveStart, endDateStr],
    queryFn: async (): Promise<MonthConsolidation[]> => {
      if (!restaurantIds || restaurantIds.length === 0) return [];

      const { data, error } = await supabase.rpc(
        "get_payouts_consolidation_status",
        {
          p_start: effectiveStart,
          p_end: endDateStr,
          p_restaurant_ids: restaurantIds,
        },
      );

      if (error) {
        console.error("[PayoutsConsolidation] RPC error:", error);
        throw error;
      }

      return ((data as any[]) || [])
        .map((row) => ({
          year: Number(row.year),
          month: Number(row.month),
          ordersTotal: Number(row.orders_total) || 0,
          ordersWithPayoutDate: Number(row.orders_with_payout_date) || 0,
          coveragePct: Number(row.coverage_pct) || 0,
          storesPendingAuth: Number(row.stores_pending_auth) || 0,
        }))
        .filter((m) => m.ordersTotal > 0 && m.coveragePct < 100)
        .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
    },
    enabled: enabled && !!restaurantIds && restaurantIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export interface PayoutBackfillQueue {
  pendingJobs: number;
  runningJobs: number;
  retroJobs: number;
}

/**
 * État de la file de rattrapage des rapports de versement Uber.
 * Sert à afficher « rattrapage en cours » plutôt qu'une jauge figée.
 */
export function usePayoutBackfillQueue(enabled: boolean = true) {
  return useQuery({
    queryKey: ["payout-backfill-queue"],
    queryFn: async (): Promise<PayoutBackfillQueue> => {
      const { data, error } = await (supabase.rpc as any)(
        "get_payout_backfill_queue_status",
      );
      if (error) throw error;
      const row = (data as any[])?.[0];
      return {
        pendingJobs: Number(row?.pending_jobs) || 0,
        runningJobs: Number(row?.running_jobs) || 0,
        retroJobs: Number(row?.retro_jobs) || 0,
      };
    },
    enabled,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 1,
  });
}
