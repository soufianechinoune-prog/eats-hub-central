import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantScope } from "@/hooks/useChataigne";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const strOr = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const scopeKey = (ids: RestaurantScope) =>
  ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(",");

export interface ConsentSummary {
  clients: number;
  actifs: number;
  opted_in: number;
  opted_out: number;
  inconnu: number;
  joignables_actifs: number;
  ca_opted_in: number;
  couverture_pct: number;
  snapshot_at: string;
}

export interface ConsentSegment {
  segment: string;
  clients: number;
  opted_in: number;
  opted_out: number;
  inconnu: number;
  ca: number;
  ca_opted_in: number;
  panier_moyen: number;
}

export interface ConsentData {
  summary: ConsentSummary;
  segments: ConsentSegment[];
}

export function useChataigneConsent(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-consent", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<ConsentData> => {
      const { data, error } = await supabase.rpc("get_chataigne_consent_audience" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, unknown>;
      const s = (raw.summary ?? {}) as Record<string, unknown>;
      const segments = Array.isArray(raw.segments) ? (raw.segments as Record<string, unknown>[]) : [];
      return {
        summary: {
          clients: num(s.clients),
          actifs: num(s.actifs),
          opted_in: num(s.opted_in),
          opted_out: num(s.opted_out),
          inconnu: num(s.inconnu),
          joignables_actifs: num(s.joignables_actifs),
          ca_opted_in: num(s.ca_opted_in),
          couverture_pct: num(s.couverture_pct),
          snapshot_at: strOr(s.snapshot_at),
        },
        segments: segments.map((x) => ({
          segment: strOr(x.segment),
          clients: num(x.clients),
          opted_in: num(x.opted_in),
          opted_out: num(x.opted_out),
          inconnu: num(x.inconnu),
          ca: num(x.ca),
          ca_opted_in: num(x.ca_opted_in),
          panier_moyen: num(x.panier_moyen),
        })),
      };
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}
