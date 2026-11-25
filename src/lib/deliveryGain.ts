/**
 * Commande WhatsApp livrée : ce que la livraison rapporte au restaurant.
 * Gain = markup + frais de livraison payés par le client − coût de la course Uber Direct.
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
  /** Avec l'offre Uber Direct (plafond par course). */
  cap_orders: number;
  cap_cost: number | null;
  gain_cap: number | null;
  loss_orders_cap: number;
  /** Au prix réel de chaque course (seulement les commandes dont on connaît le prix Uber). */
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
  orders: number;
  ordersWithOffer: number;
  /** Moyennes par commande (null s'il n'y a aucune commande). */
  markupPerOrder: number | null;
  feesPerOrder: number | null;
  capCostPerOrder: number | null;
  gainCap: number | null;
  gainCapPerOrder: number | null;
  capOrders: number;
  lossOrdersCap: number;
  realOrders: number;
  realCostPerOrder: number | null;
  gainReal: number | null;
  gainRealPerOrder: number | null;
  /** Part des articles dont on connaît le prix emporté (0 à 100). */
  refCoveragePct: number | null;
  itemsWithoutRef: number;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export function deliveryGainTotals(rows: DeliveryGainRow[]): DeliveryGainTotals {
  const active = rows.filter((r) => r.orders > 0);
  const sum = (f: (r: DeliveryGainRow) => number | null) => active.reduce((s, r) => s + (f(r) ?? 0), 0);
  const orders = sum((r) => r.orders);
  const capOrders = sum((r) => r.cap_orders);
  const realOrders = sum((r) => r.real_orders);
  const itemQty = sum((r) => r.item_qty);
  const noRef = sum((r) => r.qty_no_ref);
  return {
    restaurants: active.length,
    orders,
    ordersWithOffer: rows.reduce((s, r) => s + r.orders_with_offer, 0),
    markupPerOrder: div(sum((r) => r.markup), orders),
    feesPerOrder: div(sum((r) => r.delivery_fees), orders),
    capCostPerOrder: div(sum((r) => r.cap_cost), capOrders),
    gainCap: capOrders > 0 ? sum((r) => r.gain_cap) : null,
    gainCapPerOrder: div(sum((r) => r.gain_cap), capOrders),
    capOrders,
    lossOrdersCap: sum((r) => r.loss_orders_cap),
    realOrders,
    realCostPerOrder: div(sum((r) => r.real_cost), realOrders),
    gainReal: realOrders > 0 ? sum((r) => r.gain_real) : null,
    gainRealPerOrder: div(sum((r) => r.gain_real), realOrders),
    refCoveragePct: itemQty > 0 ? (100 * (itemQty - noRef)) / itemQty : null,
    itemsWithoutRef: noRef,
  };
}

export const perOrder = (total: number | null, orders: number) =>
  total == null || orders <= 0 ? null : total / orders;
