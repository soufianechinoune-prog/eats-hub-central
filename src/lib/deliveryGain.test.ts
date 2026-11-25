import { describe, expect, it } from "vitest";
import { deliveryGainTotals, parseDeliveryGainRows, perOrder } from "./deliveryGain";

const row = (o: Record<string, unknown>) => ({
  restaurant_id: "a", restaurant_name: "A", orders: 0, orders_with_offer: 0, markup: 0, delivery_fees: 0,
  cap_orders: 0, cap_cost: null, gain_cap: null, loss_orders_cap: 0,
  real_orders: 0, real_cost: null, gain_real: null, real_markup: null, real_delivery_fees: null,
  item_qty: 0, qty_ref_resto: 0, qty_ref_version: 0, qty_ref_grid: 0, qty_no_ref: 0, ...o,
});

describe("deliveryGainTotals", () => {
  // Chicken Street Reims, 1 → 24/11/2026 (contrôle du 25/11) : 21 commandes, toutes avec leur course Uber
  it("gain = markup + frais client − Uber Direct facturé", () => {
    const t = deliveryGainTotals(parseDeliveryGainRows([
      row({ orders: "21", markup: "75.35", delivery_fees: "103.90", real_orders: "21", real_cost: "183.36", gain_real: "-4.11",
        real_markup: "75.35", real_delivery_fees: "103.90", loss_orders_cap: "13", item_qty: "80", qty_no_ref: "4", orders_with_offer: "60" }),
    ]));
    expect(t.orders).toBe(21);
    expect(t.pricedOrders).toBe(21);
    expect(t.ordersWithoutUber).toBe(0);
    expect(t.markupPerOrder).toBeCloseTo(3.59, 2);
    expect(t.feesPerOrder).toBeCloseTo(4.95, 2);
    expect(t.uberPerOrder).toBeCloseTo(8.73, 2);
    expect(t.gain).toBeCloseTo(-4.11, 2);
    expect(t.gainPerOrder).toBeCloseTo(-0.2, 2);
    // les moyennes s'additionnent : 3,59 + 4,95 − 8,73 = −0,20 (à l'arrondi près)
    expect((t.markupPerOrder ?? 0) + (t.feesPerOrder ?? 0) - (t.uberPerOrder ?? 0)).toBeCloseTo(t.gainPerOrder ?? 99, 2);
    expect(t.lossOrders).toBe(13);
    expect(t.refCoveragePct).toBeCloseTo(95, 1);
  });

  it("commandes sans course Uber retrouvée : hors du gain, moyennes sur les seules commandes chiffrées", () => {
    const t = deliveryGainTotals(parseDeliveryGainRows([
      row({ orders: 10, markup: 30, delivery_fees: 50, real_orders: 8, real_cost: 64, gain_real: 0, real_markup: 24, real_delivery_fees: 40 }),
    ]));
    expect(t.ordersWithoutUber).toBe(2);
    expect(t.markupPerOrder).toBeCloseTo(3, 2);
    expect(t.feesPerOrder).toBeCloseTo(5, 2);
    expect(t.uberPerOrder).toBeCloseTo(8, 2);
    expect(t.gainPerOrder).toBeCloseTo(0, 2);
  });

  it("enseigne sans Uber Direct relié : markup et frais connus, gain inconnu (jamais de prix inventé)", () => {
    const t = deliveryGainTotals(parseDeliveryGainRows([row({ orders: 10, markup: 30, delivery_fees: 49 })]));
    expect(t.pricedOrders).toBe(0);
    expect(t.markupPerOrder).toBeCloseTo(3, 2);
    expect(t.feesPerOrder).toBeCloseTo(4.9, 2);
    expect(t.uberPerOrder).toBeNull();
    expect(t.gain).toBeNull();
    expect(t.gainPerOrder).toBeNull();
  });

  it("restaurant avec seulement des commandes avec offre : compté à part", () => {
    const t = deliveryGainTotals(parseDeliveryGainRows([row({ orders: 0, orders_with_offer: 12 })]));
    expect(t.restaurants).toBe(0);
    expect(t.ordersWithOffer).toBe(12);
    expect(t.markupPerOrder).toBeNull();
    expect(t.gain).toBeNull();
  });

  it("perOrder", () => {
    expect(perOrder(96.3, 21)).toBeCloseTo(4.59, 2);
    expect(perOrder(null, 21)).toBeNull();
    expect(perOrder(10, 0)).toBeNull();
  });
});
