/**
 * Commande WhatsApp livrée : ce que la livraison rapporte au restaurant.
 * Gain = markup + frais de livraison payés par le client − course facturée par Uber Direct.
 * Les lignes viennent de la fonction get_chataigne_delivery_gain (une ligne par restaurant,
 * commandes livrées sans offre client uniquement). Sources détaillées dans la migration 20261125120000.
 */

export interface DeliveryGainRow {
  restaurant_id: string;
  restaurant_name: string;
  orders: number;
  orders_with_offer: number;
  markup: number;
  delivery_fees: number;
  /** Anciens champs « avec plafond » : identiques aux champs real_* depuis la suppression du plafond (25/11/2026). */
  cap_orders: number;
  cap_cost: number | null;
  gain_cap: number | null;
  loss_orders_cap: number;
  /** Au prix facturé par Uber Direct (seulement les commandes dont la course a été retrouvée). */
  real_orders: number;
  real_cost: number | null;
  gain_real: number | null;
  real_markup: number | null;
  real_delivery_fees: number | null;
  /** Couverture du prix emporté de référence, en nombre d'articles. */
  item_qty: number;
  qty_ref_resto: number;
  qty_ref_version: number;
  qty_ref_grid: number;
  qty_no_ref: number;
  /** Sur les commandes dont la course Uber Direct est connue. */
  real_total: number | null;
  real_service_fees: number | null;
  /** Estimations réglées par enseigne (absentes de la donnée) ; null si l'enseigne n'a pas de réglage. */
  chataigne_fees: number | null;
  stripe_fees: number | null;
  avg_distance_km: number | null;
  /** Comparaison avec la même commande en emporté (commandes dont la course est connue). */
  /** Frais de service payés en plus par le client livré (frais livraison − frais emporté, lus dans la donnée). */
  real_service_extra: number | null;
  /** Frais Stripe en plus, parce que le client livré paie un total plus élevé (pourcentage estimé). */
  real_stripe_extra: number | null;
  /** Gain livraison + frais de service en plus − Stripe en plus. */
  takeaway_gap: number | null;
}

const n = (v: unknown) => Number(v) || 0;
const nn = (v: unknown) => (v == null ? null : Number(v));

export function parseDeliveryGainRows(data: unknown[] | null | undefined): DeliveryGainRow[] {
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    restaurant_id: String(r.restaurant_id),
    restaurant_name: String(r.restaurant_name ?? ""),
    orders: n(r.orders),
    orders_with_offer: n(r.orders_with_offer),
    markup: n(r.markup),
    delivery_fees: n(r.delivery_fees),
    cap_orders: n(r.cap_orders),
    cap_cost: nn(r.cap_cost),
    gain_cap: nn(r.gain_cap),
    loss_orders_cap: n(r.loss_orders_cap),
    real_orders: n(r.real_orders),
    real_cost: nn(r.real_cost),
    gain_real: nn(r.gain_real),
    real_markup: nn(r.real_markup),
    real_delivery_fees: nn(r.real_delivery_fees),
    item_qty: n(r.item_qty),
    qty_ref_resto: n(r.qty_ref_resto),
    qty_ref_version: n(r.qty_ref_version),
    qty_ref_grid: n(r.qty_ref_grid),
    qty_no_ref: n(r.qty_no_ref),
    real_total: nn(r.real_total),
    real_service_fees: nn(r.real_service_fees),
    chataigne_fees: nn(r.chataigne_fees),
    stripe_fees: nn(r.stripe_fees),
    avg_distance_km: nn(r.avg_distance_km),
    real_service_extra: nn(r.real_service_extra),
    real_stripe_extra: nn(r.real_stripe_extra),
    takeaway_gap: nn(r.takeaway_gap),
  }));
}

