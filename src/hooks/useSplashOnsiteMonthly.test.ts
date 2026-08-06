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

import { useSplashOnsiteMonthly } from "./useSplashOnsiteMonthly";

const month = (y: number, m: number, ttc: number, orders = 10) => ({
  y,
  m,
  ttc,
  ht: ttc / 1.1,
  orders,
  days_count: 30,
  days_zero: 0,
});

// Le restaurant a du CA en juillet et août, sur 2026 et 2025 :
// les deux mois sont donc éligibles au périmètre constant "sur le papier",
// mais août 2026 est le mois en cours (partiel).
const payload = {
  restaurants: [
    {
      restaurant_id: "r1",
      name: "Chicken Street Argenteuil",
      months: [
        month(2026, 7, 1000),
        month(2026, 8, 400),
        month(2025, 7, 800),
        month(2025, 8, 900),
      ],
    },
  ],
  coverage: { days_zero_current: 0, unmapped_splash_ids: 0, unmapped_revenue_ttc: 0 },
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
};

const renderMonthly = async (includePartialMonth: boolean) => {
  rpcMock.mockResolvedValue({ data: payload, error: null });
  const { result } = renderHook(
    () => useSplashOnsiteMonthly({ year: 2026, includePartialMonth }),
    { wrapper }
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await waitFor(() => expect(result.current.networkMonths.length).toBeGreaterThan(0));
  return result;
};

describe("useSplashOnsiteMonthly — mois en cours et périmètre constant", () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 6 août 2026 → le mois en cours est août (mois 8)
    vi.setSystemTime(new Date("2026-08-06T10:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("exclut le mois en cours du LFL quand le toggle est désactivé", async () => {
    const result = await renderMonthly(false);

    const august = result.current.networkMonths.find((m) => m.month === 8);
    expect(august?.isPartial).toBe(true);
    expect(august?.lflCurrent).toBe(0);
    expect(august?.lflPrevious).toBe(0);
    expect(august?.lflRestaurants).toBe(0);

    // Seul juillet alimente le périmètre constant
    expect(result.current.totals.lflCurrent).toBe(1000);
    expect(result.current.totals.lflPrevious).toBe(800);
  });

  it("n'inclut pas le mois en cours dans les totaux bruts quand le toggle est désactivé", async () => {
    const result = await renderMonthly(false);
    expect(result.current.totals.current).toBe(1000);
    expect(result.current.totals.previous).toBe(800);
  });

  it("garde le mois en cours hors du LFL même quand le toggle est activé", async () => {
    const result = await renderMonthly(true);

    const august = result.current.networkMonths.find((m) => m.month === 8);
    expect(august?.isPartial).toBe(true);
    expect(august?.lflCurrent).toBe(0);
    expect(august?.lflPrevious).toBe(0);

    // Le CA brut inclut août, mais pas le périmètre constant
    expect(result.current.totals.current).toBe(1400);
    expect(result.current.totals.lflCurrent).toBe(1000);
    expect(result.current.totals.lflPrevious).toBe(800);
  });

  it("exclut le mois en cours de la vue détaillée du périmètre constant", async () => {
    const result = await renderMonthly(false);
    expect(result.current.scope.map((s) => s.month)).not.toContain(8);
    const july = result.current.scope.find((s) => s.month === 7);
    expect(july?.lfl.map((r) => r.restaurantId)).toEqual(["r1"]);
  });

  it("ne compte pas le mois en cours dans les mois LFL d'un restaurant", async () => {
    const result = await renderMonthly(false);
    const r1 = result.current.restaurants.find((r) => r.restaurantId === "r1");
    expect(r1?.lflMonths).toBe(1);
    expect(r1?.lflCurrent).toBe(1000);
    expect(r1?.months.find((m) => m.month === 8)?.lflCurrent).toBe(0);
  });
});
