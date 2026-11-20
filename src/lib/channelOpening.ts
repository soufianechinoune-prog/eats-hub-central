/**
 * Dates d'ouverture PAR CANAL (validé avec Soufiane le 20/11/2026).
 *
 * Un restaurant n'ouvre pas tous ses canaux le même jour (caisse d'abord, Uber des mois après, ou
 * l'inverse). Et le premier jour de données n'est pas toujours une ouverture : c'est parfois le début
 * de notre historique (Villeneuve-la-Garenne : caisse « depuis le 01/02/2026 », déjà du CA ce jour-là).
 *
 * Colonnes calculées chaque nuit par refresh_restaurant_channel_dates :
 *   <canal>_first_date, <canal>_history_start, <canal>_is_opening.
 * Une date saisie à la main (uber_opening_date, deliveroo_opening_date) prime sur le calcul.
 */

export type OpeningChannel = "uber" | "cash" | "deliveroo";
export type ScopeChannel = OpeningChannel | "all";

export interface ChannelDatesRow {
  uber_opening_date?: string | null;
  deliveroo_opening_date?: string | null;
  uber_first_date?: string | null;
  uber_history_start?: string | null;
  uber_is_opening?: boolean | null;
  cash_first_date?: string | null;
  cash_history_start?: string | null;
  cash_is_opening?: boolean | null;
  deliveroo_first_date?: string | null;
  deliveroo_history_start?: string | null;
  deliveroo_is_opening?: boolean | null;
}

export const CHANNEL_DATE_COLUMNS =
  "uber_first_date, uber_history_start, uber_is_opening, cash_first_date, cash_history_start, cash_is_opening, deliveroo_first_date, deliveroo_history_start, deliveroo_is_opening";

export const CHANNEL_LABEL: Record<OpeningChannel, string> = { uber: "Uber Eats", cash: "caisse", deliveroo: "Deliveroo" };

const valid = (d: string | null | undefined): d is string => !!d && d >= "2015-01-01";

export interface ChannelOpening {
  /** Vraie date d'ouverture du canal (saisie, ou détectée avec des jours vides avant). */
  opening: string | null;
  /** Début de nos données pour ce canal. */
  historyStart: string | null;
  /** Le canal a de l'activité dans nos données. */
  hasData: boolean;
}

export function channelOpening(r: ChannelDatesRow, channel: OpeningChannel): ChannelOpening {
  if (channel === "uber") {
    const manual = valid(r.uber_opening_date) ? r.uber_opening_date : null;
    return {
      opening: manual ?? (r.uber_is_opening && valid(r.uber_first_date) ? r.uber_first_date : null),
      historyStart: valid(r.uber_history_start) ? r.uber_history_start : null,
      hasData: valid(r.uber_first_date),
    };
  }
  if (channel === "deliveroo") {
    const manual = valid(r.deliveroo_opening_date) ? r.deliveroo_opening_date : null;
    return {
      opening: manual ?? (r.deliveroo_is_opening && valid(r.deliveroo_first_date) ? r.deliveroo_first_date : null),
      historyStart: valid(r.deliveroo_history_start) ? r.deliveroo_history_start : null,
      hasData: valid(r.deliveroo_first_date),
    };
  }
  return {
    opening: r.cash_is_opening && valid(r.cash_first_date) ? r.cash_first_date : null,
    historyStart: valid(r.cash_history_start) ? r.cash_history_start : null,
    hasData: valid(r.cash_first_date),
  };
}

/**
 * Statut de comparaison N vs N-1 pour un canal :
 *   new        : le canal a ouvert après le début de N-1 → « Nouveau », pas de pourcentage ;
 *   incomplete : nos données du canal commencent après le début de N-1 → « Historique incomplet » ;
 *   ok         : comparable ;
 *   none       : aucune donnée sur ce canal.
 */
export type N1Status = "new" | "incomplete" | "ok" | "none";

export const shiftYear = (iso: string, years: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  if (dt.getUTCDate() !== d) dt.setUTCDate(0); // 29 février → 28
  return dt.toISOString().slice(0, 10);
};

