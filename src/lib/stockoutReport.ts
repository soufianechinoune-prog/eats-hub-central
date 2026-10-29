import type { HistoryStockout } from "./stockoutHistory";

export interface ReportStockout extends HistoryStockout { ended_at: string | null }
export interface ReportRestaurant { id: string; name: string }

/** Paris calendar midnight, including the DST offset applicable to that date. */
export function parisMidnight(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const value = (key: string) => Number(parts.find(p => p.type === key)?.value ?? 0);
    const wall = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    instant += target - wall;
  }
  return instant;
}

function nextDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10); // Pure calendar arithmetic; not a local date conversion.
}

export function buildStockoutReport(source: ReportStockout[], scope: ReportRestaurant[], start: string, end: string, restaurantId: string | null, product: string | null, now = Date.now()) {
  const lower = parisMidnight(start), upper = Math.min(parisMidnight(nextDate(end)), now);
  const allowed = new Set(scope.map(r => r.id));
  const network = source.filter(r => allowed.has(r.restaurant_id) && !r.item_id.startsWith("ing") && (!product || r.product_name === product)).map(r => {
    const from = Math.max(lower, Date.parse(r.started_at));
    const to = Math.min(upper, r.ended_at ? Date.parse(r.ended_at) : now);
    return { ...r, from, to, minutes: Math.max(0, (to - from) / 60000) };
  }).filter(r => r.minutes > 0);
  const rows = network.filter(r => !restaurantId || r.restaurant_id === restaurantId);
  const days: { date: string; minutes: number; events: number }[] = [];
  for (let date = start; date <= end && parisMidnight(date) < upper; date = nextDate(date)) {
    const a = parisMidnight(date), b = Math.min(parisMidnight(nextDate(date)), upper);
    const intervals = rows.filter(r => r.from < b && r.to > a);
    days.push({ date, minutes: intervals.reduce((sum, r) => sum + Math.max(0, Math.min(b, r.to) - Math.max(a, r.from)) / 60000, 0), events: intervals.length });
  }
  const summarize = (list: typeof network) => ({ events: list.length, minutes: list.reduce((s, r) => s + r.minutes, 0), products: new Set(list.map(r => r.product_name)).size });
  const restaurants = scope.map(r => {
    const list = network.filter(x => x.restaurant_id === r.id);
    return { ...r, ...summarize(list), observed: list.length > 0 };
  }).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, "fr"));
  const products = [...new Set(rows.map(r => r.product_name))].map(name => {
    const list = rows.filter(r => r.product_name === name);
    const networkList = network.filter(r => r.product_name === name);
    return { name, ...summarize(list), restaurants: new Set(list.map(r => r.restaurant_id)).size, networkRestaurants: new Set(networkList.map(r => r.restaurant_id)).size, networkShare: scope.length ? new Set(networkList.map(r => r.restaurant_id)).size / scope.length * 100 : 0 };
  }).sort((a, b) => b.minutes - a.minutes);
  const resolved = rows.filter(r => r.ended_at && Date.parse(r.ended_at) <= upper);
  const fullDurations = resolved.map(r => (Date.parse(r.ended_at ?? r.started_at) - Date.parse(r.started_at)) / 60000);
  const total = summarize(rows);
  const observedRestaurants = restaurants.filter(r => r.observed);
  const values = observedRestaurants.map(r => r.minutes).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const medianMinutes = values.length ? (values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2) : null;
  return { start, end, generatedAt: now, restaurantId, product, rows, days, restaurants, products, total, scopeCount: scope.length, observedCount: observedRestaurants.length, medianMinutes, resolvedCount: resolved.length, resolvedAverage: fullDurations.length ? fullDurations.reduce((s, n) => s + n, 0) / fullDurations.length : null, quick: fullDurations.filter(n => n < 180).length, prolonged: fullDurations.filter(n => n > 1440).length };
}
export type StockoutReport = ReturnType<typeof buildStockoutReport>;
export const reportHours = (minutes: number) => `${(minutes / 60).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
export const reportDate = (instant: string | number) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(new Date(instant));
export const stockoutReportMethod = [
  "Source : ruptures enregistrées par les notifications Splash et rattachées à un restaurant. Les ingrédients techniques sont exclus.",
  "Durées limitées à l’intersection avec la période choisie (jours civils de Paris), jusqu’à la date de génération pour les ruptures ouvertes. Plusieurs produits peuvent être indisponibles simultanément : les heures sont des heures-produit, pas des heures de fermeture.",
  "Part du périmètre = restaurants ayant une rupture enregistrée pour le produit ÷ restaurants sélectionnés. Ce n’est pas un taux de disponibilité du catalogue.",
  "Sans événement ne signifie pas sans rupture : les correspondances de caisses et l’historique sont encore partiels. La médiane utilise uniquement les restaurants avec une rupture enregistrée.",
  "Le temps de remise en stock utilise la durée complète des ruptures résolues au plus tard à la fin de période. Les ruptures encore ouvertes sont exclues de cette moyenne.",
  "Une désactivation peut être volontaire avant un lancement. Aucun incident, problème fournisseur ou manque à gagner n’est déduit automatiquement. Le taux réel de disponibilité nécessite le catalogue complet et une couverture des notifications validée.",
];