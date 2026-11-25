import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Equal, FileSpreadsheet, Minus, Plus, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useChataigneOrderItems, type ChataigneOrderItemRow } from "@/hooks/useChataigne";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { deliveryGainTotals, parseDeliveryGainRows, perOrder, type DeliveryGainRow } from "@/lib/deliveryGain";

const eur = (v: number | null | undefined, sign = false) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Math.abs(v));
  if (v < 0) return `−${s}`;
  return sign && v > 0 ? `+${s}` : s;
};
const int = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const tone = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v < 0 ? "text-destructive" : "text-success";

type SortKey = "name" | "orders" | "markup" | "fees" | "uber" | "gain" | "gainOrder";

const sortValue = (r: DeliveryGainRow, k: SortKey): number | string | null => {
  switch (k) {
    case "name": return r.restaurant_name.toLowerCase();
    case "orders": return r.orders;
    case "markup": return r.markup;
    case "fees": return r.delivery_fees;
    case "uber": return r.real_cost;
    case "gain": return r.gain_real;
    case "gainOrder": return perOrder(r.gain_real, r.real_orders);
  }
};

function Chip({ label, value, highlight, sub }: { label: string; value: string; highlight?: "good" | "bad"; sub?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        highlight === "good" && "border-success/30 bg-success/10",
        highlight === "bad" && "border-destructive/30 bg-destructive/10",
        !highlight && "bg-card",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", highlight === "good" && "text-success", highlight === "bad" && "text-destructive")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

interface OrderRow {
  order_id: string;
  short_id: string | null;
  order_datetime: string;
  total_amount: number | null;
  markup: number | null;
  delivery_fee: number | null;
  real_cost: number | null;
  cap_cost: number | null;
  distance_km: number | null;
  gain_cap: number | null;
  gain_real: number | null;
  items_without_ref: number;
}

const num = (v: unknown) => (v == null ? null : Number(v));

const Line = ({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) => (
  <div className={cn("flex items-baseline justify-between gap-4 py-1 text-sm", strong && "font-semibold")}>
    <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
    <span className={cn("tabular-nums", className)}>{value}</span>
  </div>
);

/** Panneau latéral : la commande telle que le client l'a passée, puis le calcul du gain. */
function OrderSheet({ order, restaurantName, onClose }: { order: OrderRow | null; restaurantName: string; onClose: () => void }) {
  const { data: head, isLoading: headLoading } = useQuery({
    queryKey: ["chataigne-gain-order-head", order?.order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chataigne_orders")
        .select("chataigne_order_id, raw_payload")
        .eq("id", order!.order_id)
        .maybeSingle();
      if (error) throw error;
      const payload = (data?.raw_payload ?? null) as { charges?: unknown } | null;
      const charges = (Array.isArray(payload?.charges) ? payload.charges : []) as { type?: string; amount?: { amount?: number } }[];
      const charge = (t: string) => charges.filter((c) => c.type === t).reduce((sum, c) => sum + (Number(c.amount?.amount) || 0), 0);
      return {
        chataigneOrderId: data?.chataigne_order_id ?? null,
        service: charge("service"),
        delivery: charge("delivery"),
      };
    },
    enabled: !!order,
  });
  const { data: items, isLoading: itemsLoading } = useChataigneOrderItems(head?.chataigneOrderId ?? null);

  const tree = useMemo(() => {
    const list = items ?? [];
    const children = new Map<string, ChataigneOrderItemRow[]>();
    for (const it of list) {
      if (it.depth > 0 && it.parent_item_id) {
        if (!children.has(it.parent_item_id)) children.set(it.parent_item_id, []);
        children.get(it.parent_item_id)!.push(it);
      }
    }
    // Deux lignes identiques dans la même commande partagent le même identifiant : leurs choix ne sont affichés qu'une fois.
    const owner = new Map<string, string>();
    for (const it of list) if (it.item_id && !owner.has(it.item_id)) owner.set(it.item_id, it.id);
    return { roots: list.filter((it) => it.depth === 0), children, owner };
  }, [items]);
  const itemsTotal = (items ?? []).reduce((sum, it) => sum + it.quantity * it.unit_price_amount, 0);

  const renderItem = (it: ChataigneOrderItemRow, level: number): React.ReactNode => (
    <Fragment key={it.id}>
      <div className={cn("flex items-baseline justify-between gap-4 py-1", level === 0 ? "text-sm font-medium" : "text-sm text-muted-foreground")} style={{ paddingLeft: level * 16 }}>
        <span>
          {it.quantity > 1 || level === 0 ? `${it.quantity} × ` : ""}
          {it.item_name ?? "Article"}
        </span>
        <span className="whitespace-nowrap tabular-nums">
          {it.unit_price_amount > 0 ? `${level > 0 ? "+ " : ""}${eur(it.quantity * it.unit_price_amount)}` : ""}
        </span>
      </div>
      {(it.item_id && tree.owner.get(it.item_id) === it.id ? tree.children.get(it.item_id) ?? [] : []).map((c) => renderItem(c, level + 1))}
    </Fragment>
  );

  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {order && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>Commande {order.short_id ?? ""}</SheetTitle>
              <SheetDescription>
                {restaurantName} · {format(new Date(order.order_datetime), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })} · livraison
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-semibold">Ce que le client a commandé</h3>
                {headLoading || itemsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : tree.roots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Le détail des articles n'est pas disponible pour cette commande.</p>
                ) : (
                  <div className="divide-y rounded-md border px-3 py-1">
                    {tree.roots.map((it) => (
                      <div key={it.id} className="py-1.5">{renderItem(it, 0)}</div>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <Line label="Articles" value={eur(itemsTotal)} />
                  <Line label="Frais de livraison" value={eur(head?.delivery ?? order.delivery_fee)} />
                  <Line label="Frais de service" value={eur(head?.service ?? null)} />
                  <div className="mt-1 border-t pt-1">
                    <Line label="Total payé par le client" value={eur(order.total_amount)} strong />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Ce que la livraison rapporte au restaurant</h3>
                <div className="rounded-md border px-3 py-2">
                  <Line label="Markup (prix livraison − prix emporté)" value={eur(order.markup, true)} />
                  <Line label="Frais de livraison payés par le client" value={eur(order.delivery_fee, true)} />
                  <Line
                    label={`Course facturée par Uber Direct${order.distance_km != null ? ` (${order.distance_km.toFixed(1).replace(".", ",")} km)` : ""}`}
                    value={order.real_cost == null ? "inconnue" : eur(-order.real_cost)}
                  />
                  <div className="mt-1 border-t pt-1">
                    <Line label="Gain" value={eur(order.gain_real, true)} strong className={tone(order.gain_real)} />
                  </div>
                </div>
                {order.real_cost == null && (
                  <p className="mt-2 text-xs text-muted-foreground">La course Uber Direct de cette commande n'a pas été retrouvée : le gain n'est pas calculé.</p>
                )}
                {order.items_without_ref > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Markup partiel : le prix emporté est inconnu pour {int(order.items_without_ref)} article{order.items_without_ref > 1 ? "s" : ""}, compté{order.items_without_ref > 1 ? "s" : ""} pour 0 €.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Détail commande par commande d'un restaurant (commandes livrées sans offre client, période sélectionnée). */
function OrdersDetail({ restaurantId, restaurantName, start, end }: { restaurantId: string; restaurantName: string; start: string; end: string }) {
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const { data, isLoading, error } = useQuery<OrderRow[], Error>({
    queryKey: ["chataigne-delivery-gain-orders", restaurantId, start, end],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>)("get_chataigne_delivery_gain_orders", {
        p_start: start,
        p_end: end,
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        order_id: String(r.order_id),
        short_id: r.short_id == null ? null : String(r.short_id),
        order_datetime: String(r.order_datetime),
        total_amount: num(r.total_amount),
        markup: num(r.markup),
        delivery_fee: num(r.delivery_fee),
        real_cost: num(r.real_cost),
        cap_cost: num(r.cap_cost),
        distance_km: num(r.distance_km),
        gain_cap: num(r.gain_cap),
        gain_real: num(r.gain_real),
        items_without_ref: Number(r.items_without_ref) || 0,
      }));
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error) return <p className="text-sm text-destructive">Le détail n'a pas pu être chargé : {error.message}</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Aucune commande.</p>;

  return (
    <div className="overflow-x-auto rounded-md border bg-background">
      <OrderSheet order={selected} restaurantName={restaurantName} onClose={() => setSelected(null)} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap text-xs">Date</TableHead>
            <TableHead className="whitespace-nowrap text-xs">Commande</TableHead>
            <TableHead className="whitespace-nowrap text-right text-xs">Payé par le client</TableHead>
            <TableHead className="whitespace-nowrap text-right text-xs">Markup</TableHead>
            <TableHead className="whitespace-nowrap text-right text-xs">Frais livraison client</TableHead>
            <TableHead className="whitespace-nowrap text-right text-xs">Facturé par Uber Direct</TableHead>
            <TableHead className="whitespace-nowrap text-right text-xs">Distance</TableHead>
            <TableHead className="whitespace-nowrap text-right text-xs">Gain</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((o) => (
            <TableRow
              key={o.order_id}
              className={cn("cursor-pointer", selected?.order_id === o.order_id && "bg-muted")}
              onClick={() => setSelected(o)}
              title="Voir la commande du client"
            >
              <TableCell className="whitespace-nowrap text-sm">{format(new Date(o.order_datetime), "EEE d MMM, HH:mm", { locale: fr })}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">
                {o.short_id ?? "—"}
                {o.items_without_ref > 0 && (
                  <span className="ml-2 font-sans text-[11px] text-muted-foreground" title="Prix emporté inconnu pour une partie des articles : leur markup compte pour 0 €.">
                    markup partiel
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{eur(o.total_amount)}</TableCell>
              <TableCell className="text-right tabular-nums">{eur(o.markup)}</TableCell>
              <TableCell className="text-right tabular-nums">{eur(o.delivery_fee)}</TableCell>
              <TableCell className="text-right tabular-nums">{eur(o.real_cost)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {o.distance_km == null ? "—" : `${o.distance_km.toFixed(1).replace(".", ",")} km`}
              </TableCell>
              <TableCell className={cn("text-right font-semibold tabular-nums", tone(o.gain_real))}>{eur(o.gain_real, true)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ChataigneDeliveryGain() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } = useAnalyticsContext();
  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("gain");
  const [sortAsc, setSortAsc] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: restaurants } = useQuery({
    queryKey: ["chataigne-gain-restaurants", selectedChainId],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("id, name").eq("chain_id", selectedChainId as string).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedChainId,
  });

  // Une enseigne à la fois : on n'additionne jamais deux réseaux.
  const restaurantIds = useMemo<string[] | undefined>(() => {
    if (!restaurants) return undefined;
    const all = restaurants.map((r) => r.id);
    return resolveBrandScopedRestaurantIds({ selectedRestaurantIds: selectedRestaurants, selectedChainId, chainRestaurantIds: all }) ?? all;
  }, [restaurants, selectedRestaurants, selectedChainId]);

  const { data, isLoading, error } = useQuery<DeliveryGainRow[], Error>({
    queryKey: ["chataigne-delivery-gain", start, end, restaurantIds],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: unknown[] | null; error: Error | null }>)("get_chataigne_delivery_gain", {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds,
      });
      if (error) throw error;
      return parseDeliveryGainRows(data);
    },
    enabled: !!restaurantIds && restaurantIds.length > 0,
  });

  const totals = useMemo(() => deliveryGainTotals(data ?? []), [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter((r) => r.orders > 0 && (!q || r.restaurant_name.toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // les valeurs inconnues toujours en bas
      if (vb == null) return -1;
      const c = typeof va === "string" ? va.localeCompare(String(vb), "fr") : (va as number) - (vb as number);
      return sortAsc ? c : -c;
    });
  }, [data, search, sortKey, sortAsc]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(k);
      setSortAsc(k === "name");
    }
  };

  const hasUber = totals.pricedOrders > 0;
  const periodLabel = `du ${format(startDate, "d MMMM", { locale: fr })} au ${format(endDate, "d MMMM yyyy", { locale: fr })}`;

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Restaurant: r.restaurant_name,
        "Commandes livrées sans offre": r.orders,
        "Commandes avec offre (non comptées)": r.orders_with_offer,
        "Markup (€ TTC)": r.markup,
        "Frais de livraison client (€ TTC)": r.delivery_fees,
        "Commandes avec course Uber Direct retrouvée": r.real_orders,
        "Facturé par Uber Direct (€ TTC)": r.real_cost,
        "Gain (€)": r.gain_real,
        "Gain par commande (€)": perOrder(r.gain_real, r.real_orders),
        "Articles sans prix emporté connu": r.qty_no_ref,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Gain livraison");
    XLSX.writeFile(wb, `gain-livraison-whatsapp_${start}_${end}.xlsx`);
  };

  const Th = ({ k, children, right = true }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <TableHead className={cn("whitespace-nowrap", right && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-foreground", sortKey === k && "text-foreground")}
      >
        {children}
        {sortKey === k && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6 p-4 md:p-6">
          <AnalyticsHeader />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ce que la livraison rapporte au restaurant</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Commande WhatsApp livrée par Uber Direct, {periodLabel}. Seulement les commandes livrées sans aucune offre client
                (ni bienvenue, ni parrainage, ni promo)
                {data ? <> : <span className="font-medium text-foreground">{int(totals.orders)} commandes</span>. Montants TTC.</> : "."}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={rows.length === 0}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
          </div>

          {!selectedChainId ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Choisissez une enseigne en haut à gauche : chaque réseau est analysé séparément.</CardContent></Card>
          ) : error ? (
            <Card><CardContent className="p-6 text-sm text-destructive">Le calcul n'a pas abouti : {error.message}</CardContent></Card>
          ) : isLoading || !data ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : totals.orders === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Aucune commande livrée sans offre client sur cette période
                {totals.ordersWithOffer > 0 && <> ({int(totals.ordersWithOffer)} commandes livrées avec une offre, non comptées ici)</>}.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ---------------- Par commande, en moyenne ---------------- */}
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Par commande, en moyenne</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip label="Markup" value={eur(totals.markupPerOrder)} />
                  <Plus className="h-4 w-4 text-muted-foreground" aria-label="plus" />
                  <Chip label="Frais de livraison client" value={eur(totals.feesPerOrder)} />
                  <Minus className="h-4 w-4 text-muted-foreground" aria-label="moins" />
                  <Chip label="Facturé par Uber Direct" value={eur(totals.uberPerOrder)} />
                  <Equal className="h-4 w-4 text-muted-foreground" aria-label="égale" />
                  <Chip
                    label={(totals.gainPerOrder ?? 0) >= 0 ? "Gagné par le restaurant" : "Perdu par le restaurant"}
                    value={eur(totals.gainPerOrder, true)}
                    highlight={totals.gainPerOrder == null ? undefined : totals.gainPerOrder >= 0 ? "good" : "bad"}
                  />
                </div>
              </section>

              {/* ---------------- Résultat sur la période ---------------- */}
              {hasUber ? (
                <Card className={cn((totals.gain ?? 0) < 0 ? "border-destructive/30 bg-destructive/10" : "border-success/30 bg-success/10")}>
                  <CardContent className="space-y-2 p-5">
                    <div className="text-sm text-muted-foreground">Sur la période</div>
                    <div className={cn("text-3xl font-bold tabular-nums", tone(totals.gain))}>{eur(totals.gain, true)}</div>
                    <p className="text-sm text-muted-foreground">
                      {(totals.gain ?? 0) >= 0 ? "gagnés" : "perdus"} sur {int(totals.pricedOrders)} commandes, soit {eur(totals.gainPerOrder, true)} par commande.{" "}
                      {(totals.gainPerOrder ?? 0) < 0
                        ? "Le markup et les frais de livraison ne couvrent pas la course."
                        : "Le markup et les frais de livraison couvrent la course."}{" "}
                      {totals.lossOrders === 0
                        ? "Aucune commande n'est à perte."
                        : `${int(totals.lossOrders)} commande${totals.lossOrders > 1 ? "s sont" : " est"} à perte.`}
                    </p>
                    {totals.ordersWithoutUber > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {int(totals.ordersWithoutUber)} commande{totals.ordersWithoutUber > 1 ? "s" : ""} sans course Uber Direct retrouvée : non comptée{totals.ordersWithoutUber > 1 ? "s" : ""} dans le gain.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="space-y-2 p-5">
                    <div className="text-sm font-medium">Gain non calculable pour cette enseigne</div>
                    <p className="text-sm text-muted-foreground">
                      Les courses Uber Direct de cette enseigne ne sont pas encore reliées à Mijotek : on connaît le markup et les frais payés par le client,
                      pas ce qu'Uber Direct facture. Aucun prix n'est supposé.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* ---------------- Par restaurant ---------------- */}
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Par restaurant</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un restaurant" className="pl-8" />
                  </div>
                  <span className="text-sm text-muted-foreground">{int(rows.length)} restaurant{rows.length > 1 ? "s" : ""}</span>
                </div>
                <Card>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <Th k="name" right={false}>Restaurant</Th>
                          <Th k="orders">Commandes</Th>
                          <Th k="markup">Markup</Th>
                          <Th k="fees">Frais livraison client</Th>
                          <Th k="uber">Facturé par Uber Direct</Th>
                          <Th k="gain">Gain</Th>
                          <Th k="gainOrder">Par commande</Th>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => {
                          const gr = perOrder(r.gain_real, r.real_orders);
                          const open = openId === r.restaurant_id || rows.length === 1;
                          return (
                            <Fragment key={r.restaurant_id}>
                              <TableRow
                                className="cursor-pointer"
                                onClick={() => setOpenId(openId === r.restaurant_id ? null : r.restaurant_id)}
                                aria-expanded={open}
                              >
                                <TableCell className="whitespace-nowrap font-medium">
                                  <span className="inline-flex items-center gap-1.5">
                                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                    {r.restaurant_name}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{int(r.orders)}</TableCell>
                                <TableCell className="text-right tabular-nums">{eur(r.markup)}</TableCell>
                                <TableCell className="text-right tabular-nums">{eur(r.delivery_fees)}</TableCell>
                                <TableCell className="text-right tabular-nums">{eur(r.real_cost)}</TableCell>
                                <TableCell className={cn("text-right font-semibold tabular-nums", tone(r.gain_real))}>{eur(r.gain_real, true)}</TableCell>
                                <TableCell className={cn("text-right tabular-nums", tone(gr))}>{eur(gr, true)}</TableCell>
                              </TableRow>
                              {open && (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={7} className="bg-muted/40 p-3">
                                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                                      Détail des {int(r.orders)} commande{r.orders > 1 ? "s" : ""} de {r.restaurant_name}
                                    </div>
                                    <OrdersDetail restaurantId={r.restaurant_id} restaurantName={r.restaurant_name} start={start} end={end} />
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aucun restaurant ne correspond.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
                <p className="text-xs text-muted-foreground">
                  Cliquez sur un restaurant pour voir ses commandes, puis sur une commande pour voir ce que le client a commandé. « Gain » = markup + frais de livraison client − course facturée par Uber Direct. Avec 1 à 3 commandes, un restaurant peut varier beaucoup d'une semaine à l'autre.
                </p>
              </section>

              {/* ---------------- D'où viennent les chiffres ---------------- */}
              <Collapsible>
                <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  D'où viennent ces chiffres
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>
                      <span className="font-medium text-foreground">Markup</span> = prix de l'article en livraison − prix du même article en emporté,
                      suppléments compris. Le prix emporté est celui réellement payé sur les commandes WhatsApp à emporter du même restaurant
                      (à défaut, des restaurants qui ont la même grille de prix).{" "}
                      {totals.refCoveragePct != null && (
                        <>
                          Prix emporté trouvé pour <span className="font-medium text-foreground">{totals.refCoveragePct.toFixed(1).replace(".", ",")} % des articles</span>
                          {totals.itemsWithoutRef > 0 && <> ; les {int(totals.itemsWithoutRef)} autres comptent pour 0 € de markup</>}.
                        </>
                      )}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Frais de livraison client</span> : montant payé par le client, lu dans le détail de chaque commande WhatsApp.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Facturé par Uber Direct</span> : {hasUber
                        ? <>prix de chaque course, lu chez Uber Direct chaque nuit et rattaché à la commande par son numéro. Aucun prix n'est saisi à la main.</>
                        : <>non relié pour cette enseigne.</>}
                    </li>
                    <li>
                      {int(totals.ordersWithOffer)} commandes livrées avec une offre client ne sont pas comptées : avec une offre, une partie du prix n'est pas payée par le client.
                    </li>
                    <li>Non comptés : les frais de service, les frais Châtaigne et les frais de paiement.</li>
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
