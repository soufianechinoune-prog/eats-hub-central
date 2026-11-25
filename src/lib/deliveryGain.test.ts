import { describe, expect, it } from "vitest";
import { deliveryGainTotals, parseDeliveryGainRows, perOrder } from "./deliveryGain";

const row = (o: Record<string, unknown>) => ({
  restaurant_id: "a", restaurant_name: "A", orders: 0, orders_with_offer: 0, markup: 0, delivery_fees: 0,
  cap_orders: 0, cap_cost: null, gain_cap: null, loss_orders_cap: 0,
  real_orders: 0, real_cost: null, gain_real: null, real_markup: null, real_delivery_fees: null,
  item_qty: 0, qty_ref_resto: 0, qty_ref_version: 0, qty_ref_grid: 0, qty_no_ref: 0, ...o,
});

describe("deliveryGainTotals", () => {
  // Chicken Street, 24/10 → 17/11/2026 (contrôle du 25/11) : 426 commandes, 2,81 + 4,57 − 3,60 = 3,79 €
  it("retrouve le gain par commande du réseau", () => {
    const rows = parseDeliveryGainRows([
      row({ restaurant_id: "a", orders: "300", markup: "843.00", delivery_fees: "1371.00", cap_orders: "300", cap_cost: "1080.00", gain_cap: "1134.00",
        real_orders: "295", real_cost: "2433.75", gain_real: "-250.00", item_qty: "1200", qty_no_ref: "40", orders_with_offer: "800" }),
      row({ restaurant_id: "b", orders: "126", markup: "354.96", delivery_fees: "577.40", cap_orders: "126", cap_cost: "453.60", gain_cap: "478.76",
        real_orders: "122", real_cost: "1006.50", gain_real: "-116.66", item_qty: "554", qty_no_ref: "27", loss_orders_cap: "4", orders_with_offer: "334" }),
    ]);
    const t = deliveryGainTotals(rows);
    expect(t.orders).toBe(426);
    expect(t.ordersWithOffer).toBe(1134);
    expect(t.markupPerOrder).toBeCloseTo(2.81, 2);
    expect(t.feesPerOrder).toBeCloseTo(4.57, 2);
    expect(t.capCostPerOrder).toBeCloseTo(3.6, 2);
    expect(t.gainCapPerOrder).toBeCloseTo(3.79, 2);
    expect(t.gainCap).toBeCloseTo(1612.76, 2);
    expect(t.realOrders).toBe(417);
    expect(t.realCostPerOrder).toBeCloseTo(8.25, 2);
    expect(t.gainRealPerOrder).toBeCloseTo(-0.88, 2);
    expect(t.lossOrdersCap).toBe(4);
    expect(t.refCoveragePct).toBeCloseTo(96.2, 1);
  });

  it("enseigne sans Uber Direct connecté : pas de vrai tarif, pas de zéro inventé", () => {
    const t = deliveryGainTotals(parseDeliveryGainRows([
      row({ orders: 10, markup: 30, delivery_fees: 49, cap_orders: 10, cap_cost: 36, gain_cap: 43 }),
    ]));
    expect(t.gainReal).toBeNull();
    expect(t.gainRealPerOrder).toBeNull();
    expect(t.realCostPerOrder).toBeNull();
    expect(t.gainCapPerOrder).toBeCloseTo(4.3, 2);
  });

  it("restaurant avec seulement des commandes avec offre : compté à part", () => {
    const t = deliveryGainTotals(parseDeliveryGainRows([row({ orders: 0, orders_with_offer: 12 })]));
    expect(t.restaurants).toBe(0);
    expect(t.ordersWithOffer).toBe(12);
    expect(t.markupPerOrder).toBeNull();
    expect(t.gainCap).toBeNull();
  });

  it("perOrder", () => {
    expect(perOrder(96.3, 21)).toBeCloseTo(4.59, 2);
    expect(perOrder(null, 21)).toBeNull();
    expect(perOrder(10, 0)).toBeNull();
  });
});
