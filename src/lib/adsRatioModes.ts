export type AdsRatioMode = "uber" | "comptable";

export const ADS_RATIO_MODES: Record<AdsRatioMode, { label: string; short: string; formula: string; what: string; note: string }> = {
  uber: {
    label: "Uber officiel",
    short: "méthode Uber",
    formula: "Pub HT ÷ CA net TTC",
    what: "Le ratio tel qu'Uber le communique dans ses bilans : pub hors taxes rapportée aux ventes TTC moins les promos.",
    note: "Uber ajoute aussi à son CA les frais de livraison et de service payés par les clients. Ces frais sont encaissés directement par Uber et ne nous sont pas transmis : notre chiffre est donc légèrement au-dessus du sien (environ 0,5 à 1 % d'écart).",
  },
  comptable: {
    label: "Comptable réel",
    short: "rentabilité réelle",
    formula: "Pub HT ÷ ventes HT",
    what: "Le vrai poids de la pub pour le restaurant : pub hors taxes rapportée aux ventes d'articles hors taxes (promos déduites).",
    note: "Sans TVA et sans les frais encaissés par Uber. C'est la référence pour piloter la marge.",
  },
};

export interface AdsRatioInputs {
  adsHt: number;
  revenueTtc: number;
  revenueHt: number;
}

/** Numérateur / dénominateur selon le mode. Réseau = somme num/denom, jamais moyenne de %. */
export function computeAdsRatio(mode: AdsRatioMode, i: AdsRatioInputs) {
  const revenue = mode === "comptable" ? i.revenueHt : i.revenueTtc;
  return { ads: i.adsHt, revenue, pct: revenue > 0 ? (i.adsHt / revenue) * 100 : null };
}
