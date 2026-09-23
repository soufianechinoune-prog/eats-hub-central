import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Euro, Network, Repeat, ShoppingBag, Sparkles, Store, Users } from "lucide-react";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import { useChataigneCrossStore } from "@/hooks/useChataigneCrossStore";
import { cn } from "@/lib/utils";

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const fmtEur = (v: number, digits = 2) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)} %`;

const PROFIL_COLORS: Record<string, string> = {
  "1 restaurant": "hsl(var(--muted-foreground))",
  "2 restaurants": "hsl(var(--chart-1))",
  "3 restaurants": "hsl(var(--chart-2))",
  "4 restaurants et +": "hsl(var(--chart-4))",
};

function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-16px_hsl(var(--foreground)/0.12)]",
        className
      )}
    >
      <header className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-16px_hsl(var(--foreground)/0.12)] transition-shadow hover:shadow-[0_2px_4px_hsl(var(--foreground)/0.05),0_16px_40px_-16px_hsl(var(--foreground)/0.18)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity opacity-70 group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ChataigneCrossStore() {
  const [metric, setMetric] = useState<"clients" | "ca">("clients");

  const {
    selectedRestaurants,
    selectedChainId,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    setPeriodMode,
    setDateRange,
  } = useAnalyticsContext();

  const didInitPeriod = useRef(false);
  useEffect(() => {
    if (didInitPeriod.current) return;
    didInitPeriod.current = true;
    // 90 derniers jours, arrêtés à la veille (la journée en cours est incomplète)
    setDateRange({ from: addDays(new Date(), -90), to: addDays(new Date(), -1) });
    setPeriodMode("range");
  }, [setDateRange, setPeriodMode]);

  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("id, name, city, is_pinned, is_active").order("name");
      if (selectedChainId) query = query.eq("chain_id", selectedChainId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const chainRestaurantIds = useMemo(() => restaurants?.map((r) => r.id) ?? [], [restaurants]);

  const restaurantFilter = useMemo<string[] | null | undefined>(() => {
    const resolved = resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    });
    if (!resolved) return null;
    if (resolved === EMPTY_BRAND_SCOPE_RESTAURANT_IDS) return EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
    return resolved;
  }, [selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const q = useChataigneCrossStore(start, end, restaurantFilter);
  const data = q.data;
  const isLoading = restaurantFilter === undefined || q.isLoading;
  const s = data?.summary;

  const profilChart = useMemo(
    () =>
      (data?.profils ?? []).map((p) => ({
        name: p.profil,
        clients: p.clients,
        ca: p.ca,
        fill: PROFIL_COLORS[p.profil] ?? "hsl(var(--chart-3))",
      })),
    [data]
  );

  const maxPairClients = useMemo(
    () => Math.max(1, ...(data?.paires ?? []).map((p) => p.clients_communs)),
    [data]
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Mobilité inter-restaurants</h1>
                <p className="text-muted-foreground">
                  Clients qui commandent dans plusieurs restaurants du réseau · 100 % pseudonymisé
                </p>
              </div>
            </div>
            <AnalyticsHeader />
          </div>

          <p className="text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            Un client « nomade » commande dans au moins deux restaurants différents sur la période.
            Ces clients révèlent les zones de chalandise qui se recoupent (complémentarité ou
            cannibalisation) et pèsent souvent plus lourd en CA que les clients fidèles à un seul
            point de vente.
          </p>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiTile
                label="Clients nomades"
                value={fmtInt(s?.clients_multi ?? 0)}
                hint={`${fmtPct(s?.multi_pct ?? 0)} des ${fmtInt(s?.clients ?? 0)} clients`}
                icon={Network}
              />
              <KpiTile
                label="CA des nomades"
                value={fmtEur(s?.ca_multi ?? 0, 0)}
                hint={`${fmtPct(s?.ca_multi_pct ?? 0)} du CA total`}
                icon={Euro}
              />
              <KpiTile
                label="Restaurants par client"
                value={(s?.restaurants_moy ?? 0).toFixed(2)}
                hint={`${fmtInt(s?.clients_mono ?? 0)} clients fidèles à un seul resto`}
                icon={Store}
              />
              <KpiTile
                label="Panier moyen nomade"
                value={fmtEur(s?.panier_multi ?? 0)}
                hint={`contre ${fmtEur(s?.panier_mono ?? 0)} en mono-resto`}
                icon={ShoppingBag}
              />
              <KpiTile
                label="Fréquence nomade"
                value={(s?.freq_multi ?? 0).toFixed(2)}
                hint={`contre ${(s?.freq_mono ?? 0).toFixed(2)} commandes en mono-resto`}
                icon={Repeat}
              />
              <KpiTile
                label="Clients de la période"
                value={fmtInt(s?.clients ?? 0)}
                hint="ayant commandé au moins une fois"
                icon={Users}
              />
            </div>
          )}

          {/* Répartition par nombre de restaurants */}
          {isLoading ? (
            <Skeleton className="h-[380px] rounded-2xl" />
          ) : (data?.profils.length ?? 0) === 0 ? (
            <Panel title="Répartition des clients" subtitle="Aucune donnée sur cette période.">
              <div className="py-16 text-center text-sm text-muted-foreground">
                Élargis la période ou vérifie la sélection de restaurants.
              </div>
            </Panel>
          ) : (
            <Panel
              title="Répartition des clients par nombre de restaurants visités"
              subtitle="Combien de clients restent sur un seul point de vente, et combien circulent dans le réseau."
              action={
                <ToggleGroup
                  type="single"
                  value={metric}
                  onValueChange={(v) => v && setMetric(v as "clients" | "ca")}
                  size="sm"
                >
                  <ToggleGroupItem value="clients">Clients</ToggleGroupItem>
                  <ToggleGroupItem value="ca">CA</ToggleGroupItem>
                </ToggleGroup>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profilChart} layout="vertical" margin={{ top: 8, right: 56, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) =>
                      metric === "clients" ? [`${fmtInt(v)} clients`, "Clients"] : [fmtEur(v, 0), "CA"]
                    }
                  />
                  <Bar dataKey={metric} radius={[0, 8, 8, 0]}>
                    {profilChart.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profil</TableHead>
                      <TableHead className="text-right">Clients</TableHead>
                      <TableHead className="text-right">Commandes</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Panier moyen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.profils ?? []).map((p) => (
                      <TableRow key={p.profil}>
                        <TableCell className="font-medium">{p.profil}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(p.clients)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(p.commandes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(p.ca, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(p.panier_moyen)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          )}

          {/* Paires de restaurants */}
          {isLoading ? (
            <Skeleton className="h-[420px] rounded-2xl" />
          ) : (
            <Panel
              title="Paires de restaurants les plus liées"
              subtitle="Restaurants qui partagent le plus de clients : zones de chalandise proches ou usages différents (midi au travail, soir au domicile)."
            >
              {(data?.paires.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Aucun client commun détecté sur cette période.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant A</TableHead>
                        <TableHead>Restaurant B</TableHead>
                        <TableHead className="w-[220px]">Clients communs</TableHead>
                        <TableHead className="text-right">Commandes</TableHead>
                        <TableHead className="text-right">CA cumulé</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.paires ?? []).map((p) => (
                        <TableRow key={`${p.resto_a}-${p.resto_b}`}>
                          <TableCell className="font-medium">{p.resto_a}</TableCell>
                          <TableCell className="font-medium">{p.resto_b}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${(100 * p.clients_communs) / maxPairClients}%` }}
                                />
                              </div>
                              <span className="tabular-nums text-sm font-medium">{fmtInt(p.clients_communs)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(p.commandes)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtEur(p.ca, 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          )}

          {/* Restaurants carrefours */}
          {isLoading ? (
            <Skeleton className="h-[420px] rounded-2xl" />
          ) : (
            <Panel
              title="Restaurants carrefours"
              subtitle="Part de la clientèle de chaque restaurant qui commande aussi ailleurs dans le réseau. Un taux élevé signale une clientèle partagée."
            >
              {(data?.restaurants.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Aucune donnée sur cette période.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        <TableHead className="text-right">Clients</TableHead>
                        <TableHead className="text-right">Dont partagés</TableHead>
                        <TableHead className="text-right">Taux de partage</TableHead>
                        <TableHead className="text-right">CA</TableHead>
                        <TableHead className="text-right">CA partagé</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.restaurants ?? []).map((r) => (
                        <TableRow key={r.restaurant_id}>
                          <TableCell className="font-medium">{r.nom}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(r.clients)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {fmtInt(r.clients_partages)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmtPct(r.partage_pct)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtEur(r.ca, 0)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {fmtEur(r.ca_partage, 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          )}
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
