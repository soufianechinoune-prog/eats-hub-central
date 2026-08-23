import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Bike, Clock, MessageCircle, Sparkles, ShoppingBag, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChataigneBreakdown,
  useChataigneProducts,
  useChataignePromos,
  type ChataigneProduct,
} from "@/hooks/useChataigne";

const fmtEur = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const fmtPct = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v || 0)} %`;

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
];

type ProductSortKey = keyof Pick<
  ChataigneProduct,
  "item_name" | "commandes" | "quantite" | "ca_estime" | "pu_moyen"
>;

interface Props {
  start: string;
  end: string;
  totalOrders: number;
  restaurantIds?: string[] | null;
}

export function ChataigneOrdersAnalysis({ start, end, totalOrders, restaurantIds = null }: Props) {
  const productsQ = useChataigneProducts(start, end, restaurantIds);
  const promosQ = useChataignePromos(start, end, restaurantIds);
  const breakdownQ = useChataigneBreakdown(start, end, restaurantIds);

  const [sortKey, setSortKey] = useState<ProductSortKey>("commandes");
  const [sortAsc, setSortAsc] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const sortedProducts = useMemo(() => {
    const rows = [...(productsQ.data ?? [])];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av).localeCompare(String(bv), "fr")
        : String(bv).localeCompare(String(av), "fr");
    });
    return rows;
  }, [productsQ.data, sortKey, sortAsc]);

  const topProduct = useMemo(
    () => [...(productsQ.data ?? [])].sort((a, b) => b.commandes - a.commandes)[0] ?? null,
    [productsQ.data]
  );

  const visibleProducts = showAll ? sortedProducts : sortedProducts.slice(0, 20);

  const toggleSort = (key: ProductSortKey) => {
    if (key === sortKey) setSortAsc((s) => !s);
    else {
      setSortKey(key);
      setSortAsc(key === "item_name");
    }
  };

  const SortHead = ({
    keyName,
    label,
    align = "left",
  }: {
    keyName: ProductSortKey;
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

  // Promos insight
  const promos = promosQ.data ?? [];
  const totalPromoUses = promos.reduce((s, p) => s + p.utilisations, 0);
  const welcome = promos.find((p) => /bienvenue|welcome/i.test(p.promo));
  const promoShare = totalOrders > 0 ? (totalPromoUses / totalOrders) * 100 : 0;
  const welcomeShare = totalOrders > 0 ? ((welcome?.utilisations ?? 0) / totalOrders) * 100 : 0;

  // Breakdown
  const rows = breakdownQ.data ?? [];
  const hourly = useMemo(() => {
    const map = new Map(
      rows.filter((r) => r.dimension === "heure").map((r) => [Number(r.valeur), r.commandes])
    );
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, "0")}h`,
      commandes: map.get(h) ?? 0,
    }));
  }, [rows]);
  const peakHour = useMemo(
    () => hourly.reduce((best, cur) => (cur.commandes > best.commandes ? cur : best), hourly[0]),
    [hourly]
  );
  const serviceRows = rows.filter((r) => r.dimension === "service_type");
  const canalRows = rows.filter((r) => r.dimension === "canal");

  const labelService = (v: string) =>
    /deliv|livr/i.test(v) ? "Livraison" : /collect|empor|pickup/i.test(v) ? "Emport" : v;
  const labelCanal = (v: string) =>
    /insta/i.test(v) ? "Instagram" : /whats/i.test(v) ? "WhatsApp" : v;

  const DonutCard = ({
    title,
    icon: Icon,
    data,
    labelFn,
    emptyLabel,
  }: {
    title: string;
    icon: typeof Bike;
    data: typeof serviceRows;
    labelFn: (v: string) => string;
    emptyLabel: string;
  }) => {
    const total = data.reduce((s, r) => s + r.commandes, 0);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.map((r) => ({ name: labelFn(r.valeur), value: r.commandes }))}
                      dataKey="value"
                      innerRadius={38}
                      outerRadius={60}
                      paddingAngle={2}
                      stroke="hsl(var(--background))"
                    >
                      {data.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        color: "hsl(var(--popover-foreground))",
                      }}
                      formatter={(v: number) => fmtInt(Number(v))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {data.map((r, i) => (
                  <div key={r.valeur} className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {labelFn(r.valeur)}
                      <Badge variant="secondary" className="ml-auto">
                        {fmtPct((r.commandes / total) * 100)}
                      </Badge>
                    </div>
                    <p className="pl-[18px] text-xs text-muted-foreground">
                      {fmtInt(r.commandes)} commandes · panier moyen {fmtEur(r.panier_moyen, 2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analyse détaillée des commandes</h2>
        <p className="text-sm text-muted-foreground">
          Détail produit, promotions et répartition sur la période sélectionnée.
        </p>
      </div>

      {/* Produits */}
      <Card>
        <CardHeader>
          <CardTitle>Produits les plus commandés</CardTitle>
          <CardDescription>
            CA estimé à partir des prix unitaires des lignes de commande.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {productsQ.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun produit commandé sur cette période.
            </p>
          ) : (
            <>
              {topProduct && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4">
                  <Trophy className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Produit nº 1</p>
                    <p className="text-lg font-semibold">{topProduct.item_name}</p>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-4 text-sm">
                    <span>
                      <span className="text-muted-foreground">Commandes : </span>
                      <span className="font-medium">{fmtInt(topProduct.commandes)}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Quantité : </span>
                      <span className="font-medium">{fmtInt(topProduct.quantite)}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">CA estimé : </span>
                      <span className="font-medium">{fmtEur(topProduct.ca_estime)}</span>
                    </span>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead keyName="item_name" label="Produit" />
                      <SortHead keyName="commandes" label="Commandes" align="right" />
                      <SortHead keyName="quantite" label="Quantité" align="right" />
                      <SortHead keyName="ca_estime" label="CA estimé" align="right" />
                      <SortHead keyName="pu_moyen" label="Prix moyen" align="right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProducts.map((p) => (
                      <TableRow key={p.item_name}>
                        <TableCell className="font-medium">{p.item_name}</TableCell>
                        <TableCell className="text-right">{fmtInt(p.commandes)}</TableCell>
                        <TableCell className="text-right">{fmtInt(p.quantite)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtEur(p.ca_estime)}
                        </TableCell>
                        <TableCell className="text-right">{fmtEur(p.pu_moyen, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {sortedProducts.length > 20 && (
                <Button variant="outline" size="sm" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Afficher le top 20" : `Afficher les ${sortedProducts.length} produits`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Promotions */}
      <Card>
        <CardHeader>
          <CardTitle>Promotions</CardTitle>
          <CardDescription>Bons et remises appliqués sur la période.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {promosQ.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : promos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune promotion utilisée sur cette période.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promo</TableHead>
                      <TableHead className="text-right">Utilisations</TableHead>
                      <TableHead className="text-right">Montant total</TableHead>
                      <TableHead className="text-right">Remise moyenne</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promos.map((p) => (
                      <TableRow key={p.promo}>
                        <TableCell className="font-medium">{p.promo}</TableCell>
                        <TableCell className="text-right">{fmtInt(p.utilisations)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtEur(p.montant_total)}
                        </TableCell>
                        <TableCell className="text-right">{fmtEur(p.remise_moyenne, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    Ce canal fonctionne surtout à l'acquisition : la majorité des commandes portent
                    un bon de bienvenue.
                  </p>
                  <p className="text-muted-foreground">
                    {fmtPct(promoShare)} des commandes de la période portent une promotion
                    {welcome
                      ? `, dont ${fmtPct(welcomeShare)} avec « ${welcome.promo} » (${fmtInt(
                          welcome.utilisations
                        )} utilisations, ${fmtEur(welcome.montant_total)} de remise).`
                      : "."}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Répartition */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Commandes par heure
          </CardTitle>
          <CardDescription>
            {breakdownQ.isLoading || !peakHour || peakHour.commandes === 0
              ? "Répartition horaire des commandes."
              : `Pic d'activité à ${peakHour.label} avec ${fmtInt(peakHour.commandes)} commandes.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdownQ.isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : hourly.every((h) => h.commandes === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune commande sur cette période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourly} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => fmtInt(Number(v))}
                />
                <RTooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(v: number) => [fmtInt(Number(v)), "Commandes"]}
                />
                <Bar dataKey="commandes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {breakdownQ.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DonutCard
            title="Emport vs Livraison"
            icon={ShoppingBag}
            data={serviceRows}
            labelFn={labelService}
            emptyLabel="Aucune commande sur cette période."
          />
          <DonutCard
            title="Canal"
            icon={MessageCircle}
            data={canalRows}
            labelFn={labelCanal}
            emptyLabel="Aucune commande sur cette période."
          />
        </div>
      )}
    </div>
  );
}
