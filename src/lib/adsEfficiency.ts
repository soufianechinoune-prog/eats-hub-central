import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type AdsEfficiencyRow = { restaurant_id: string; ads_ht: number; rev_ttc: number; rev_prev_ttc: number; payout: number };

export type EfficiencyCohort = "c0" | "c1" | "c2" | "c3";
export const EFFICIENCY_COHORTS: Record<EfficiencyCohort, { label: string; hint: string; min: number; max: number }> = {
  c0: { label: "< 1 %", hint: "Peu ou pas de pub", min: 0, max: 1 },
  c1: { label: "1 – 2,5 %", hint: "Effort modéré", min: 1, max: 2.5 },
  c2: { label: "2,5 – 4 %", hint: "Zone de rendement observée", min: 2.5, max: 4 },
  c3: { label: "> 4 %", hint: "Effort élevé", min: 4, max: Infinity },
};
export const SWEET_SPOT = { min: 2.5, max: 4 };

export function cohortOf(pct: number): EfficiencyCohort {
  if (pct < 1) return "c0";
  if (pct < 2.5) return "c1";
  if (pct < 4) return "c2";
  return "c3";
}

export type EfficiencyStats = {
  count: number; ads: number; revenue: number; revenuePrev: number; payout: number;
  pct: number | null; growth: number | null; netMargin: number | null; gainPerEuro: number | null;
};

/** Agrège des restaurants : ratio pondéré, croissance CA, part nette en banque (versement − pub) / CA, gain de CA par € de pub. */
export function aggregateEfficiency(rows: AdsEfficiencyRow[]): EfficiencyStats {
  let ads = 0, revenue = 0, revenuePrev = 0, payout = 0;
  rows.forEach((r) => { ads += Number(r.ads_ht) || 0; revenue += Number(r.rev_ttc) || 0; revenuePrev += Number(r.rev_prev_ttc) || 0; payout += Number(r.payout) || 0; });
  return {
    count: rows.length, ads, revenue, revenuePrev, payout,
    pct: revenue > 0 ? (ads / revenue) * 100 : null,
    growth: revenuePrev > 0 ? (revenue / revenuePrev - 1) * 100 : null,
    netMargin: revenue > 0 ? ((payout - ads) / revenue) * 100 : null,
    gainPerEuro: ads > 0 ? (revenue - revenuePrev) / ads : null,
  };
}

/** Restaurants comparables : actifs sur les deux périodes (périmètre constant). */
export const isComparable = (r: AdsEfficiencyRow) => Number(r.rev_ttc) > 0 && Number(r.rev_prev_ttc) > 0;

export function groupByCohort(rows: AdsEfficiencyRow[]) {
  const out: Record<EfficiencyCohort, AdsEfficiencyRow[]> = { c0: [], c1: [], c2: [], c3: [] };
  rows.filter(isComparable).forEach((r) => out[cohortOf((Number(r.ads_ht) / Number(r.rev_ttc)) * 100)].push(r));
  return (Object.keys(out) as EfficiencyCohort[]).map((k) => ({ key: k, ...aggregateEfficiency(out[k]) }));
}

export async function fetchAdsEfficiency(cur: { start: Date; end: Date }, prev: { start: Date; end: Date }, ids: string[]): Promise<AdsEfficiencyRow[]> {
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_ads_efficiency", {
    p_start: f(cur.start), p_end: f(cur.end), p_prev_start: f(prev.start), p_prev_end: f(prev.end), p_restaurant_ids: ids,
  });
  if (error) throw error;
  return (data ?? []) as AdsEfficiencyRow[];
}

/** Dernier trimestre clos et celui qui le précède. */
export function lastClosedQuarters(today: Date) {
  const q = Math.floor(today.getMonth() / 3); // trimestre en cours (0-based)
  const mk = (y: number, qi: number) => {
    const yy = y + Math.floor(qi / 4), q0 = ((qi % 4) + 4) % 4;
    const adjY = qi < 0 ? y - 1 : yy;
    return { start: new Date(adjY, q0 * 3, 1), end: new Date(adjY, q0 * 3 + 3, 0), label: `T${q0 + 1} ${adjY}` };
  };
  return { cur: mk(today.getFullYear(), q - 1), prev: mk(today.getFullYear(), q - 2) };
}
