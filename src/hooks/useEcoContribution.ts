import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { endOfMonth, format } from "date-fns";
import { assignEcoLinesToYear } from "@/lib/ecoRateYear";


type EcoRow = Omit<EcoDetailLine, "platform">;
// Requête minimale sur la vue eco_contribution_lines (migration 20261117210000, pas encore dans les types générés).
// On garde les appels sur l'objet client : extraire ses méthodes leur fait perdre leur contexte.
type EcoQuery = PromiseLike<{ data: EcoRow[] | null; error: Error | null }> & {
  in: (column: string, values: readonly string[]) => EcoQuery;
  order: (column: string, options?: { ascending: boolean }) => EcoQuery;
  gte: (column: string, value: string) => EcoQuery;
  lte: (column: string, value: string) => EcoQuery;
  range: (from: number, to: number) => EcoQuery;
};
const ecoClient = supabase as unknown as { from: (table: string) => { select: (columns: string) => EcoQuery } };

interface EcoDetailLine {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  payout_reference_id: string | null;
  payout_date: string | null;
  description: string | null;
  amount: number;
  platform: "uber_eats" | "deliveroo";
  /** Date réelle du versement quand la ligne est rangée dans une année antérieure (payout_date = 31/12 de cette année). */
  paid_on?: string;
  /** Date de commande inscrite par Uber sur la ligne (sert à trancher l'année quand le taux est ambigu). */
  order_date?: string | null;
}

