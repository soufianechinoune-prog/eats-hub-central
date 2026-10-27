export type AdsEffortTier = "none" | "t1" | "t2" | "t3" | "t4";

/**
 * Paliers neutres de ratio pub / CA : 0 %, < 1 %, 1 – 2,5 %, 2,5 – 5 %, > 5 %.
 * Pas de jugement (maîtrisé / sur-dépense) : le bon niveau dépend de l'investissement négocié avec Uber Eats.
 */
export function getAdsEffortTier(adsSpend: number, pct: number | null): AdsEffortTier {
  if (!adsSpend || adsSpend <= 0 || pct == null || pct <= 0) return "none";
  if (pct < 1) return "t1";
  if (pct < 2.5) return "t2";
  if (pct <= 5) return "t3";
  return "t4";
}

export const ADS_EFFORT_TIERS: Record<AdsEffortTier, { label: string; range: string; className: string; barClass: string }> = {
  none: { label: "0 %", range: "aucune pub", className: "bg-muted text-muted-foreground border-border", barClass: "bg-muted-foreground/40" },
  t1: { label: "< 1 %", range: "jusqu'à 1 %", className: "bg-uber/5 text-uber border-uber/20", barClass: "bg-uber/30" },
  t2: { label: "1 – 2,5 %", range: "de 1 à 2,5 %", className: "bg-uber/10 text-uber border-uber/30", barClass: "bg-uber/55" },
  t3: { label: "2,5 – 5 %", range: "de 2,5 à 5 %", className: "bg-uber/15 text-uber border-uber/40", barClass: "bg-uber/80" },
  t4: { label: "> 5 %", range: "plus de 5 %", className: "bg-uber/25 text-uber border-uber/60", barClass: "bg-uber" },
};

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Bornes d'un trimestre civil (q = 1..4), tronquées à aujourd'hui. */
export function quarterRange(year: number, q: number, today = new Date()) {
  const start = new Date(year, (q - 1) * 3, 1);
  const end = new Date(year, q * 3, 0);
  return { start, end: end > today ? today : end, future: start > today };
}
