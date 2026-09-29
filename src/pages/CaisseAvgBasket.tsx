import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfISOWeek, getISOWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { fr } from "date-fns/locale";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";

const eur2 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const eur0 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const int = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
const basket = (rev: number, t: number) => (t > 0 ? rev / t : null);
const varPct = (cur: number | null, prev: number | null) => (cur != null && prev != null && prev > 0 ? ((cur - prev) / prev) * 100 : null);

function Delta({ value, suffix = " %" }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const cls = value >= 0 ? "text-success" : "text-destructive";
  return <span className={cls}>{value >= 0 ? "+" : ""}{value.toFixed(suffix === " %" ? 1 : 2)}{suffix}</span>;
}

type SortKey = "basket" | "var" | "tickets" | "revenue";
type Gran = "day" | "week" | "month";

export default function CaisseAvgBasket() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } = useAnalyticsContext();
  const { startDate, endDate, granularity } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const [gran, setGran] = useState<Gran | null>(null);
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("basket");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let q = supabase.from("restaurants").select("id, name").order("name");
      if (selectedChainId) q = q.eq("chain_id", selectedChainId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const ids = useMemo<string[] | undefined>(() => {
    if (!restaurants) return undefined;
    const all = restaurants.map((r) => r.id);
    return resolveBrandScopedRestaurantIds({ selectedRestaurantIds: selectedRestaurants, selectedChainId, chainRestaurantIds: all }) ?? all;
  }, [restaurants, selectedRestaurants, selectedChainId]);

  const enabled = !!ids && ids.length > 0;
  const params = { p_restaurant_ids: ids ?? [], p_start: start, p_end: end };

  const daily = useQuery({
    queryKey: ["caisse-basket-daily", start, end, ids],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_avg_basket_daily", params);
      if (error) throw error;
      return (data ?? []) as { date: string; revenue: number; tickets: number; prev_revenue: number; prev_tickets: number }[];
    },
  });

  const byResto = useQuery({
    queryKey: ["caisse-basket-resto", start, end, ids],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_caisse_avg_basket_by_restaurant", params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => {
        const revenue = Number(r.revenue) || 0, tickets = Number(r.tickets) || 0;
        const prevRevenue = Number(r.prev_revenue) || 0, prevTickets = Number(r.prev_tickets) || 0;
        const b = basket(revenue, tickets), pb = basket(prevRevenue, prevTickets);
        return {
          id: r.restaurant_id as string, name: r.restaurant_name as string,
          revenue, tickets, prevTickets, basket: b, prevBasket: pb,
          basketVar: varPct(b, pb), ticketsVar: varPct(tickets, prevTickets || null),
        };
      });
    },
  });

  const totals = useMemo(() => {
    const d = daily.data ?? [];
    const rev = d.reduce((a, x) => a + Number(x.revenue), 0);
    const t = d.reduce((a, x) => a + Number(x.tickets), 0);
    const prev = d.reduce((a, x) => a + Number(x.prev_revenue), 0);
    const pt = d.reduce((a, x) => a + Number(x.prev_tickets), 0);
    const b = basket(rev, t), pb = basket(prev, pt);
    return { rev, t, pt, b, pb, bVar: varPct(b, pb), tVar: varPct(t, pt || null) };
  }, [daily.data]);

  const effGran: Gran = gran ?? (granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month");

  const chart = useMemo(() => {
    const buckets = new Map<string, { label: string; r: number; t: number; pr: number; pt: number }>();
    for (const x of daily.data ?? []) {
      const d = new Date(x.date + "T12:00:00");
      let key: string, label: string;
      if (effGran === "day") { key = x.date; label = format(d, "dd MMM", { locale: fr }); }
      else if (effGran === "week") { const s = startOfISOWeek(d); key = format(s, "yyyy-MM-dd"); label = `S${getISOWeek(d)} · ${format(s, "dd MMM", { locale: fr })}`; }
      else { key = format(d, "yyyy-MM"); label = format(d, "MMM yyyy", { locale: fr }); }
      const b = buckets.get(key) ?? { label, r: 0, t: 0, pr: 0, pt: 0 };
      b.r += Number(x.revenue); b.t += Number(x.tickets); b.pr += Number(x.prev_revenue); b.pt += Number(x.prev_tickets);
      buckets.set(key, b);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, b]) => ({
      label: b.label, N: basket(b.r, b.t), "N-1": basket(b.pr, b.pt), tickets: b.t,
    }));
  }, [daily.data, effGran]);

  const ranked = useMemo(() => {
    const rows = (byResto.data ?? []).filter((r) => r.tickets > 0);
    const byBasket = [...rows].sort((a, b) => (b.basket ?? 0) - (a.basket ?? 0));
    const rank = new Map(byBasket.map((r, i) => [r.id, i + 1]));
    const key = (r: (typeof rows)[number]) =>
      sort === "basket" ? r.basket ?? 0 : sort === "var" ? r.basketVar ?? -Infinity : sort === "tickets" ? r.tickets : r.revenue;
    const q = search.trim().toLowerCase();
    return { total: rows.length, rank, rows: [...rows].sort((a, b) => key(b) - key(a)).filter((r) => !q || r.name.toLowerCase().includes(q)) };
  }, [byResto.data, search, sort]);

  const sortHead = (k: SortKey, label: string) => (
    <TableHead className="text-right cursor-pointer select-none" onClick={() => setSort(k)}>
      {label}{sort === k ? " ↓" : ""}
    </TableHead>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Panier moyen</h1>
            <p className="text-muted-foreground">Panier moyen caisse (TTC, hors Châtaigne) sur la période, comparé à N-1.</p>
          </div>
          <AnalyticsHeader />

          {daily.isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Panier moyen réseau</p>
                <p className="text-2xl font-bold">{totals.b != null ? eur2(totals.b) : "—"}</p>
                <p className="text-xs text-muted-foreground">vs {totals.pb != null ? eur2(totals.pb) : "—"} (N-1) · <Delta value={totals.bVar} /></p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Écart panier vs N-1</p>
                <p className="text-2xl font-bold">
                  <Delta value={totals.b != null && totals.pb != null ? totals.b - totals.pb : null} suffix=" €" />
                </p>
                <p className="text-xs text-muted-foreground">par ticket</p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Tickets</p>
                <p className="text-2xl font-bold">{int(totals.t)}</p>
                <p className="text-xs text-muted-foreground">vs {int(totals.pt)} (N-1) · <Delta value={totals.tVar} /></p>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">CA caisse net</p>
                <p className="text-2xl font-bold">{eur0(totals.rev)}</p>
                <p className="text-xs text-muted-foreground">hors Châtaigne</p>
              </CardContent></Card>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Évolution du panier moyen</CardTitle>
                <CardDescription>
                  Par {effGran === "day" ? "jour" : effGran === "week" ? "semaine" : "mois"} (CA ÷ tickets du groupe), N en trait plein, N-1 en pointillés
                </CardDescription>
              </div>
              <div className="flex gap-1">
                {(["day", "week", "month"] as Gran[]).map((g) => (
                  <Button key={g} size="sm" variant={effGran === g ? "default" : "outline"} onClick={() => setGran(g)}>
                    {g === "day" ? "Jour" : g === "week" ? "Semaine" : "Mois"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v) => `${Number(v).toFixed(0)} €`} />
                  <ReTooltip formatter={(v: any, n: any) => (v == null ? "—" : [eur2(Number(v)), n])} />
                  <Legend />
                  <Line type="monotone" dataKey="N" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="N-1" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Par restaurant</CardTitle>
                <CardDescription>Rang calculé sur le panier moyen de tout le périmètre ({ranked.total} restaurants)</CardDescription>
              </div>
              <Input placeholder="Rechercher un restaurant" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {byResto.isLoading ? <Skeleton className="h-40" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Restaurant</TableHead>
                      {sortHead("basket", "Panier moyen")}
                      <TableHead className="text-right">N-1</TableHead>
                      {sortHead("var", "Var. panier")}
                      {sortHead("tickets", "Tickets")}
                      <TableHead className="text-right">Var. tickets</TableHead>
                      {sortHead("revenue", "CA net")}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{ranked.rank.get(r.id)}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right font-semibold">{r.basket != null ? eur2(r.basket) : "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.prevBasket != null ? eur2(r.prevBasket) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Delta value={r.basketVar} />
                          {r.basket != null && r.prevBasket != null && (
                            <div className="text-xs text-muted-foreground">{r.basket - r.prevBasket >= 0 ? "+" : ""}{(r.basket - r.prevBasket).toFixed(2)} €</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{int(r.tickets)}</TableCell>
                        <TableCell className="text-right"><Delta value={r.ticketsVar} /></TableCell>
                        <TableCell className="text-right">{eur0(r.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
