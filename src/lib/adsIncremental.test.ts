import { describe, expect, it } from "vitest";
import { computeIncremental, findTwins, payoutGrowth, MIN_TWINS } from "@/lib/adsIncremental";
import type { AdsEfficiencyRow } from "@/lib/adsEfficiency";

const row = (id: string, revPrev: number, payout: number, payoutPrev: number, ads = 0): AdsEfficiencyRow => ({
  restaurant_id: id, ads_ht: ads, rev_ttc: revPrev * 1.1, rev_prev_ttc: revPrev, payout, payout_prev: payoutPrev,
});

describe("payoutGrowth", () => {
  it("calcule la croissance du versement, pas du CA", () => {
    expect(payoutGrowth(row("a", 100000, 55000, 50000))).toBeCloseTo(0.1);
    expect(payoutGrowth(row("b", 100000, 55000, 0))).toBeNull();
  });
});

describe("findTwins", () => {
  const rows = [
    row("target", 100000, 60000, 50000, 2000),
    row("near1", 105000, 52000, 50000),
    row("near2", 95000, 48000, 50000),
    row("near3", 110000, 51000, 50000),
    row("far", 500000, 250000, 200000),
    row("noprev", 100000, 50000, 0),
  ];
  it("retient les plus proches en taille et exclut la cible et les non comparables", () => {
    const twins = findTwins(rows, "target", 3).map((t) => t.restaurant_id);
    expect(twins).toEqual(["near1", "near2", "near3"]);
    expect(twins).not.toContain("target");
    expect(twins).not.toContain("far");
    expect(twins).not.toContain("noprev");
  });
});

describe("computeIncremental", () => {
  it("compare le versement réel au contrefactuel au rythme médian des jumeaux", () => {
    // 5 jumeaux de taille proche, croissances du versement : +0 %, +5 %, +10 %, +15 %, +20 % → médiane +10 %
    const rows = [
      row("t", 100000, 60000, 50000, 3000),
      row("j1", 98000, 50000, 50000),
      row("j2", 99000, 52500, 50000),
      row("j3", 101000, 55000, 50000),
      row("j4", 102000, 57500, 50000),
      row("j5", 103000, 60000, 50000),
    ];
    const r = computeIncremental(rows, "t");
    expect(r.twinsGrowth).toBeCloseTo(0.1);
    expect(r.counterfactual).toBeCloseTo(55000);
    expect(r.incremental).toBeCloseTo(5000);
    expect(r.roas).toBeCloseTo(5000 / 3000);
  });

  it("renvoie un résultat vide sous le minimum de jumeaux", () => {
    const rows = [row("t", 100000, 60000, 50000, 3000), row("j1", 98000, 50000, 50000)];
    const r = computeIncremental(rows, "t");
    expect(r.incremental).toBeNull();
    expect(r.twins.length).toBeLessThan(MIN_TWINS);
  });

  it("ROAS nul quand le restaurant ne fait pas de pub", () => {
    const rows = [
      row("t", 100000, 60000, 50000, 0),
      row("j1", 98000, 50000, 50000),
      row("j2", 99000, 52500, 50000),
      row("j3", 101000, 55000, 50000),
    ];
    expect(computeIncremental(rows, "t").roas).toBeNull();
  });
});
