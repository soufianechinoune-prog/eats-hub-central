import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  CalendarClock,
  Clock,
  Euro,
  Repeat,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import { useChataigneRfm, type RfmSegment } from "@/hooks/useChataigneRfm";
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

const SEGMENT_COLORS: Record<string, string> = {
  Champions: "hsl(var(--chart-2))",
  Fidèles: "hsl(var(--chart-5))",
  Nouveaux: "hsl(var(--chart-1))",
  Occasionnels: "hsl(var(--chart-3))",
  "À risque": "hsl(var(--chart-4))",
  Dormants: "hsl(var(--muted-foreground))",
  "Inactifs (hors période)": "hsl(var(--muted-foreground))",
};

const SEGMENT_HINTS: Record<string, string> = {
  Champions: "Très récents (≤ 14 j) et ≥ 4 commandes",
  Fidèles: "Récents (≤ 30 j) et ≥ 3 commandes",
  Nouveaux: "Première commande dans la période (≤ 2 commandes)",
  Occasionnels: "Peu fréquents (≤ 2 commandes), encore actifs (≤ 60 j)",
  "À risque": "Client régulier qui ne revient plus depuis + 60 j",
  Dormants: "Plus de commande depuis + 60 j (≤ 2 commandes)",
  "Inactifs (hors période)": "Aucune commande dans la période sélectionnée",
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

function SegmentBadge({ segment }: { segment: string }) {
  const color = SEGMENT_COLORS[segment] ?? "hsl(var(--muted-foreground))";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {segment}
    </span>
  );
}