export interface DeliveryGainTotals {
  restaurants: number;
  /** Commandes livrées sans offre client. */
  orders: number;
  ordersWithOffer: number;
  /** Commandes dont on connaît le prix Uber Direct : le gain est calculé sur celles-ci. */
  pricedOrders: number;
  ordersWithoutUber: number;
  /** Moyennes par commande, sur les commandes dont on connaît le prix Uber Direct. */
  markupPerOrder: number | null;
  feesPerOrder: number | null;
  uberPerOrder: number | null;
  gain: number | null;
  gainPerOrder: number | null;
  lossOrders: number;
  /** Frais de service payés en plus par rapport à l'emporté. */
  serviceExtra: number | null;
  /** Frais Stripe en plus par rapport à l'emporté (estimé). */
  stripeExtra: number | null;
  /** Écart vs emporté = gain livraison + frais de service en plus − Stripe en plus ; null si inconnu. */
  takeawayGap: number | null;
  takeawayGapPerOrder: number | null;
  /** Part des articles dont on connaît le prix emporté (0 à 100). */
  refCoveragePct: number | null;
  itemsWithoutRef: number;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

/**
 * Le coût de la course est celui facturé par Uber Direct, lu dans la donnée (aucun prix saisi à la main).
 * Une commande sans course Uber retrouvée n'entre pas dans le gain. Sans aucun prix Uber (enseigne non
 * reliée), les moyennes markup / frais portent sur toutes les commandes et le gain reste inconnu.
 */
export function deliveryGainTotals(rows: DeliveryGainRow[]): DeliveryGainTotals {
  const active = rows.filter((r) => r.orders > 0);
  const sum = (f: (r: DeliveryGainRow) => number | null) => active.reduce((s, r) => s + (f(r) ?? 0), 0);
  const orders = sum((r) => r.orders);
  const priced = sum((r) => r.real_orders);
  const itemQty = sum((r) => r.item_qty);
  const noRef = sum((r) => r.qty_no_ref);
  const hasGap = priced > 0 && active.some((r) => r.real_orders > 0 && r.takeaway_gap != null);
  const takeawayGap = hasGap ? sum((r) => r.takeaway_gap) : null;
  return {
    restaurants: active.length,
    orders,
    ordersWithOffer: rows.reduce((s, r) => s + r.orders_with_offer, 0),
    pricedOrders: priced,
    ordersWithoutUber: orders - priced,
    markupPerOrder: priced > 0 ? div(sum((r) => r.real_markup), priced) : div(sum((r) => r.markup), orders),
    feesPerOrder: priced > 0 ? div(sum((r) => r.real_delivery_fees), priced) : div(sum((r) => r.delivery_fees), orders),
    uberPerOrder: div(sum((r) => r.real_cost), priced),
    gain: priced > 0 ? sum((r) => r.gain_real) : null,
    gainPerOrder: div(sum((r) => r.gain_real), priced),
    lossOrders: sum((r) => r.loss_orders_cap),
    serviceExtra: hasGap ? sum((r) => r.real_service_extra) : null,
    stripeExtra: hasGap ? sum((r) => r.real_stripe_extra) : null,
    takeawayGap,
    takeawayGapPerOrder: takeawayGap == null ? null : div(takeawayGap, priced),
    refCoveragePct: itemQty > 0 ? (100 * (itemQty - noRef)) / itemQty : null,
    itemsWithoutRef: noRef,
  };
}

export const perOrder = (total: number | null, orders: number) =>
  total == null || orders <= 0 ? null : total / orders;

/** Les colonnes « de bout en bout », identiques pour une commande et pour un restaurant. */
export interface GainFigures {
  art: number | null; // articles payés en livraison
  emp: number | null; // mêmes articles au prix emporté
  mk: number | null; // markup
  liv: number | null; // frais de livraison payés par le client
  svc: number | null; // frais de service payés par le client
  tot: number | null; // total payé par le client
  ud: number | null; // course facturée par Uber Direct
  km: number | null; // distance (moyenne pour un restaurant)
  gain: number | null; // gain livraison
  svcx: number | null; // frais de service en plus par rapport à l'emporté
  stripex: number | null; // frais Stripe en plus par rapport à l'emporté (estimé)
  ecart: number | null; // écart vs emporté
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Chiffres d'un restaurant, sur ses commandes dont la course Uber Direct est connue.
 * perOrderMode : moyenne par commande au lieu du total. Sans aucune course connue : markup et frais de
 * livraison de toutes les commandes, le reste inconnu.
 */
export function restaurantFigures(r: DeliveryGainRow, perOrderMode = false): GainFigures {
  const nPriced = r.real_orders;
  if (nPriced <= 0) {
    const d = perOrderMode ? Math.max(r.orders, 1) : 1;
    return { art: null, emp: null, mk: r2(r.markup / d), liv: r2(r.delivery_fees / d), svc: null, tot: null, ud: null, km: null, gain: null, svcx: null, stripex: null, ecart: null };
  }
  const d = perOrderMode ? nPriced : 1;
  const v = (x: number | null) => (x == null ? null : r2(x / d));
  const art = r.real_total == null || r.real_delivery_fees == null || r.real_service_fees == null ? null : r.real_total - r.real_delivery_fees - r.real_service_fees;
  const emp = art == null || r.real_markup == null ? null : art - r.real_markup;
  return {
    art: v(art), emp: v(emp), mk: v(r.real_markup), liv: v(r.real_delivery_fees), svc: v(r.real_service_fees), tot: v(r.real_total),
    ud: v(r.real_cost), km: r.avg_distance_km, gain: v(r.gain_real), svcx: v(r.real_service_extra), stripex: v(r.real_stripe_extra), ecart: v(r.takeaway_gap),
  };
}

/* ---------------- Offres client ---------------- */

/** Périmètre du calcul : toutes les commandes (offre neutralisée) ou seulement celles sans offre. */
export type GainScope = "all" | "no_offer";

/** Famille d'offre, déduite du nom de l'offre lu dans la commande (voir migration 20261127090000). */
export type OfferKind = "none" | "bienvenue" | "parrainage" | "promo" | "article_offert";

export const OFFER_KIND_LABEL: Record<OfferKind, string> = {
  none: "Sans offre",
  bienvenue: "Bienvenue",
  parrainage: "Parrainage",
  promo: "Promo",
  article_offert: "Article offert",
};

const OFFER_KINDS = Object.keys(OFFER_KIND_LABEL) as OfferKind[];
export const parseOfferKind = (v: unknown): OfferKind => (OFFER_KINDS.includes(v as OfferKind) ? (v as OfferKind) : "promo");

/** L'article offert reste hors du gain : neutraliser l'offre reviendrait à compter l'article gratuit comme payé. */
export const offerInGain = (kind: OfferKind, scope: GainScope) => (scope === "all" ? kind !== "article_offert" : kind === "none");

export interface OfferGainRow {
  kind: OfferKind;
  /** Noms des offres tels qu'ils apparaissent dans les commandes. */
  labels: string | null;
  /** Toutes les commandes livrées de la famille. */
  orders: number;
  /** Celles dont la course Uber Direct est connue : base des moyennes. */
  pricedOrders: number;
  itemsPerOrder: number | null;
  markupPerOrder: number | null;
  feesPerOrder: number | null;
  uberPerOrder: number | null;
  gain: number | null;
  gainPerOrder: number | null;
  /** Écart vs emporté, par commande ; null si inconnu. */
  gapPerOrder: number | null;
  lossOrders: number;
  /** Remises accordées sur toutes les commandes de la famille : le coût de l'offre, hors gain livraison. */
  discounts: number;
  discountPerOrder: number | null;
  inGain: boolean;
}

export function parseOfferGainRows(data: unknown[] | null | undefined, scope: GainScope): OfferGainRow[] {
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const kind = parseOfferKind(r.offer_kind);
    const orders = n(r.orders);
    const priced = n(r.real_orders);
    const avg = (v: unknown) => (priced > 0 && v != null ? Number(v) / priced : null);
    return {
      kind,
      labels: r.offer_labels == null ? null : String(r.offer_labels),
      orders,
      pricedOrders: priced,
      itemsPerOrder: avg(r.items_delivery),
      markupPerOrder: avg(r.markup),
      feesPerOrder: avg(r.delivery_fees),
      uberPerOrder: avg(r.real_cost),
      gain: priced > 0 ? nn(r.gain_real) : null,
      gainPerOrder: avg(r.gain_real),
      gapPerOrder: avg(r.takeaway_gap),
      lossOrders: n(r.loss_orders),
      discounts: n(r.discounts_all),
      discountPerOrder: div(n(r.discounts_all), orders),
      inGain: offerInGain(kind, scope),
    };
  });
}
