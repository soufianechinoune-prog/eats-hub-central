import { supabase } from "@/integrations/supabase/client";

/**
 * Simulateur de budget pub Uber (étude d'impact du 13/11/2026, 10 882 semaines-restaurant).
 *
 * Résultat de l'étude : +10 % de pub ≈ +0,45 % de ventes, quel que soit le restaurant
 * (élasticité constante). Un euro de pub supplémentaire rapporte donc beaucoup chez un
 * restaurant qui en fait peu, et peu chez un restaurant qui en fait déjà beaucoup.
 *
 * Toute la pub est en HT (le coût réel pour le restaurant, TVA récupérée).
 */

/** Effet de la pub sur les ventes, selon le scénario choisi. */
export const ADS_SCENARIOS = {
  pessimiste: { label: "Pessimiste", elasticity: 0.03 },
  realiste: { label: "Réaliste", elasticity: 0.045 },
  optimiste: { label: "Optimiste", elasticity: 0.06 },
} as const;
export type AdsScenario = keyof typeof ADS_SCENARIOS;

export type AdsStrategy = "reallocate" | "optimal";

/** TVA sur les ventes (restauration livrée) et sur les frais Uber. */
const VAT_SALES = 1.1;
const VAT_FEES = 1.2;
/** Garde-fou : on ne conseille pas de sortir de la zone observée (÷2 à ×2 de la pub actuelle). */
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2;
/** Plafond conseillé pour un restaurant qui ne fait aucune pub (€ HT par semaine). */
const START_BUDGET_CAP = 50;
/** Écart à partir duquel on conseille de changer (±15 %). */
const CHANGE_THRESHOLD = 0.15;

export interface AdsSimInput {
  id: string;
  name: string;
  /** CA net Uber TTC par semaine (promos déduites). */
  revenueWeek: number;
  /** Pub HT par semaine. */
  adsWeekHt: number;
  /** Versement Uber ÷ CA net TTC. */
  payoutRatio: number;
}

export type AdsDecision = "increase" | "keep" | "reduce";

export interface AdsSimRow extends AdsSimInput {
  /** Ce qui reste sur 1 € de CA TTC une fois payés Uber et les ingrédients (HT). */
  marginPerRevenue: number;
  /** Ventes HT générées par 1 € HT de pub en plus, au niveau actuel. Null si aucune pub. */
  salesPerExtraEuro: number | null;
  recommendedWeekHt: number;
  changeRatio: number;
  decision: AdsDecision;
  /** Effet hebdomadaire de la pub conseillée. */
  extraRevenueWeek: number;
  extraProfitWeek: number;
}

export interface AdsContractRule {
  label: string;
  minAdsRatio: number;
  hqExtraRate: number;
  growthPenaltyEur: number | null;
}

export interface AdsSimResult {
  rows: AdsSimRow[];
  revenueWeek: number;
  adsNowWeek: number;
  adsRecommendedWeek: number;
  extraRevenueYear: number;
  extraProfitYear: number;
  counts: Record<AdsDecision, number>;
}

/** Marge après commission Uber et coût matière, par € de CA TTC, en HT. */
export function marginPerRevenue(payoutRatio: number, foodCost: number) {
  const salesHt = 1 / VAT_SALES;
  const uberFeesHt = (1 - payoutRatio) / VAT_FEES;
  return salesHt - uberFeesHt - foodCost * salesHt;
}

/** Pub HT où le dernier euro rapporte exactement un euro de marge. */
export function optimalAdsWeekHt(revenueWeek: number, margin: number, elasticity: number) {
  return Math.max(0, elasticity * margin * revenueWeek);
}

function bounds(adsWeekHt: number) {
  return adsWeekHt > 0 ? [adsWeekHt * MIN_FACTOR, adsWeekHt * MAX_FACTOR] : [0, START_BUDGET_CAP];
}

/** Répartit une enveloppe fixe au mieux, en respectant les bornes de chaque restaurant. */
function reallocate(rows: { r: AdsSimInput; margin: number }[], total: number): Map<string, number> {
  const out = new Map<string, number>();
  let free = rows.slice();
  for (let i = 0; i < 20 && free.length; i++) {
    const fixedSum = [...out.values()].reduce((s, v) => s + v, 0);
    const remaining = Math.max(0, total - fixedSum);
    const weight = free.reduce((s, x) => s + Math.max(0, x.margin) * x.r.revenueWeek, 0);
    const proposal = new Map(free.map((x) => [x.r.id, weight > 0 ? (remaining * Math.max(0, x.margin) * x.r.revenueWeek) / weight : 0]));
    const clamped = free.filter((x) => {
      const [lo, hi] = bounds(x.r.adsWeekHt);
      const v = proposal.get(x.r.id) ?? 0;
      if (v < lo) { out.set(x.r.id, lo); return true; }
      if (v > hi) { out.set(x.r.id, hi); return true; }
      return false;
    });
    if (!clamped.length) { proposal.forEach((v, k) => out.set(k, v)); break; }
    free = free.filter((x) => !clamped.includes(x));
  }
  return out;
}

