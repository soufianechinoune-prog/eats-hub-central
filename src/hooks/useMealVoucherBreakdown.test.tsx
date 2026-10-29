// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMealVoucherBreakdown } from "./useMealVoucherBreakdown";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const restaurantId = "e12df4de-0fc0-4fe1-a391-424c455cfa26";
const period = { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 9, 28) };

describe("meal voucher consolidated reads", () => {
  beforeEach(() => rpc.mockReset());

  it("preserves verified annual Place de Clichy amounts and counts", async () => {
    rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "get_meal_voucher_totals"
      ? [{ restaurant_id: restaurantId, uber_revenue_ttc: "493437.82", uber_order_count: "22255", tr_amount: "40316.38", tr_order_count: "2718" }]
      : [{ restaurant_id: restaurantId, provider: "Swile", amount: "19217", order_count: "1310" }] }));
    const { result } = renderHook(() => useMealVoucherBreakdown({ restaurantIds: [restaurantId], ...period }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const row = result.current.data?.[0];
    expect(row?.uberRevenueTTC).toBe(493437.82);
    expect(row?.uberOrderCount).toBe(22255);
    expect(row?.trAmount).toBe(40316.38);
    expect(row?.trOrderCount).toBe(2718);
    expect(row?.trShareOfUber).toBeCloseTo(40316.38 / 493437.82 * 100, 8);
    expect(row?.byProvider.Swile.orderCount).toBe(1310);
    expect(rpc).toHaveBeenCalledWith("get_meal_voucher_totals", { p_restaurant_ids: [restaurantId], p_date_from: "2026-01-01", p_date_to: "2026-10-28" });
  });

  it.each([{ restaurantIds: [] }, { restaurantIds: ["00000000-0000-0000-0000-000000000000"] }])("does not fetch an unresolved restaurant scope $restaurantIds", ({ restaurantIds }) => {
    renderHook(() => useMealVoucherBreakdown({ restaurantIds, ...period }), { wrapper });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces failures without repeated heavy calls", async () => {
    rpc.mockResolvedValue({ error: new Error("unavailable"), data: null });
    const { result } = renderHook(() => useMealVoucherBreakdown({ restaurantIds: [restaurantId], ...period }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});