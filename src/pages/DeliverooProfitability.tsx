import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Euro, Info, Megaphone, Percent, Receipt, UtensilsCrossed } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import deliverooLogo from "@/assets/deliveroo-logo.png";

interface Row {
  restaurant_id: string;
  restaurant_name: string;
  ca: number;
  commission: number;
  orders_count: number;
  pub: number;
  ad_sales: number;
  ad_orders: number;
  food_cost: number;
  marge: number;
  marge_pct: number | null;
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)} %`);

export default function DeliverooProfitability() {
  const {
    selectedRestaurants,
    selectedChainId,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
  } = useAnalyticsContext();

  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("id, name").order("name");
      if (selectedChainId) query = query.eq("chain_id", selectedChainId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const chainRestaurantIds = useMemo(() => restaurants?.map((r) => r.id) ?? [], [restaurants]);

  const restaurantFilter = useMemo<string[] | null | undefined>(() => {
    if (!restaurants) return undefined;
    const resolved = resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    });
    return resolved ?? null;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const { data, isLoading } = useQuery<Row[], Error>({
    queryKey: ["deliveroo-profitability", start, end, restaurantFilter],
    enabled: restaurantFilter !== undefined,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_deliveroo_profitability", {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantFilter ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        ca: Number(r.ca) || 0,
        commission: Number(r.commission) || 0,
        orders_count: Number(r.orders_count) || 0,
        pub: Number(r.pub) || 0,
        ad_sales: Number(r.ad_sales) || 0,
        ad_orders: Number(r.ad_orders) || 0,
        food_cost: Number(r.food_cost) || 0,
        marge: Number(r.marge) || 0,
        marge_pct: r.marge_pct == null ? null : Number(r.marge_pct),
      })) as Row[];
    },
  });

  const rows = data ?? [];

  const totals = useMemo(() => {
    const t = rows.reduce(
      (a, r) => ({
        ca: a.ca + r.ca,
        commission: a.commission + r.commission,
        pub: a.pub + r.pub,
        adSales: a.adSales + r.ad_sales,
        orders: a.orders + r.orders_count,
      }),
      { ca: 0, commission: 0, pub: 0, adSales: 0, orders: 0 },
    );
    return {
      ...t,
      marge: t.ca - t.commission - t.pub,
      margePct: t.ca > 0 ? ((t.ca - t.commission - t.pub) / t.ca) * 100 : null,
      commissionPct: t.ca > 0 ? (t.commission / t.ca) * 100 : null,
      pubPct: t.ca > 0 ? (t.pub / t.ca) * 100 : null,
      roas: t.pub > 0 ? t.adSales / t.pub : null,
    };
  }, [rows]);

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <img src={deliverooLogo} alt="Deliveroo" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-3xl font-bold">Rentabilité Deliveroo</h1>
            <p className="text-muted-foreground">
              CA − commission − dépenses publicitaires, par restaurant et pour le réseau
            </p>
          </div>
        </div>

        <AnalyticsHeader />

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Coût matière à venir</AlertTitle>
          <AlertDescription className="text-sm">
            La ligne <strong>food cost</strong> est prévue dans le calcul mais reste à 0 tant que le rapport
            « Produits vendus » et le rapprochement produits ne sont pas intégrés. La marge affichée est donc
            une <strong>marge avant coût matière</strong>.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-5">
              <Card><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Euro className="h-3 w-3" /> CA Deliveroo</p>
                <p className="text-2xl font-bold">{eur(totals.ca)}</p>
                <p className="text-xs text-muted-foreground">{totals.orders.toLocaleString("fr-FR")} commandes</p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> Commission</p>
                <p className="text-2xl font-bold">{eur(totals.commission)}</p>
                <p className="text-xs text-muted-foreground">{pct(totals.commissionPct)} du CA</p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Megaphone className="h-3 w-3" /> Dépenses pub</p>
                <p className="text-2xl font-bold">{eur(totals.pub)}</p>
                <p className="text-xs text-muted-foreground">
                  {pct(totals.pubPct)} du CA · ROAS {totals.roas != null ? `${totals.roas.toFixed(1)}x` : "—"}
                </p>
              </CardContent></Card>
              <Card className="opacity-70"><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><UtensilsCrossed className="h-3 w-3" /> Food cost</p>
                <p className="text-2xl font-bold">—</p>
                <Badge variant="secondary" className="mt-1">À venir</Badge>
              </CardContent></Card>
              <Card className="border-primary/30"><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> Marge (avant food cost)</p>
                <p className="text-2xl font-bold">{eur(totals.marge)}</p>
                <p className="text-xs text-muted-foreground">{pct(totals.margePct)} du CA</p>
              </CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Par restaurant</CardTitle>
                <CardDescription>
                  Sources agrégées séparément (commandes / publicités) puis rapprochées par restaurant.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Aucune donnée Deliveroo sur la période sélectionnée.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        <TableHead className="text-right">Commandes</TableHead>
                        <TableHead className="text-right">CA</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead className="text-right">Pub</TableHead>
                        <TableHead className="text-right">% pub</TableHead>
                        <TableHead className="text-right">ROAS</TableHead>
                        <TableHead className="text-right">Food cost</TableHead>
                        <TableHead className="text-right">Marge</TableHead>
                        <TableHead className="text-right">% marge</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const pubPct = r.ca > 0 ? (r.pub / r.ca) * 100 : null;
                        const roas = r.pub > 0 ? r.ad_sales / r.pub : null;
                        return (
                          <TableRow key={r.restaurant_id}>
                            <TableCell className="font-medium">{r.restaurant_name}</TableCell>
                            <TableCell className="text-right">{r.orders_count.toLocaleString("fr-FR")}</TableCell>
                            <TableCell className="text-right">{eur(r.ca)}</TableCell>
                            <TableCell className="text-right">{eur(r.commission)}</TableCell>
                            <TableCell className="text-right">{eur(r.pub)}</TableCell>
                            <TableCell className="text-right">{pct(pubPct)}</TableCell>
                            <TableCell className="text-right">{roas != null ? `${roas.toFixed(1)}x` : "—"}</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-right font-semibold">{eur(r.marge)}</TableCell>
                            <TableCell className="text-right">{pct(r.marge_pct)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-semibold">Total réseau</TableCell>
                        <TableCell className="text-right">{totals.orders.toLocaleString("fr-FR")}</TableCell>
                        <TableCell className="text-right">{eur(totals.ca)}</TableCell>
                        <TableCell className="text-right">{eur(totals.commission)}</TableCell>
                        <TableCell className="text-right">{eur(totals.pub)}</TableCell>
                        <TableCell className="text-right">{pct(totals.pubPct)}</TableCell>
                        <TableCell className="text-right">{totals.roas != null ? `${totals.roas.toFixed(1)}x` : "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">—</TableCell>
                        <TableCell className="text-right font-semibold">{eur(totals.marge)}</TableCell>
                        <TableCell className="text-right">{pct(totals.margePct)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
