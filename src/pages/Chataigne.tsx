import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  Euro,
  MessageCircle,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChataigneOrdersAnalysis } from "@/components/chataigne/ChataigneOrdersAnalysis";
import {
  useChataigneByRestaurant,
  useChataigneMonthly,
  useChataigneOverview,
  type ChataigneRestaurant,
} from "@/hooks/useChataigne";

const CHANNEL_START = "2026-06-01";

const fmtEur = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

const monthLabel = (mois: string) => {
  const [y, m] = mois.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_LABELS[idx] ?? mois} ${y?.slice(2) ?? ""}`;
};

const PRESETS = [
  { value: "since-start", label: "Depuis le lancement (juin 2026)" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
  { value: "current-month", label: "Mois en cours" },
  { value: "custom", label: "Période personnalisée" },
];

const shiftDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

function FreshnessBadge({ value, isLoading }: { value: string | null; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-6 w-48" />;
  if (!value) {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
        Aucune synchronisation enregistrée
      </Badge>
    );
  }
  const hours = (Date.now() - new Date(value).getTime()) / 3_600_000;
  const fresh = hours < 48;
  const label =
    hours < 1
      ? "il y a moins d'une heure"
      : hours < 24
        ? `il y a ${Math.round(hours)} h`
        : `il y a ${Math.round(hours / 24)} j`;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        fresh
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          fresh ? "bg-emerald-500" : "bg-amber-500"
        )}
      />
      {fresh ? "Données à jour" : "Données à rafraîchir"} · dernière synchro {label}
    </Badge>
  );
}

type SortKey = "restaurant_name" | "city" | "commandes" | "ca_brut" | "panier_moyen";

export default function Chataigne() {
  const [preset, setPreset] = useState("since-start");
  const [start, setStart] = useState(CHANNEL_START);
  const [end, setEnd] = useState(today());
  const [sortKey, setSortKey] = useState<SortKey>("ca_brut");
  const [sortAsc, setSortAsc] = useState(false);

  const applyPreset = (v: string) => {
    setPreset(v);
    if (v === "since-start") {
      setStart(CHANNEL_START);
      setEnd(today());
    } else if (v === "30d") {
      setStart(shiftDays(30));
      setEnd(today());
    } else if (v === "90d") {
      setStart(shiftDays(90));
      setEnd(today());
    } else if (v === "current-month") {
      const d = new Date();
      setStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
      setEnd(today());
    }
  };

  const overviewQ = useChataigneOverview(start, end);
  const monthlyQ = useChataigneMonthly(start, end);
  const restaurantsQ = useChataigneByRestaurant(start, end);

  const chartData = useMemo(
    () =>
      (monthlyQ.data ?? []).map((m) => ({
        label: monthLabel(m.mois),
        ca: m.ca_brut,
        commandes: m.commandes,
      })),
    [monthlyQ.data]
  );

  const sorted = useMemo(() => {
    const rows: ChataigneRestaurant[] = [...(restaurantsQ.data ?? [])];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av).localeCompare(String(bv), "fr")
        : String(bv).localeCompare(String(av), "fr");
    });
    return rows;
  }, [restaurantsQ.data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((s) => !s);
    else {
      setSortKey(key);
      setSortAsc(key === "restaurant_name" || key === "city");
    }
  };

  const SortHead = ({
    keyName,
    label,
    align = "left",
  }: {
    keyName: SortKey;
    label: string;
    align?: "left" | "right";
  }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(keyName)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          sortKey === keyName ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {sortKey === keyName &&
          (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
      </button>
    </TableHead>
  );

  const o = overviewQ.data;
  const isLoading = overviewQ.isLoading || monthlyQ.isLoading || restaurantsQ.isLoading;
  const isEmpty =
    !isLoading && (!o || (o.commandes === 0 && o.ca_brut === 0)) && (restaurantsQ.data ?? []).length === 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Chataigne</h1>
            <p className="mt-1 text-muted-foreground">Canal WhatsApp &amp; Instagram</p>
          </div>
          <FreshnessBadge value={o?.derniere_sync ?? null} isLoading={overviewQ.isLoading} />
        </div>

        {/* Barre de période */}
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Période</Label>
              <Select value={preset} onValueChange={applyPreset}>
                <SelectTrigger className="h-12 w-72 rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Du</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setPreset("custom");
                }}
                className="h-12 w-44 rounded-xl bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Au</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setPreset("custom");
                }}
                className="h-12 w-44 rounded-xl bg-background"
              />
            </div>
          </div>
        </div>

        {/* KPI */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Chiffre d'affaires brut" value={fmtEur(o?.ca_brut ?? 0)} icon={Euro} />
            <KPICard title="Commandes" value={fmtInt(o?.commandes ?? 0)} icon={ShoppingBag} />
            <KPICard title="Panier moyen" value={fmtEur(o?.panier_moyen ?? 0, 2)} icon={Wallet} />
            <KPICard title="Restaurants actifs" value={fmtInt(o?.restos_actifs ?? 0)} icon={Store} />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <MessageCircle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          CA brut = valeur des commandes passées via WhatsApp &amp; Instagram. Contrairement aux
          marketplaces, il s'agit du canal propre de la marque : quasiment aucune commission n'est
          prélevée, le CA brut est donc très proche du CA encaissé.
        </p>

        {isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Aucune donnée sur cette période</p>
              <p className="text-sm text-muted-foreground">
                Élargis la période ou vérifie la synchronisation du canal Chataigne.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Évolution mensuelle */}
            <Card>
              <CardHeader>
                <CardTitle>Évolution mensuelle</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyQ.isLoading ? (
                  <Skeleton className="h-[340px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        yAxisId="left"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => fmtEur(Number(v))}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => fmtInt(Number(v))}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.75rem",
                          color: "hsl(var(--popover-foreground))",
                        }}
                        formatter={(value: number, name: string) =>
                          name === "CA brut" ? fmtEur(Number(value)) : fmtInt(Number(value))
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="ca"
                        name="CA brut"
                        fill="hsl(var(--primary))"
                        radius={[6, 6, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="commandes"
                        name="Commandes"
                        stroke="hsl(var(--accent-foreground))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Tableau par restaurant */}
            <Card>
              <CardHeader>
                <CardTitle>Performance par restaurant</CardTitle>
              </CardHeader>
              <CardContent>
                {restaurantsQ.isLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : sorted.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucun restaurant actif sur cette période.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortHead keyName="restaurant_name" label="Restaurant" />
                          <SortHead keyName="city" label="Ville" />
                          <SortHead keyName="commandes" label="Commandes" align="right" />
                          <SortHead keyName="ca_brut" label="CA brut" align="right" />
                          <SortHead keyName="panier_moyen" label="Panier moyen" align="right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((r) => (
                          <TableRow key={r.restaurant_id}>
                            <TableCell className="font-medium">
                              {r.restaurant_name ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                            <TableCell className="text-right">{fmtInt(r.commandes)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {fmtEur(r.ca_brut)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtEur(r.panier_moyen, 2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <ChataigneOrdersAnalysis
              start={start}
              end={end}
              totalOrders={o?.commandes ?? 0}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}
