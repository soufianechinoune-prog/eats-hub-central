import { describe, expect, it } from "vitest";
import { deliveryGainTotals, offerInGain, parseDeliveryGainRows, parseOfferGainRows, parseOfferKind, perOrder, restaurantFigures } from "./deliveryGain";

const row = (o: Record<string, unknown>) => ({
  restaurant_id: "a", restaurant_name: "A", orders: 0, orders_with_offer: 0, markup: 0, delivery_fees: 0,
  cap_orders: 0, cap_cost: null, gain_cap: null, loss_orders_cap: 0,
  real_orders: 0, real_cost: null, gain_real: null, real_markup: null, real_delivery_fees: null,
  item_qty: 0, qty_ref_resto: 0, qty_ref_version: 0, qty_ref_grid: 0, qty_no_ref: 0,
  real_total: null, real_service_fees: null, chataigne_fees: null, stripe_fees: null, avg_distance_km: null,
  real_service_extra: null, real_stripe_extra: null, takeaway_gap: null, ...o,
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

  // Reims, 1 → 26/11/2026, toutes commandes offre neutralisée : 58 commandes. Gain, frais de service en plus,
  // Stripe en plus et écart viennent du contrôle du 27/11 ; les autres montants sont illustratifs.
  const reims = () => parseDeliveryGainRows([
    row({ orders: 60, markup: 200, delivery_fees: 290, real_orders: 58, real_cost: 498.1, gain_real: 1.66, real_markup: 195.2,
      real_delivery_fees: 304.56, real_total: 2075.3, real_service_fees: 115.42, chataigne_fees: 58, stripe_fees: 45.63, avg_distance_km: 2,
      real_service_extra: 57.42, real_stripe_extra: 8.69, takeaway_gap: 50.39 }),
  ]);

  it("ligne restaurant : mêmes colonnes que le détail des commandes, jusqu'à l'écart vs emporté", () => {
    const f = restaurantFigures(reims()[0]);
    expect(f).toMatchObject({ mk: 195.2, liv: 304.56, svc: 115.42, tot: 2075.3, ud: 498.1, km: 2, gain: 1.66, svcx: 57.42, stripex: 8.69, ecart: 50.39 });
    // écart vs emporté = gain livraison + frais de service en plus − Stripe en plus
    expect((f.gain ?? 0) + (f.svcx ?? 0) - (f.stripex ?? 0)).toBeCloseTo(f.ecart ?? 99, 2);
    const o = restaurantFigures(reims()[0], true);
    expect(o.gain).toBeCloseTo(0.03, 2);
    expect(o.ecart).toBeCloseTo(0.87, 2);
    expect(o.km).toBe(2);
  });

  it("écart vs emporté du réseau : somme des restaurants, moyenne sur les commandes chiffrées", () => {
    const t = deliveryGainTotals(reims());
    expect(t.serviceExtra).toBeCloseTo(57.42, 2);
    expect(t.stripeExtra).toBeCloseTo(8.69, 2);
    expect(t.takeawayGap).toBeCloseTo(50.39, 2);
    expect(t.takeawayGapPerOrder).toBeCloseTo(0.87, 2);
  });

  // Nice, commande K7V2 du 08/11/2026 : livrée 21,94 € pour le restaurant, la même en emporté 23,72 €
  it("une commande : l'écart vs emporté ne dépend pas du frais Châtaigne", () => {
    const f = restaurantFigures(parseDeliveryGainRows([row({ orders: 1, real_orders: 1, markup: 2.05, delivery_fees: 4.9, real_markup: 2.05, real_delivery_fees: 4.9,
      real_cost: 9.6, gain_real: -2.65, real_total: 33.29, real_service_fees: 1.99, real_service_extra: 0.99, real_stripe_extra: 0.12, takeaway_gap: -1.78 })])[0]);
    expect(f.gain).toBeCloseTo(-2.65, 2);
    expect(f.ecart).toBeCloseTo(-1.78, 2);
    expect(f.ecart).toBeCloseTo(21.94 - 23.72, 2);
  });

  it("enseigne sans réglage Stripe ou sans Uber : pas d'écart vs emporté inventé", () => {
    expect(deliveryGainTotals(parseDeliveryGainRows([row({ orders: 5, real_orders: 5, real_cost: 40, gain_real: -3, real_markup: 12, real_delivery_fees: 25, real_total: 150, real_service_fees: 9.95 })])).takeawayGap).toBeNull();
    const f = restaurantFigures(parseDeliveryGainRows([row({ orders: 4, markup: 12, delivery_fees: 20 })])[0], true);
    expect(f).toMatchObject({ mk: 3, liv: 5, gain: null, ecart: null, ud: null });
  });

  // Chicken Street, 1 → 26/11/2026 (contrôle du 27/11) : vue par offre
  const offers = [
    { offer_kind: "none", offer_labels: null, orders: 425, real_orders: 406, items_delivery: 9059.45, markup: 1121.1, delivery_fees: 1891.4, real_cost: 3383.4, gain_real: -370.9, loss_orders: 317, discounts: 0, discounts_all: 0, takeaway_gap: -20.3 },
    { offer_kind: "bienvenue", offer_labels: "Promo de bienvenue", orders: 957, real_orders: 938, items_delivery: 24335.7, markup: 3086.62, delivery_fees: 4694.2, real_cost: 8146.92, gain_real: -366.1, loss_orders: 621, discounts: 6086.31, discounts_all: 6195.95, takeaway_gap: 431.67 },
    { offer_kind: "parrainage", offer_labels: "Code Parrainage", orders: 121, real_orders: 118, items_delivery: 3675.5, markup: 475.4, delivery_fees: 539.2, real_cost: 970.56, gain_real: 44.04, loss_orders: 58, discounts: 858.53, discounts_all: 875.07 },
    { offer_kind: "article_offert", offer_labels: "1 naan tenders acheté = 1 offert - GTA VI", orders: 136, real_orders: 128, items_delivery: 3283.85, markup: 432.15, delivery_fees: 598.2, real_cost: 1073.28, gain_real: -42.93, loss_orders: 89, discounts: 1013.2, discounts_all: 1074.9 },
  ];

  it("vue par offre : moyennes sur les commandes dont la course est connue, remises à part", () => {
    const rows = parseOfferGainRows(offers, "all");
    const by = Object.fromEntries(rows.map((r) => [r.kind, r]));
    expect(by.none.gainPerOrder).toBeCloseTo(-0.91, 2);
    expect(by.bienvenue.gainPerOrder).toBeCloseTo(-0.39, 2);
    expect(by.bienvenue.itemsPerOrder).toBeCloseTo(25.94, 2);
    expect(by.bienvenue.discounts).toBeCloseTo(6195.95, 2);
    expect(by.bienvenue.discountPerOrder).toBeCloseTo(6.47, 2);
    expect(by.parrainage.gainPerOrder).toBeCloseTo(0.37, 2);
    expect(by.none.gapPerOrder).toBeCloseTo(-0.05, 2);
    expect(by.bienvenue.gapPerOrder).toBeCloseTo(0.46, 2);
    expect(by.parrainage.gapPerOrder).toBeNull();
    // l'article offert est montré mais reste hors du gain
    expect(rows.filter((r) => r.inGain).map((r) => r.kind)).toEqual(["none", "bienvenue", "parrainage"]);
    // le gain « toutes les commandes » est la somme des familles comptées : −692,96 €
    expect(rows.filter((r) => r.inGain).reduce((s, r) => s + (r.gain ?? 0), 0)).toBeCloseTo(-692.96, 2);
  });

  it("périmètre « sans offre » : seule la famille sans offre entre dans le gain", () => {
    expect(parseOfferGainRows(offers, "no_offer").filter((r) => r.inGain).map((r) => r.kind)).toEqual(["none"]);
    expect(offerInGain("article_offert", "all")).toBe(false);
    expect(offerInGain("promo", "all")).toBe(true);
  });

  it("famille d'offre inconnue : traitée comme une promo, sans course connue pas de moyenne inventée", () => {
    expect(parseOfferKind("nouveau_type")).toBe("promo");
    const r = parseOfferGainRows([{ offer_kind: "promo", orders: 3, real_orders: 0, discounts_all: 12 }], "all")[0];
    expect(r.gain).toBeNull();
    expect(r.gainPerOrder).toBeNull();
    expect(r.discountPerOrder).toBeCloseTo(4, 2);
  });
});
