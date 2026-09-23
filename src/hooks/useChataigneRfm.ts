import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantScope } from "@/hooks/useChataigne";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const strOr = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const scopeKey = (ids: RestaurantScope) =>
  ids === undefined ? "pending" : ids === null ? "all" : [...ids].sort().join(",");

export interface RfmSummary {
  clients: number;
  inactifs: number;
  nouveaux: number;
  commandes: number;
  ca: number;
  panier_moyen: number;
  frequence_moy: number;
  recence_moy: number;
}

export interface RfmSegment {
  segment: string;
  clients: number;
  commandes: number;
  ca: number;
  ca_pct: number;
  panier_moyen: number;
  frequence_moy: number;
  recence_moy: number;
}

export interface RfmTopClient {
  client_key: string;
  segment: string;
  nb: number;
  ca: number;
  panier: number;
  recence: number;
  premier: string;
  dernier: string;
}

export interface RfmData {
  summary: RfmSummary;
  segments: RfmSegment[];
  top_clients: RfmTopClient[];
}

export function useChataigneRfm(
  start: string,
  end: string,
  restaurantIds: RestaurantScope = null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chataigne-rfm", start, end, scopeKey(restaurantIds)],
    queryFn: async (): Promise<RfmData> => {
      const { data, error } = await supabase.rpc("get_chataigne_rfm" as never, {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, unknown>;
      const summary = (raw.summary ?? {}) as Record<string, unknown>;
      const segments = Array.isArray(raw.segments) ? (raw.segments as Record<string, unknown>[]) : [];
      const top = Array.isArray(raw.top_clients) ? (raw.top_clients as Record<string, unknown>[]) : [];
      return {
        summary: {
          clients: num(summary.clients),
          inactifs: num(summary.inactifs),
          nouveaux: num(summary.nouveaux),
          commandes: num(summary.commandes),
          ca: num(summary.ca),
          panier_moyen: num(summary.panier_moyen),
          frequence_moy: num(summary.frequence_moy),
          recence_moy: num(summary.recence_moy),
        },
        segments: segments.map((s) => ({
          segment: strOr(s.segment),
          clients: num(s.clients),
          commandes: num(s.commandes),
          ca: num(s.ca),
          ca_pct: num(s.ca_pct),
          panier_moyen: num(s.panier_moyen),
          frequence_moy: num(s.frequence_moy),
          recence_moy: num(s.recence_moy),
        })),
        top_clients: top.map((c) => ({
          client_key: strOr(c.client_key),
          segment: strOr(c.segment),
          nb: num(c.nb),
          ca: num(c.ca),
          panier: num(c.panier),
          recence: num(c.recence),
          premier: strOr(c.premier),
          dernier: strOr(c.dernier),
        })),
      };
    },
    enabled: enabled && restaurantIds !== undefined && !!start && !!end,
    retry: false,
  });
}
