import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const CHAIN_ID = "11111111-1111-1111-1111-111111111111";

vi.mock("@/contexts/AnalyticsContext", () => ({
  useAnalyticsContext: () => ({ selectedChainId: CHAIN_ID }),
}));

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { useSplashOnsiteMonthly, avgBasket, deltaPct } from "./useSplashOnsiteMonthly";

const month = (y: number, m: number, ttc: number, orders: number) => ({
  y,
  m,
  ttc,
  ht: ttc / 1.1,
  orders,
  days_count: 30,
  days_zero: 0,
});

// 2 restaurants, mars + avril, 2026 vs 2025
const payload = {
  restaurants: [
    {
      restaurant_id: "r1",
      name: "Resto 1",
      months: [
        month(2026, 3, 1200, 100),
        month(2026, 4, 1500, 100),
        month(2025, 3, 900, 90),
        month(2025, 4, 1000, 80),
      ],
    },
    {
      restaurant_id: "r2",
      name: "Resto 2",
      months: [
        month(2026, 3, 800, 50),
        month(2026, 4, 500, 25),
        month(2025, 3, 600, 40),
        month(2025, 4, 700, 35),
      ],
    },
  ],
  coverage: { days_zero_current: 0, unmapped_splash_ids: 0, unmapped_revenue_ttc: 0 },
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
};

const render = async () => {
  rpcMock.mockResolvedValue({ data: payload, error: null });
  const { result } = renderHook(
    () => useSplashOnsiteMonthly({ year: 2026, includePartialMonth: false }),
    { wrapper }
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await waitFor(() => expect(result.current.networkMonths.length).toBeGreaterThan(0));
  return result;
};

describe("avgBasket — helper", () => {
  it("renvoie 0 quand il n'y a aucune commande (pas de division par zéro)", () => {
    expect(avgBasket(1000, 0)).toBe(0);
    expect(avgBasket(0, 0)).toBe(0);
  });

  it("calcule CA / commandes", () => {
    expect(avgBasket(1000, 40)).toBe(25);
  });
});

describe("Panier moyen 2025 (N-1) — cohérence avec les totaux", () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // décembre 2026 → aucun mois de mars/avril n'est partiel
    vi.setSystemTime(new Date("2026-12-15T10:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("calcule le panier moyen N-1 par mois réseau", async () => {
    const result = await render();
    const march = result.current.networkMonths.find((m) => m.month === 3)!;
    // 2025 mars : (900 + 600) / (90 + 40)
    expect(march.previous).toBe(1500);
    expect(march.ordersPrevious).toBe(130);
    expect(avgBasket(march.previous, march.ordersPrevious)).toBeCloseTo(1500 / 130, 6);
  });

  it("le panier moyen N-1 total est le ratio des totaux, pas la moyenne des paniers mensuels", async () => {
    const result = await render();
    const { totals } = result.current;

    // Totaux 2025 : 900+600+1000+700 = 3200 ; 90+40+80+35 = 245
    expect(totals.previous).toBe(3200);
    expect(totals.ordersPrevious).toBe(245);

    const basketTotal = avgBasket(totals.previous, totals.ordersPrevious);
    expect(basketTotal).toBeCloseTo(3200 / 245, 6);

    const months = result.current.networkMonths;
    const naiveMean =
      months.reduce((s, m) => s + avgBasket(m.previous, m.ordersPrevious), 0) / months.length;
    expect(basketTotal).not.toBeCloseTo(naiveMean, 6);
  });

  it("le total N-1 est la somme des mois (CA et commandes)", async () => {
    const result = await render();
    const months = result.current.networkMonths;
    expect(months.reduce((s, m) => s + m.previous, 0)).toBeCloseTo(result.current.totals.previous, 6);
    expect(months.reduce((s, m) => s + m.ordersPrevious, 0)).toBe(result.current.totals.ordersPrevious);
  });

  it("les paniers moyens N-1 par restaurant se recomposent en total réseau", async () => {
    const result = await render();
    const restos = result.current.restaurants;

    const r1 = restos.find((r) => r.restaurantId === "r1")!;
    expect(r1.previous).toBe(1900);
    expect(r1.ordersPrevious).toBe(170);
    expect(avgBasket(r1.previous, r1.ordersPrevious)).toBeCloseTo(1900 / 170, 6);

    const sumRevenue = restos.reduce((s, r) => s + r.previous, 0);
    const sumOrders = restos.reduce((s, r) => s + r.ordersPrevious, 0);
    expect(sumRevenue).toBeCloseTo(result.current.totals.previous, 6);
    expect(sumOrders).toBe(result.current.totals.ordersPrevious);
    expect(avgBasket(sumRevenue, sumOrders)).toBeCloseTo(
      avgBasket(result.current.totals.previous, result.current.totals.ordersPrevious),
      6
    );
  });

  it("l'évolution du panier moyen suit deltaPct entre N et N-1", async () => {
    const result = await render();
    const { totals } = result.current;
    const cur = avgBasket(totals.current, totals.ordersCurrent);
    const prev = avgBasket(totals.previous, totals.ordersPrevious);
    expect(deltaPct(cur, prev)).toBeCloseTo(((cur - prev) / prev) * 100, 6);
  });
});