export default function ChataigneClients() {
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

  // Par défaut : tout l'historique du canal (1er juin 2026 → aujourd'hui)
  const didInitPeriod = useRef(false);
  useEffect(() => {
    if (didInitPeriod.current) return;
    didInitPeriod.current = true;
    // Par défaut : 30 derniers jours, arrêtés à la veille (la journée en cours est incomplète)
    setDateRange({ from: addDays(new Date(), -30), to: addDays(new Date(), -1) });
    setPeriodMode("range");
  }, [setDateRange, setPeriodMode]);

  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const chainRestaurantIds = useMemo<string[]>(() => [], []);

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

  const rfmQ = useChataigneRfm(start, end, restaurantFilter);
  const isLoading = restaurantFilter === undefined || rfmQ.isLoading;
  const data = rfmQ.data;

  const chartData = useMemo(
    () =>
      (data?.segments ?? []).map((s) => ({
        name: s.segment,
        clients: s.clients,
        ca: s.ca,
        ca_pct: s.ca_pct,
        fill: SEGMENT_COLORS[s.segment] ?? "hsl(var(--muted-foreground))",
      })),
    [data]
  );

  const fmtDate = (iso: string) => {
    try {
      return format(parseISO(iso), "dd/MM/yyyy", { locale: fr });
    } catch {
      return "—";
    }
  };

  const s = data?.summary;

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Clients &amp; Segments</h1>
                <p className="text-muted-foreground">
                  Matrice RFM — Récence, Fréquence, Montant · clients 100 % pseudonymisés
                </p>
              </div>
            </div>
            <AnalyticsHeader />
          </div>

          <p className="text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            Chaque client du canal Chataigne (WhatsApp &amp; Instagram) est identifié par un code
            pseudonyme irréversible : ni nom, ni téléphone, ni e-mail. La segmentation s'appuie
            uniquement sur l'historique de commandes : <b>récence</b> (jours depuis la dernière
            commande), <b>fréquence</b> (commandes dans la période) et <b>montant</b> (CA généré).
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
                label="Clients actifs"
                value={fmtInt(s?.clients ?? 0)}
                hint={`${fmtInt(s?.nouveaux ?? 0)} nouveau(x) dans la période`}
                icon={Users}
              />
              <KpiTile label="CA clients" value={fmtEur(s?.ca ?? 0, 0)} hint={`${fmtInt(s?.commandes ?? 0)} commandes`} icon={Euro} />
              <KpiTile label="Panier moyen" value={fmtEur(s?.panier_moyen ?? 0)} icon={ShoppingBag} />
              <KpiTile label="Fréquence moyenne" value={`${(s?.frequence_moy ?? 0).toFixed(2)}`} hint="commandes / client" icon={Repeat} />
              <KpiTile label="Récence moyenne" value={`${fmtInt(s?.recence_moy ?? 0)} j`} hint="depuis la dernière commande" icon={Clock} />
              <KpiTile
                label="Inactifs (hors période)"
                value={fmtInt(s?.inactifs ?? 0)}
                hint="clients sans commande sur la période"
                icon={CalendarClock}
              />
            </div>
          )}

          {/* Répartition des segments */}
          {isLoading ? (
            <Skeleton className="h-[420px] rounded-2xl" />
          ) : (data?.segments.length ?? 0) === 0 ? (
            <Panel title="Répartition des segments" subtitle="Aucune donnée sur cette période.">
              <div className="py-16 text-center text-sm text-muted-foreground">
                Élargis la période ou vérifie la sélection de restaurants.
              </div>
            </Panel>
          ) : (
            <Panel
              title="Répartition des segments"
              subtitle="Nombre de clients et part du CA par segment RFM. Les « inactifs (hors période) » sont les clients qui n'ont rien commandé dans la période sélectionnée."
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
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 48, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (metric === "ca" ? fmtEur(Number(v), 0) : fmtInt(Number(v)))}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RTooltip
                    formatter={(value: number | string, name: string) => [
                      name === "clients" ? fmtInt(Number(value)) : fmtEur(Number(value), 0),
                      name === "clients" ? "Clients" : "CA",
                    ]}
                    labelFormatter={(label: string) => {
                      const seg = data?.segments.find((x) => x.segment === label);
                      const hint = SEGMENT_HINTS[label];
                      return seg ? `${label} — ${fmtInt(seg.clients)} clients · ${fmtEur(seg.ca, 0)} (${fmtPct(seg.ca_pct)} du CA)${hint ? ` · ${hint}` : ""}` : label;
                    }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey={metric} radius={[0, 6, 6, 0]} maxBarSize={34}>
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={d.fill} fillOpacity={d.name === "Inactifs (hors période)" ? 0.35 : 0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          )}

          {/* Détail des segments */}
          {!isLoading && (data?.segments.length ?? 0) > 0 && (
            <Panel
              title="Détail des segments"
              subtitle="Pour chaque segment : nombre de clients, commandes, CA généré, panier moyen, fréquence et récence moyennes."
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segment</TableHead>
                      <TableHead className="text-right">Clients</TableHead>
                      <TableHead className="text-right">Part du CA</TableHead>
                      <TableHead className="text-right">Commandes</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Panier moyen</TableHead>
                      <TableHead className="text-right">Fréq. moy.</TableHead>
                      <TableHead className="text-right">Récence moy.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.segments ?? []).map((row: RfmSegment) => (
                      <TableRow key={row.segment}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <SegmentBadge segment={row.segment} />
                            <span className="text-xs text-muted-foreground">{SEGMENT_HINTS[row.segment]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(row.clients)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPct(row.ca_pct)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(row.commandes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(row.ca, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(row.panier_moyen)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.frequence_moy.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(row.recence_moy)} j</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          )}

          {/* Top clients */}
          {!isLoading && (data?.top_clients.length ?? 0) > 0 && (
            <Panel
              title="Top clients (pseudonymisés)"
              subtitle="Les 40 clients les plus générateurs de CA. Identifiant tronqué et irréversible : impossible de retrouver une personne physique."
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead className="text-right">Commandes</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Panier moyen</TableHead>
                      <TableHead className="text-right">Récence</TableHead>
                      <TableHead>Première commande</TableHead>
                      <TableHead>Dernière commande</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.top_clients ?? []).map((c) => (
                      <TableRow key={c.client_key}>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.client_key}</code>
                        </TableCell>
                        <TableCell>
                          <SegmentBadge segment={c.segment} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(c.nb)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{fmtEur(c.ca, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(c.panier)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(c.recence)} j</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(c.premier)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(c.dernier)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          )}

          <Badge variant="outline" className="w-fit">
            Étape 2 (consentement marketing) et 3 (LTV par cohorte) arriveront sur cette même vue.
          </Badge>
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