export function useEcoContribution({
  restaurantIds,
  year,
  month,
  platform = "global",
}: {
  restaurantIds?: string[];
  year: number | null;
  month?: number | null;
  platform?: "uber_eats" | "deliveroo" | "global";
}) {
  // Empty array = no restaurants in scope → disable all queries
  const hasEmptyScope = restaurantIds !== undefined && restaurantIds.length === 0;
  const isUberEnabled = !hasEmptyScope && (platform === "uber_eats" || platform === "global");
  const isDeliverooEnabled = !hasEmptyScope && (platform === "deliveroo" || platform === "global");
  // ── Uber Eats: payout_adjustments detail lines ──
  const { data: uberData, isLoading: loadingUberDetail } = useQuery({
    queryKey: ["eco_contribution_detail", restaurantIds, year, month, platform],
    queryFn: async (): Promise<{ lines: EcoDetailLine[]; movedOut: EcoDetailLine[] }> => {
      const allData: EcoDetailLine[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        // La vue donne la nature de chaque ligne (eco_kind). On ne garde que les vrais prélèvements et
        // remboursements d'éco-contribution : les titres-restaurant et les petits crédits sans rapport
        // (commande annulée, annulation de remboursement client) sont écartés.
        let query = ecoClient
          .from("eco_contribution_lines")
          .select("id, restaurant_id, restaurant_name, payout_reference_id, payout_date, description, amount, order_date")
          .in("eco_kind", ["prelevement", "remboursement"])
          .order("payout_date", { ascending: false }).order("id");

        // Année Y : on lit aussi Y+1, où Uber verse en retard des semaines de Y (taux de Y).
        // assignEcoLinesToYear range ensuite chaque ligne dans l'année qu'elle concerne.
        if (year) {
          query = query.gte("payout_date", `${year}-01-01`).lte("payout_date", `${year + 1}-12-31`);
        }

        if (restaurantIds && restaurantIds.length > 0) {
          query = query.in("restaurant_id", restaurantIds);
        }

        const { data, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data.map(d => ({ ...d, platform: "uber_eats" as const })));
          if (data.length < batchSize) break;
          offset += batchSize;
        } else {
          break;
        }
      }

      if (!year) return { lines: allData, movedOut: [] };
      const { kept, movedOut } = assignEcoLinesToYear(allData, year);
      if (!month) return { lines: kept, movedOut };
      const inMonth = (d: string | null) => !!d && Number(d.slice(5, 7)) === month;
      return { lines: kept.filter((l) => inMonth(l.payout_date)), movedOut: movedOut.filter((l) => inMonth(l.payout_date)) };
    },
    enabled: isUberEnabled,
    staleTime: 60_000,
    retry: false,
  });
  const uberDetailLines = uberData?.lines;
  // Lignes versées cette année mais qui concernent une année antérieure : affichées dans leur année.
  const movedOutLines = useMemo(() => uberData?.movedOut ?? [], [uberData]);

  // ── Deliveroo: deliveroo_orders with eco-contribution type ──
  const { data: deliverooEcoData, isLoading: loadingDeliveroo } = useQuery({
    queryKey: ["eco_contribution_deliveroo", restaurantIds, year, month, platform],
    queryFn: async () => {
      const allData: {
        id: string;
        restaurant_id: string | null;
        restaurant_name: string;
        delivery_datetime: string | null;
        total_payable: number | null;
        note: string | null;
        statement_file: string | null;
      }[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        let query = supabase
          .from("deliveroo_orders")
          .select("id, restaurant_id, restaurant_name, delivery_datetime, total_payable, note, statement_file")
          .like("history_type", "Eco-contribution%")
          .order("delivery_datetime", { ascending: false });

        if (year) {
          query = query.gte("delivery_datetime", `${year}-01-01`).lte("delivery_datetime", `${year}-12-31`);
        }

        if (restaurantIds && restaurantIds.length > 0) {
          query = query.in("restaurant_id", restaurantIds);
        }

        if (month && year) {
          const monthStr = String(month).padStart(2, "0");
          query = query
            .gte("delivery_datetime", `${year}-${monthStr}-01`)
            .lte("delivery_datetime", format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd"));
        }

        const { data, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          if (data.length < batchSize) break;
          offset += batchSize;
        } else {
          break;
        }
      }

      return allData;
    },
    enabled: isDeliverooEnabled,
  });

  // Convert Deliveroo data to detail lines format
  const deliverooDetailLines: EcoDetailLine[] = useMemo(() => {
    if (!deliverooEcoData) return [];
    return deliverooEcoData
      .filter(d => d.restaurant_id)
      .map(d => ({
        id: d.id,
        restaurant_id: d.restaurant_id || "",
        restaurant_name: d.restaurant_name,
        payout_reference_id: d.statement_file,
        payout_date: d.delivery_datetime,
        description: d.note || "Eco-contribution Deliveroo",
        amount: Number(d.total_payable) || 0,
        platform: "deliveroo" as const,
      }));
  }, [deliverooEcoData]);

  // Merge all detail lines
  const allDetailLines = useMemo(() => {
    return [...(uberDetailLines || []), ...deliverooDetailLines];
  }, [uberDetailLines, deliverooDetailLines]);

  // Aggregate by year-month (Uber payouts + Uber detail fallback + Deliveroo)
  const monthlyData = useMemo(() => {
    const byKey = new Map<string, { year: number; month: number; refund: number; charge: number; count: number }>();
    
    const addLineByDate = (dateStr: string | null, amount: number) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${m}`;
      const existing = byKey.get(key) || { year: y, month: m, refund: 0, charge: 0, count: 0 };
      if (amount >= 0) {
        existing.refund += amount;
      } else {
        existing.charge += Math.abs(amount);
      }
      existing.count += 1;
      byKey.set(key, existing);
    };

    // Uber detail fallback (payout_adjustments for restaurants without aggregated payouts)
    for (const line of (uberDetailLines || [])) {
      addLineByDate(line.payout_date, Number(line.amount) || 0);
    }

    // Deliveroo eco lines
    for (const line of deliverooDetailLines) {
      addLineByDate(line.payout_date, line.amount);
    }

    return Array.from(byKey.values())
      .map(d => ({
        year: d.year,
        month: d.month,
        refund: Math.round(d.refund * 100) / 100,
        charge: Math.round(d.charge * 100) / 100,
        net: Math.round((d.refund - d.charge) * 100) / 100,
        count: d.count,
      }))
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }, [uberDetailLines, deliverooDetailLines]);

  // Aggregate by restaurant (Uber payouts + Uber detail fallback + Deliveroo)
  const byRestaurant = useMemo(() => {
    const byResto = new Map<string, { refund: number; charge: number; count: number }>();
    
    const addToResto = (restaurantId: string, amount: number) => {
      const existing = byResto.get(restaurantId) || { refund: 0, charge: 0, count: 0 };
      if (amount >= 0) {
        existing.refund += amount;
      } else {
        existing.charge += Math.abs(amount);
      }
      existing.count += 1;
      byResto.set(restaurantId, existing);
    };

    // Uber detail fallback
    for (const line of (uberDetailLines || [])) {
      addToResto(line.restaurant_id, Number(line.amount) || 0);
    }

    // Deliveroo
    for (const line of deliverooDetailLines) {
      addToResto(line.restaurant_id, line.amount);
    }

    return Array.from(byResto.entries())
      .map(([id, d]) => ({
        restaurant_id: id,
        refund: Math.round(d.refund * 100) / 100,
        charge: Math.round(d.charge * 100) / 100,
        net: Math.round((d.refund - d.charge) * 100) / 100,
        count: d.count,
      }))
      .sort((a, b) => b.net - a.net);
  }, [uberDetailLines, deliverooDetailLines]);

  // KPI totals
  const totals = useMemo(() => {
    let refund = 0, charge = 0;

    // Uber detail fallback
    for (const line of (uberDetailLines || [])) {
      const amount = Number(line.amount) || 0;
      if (amount >= 0) refund += amount;
      else charge += Math.abs(amount);
    }

    // Deliveroo
    for (const line of deliverooDetailLines) {
      const amount = line.amount;
      if (amount >= 0) refund += amount;
      else charge += Math.abs(amount);
    }

    return {
      refund: Math.round(refund * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      net: Math.round((refund - charge) * 100) / 100,
      lineCount: allDetailLines.length,
    };
  }, [uberDetailLines, deliverooDetailLines, allDetailLines]);

  return {
    monthlyData,
    byRestaurant,
    totals,
    detailLines: allDetailLines,
    movedOutLines,
    isLoading: loadingUberDetail || loadingDeliveroo,
  };
}