export function channelN1Status(r: ChannelDatesRow, channel: OpeningChannel, periodStart: string): N1Status {
  const c = channelOpening(r, channel);
  if (!c.hasData && !c.opening) return "none";
  const prevStart = shiftYear(periodStart, -1);
  if (c.opening && c.opening > prevStart) return "new";
  if (c.historyStart && c.historyStart > prevStart) return "incomplete";
  return "ok";
}

export interface RestaurantN1 {
  status: N1Status;
  /** Canal et date qui expliquent le statut (pour l'info-bulle). */
  channel: OpeningChannel | null;
  date: string | null;
  /** Canaux ouverts pendant la période alors que le restaurant existait déjà (ex. « Uber depuis le 18/05/26 »). */
  addedChannels: { channel: OpeningChannel; date: string }[];
}

/**
 * Statut d'un restaurant sur plusieurs canaux (vue « Tous canaux », ou Uber + Deliveroo) :
 *   new        : tous ses canaux ont ouvert après le début de N-1 ;
 *   incomplete : un de ses canaux a un historique qui commence après le début de N-1 ;
 *   ok         : comparable (un canal ajouté en cours de route est signalé dans addedChannels).
 */
export function restaurantN1Status(
  r: ChannelDatesRow,
  scope: ScopeChannel,
  periodStart: string,
  channels: OpeningChannel[] = ["uber", "cash", "deliveroo"],
): RestaurantN1 {
  if (scope !== "all") {
    const status = channelN1Status(r, scope, periodStart);
    const c = channelOpening(r, scope);
    return {
      status,
      channel: scope,
      date: status === "new" ? c.opening : status === "incomplete" ? c.historyStart : null,
      addedChannels: [],
    };
  }
  const items = channels
    .map((ch) => ({ ch, status: channelN1Status(r, ch, periodStart), c: channelOpening(r, ch) }))
    .filter((x) => x.status !== "none");
  if (items.length === 0) return { status: "none", channel: null, date: null, addedChannels: [] };
  // Le restaurant est nouveau si son tout premier signe de vie (ouverture ou début de données, tous canaux)
  // est une vraie ouverture postérieure au début de N-1. Ex. Villeneuve : Uber ouvert le 24/03/2025,
  // caisse suivie seulement depuis le 01/02/2026 → nouveau en 2026, pas « historique incomplet ».
  const prevStart = shiftYear(periodStart, -1);
  const earliest = [...items]
    .map((x) => ({ ...x, d: x.c.opening ?? x.c.historyStart ?? "" }))
    .sort((a, b) => a.d.localeCompare(b.d))[0];
  if (earliest.c.opening && earliest.d === earliest.c.opening && earliest.d > prevStart) {
    return { status: "new", channel: earliest.ch, date: earliest.c.opening, addedChannels: [] };
  }
  const added = items
    .filter((x) => x.status === "new" && x.c.opening)
    .map((x) => ({ channel: x.ch, date: x.c.opening as string }));
  const incomplete = items.find((x) => x.status === "incomplete");
  if (incomplete) {
    return { status: "incomplete", channel: incomplete.ch, date: incomplete.c.historyStart, addedChannels: added };
  }
  return { status: "ok", channel: null, date: null, addedChannels: added };
}

export const frDate = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");

/** Texte de l'info-bulle pour un statut. */
export function n1StatusTooltip(n1: RestaurantN1): string {
  const label = n1.channel ? CHANNEL_LABEL[n1.channel] : "";
  if (n1.status === "new") {
    const what = n1.channel === "cash" ? "Caisse ouverte" : n1.channel ? `${label} ouvert` : "Ouvert";
    return `${what} le ${frDate(n1.date)}, après le début de la période N-1 : pas de comparaison possible. Ce restaurant n'entre pas dans l'évolution à périmètre constant.`;
  }
  if (n1.status === "incomplete") {
    return `Nos données ${label} ne commencent que le ${frDate(n1.date)} : la période N-1 est incomplète, la variation serait fausse. Ce restaurant n'entre pas dans l'évolution à périmètre constant.`;
  }
  return "";
}
