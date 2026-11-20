import { describe, expect, it, vi } from "vitest";

// 3 190 lignes = Chicken Street, octobre 2026 (≈ 107 restaurants × 31 jours) : avant le correctif, seules 1 000 arrivaient.
const TOTAL = 3190;
const ranges: [number, number][] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () => ({
      range: async (from: number, to: number) => {
        ranges.push([from, to]);
        const n = Math.max(0, Math.min(to, TOTAL - 1) - from + 1);
        return { data: Array.from({ length: n }, (_, i) => ({ i: from + i })), error: null };
      },
    }),
  },
}));

import { fetchAllDailyRows } from "./fetchAllDailyRows";

describe("fetchAllDailyRows", () => {
  it("rapatrie toutes les lignes au-delà de 1 000, par paquets", async () => {
    const rows = await fetchAllDailyRows<{ i: number }>("get_daily_revenue_from_orders", {
      p_start_date: "2026-10-01", p_end_date: "2026-10-31", p_restaurant_ids: null,
    });
    expect(rows).toHaveLength(TOTAL);
    expect(rows[TOTAL - 1].i).toBe(TOTAL - 1);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999], [3000, 3999]]);
  });
});
