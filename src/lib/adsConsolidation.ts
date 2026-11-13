import { differenceInCalendarDays } from "date-fns";

/**
 * Période de consolidation de la pub Uber : 14 jours après la fin de la période.
 * Mesuré en base (13/11/2026) : la pub d'une semaine est rattachée au versement
 * du lundi suivant, et ses lignes arrivent en plusieurs vagues sur ~8 jours après
 * ce versement (ex. versement du 02/11 : arrivées les 02, 03, 06 et 10/11).
 * Même seuil que la zone grisée du graphique (AdsSpendAnalysis).
 * Avertissement de fraîcheur, pas une preuve de complétude.
 */
export const ADS_CONSOLIDATION_DAYS = 14;

export function isAdsConsolidating(endDate: Date, today = new Date()): boolean {
  const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  const [year, month, day] = parisDay.split("-").map(Number);
  return differenceInCalendarDays(new Date(year, month - 1, day), endDate) < ADS_CONSOLIDATION_DAYS;
}
