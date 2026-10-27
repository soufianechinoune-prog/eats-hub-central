export type AdsEffortTier = "none" | "controlled" | "moderate" | "over";

/** Paliers d'effort pub (% pub / CA) : 0 = aucune pub, <1 maîtrisé, 1–2,5 modéré, >2,5 sur-dépense. */
export function getAdsEffortTier(adsSpend: number, pct: number | null): AdsEffortTier {
  if (!adsSpend || adsSpend <= 0 || pct == null || pct <= 0) return "none";
  if (pct < 1) return "controlled";
  if (pct <= 2.5) return "moderate";
  return "over";
}

export const ADS_EFFORT_TIERS: Record<AdsEffortTier, { label: string; range: string; className: string; barClass: string }> = {
  none: { label: "Aucune pub", range: "0 %", className: "bg-muted text-muted-foreground border-border", barClass: "bg-muted-foreground/40" },
  controlled: { label: "Maîtrisé", range: "< 1 %", className: "bg-success/10 text-success border-success/30", barClass: "bg-success" },
  moderate: { label: "Modéré", range: "1 – 2,5 %", className: "bg-warning/10 text-warning border-warning/30", barClass: "bg-warning" },
  over: { label: "Sur-dépense", range: "> 2,5 %", className: "bg-destructive/10 text-destructive border-destructive/30", barClass: "bg-destructive" },
};

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
