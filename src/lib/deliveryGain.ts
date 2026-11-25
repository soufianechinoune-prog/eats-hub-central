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
    refCoveragePct: itemQty > 0 ? (100 * (itemQty - noRef)) / itemQty : null,
    itemsWithoutRef: noRef,
  };
}

export const perOrder = (total: number | null, orders: number) =>
  total == null || orders <= 0 ? null : total / orders;
