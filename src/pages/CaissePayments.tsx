import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreditCard, Coins, Info, Ticket, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";

interface BreakdownRow {
  restaurant_id: string;
  restaurant_name: string;
  tickets: number;
  days_covered: number;
  revenue: number;
  card_amount: number;
  cash_amount: number;
  tr_amount: number;
  platform_amount: number;
  other_amount: number;
  paid_total: number;
  tr_share: number | null;
}

interface BrandRow {
  category: string;
  brand: string | null;
  payments: number;
  amount: number;
}

interface WeeklyRow {
  week_start: string;
  card_amount: number;
  cash_amount: number;
  tr_amount: number;
  platform_amount: number;
  other_amount: number;
  total_amount: number;
  tr_share: number | null;
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)} %`);
const int = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
const num = (v: unknown) => Number(v) || 0;

export default function CaissePayments() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } =
    useAnalyticsContext();

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

  const enabled = restaurantFilter !== undefined;
  const params = { p_start: start, p_end: end, p_restaurant_ids: restaurantFilter ?? null };

  const breakdown = useQuery<BreakdownRow[], Error>({
    queryKey: ["caisse-payment-breakdown", start, end, restaurantFilter],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_payment_breakdown", params);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        tickets: num(r.tickets),
        days_covered: num(r.days_covered),
        revenue: num(r.revenue),
        card_amount: num(r.card_amount),
        cash_amount: num(r.cash_amount),
        tr_amount: num(r.tr_amount),
        platform_amount: num(r.platform_amount),
        other_amount: num(r.other_amount),
        paid_total: num(r.paid_total),
        tr_share: r.tr_share == null ? null : Number(r.tr_share),
      }));
    },
  });

  const brands = useQuery<BrandRow[], Error>({
    queryKey: ["caisse-payment-brands", start, end, restaurantFilter],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_payment_brands", params);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        category: r.category,
        brand: r.brand,
        payments: num(r.payments),
        amount: num(r.amount),
      }));
    },
  });

  const weekly = useQuery<WeeklyRow[], Error>({
    queryKey: ["caisse-payment-weekly", start, end, restaurantFilter],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_payment_weekly", params);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        week_start: r.week_start,
        card_amount: num(r.card_amount),
        cash_amount: num(r.cash_amount),
        tr_amount: num(r.tr_amount),
        platform_amount: num(r.platform_amount),
        other_amount: num(r.other_amount),
        total_amount: num(r.total_amount),
        tr_share: r.tr_share == null ? null : Number(r.tr_share),
      }));
    },
  });

  const rows = breakdown.data ?? [];

  const totals = useMemo(() => {
    const t = rows.reduce(
      (a, r) => ({
        tickets: a.tickets + r.tickets,
        card: a.card + r.card_amount,
        cash: a.cash + r.cash_amount,
        tr: a.tr + r.tr_amount,
        platform: a.platform + r.platform_amount,
        other: a.other + r.other_amount,
        paid: a.paid + r.paid_total,
      }),
      { tickets: 0, card: 0, cash: 0, tr: 0, platform: 0, other: 0, paid: 0 },
    );
    const inStore = t.card + t.cash + t.tr + t.other;
    return {
      ...t,
      inStore,
      cardShare: inStore > 0 ? (t.card / inStore) * 100 : null,
      cashShare: inStore > 0 ? (t.cash / inStore) * 100 : null,
      trShare: inStore > 0 ? (t.tr / inStore) * 100 : null,
    };
  }, [rows]);

  const trBrands = useMemo(
    () => (brands.data ?? []).filter((b) => b.category === "Titres-resto"),
    [brands.data],
  );

  const weeklyChart = useMemo(
    () =>
      (weekly.data ?? []).map((w) => ({
        label: format(new Date(w.week_start), "dd MMM", { locale: fr }),
        Carte: w.card_amount,
        Espèces: w.cash_amount,
        "Titres-resto": w.tr_amount,
        Autre: w.other_amount,
        partTR: w.tr_share ?? 0,
      })),
    [weekly.data],
  );

  const topTr = useMemo(
    () =>
      [...rows]
        .filter((r) => r.paid_total > 0)
        .sort((a, b) => (b.tr_share ?? 0) - (a.tr_share ?? 0))
        .slice(0, 12)
        .map((r) => ({ name: r.restaurant_name.replace(/^(Chicken Street|Tasty Crousty)\s*-\s*/i, ""), part: r.tr_share ?? 0 })),
    [rows],
  );

  const isLoading = breakdown.isLoading || weekly.isLoading;

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Moyens de paiement</h1>
            <p className="text-muted-foreground">
              Répartition Carte / Espèces / Titres-resto par restaurant, à partir des règlements de caisse.
            </p>
          </div>

          <AnalyticsHeader />

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Couverture des tickets de caisse</AlertTitle>
            <AlertDescription className="text-sm">
              Cette vue s'appuie sur le détail ticket par ticket remonté de la caisse. Le rattrapage
              historique est progressif : seuls les restaurants et les mois déjà récupérés apparaissent
              ci-dessous ({int(totals.tickets)} tickets sur la période, {rows.length} restaurant(s)).
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Aucun ticket de caisse disponible sur la période et le périmètre sélectionnés.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Carte
                    </p>
                    <p className="text-2xl font-bold">{eur(totals.card)}</p>
                    <p className="text-xs text-muted-foreground">{pct(totals.cardShare)} des encaissements</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Coins className="h-3 w-3" /> Espèces
                    </p>
                    <p className="text-2xl font-bold">{eur(totals.cash)}</p>
                    <p className="text-xs text-muted-foreground">{pct(totals.cashShare)} des encaissements</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Ticket className="h-3 w-3" /> Titres-resto
                    </p>
                    <p className="text-2xl font-bold">{eur(totals.tr)}</p>
                    <p className="text-xs text-muted-foreground">{pct(totals.trShare)} des encaissements</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wallet className="h-3 w-3" /> Encaissé sur place
                    </p>
                    <p className="text-2xl font-bold">{eur(totals.inStore)}</p>
                    <p className="text-xs text-muted-foreground">
                      {int(totals.tickets)} tickets · plateformes {eur(totals.platform)} hors total
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Évolution hebdomadaire des encaissements</CardTitle>
                    <CardDescription>Montants réglés par semaine et part des titres-resto</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => eur(Number(v))} />
                        <ReTooltip formatter={(v: any) => eur(Number(v))} />
                        <Legend />
                        <Bar dataKey="Carte" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Espèces" stackId="a" fill="hsl(var(--chart-2))" />
                        <Bar dataKey="Titres-resto" stackId="a" fill="hsl(var(--chart-3))" />
                        <Bar dataKey="Autre" stackId="a" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Part des titres-resto dans le temps</CardTitle>
                    <CardDescription>Base : encaissements sur place (hors plateformes)</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} %`} />
                        <ReTooltip formatter={(v: any) => `${Number(v).toFixed(1)} %`} />
                        <Line
                          type="monotone"
                          dataKey="partTR"
                          name="Part titres-resto"
                          stroke="hsl(var(--chart-3))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Marques de titres-resto</CardTitle>
                    <CardDescription>Libellés de caisse normalisés par marque</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trBrands.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Aucun règlement en titres-resto identifié sur la période.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Marque</TableHead>
                            <TableHead className="text-right">Règlements</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trBrands.map((b) => (
                            <TableRow key={`${b.category}-${b.brand ?? "na"}`}>
                              <TableCell>
                                {b.brand ?? <Badge variant="secondary">Marque non précisée</Badge>}
                              </TableCell>
                              <TableCell className="text-right">{int(b.payments)}</TableCell>
                              <TableCell className="text-right">{eur(b.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Restaurants les plus exposés aux titres-resto</CardTitle>
                    <CardDescription>Part des titres-resto dans les encaissements</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topTr} layout="vertical" margin={{ left: 12, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} %`} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                        <ReTooltip formatter={(v: any) => `${Number(v).toFixed(1)} %`} />
                        <Bar dataKey="part" name="Part titres-resto" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Par restaurant</CardTitle>
                  <CardDescription>
                    Tickets et règlements agrégés séparément puis rapprochés par restaurant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        <TableHead className="text-right">Tickets</TableHead>
                        <TableHead className="text-right">Jours couverts</TableHead>
                        <TableHead className="text-right">Carte</TableHead>
                        <TableHead className="text-right">Espèces</TableHead>
                        <TableHead className="text-right">Titres-resto</TableHead>
                        <TableHead className="text-right">Autre</TableHead>
                        <TableHead className="text-right">Part TR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.restaurant_id}>
                          <TableCell className="font-medium">{r.restaurant_name}</TableCell>
                          <TableCell className="text-right">{int(r.tickets)}</TableCell>
                          <TableCell className="text-right">{int(r.days_covered)}</TableCell>
                          <TableCell className="text-right">{eur(r.card_amount)}</TableCell>
                          <TableCell className="text-right">{eur(r.cash_amount)}</TableCell>
                          <TableCell className="text-right">{eur(r.tr_amount)}</TableCell>
                          <TableCell className="text-right">{eur(r.other_amount)}</TableCell>
                          <TableCell className="text-right">{pct(r.tr_share)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{int(totals.tickets)}</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">{eur(totals.card)}</TableCell>
                        <TableCell className="text-right">{eur(totals.cash)}</TableCell>
                        <TableCell className="text-right">{eur(totals.tr)}</TableCell>
                        <TableCell className="text-right">{eur(totals.other)}</TableCell>
                        <TableCell className="text-right">{pct(totals.trShare)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
