import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bike, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChataigneServiceComparison,
  type RestaurantScope,
  type ChataigneServiceRow,
} from "@/hooks/useChataigne";

const fmtEur = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const fmtPct = (v: number | null, digits = 1) =>
  v === null || v === undefined
    ? "—"
    : `${new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(v)} %`;

interface Props {
  start: string;
  end: string;
  restaurantIds: RestaurantScope;
}

interface Totals {
  orders: number;
  revenue: number;
  avgBasket: number;
}

const sumTotals = (rows: ChataigneServiceRow[]): Totals => {
  const orders = rows.reduce((s, r) => s + r.orders, 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  return { orders, revenue, avgBasket: orders > 0 ? revenue / orders : 0 };
};

export function ChataigneServiceComparison({ start, end, restaurantIds }: Props) {
  const { data, isLoading } = useChataigneServiceComparison(start, end, restaurantIds);

  const rows = data ?? [];

  const collection = useMemo(() => rows.filter((r) => r.service_type === "collection"), [rows]);
  const delivery = useMemo(() => rows.filter((r) => r.service_type === "delivery"), [rows]);

  const cTot = sumTotals(collection);
  const dTot = sumTotals(delivery);
  const allOrders = cTot.orders + dTot.orders;

  const pick = (list: ChataigneServiceRow[], promo: boolean) =>
    list.find((r) => r.has_promo === promo) ?? null;

  const chartData = useMemo(
    () =>
      [
        { key: false, label: "Sans promo" },
        { key: true, label: "Avec promo" },
      ].map(({ key, label }) => {
        const c = pick(collection, key);
        const d = pick(delivery, key);
        return {
          label,
          emport: c?.collection_rate ?? null,
          livraison: d?.collection_rate ?? null,
          emportOrders: c?.orders_with_ref ?? 0,
          livraisonOrders: d?.orders_with_ref ?? 0,
        };
      }),
    [collection, delivery]
  );

  const totalRef = rows.reduce((s, r) => s + r.orders_with_ref, 0);
  const coverage = allOrders > 0 ? (100 * totalRef) / allOrders : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[380px] w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  if (allOrders === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Aucune commande emport ou livraison sur cette période.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vue 1 — rentabilité comparée */}
      <Card>
        <CardHeader>
          <CardTitle>Rentabilité comparée · taux d'encaissement</CardTitle>
          <CardDescription>
            Part de la valeur boutique réellement encaissée, après 1 € Chataigne, frais de paiement
            (0,25 € + 1,5 %) et 3 € de livraison. Au-dessus de 100 %, le canal encaisse plus que le
            prix pratiqué sur place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v) => `${Math.round(Number(v))} %`}
              />
              <RTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value: number) => fmtPct(Number(value))}
              />
              <Legend />
              <Bar dataKey="emport" name="Emport" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="emport"
                  position="top"
                  fontSize={11}
                  fill="hsl(var(--muted-foreground))"
                  formatter={(v: number) => fmtPct(v === null ? null : Number(v), 0)}
                />
              </Bar>
              <Bar
                dataKey="livraison"
                name="Livraison"
                fill="hsl(var(--chart-2, var(--accent-foreground)))"
                radius={[6, 6, 0, 0]}
              >
                <LabelList
                  dataKey="livraison"
                  position="top"
                  fontSize={11}
                  fill="hsl(var(--muted-foreground))"
                  formatter={(v: number) => fmtPct(v === null ? null : Number(v), 0)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {chartData.map((d) => (
              <span key={d.label}>
                <strong className="text-foreground">{d.label}</strong> · emport{" "}
                {fmtInt(d.emportOrders)} cde{d.emportOrders > 1 ? "s" : ""} · livraison{" "}
                {fmtInt(d.livraisonOrders)} cde{d.livraisonOrders > 1 ? "s" : ""}
              </span>
            ))}
          </div>

          {coverage < 90 && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-600"
            >
              Prix boutique connus pour {fmtPct(coverage, 0)} des commandes — à lire avec prudence
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Vue 4 — KPIs côte à côte */}
      <div className="grid gap-4 md:grid-cols-2">
        <ServiceKpiBlock
          title="Emport"
          icon={<ShoppingBag className="h-4 w-4" />}
          totals={cTot}
          share={allOrders > 0 ? (100 * cTot.orders) / allOrders : 0}
          accent="text-primary"
        />
        <ServiceKpiBlock
          title="Livraison"
          icon={<Bike className="h-4 w-4" />}
          totals={dTot}
          share={allOrders > 0 ? (100 * dTot.orders) / allOrders : 0}
          accent="text-emerald-600"
        />
      </div>
    </div>
  );
}

function ServiceKpiBlock({
  title,
  icon,
  totals,
  share,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  totals: Totals;
  share: number;
  accent: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={cn("flex items-center gap-2 text-base", accent)}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Metric label="Commandes" value={fmtInt(totals.orders)} />
        <Metric label="Part du total" value={fmtPct(share, 1)} />
        <Metric label="Chiffre d'affaires" value={fmtEur(totals.revenue)} />
        <Metric label="Panier moyen" value={fmtEur(totals.avgBasket, 2)} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