export function simulateAdsBudget(
  inputs: AdsSimInput[],
  opts: { foodCost: number; elasticity: number; strategy: AdsStrategy },
): AdsSimResult {
  const prepared = inputs.map((r) => ({ r, margin: marginPerRevenue(r.payoutRatio, opts.foodCost) }));
  const totalNow = inputs.reduce((s, r) => s + r.adsWeekHt, 0);
  const realloc = opts.strategy === "reallocate" ? reallocate(prepared, totalNow) : null;

  const counts: Record<AdsDecision, number> = { increase: 0, keep: 0, reduce: 0 };
  let revenueWeek = 0, adsRecommendedWeek = 0, extraRevenueWeek = 0, extraProfitWeek = 0;

  const rows = prepared.map(({ r, margin }) => {
    const [lo, hi] = bounds(r.adsWeekHt);
    const target = realloc
      ? realloc.get(r.id) ?? r.adsWeekHt
      : Math.min(hi, Math.max(lo, optimalAdsWeekHt(r.revenueWeek, margin, opts.elasticity)));
    // modèle estimé sur log(1 + pub) : on garde la même forme
    const extraRevenue = r.revenueWeek * opts.elasticity * Math.log((1 + target) / (1 + r.adsWeekHt));
    const extraProfit = margin * extraRevenue - (target - r.adsWeekHt);
    const changeRatio = r.adsWeekHt > 0 ? target / r.adsWeekHt - 1 : target > 0 ? 1 : 0;
    const decision: AdsDecision = changeRatio > CHANGE_THRESHOLD ? "increase" : changeRatio < -CHANGE_THRESHOLD ? "reduce" : "keep";
    counts[decision]++;
    revenueWeek += r.revenueWeek; adsRecommendedWeek += target; extraRevenueWeek += extraRevenue; extraProfitWeek += extraProfit;
    return {
      ...r,
      marginPerRevenue: margin,
      salesPerExtraEuro: r.adsWeekHt > 0 ? (opts.elasticity * r.revenueWeek) / VAT_SALES / r.adsWeekHt : null,
      recommendedWeekHt: target,
      changeRatio,
      decision,
      extraRevenueWeek: extraRevenue,
      extraProfitWeek: extraProfit,
    };
  });

  return {
    rows,
    revenueWeek,
    adsNowWeek: totalNow,
    adsRecommendedWeek,
    extraRevenueYear: extraRevenueWeek * 52,
    extraProfitYear: extraProfitWeek * 52,
    counts,
  };
}

export interface AdsSimData {
  rows: AdsSimInput[];
  periodStart: string | null;
  periodEnd: string | null;
  rule: AdsContractRule | null;
}

type SimRpcRow = { restaurant_id: string; restaurant_name: string; revenue_week: number; ads_week_ht: number; payout_ratio: number; period_start: string; period_end: string };
type RuleRow = { label: string; min_ads_ratio: number; hq_extra_rate: number; growth_penalty_eur: number | null };

export async function fetchAdsSimulatorData(chainId: string): Promise<AdsSimData> {
  // Fonction et table ajoutées par la migration 20261113170000 (pas encore dans les types générés).
  const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: SimRpcRow[] | null; error: Error | null }>;
  const from = supabase.from as unknown as (t: string) => {
    select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: RuleRow | null; error: Error | null }> } };
  };
  const [sim, rule] = await Promise.all([
    rpc("get_ads_budget_simulator", { p_chain_id: chainId }),
    from("ads_contract_rules").select("label, min_ads_ratio, hq_extra_rate, growth_penalty_eur").eq("chain_id", chainId).maybeSingle(),
  ]);
  if (sim.error) throw sim.error;
  // Les règles de contrat sont facultatives : sans elles, pas d'alerte contrat, mais le simulateur fonctionne.
  if (rule.error) console.warn("[ads-simulator] règles de contrat indisponibles", rule.error);
  const data = sim.data ?? [];
  return {
    rows: data.map((d) => ({
      id: d.restaurant_id,
      name: d.restaurant_name,
      revenueWeek: Number(d.revenue_week) || 0,
      adsWeekHt: Number(d.ads_week_ht) || 0,
      payoutRatio: Number(d.payout_ratio) || 0,
    })),
    periodStart: data[0]?.period_start ?? null,
    periodEnd: data[0]?.period_end ?? null,
    rule: !rule.error && rule.data
      ? { label: rule.data.label, minAdsRatio: Number(rule.data.min_ads_ratio), hqExtraRate: Number(rule.data.hq_extra_rate), growthPenaltyEur: rule.data.growth_penalty_eur == null ? null : Number(rule.data.growth_penalty_eur) }
      : null,
  };
}
