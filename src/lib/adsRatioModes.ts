export type AdsRatioMode = "uber" | "comptable" | "tresorerie";

export const ADS_VAT_RATE = 0.2;

export const ADS_RATIO_MODES: Record<AdsRatioMode, { label: string; short: string; hint: string }> = {
  uber: {
    label: "Uber officiel",
    short: "Pub HT / CA TTC",
    hint: "Méthode Uber Eats : dépenses pub hors taxes rapportées au CA net TTC (ventes moins promos articles).",
  },
  comptable: {
    label: "Comptable réel",
    short: "Pub HT / CA HT",
    hint: "Ratio économique : dépenses pub HT rapportées au CA net HT. Base cohérente pour la rentabilité.",
  },
  tresorerie: {
    label: "Trésorerie",
    short: "Pub TTC / CA TTC",
    hint: "Ratio de trésorerie : dépenses pub TTC (TVA 20 %) rapportées au CA net TTC.",
  },
};

export interface AdsRatioInputs {
  adsHt: number;
  revenueTtc: number;
  revenueHt: number;
}

/** Numérateur / dénominateur selon le mode. Réseau = somme num/denom, jamais moyenne de %. */
export function computeAdsRatio(mode: AdsRatioMode, i: AdsRatioInputs) {
  const ads = mode === "tresorerie" ? i.adsHt * (1 + ADS_VAT_RATE) : i.adsHt;
  const revenue = mode === "comptable" ? i.revenueHt : i.revenueTtc;
  return { ads, revenue, pct: revenue > 0 ? (ads / revenue) * 100 : null };
}
