import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, subDays } from "date-fns";
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
import {
  deliveryGainTotals, OFFER_KIND_LABEL, parseDeliveryGainRows, perOrder, parseOfferGainRows, parseOfferKind, restaurantFigures,
  type DeliveryGainRow, type GainFigures, type GainScope, type OfferGainRow, type OfferKind,
} from "@/lib/deliveryGain";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const eur = (v: number | null | undefined, sign = false) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Math.abs(v));
  if (v < 0) return `−${s}`;
  return sign && v > 0 ? `+${s}` : s;
};
const int = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const tone = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v < 0 ? "text-destructive" : "text-success";

function Chip({ label, value, highlight, sub, tip }: { label: string; value: string; highlight?: "good" | "bad"; sub?: string; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
    <div
      tabIndex={0}
      className={cn(
        "cursor-help rounded-lg border px-4 py-3",
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
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-left text-xs font-normal">{tip}</TooltipContent>
    </Tooltip>
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
  service_fee: number | null;
  items_delivery: number | null;
  items_takeaway: number | null;
  /** Estimations (réglage par enseigne), absentes de la donnée. */
  chataigne_fee: number | null;
  stripe_fee: number | null;
  service_balance: number | null;
  full_result: number | null;
  /** Comparaison avec la même commande en emporté. */
  service_extra: number | null;
  stripe_extra: number | null;
  takeaway_gap: number | null;
  /** Offre client de la commande. total_amount est le total hors offre ; paid_amount ce que le client a réellement payé. */
  offer_kind: OfferKind;
  offer_label: string | null;
  discount: number;
  paid_amount: number | null;
}

/** Vue hors taxe (par défaut) ou TTC. */
type TaxMode = "ht" | "ttc";
/** Réglages de l'enseigne : taux de TVA par nature de montant et frais de paiement (lus en base, jamais en dur ici). */
interface GainSettings { vatItems: number | null; vatFees: number | null; vatUber: number | null; vatNote: string | null; stripePct: number | null; stripeFixed: number | null }
type VatKind = "items" | "fees" | "uber" | "pay" | "mix" | "none";
const pct = (v: number | null | undefined) => (v == null ? "taux non réglé" : `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
/** Fin d'info-bulle : quelle TVA s'applique à ce montant, et si elle est comprise ou retirée. */
function vatSuffix(kind: VatKind, tax: TaxMode, st: GainSettings | undefined): string {
  if (kind === "none") return "";
  if (kind === "pay") return " Pas de TVA sur les frais de paiement.";
  if (kind === "mix") {
    return tax === "ht"
      ? " Calculé sur des montants hors taxe."
      : " Calculé sur des montants TTC, alors que les taux de TVA diffèrent d'une ligne à l'autre : la vue hors taxe est la plus juste.";
  }
  const rate = kind === "items" ? st?.vatItems : kind === "fees" ? st?.vatFees : st?.vatUber;
  const who = kind === "uber" ? "le restaurant la récupère" : "le restaurant la reverse à l'État";
  return tax === "ht" ? ` Hors taxe : TVA de ${pct(rate)} retirée (${who}).` : ` TTC : TVA de ${pct(rate)} comprise (${who}).`;
}

type Rpc = (fn: string, params: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>;
// Appel écrit ainsi pour garder le client Supabase comme contexte de la méthode.
const rpc: Rpc = (fn, params) => (supabase.rpc as unknown as Rpc)(fn, params);

function OfferBadge({ kind, label }: { kind: OfferKind; label?: string | null }) {
  if (kind === "none") return null;
  return (
    <Badge variant="secondary" className="ml-2 font-sans text-[11px] font-medium" title={label ?? undefined}>
      {OFFER_KIND_LABEL[kind]}
    </Badge>
  );
}

const num = (v: unknown) => (v == null ? null : Number(v));

const Line = ({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) => (
  <div className={cn("flex items-baseline justify-between gap-4 py-1 text-sm", strong && "font-semibold")}>
    <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
    <span className={cn("tabular-nums", className)}>{value}</span>
  </div>
);

const toOrderRow = (r: Record<string, unknown>): OrderRow => ({
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
  service_fee: num(r.service_fee),
  items_delivery: num(r.items_delivery),
  items_takeaway: num(r.items_takeaway),
  chataigne_fee: num(r.chataigne_fee),
  stripe_fee: num(r.stripe_fee),
  service_balance: num(r.service_balance),
  full_result: num(r.full_result),
  service_extra: num(r.service_extra),
  stripe_extra: num(r.stripe_extra),
  takeaway_gap: num(r.takeaway_gap),
  offer_kind: parseOfferKind(r.offer_kind ?? "none"),
  offer_label: r.offer_label == null ? null : String(r.offer_label),
  discount: Number(r.discount) || 0,
  paid_amount: num(r.paid_amount),
});

/** Commandes livrées d'un restaurant, dans le périmètre et la vue (hors taxe ou TTC) demandés. */
async function fetchOrderRows(restaurantId: string, start: string, end: string, scope: GainScope, tax: TaxMode): Promise<OrderRow[]> {
  const { data, error } = await rpc("get_chataigne_delivery_gain_orders", { p_start: start, p_end: end, p_restaurant_id: restaurantId, p_scope: scope, p_tax: tax });
  if (error) throw error;
  return (data ?? []).map(toOrderRow);
}

/** Panneau latéral : la commande telle que le client l'a passée, puis le calcul du gain. */
function OrderSheet({ order: pageOrder, restaurantId, restaurantName, onClose, tax: pageTax, scope }: { order: OrderRow | null; restaurantId: string; restaurantName: string; onClose: () => void; tax: TaxMode; scope: GainScope }) {
  // Onglet propre au panneau : on compare hors taxe et TTC sans changer la vue de la page.
  const [tax, setTax] = useState<TaxMode>(pageTax);
  useEffect(() => setTax(pageTax), [pageTax, pageOrder?.order_id]);
  const day = pageOrder ? new Date(pageOrder.order_datetime) : null;
  const { data: other, isLoading: otherLoading, error: otherError } = useQuery<OrderRow | null, Error>({
    queryKey: ["chataigne-gain-order-other-tax", pageOrder?.order_id, tax, scope],
    queryFn: async () => {
      // un jour de marge de chaque côté : la date de la commande est lue en heure de Paris côté base
      const rows = await fetchOrderRows(restaurantId, format(subDays(day!, 1), "yyyy-MM-dd"), format(addDays(day!, 1), "yyyy-MM-dd"), scope, tax);
      return rows.find((r) => r.order_id === pageOrder!.order_id) ?? null;
    },
    enabled: !!pageOrder && tax !== pageTax,
  });
  const order = tax === pageTax ? pageOrder : other ?? null;
  const { data: head, isLoading: headLoading } = useQuery({
    queryKey: ["chataigne-gain-order-head", pageOrder?.order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chataigne_orders")
        .select("chataigne_order_id, raw_payload, total_amount, discount_total_amount")
        .eq("id", pageOrder!.order_id)
        .maybeSingle();
      if (error) throw error;
      const payload = (data?.raw_payload ?? null) as { charges?: unknown } | null;
      const charges = (Array.isArray(payload?.charges) ? payload.charges : []) as { type?: string; amount?: { amount?: number } }[];
      const charge = (t: string) => charges.filter((c) => c.type === t).reduce((sum, c) => sum + (Number(c.amount?.amount) || 0), 0);
      return {
        chataigneOrderId: data?.chataigne_order_id ?? null,
        service: charge("service"),
        delivery: charge("delivery"),
        // Le ticket du client est toujours en TTC, quelle que soit la vue choisie.
        paid: data?.total_amount == null ? null : Number(data.total_amount),
        discount: Number(data?.discount_total_amount) || 0,
      };
    },
    enabled: !!pageOrder,
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
    <Sheet open={!!pageOrder} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {pageOrder && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>Commande {pageOrder.short_id ?? ""}</SheetTitle>
              <SheetDescription>
                {restaurantName} · {format(new Date(pageOrder.order_datetime), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })} · livraison
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
                  <Line label="Frais de livraison" value={eur(head?.delivery ?? null)} />
                  <Line label="Frais de service" value={eur(head?.service ?? null)} />
                  <div className="mt-1 border-t pt-1">
                    {(head?.discount ?? 0) > 0 && (
                      <>
                        <Line label="Total hors offre" value={eur((head?.paid ?? 0) + (head?.discount ?? 0))} />
                        <Line label={`Offre${pageOrder.offer_label ? ` « ${pageOrder.offer_label} »` : ""}`} value={eur(-(head?.discount ?? 0))} />
                      </>
                    )}
                    <Line label="Total payé par le client (TTC)" value={eur(head?.paid ?? null)} strong />
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">Ticket du client : prix TTC.</p>
                </div>
              </section>

              <section>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Ce que la livraison rapporte au restaurant</h3>
                  <Tabs value={tax} onValueChange={(v) => setTax(v as TaxMode)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="ht" className="px-3 py-1 text-xs" title="Ce qui reste réellement au restaurant, TVA retirée">Hors taxe</TabsTrigger>
                      <TabsTrigger value="ttc" className="px-3 py-1 text-xs" title="Montants TVA comprise">TTC</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {!order ? (
                  otherError ? (
                    <p className="text-sm text-destructive">Cette vue n'a pas pu être chargée : {otherError.message}</p>
                  ) : otherLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Cette commande n'a pas été retrouvée dans cette vue.</p>
                  )
                ) : (
                <>
                <div className="rounded-md border px-3 py-2">
                  <Line label="Markup (prix livraison − prix emporté)" value={eur(order.markup, true)} />
                  <Line label="Frais de livraison payés par le client" value={eur(order.delivery_fee, true)} />
                  <Line
                    label={`Course facturée par Uber Direct${order.distance_km != null ? ` (${order.distance_km.toFixed(1).replace(".", ",")} km)` : ""}`}
                    value={order.real_cost == null ? "inconnue" : eur(-order.real_cost)}
                  />
                  <div className="mt-1 border-t pt-1">
                    <Line label="Gain livraison" value={eur(order.gain_real, true)} strong className={tone(order.gain_real)} />
                  </div>
                </div>
                {order.takeaway_gap != null && (
                  <div className="mt-3 rounded-md border px-3 py-2">
                    <div className="pb-1 text-xs font-medium text-muted-foreground">Comparé à la même commande à emporter</div>
                    <Line label="Gain livraison (ci-dessus)" value={eur(order.gain_real, true)} />
                    <Line
                      label={`Frais de service en plus${order.service_fee != null && order.service_extra != null ? ` (${eur(order.service_fee)} au lieu de ${eur(order.service_fee - order.service_extra)})` : ""}`}
                      value={eur(order.service_extra, true)}
                    />
                    <Line label="Frais Stripe en plus, le total payé étant plus élevé (estimé)" value={order.stripe_extra == null ? "—" : eur(-order.stripe_extra)} />
                    <div className="mt-1 border-t pt-1">
                      <Line label="Écart vs emporté" value={eur(order.takeaway_gap, true)} strong className={tone(order.takeaway_gap)} />
                    </div>
                    <p className="pt-1 text-xs text-muted-foreground">
                      Ce que cette commande laisse au restaurant en plus (ou en moins) que si le client était venu la chercher. Le frais Châtaigne est le même
                      dans les deux cas : il n'entre pas dans la comparaison.
                    </p>
                  </div>
                )}
                {order.discount > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Calcul fait comme si l'offre n'existait pas : les articles sont pris à leur prix catalogue. La remise de {eur(order.discount)}{tax === "ht" ? " hors taxe" : ""} est un coût
                    d'acquisition, suivi à part dans la vue par offre.
                  </p>
                )}
                {order.real_cost == null && (
                  <p className="mt-2 text-xs text-muted-foreground">La course Uber Direct de cette commande n'a pas été retrouvée : le gain n'est pas calculé.</p>
                )}
                {order.items_without_ref > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Markup partiel : le prix emporté est inconnu pour {int(order.items_without_ref)} article{order.items_without_ref > 1 ? "s" : ""}, compté{order.items_without_ref > 1 ? "s" : ""} pour 0 €.
                  </p>
                )}
                </>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Colonnes « de bout en bout », communes aux restaurants et aux commandes ---------------- */

type FigKey = keyof GainFigures;
interface FigCol { key: FigKey; label: string; tip: string; vat: VatKind; sign?: boolean; strong?: boolean; est?: boolean; km?: boolean }

const FIG_COLS: FigCol[] = [
  { key: "art", vat: "items", label: "Articles livrés", tip: "Ce que le client a payé pour ses articles et suppléments, au prix de la livraison (hors frais de livraison et de service)." },
  { key: "emp", vat: "items", label: "Au prix emporté", tip: "Les mêmes articles au prix que le client aurait payé s'il était venu chercher sa commande." },
  { key: "mk", vat: "items", label: "Markup", tip: "Ce que le restaurant encaisse en plus sur les articles parce que la commande est livrée : articles livrés − mêmes articles au prix emporté.", sign: true },
  { key: "liv", vat: "fees", label: "Frais livr.", tip: "Frais de livraison payés par le client." },
  { key: "svc", vat: "fees", label: "Frais service", tip: "Frais de service payés par le client sur la commande livrée." },
  { key: "tot", vat: "mix", label: "Total payé", tip: "Articles livrés + frais de livraison + frais de service. Pour une commande avec offre : total avant remise." },
  { key: "ud", vat: "uber", label: "Uber Direct", tip: "Ce qu'Uber Direct facture au restaurant pour la course. Montant lu chez Uber Direct, jamais saisi à la main." },
  { key: "km", vat: "none", label: "Distance", tip: "Distance de la course (moyenne pour un restaurant).", km: true },
  { key: "gain", vat: "mix", label: "Gain livraison", tip: "Est-ce que le client paie la course ? Markup + frais de livraison payés par le client − course Uber Direct. Négatif : le restaurant paie une partie de la course.", sign: true, strong: true },
  { key: "svcx", vat: "fees", label: "Service en plus", tip: "Frais de service payés en plus par un client livré, par rapport à une commande à emporter (les deux montants sont lus dans les commandes).", sign: true },
  { key: "stripex", vat: "pay", label: "Stripe en plus (estimé)", tip: "Le client livré paie un total plus élevé, donc le paiement par carte coûte un peu plus cher. ESTIMATION : pourcentage Stripe réglé dans Mijotek.", est: true },
  { key: "ecart", vat: "mix", label: "Écart vs emporté", tip: "Ce que la commande livrée laisse au restaurant en plus (ou en moins) que la même commande à emporter : gain livraison + frais de service en plus − Stripe en plus. C'est la rentabilité de la livraison face à l'emporté.", sign: true, strong: true },
];
const FEE_KEYS: FigKey[] = ["stripex", "ecart"];

const fmtFig = (c: FigCol, v: number | null) => (c.km ? (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} km`) : eur(v, c.sign));

function FigCell({ col, value, bold }: { col: FigCol; value: number | null; bold?: boolean }) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap text-right tabular-nums",
        (col.strong || bold) && "font-semibold",
        col.sign && tone(value),
        (col.est || col.km) && "text-muted-foreground",
      )}
    >
      {fmtFig(col, value)}
    </TableCell>
  );
}

function HeadTip({ col, children, className }: { col: { label: string; tip: string; strong?: boolean }; children?: React.ReactNode; className?: string }) {
  return (
    <TableHead className={cn("whitespace-nowrap text-right text-xs", col.strong && "font-bold text-foreground", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help items-center gap-1 underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">
            {children ?? col.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left text-xs font-normal normal-case">{col.tip}</TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

const orderFigures = (o: OrderRow): GainFigures => ({
  art: o.items_delivery, emp: o.items_takeaway, mk: o.markup, liv: o.delivery_fee, svc: o.service_fee, tot: o.total_amount,
  ud: o.real_cost, km: o.distance_km, gain: o.gain_real, svcx: o.service_extra, stripex: o.stripe_extra, ecart: o.takeaway_gap,
});

/** Détail commande par commande d'un restaurant (période et périmètre sélectionnés). */
function OrdersDetail({ restaurantId, restaurantName, start, end, cols, scope, tax }: { restaurantId: string; restaurantName: string; start: string; end: string; cols: FigCol[]; scope: GainScope; tax: TaxMode }) {
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const { data, isLoading, error } = useQuery<OrderRow[], Error>({
    queryKey: ["chataigne-delivery-gain-orders", restaurantId, start, end, scope, tax],
    queryFn: () => fetchOrderRows(restaurantId, start, end, scope, tax),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error) return <p className="text-sm text-destructive">Le détail n'a pas pu être chargé : {error.message}</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Aucune commande.</p>;

  const figs = data.map((o) => ({ o, f: orderFigures(o) }));
  // Comme la ligne du restaurant : total et moyenne sur les commandes dont la course Uber Direct est connue.
  const priced = figs.filter((x) => x.f.ud != null);
  const without = figs.length - priced.length;
  const total = (k: FigKey) => (priced.length > 0 && priced.every((x) => x.f[k] != null) ? priced.reduce((sum, x) => sum + (x.f[k] as number), 0) : null);

  return (
    <div className="overflow-x-auto rounded-md border bg-background">
      <OrderSheet order={selected} restaurantId={restaurantId} restaurantName={restaurantName} onClose={() => setSelected(null)} tax={tax} scope={scope} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap text-xs">Date</TableHead>
            <TableHead className="whitespace-nowrap text-xs">Commande</TableHead>
            {cols.map((c) => <HeadTip key={c.key} col={c} />)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {figs.map(({ o, f }) => (
            <TableRow
              key={o.order_id}
              className={cn("cursor-pointer", selected?.order_id === o.order_id && "bg-muted")}
              onClick={() => setSelected(o)}
              title="Voir la commande du client"
            >
              <TableCell className="whitespace-nowrap text-sm">{format(new Date(o.order_datetime), "EEE d MMM, HH:mm", { locale: fr })}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">
                {o.short_id ?? "—"}
                <OfferBadge kind={o.offer_kind} label={o.offer_label} />
                {o.items_without_ref > 0 && (
                  <span className="ml-2 font-sans text-[11px] text-muted-foreground" title="Prix emporté inconnu pour une partie des articles : leur markup compte pour 0 €.">
                    markup partiel
                  </span>
                )}
              </TableCell>
              {cols.map((c) => <FigCell key={c.key} col={c} value={f[c.key]} />)}
            </TableRow>
          ))}
          {([["Total", 1], ["Moyenne par commande", Math.max(priced.length, 1)]] as const).map(([label, divisor]) => (
            <TableRow key={label} className="bg-muted/60 hover:bg-muted/60">
              <TableCell className="whitespace-nowrap text-sm font-semibold" colSpan={2}>
                {label}
                {divisor === 1 && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {int(priced.length)} commande{priced.length > 1 ? "s" : ""}
                    {without > 0 && ` (+ ${int(without)} sans course Uber, hors total)`}
                  </span>
                )}
              </TableCell>
              {cols.map((c) => {
                const t = total(c.key);
                const v = c.km ? (divisor === 1 ? null : t == null ? null : t / divisor) : t == null ? null : t / divisor;
                return c.km && divisor === 1 ? <TableCell key={c.key} /> : <FigCell key={c.key} col={c} value={v} bold />;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Vue par offre : une ligne par famille d'offre. Chargée seulement quand on l'ouvre. */
function OffersView({ start, end, restaurantIds, scope, tax }: { start: string; end: string; restaurantIds: string[]; scope: GainScope; tax: TaxMode }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery<OfferGainRow[], Error>({
    queryKey: ["chataigne-delivery-gain-by-offer", start, end, restaurantIds, scope, tax],
    queryFn: async () => {
      const { data, error } = await rpc("get_chataigne_delivery_gain_by_offer", { p_start: start, p_end: end, p_restaurant_ids: restaurantIds, p_tax: tax });
      if (error) throw error;
      return parseOfferGainRows(data, scope);
    },
    enabled: open,
  });
  const totalDiscounts = (data ?? []).reduce((sum, r) => sum + r.discounts, 0);
  const th = "whitespace-nowrap text-right text-xs";
  const td = "whitespace-nowrap text-right tabular-nums";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex items-center gap-2 text-lg font-semibold hover:text-foreground">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        Par offre
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : error ? (
            <p className="text-sm text-destructive">La vue par offre n'a pas pu être chargée : {error.message}</p>
          ) : (
            <>
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap text-xs">Offre</TableHead>
                        <TableHead className={th}>Commandes</TableHead>
                        <TableHead className={th}>Articles / cmd</TableHead>
                        <TableHead className={th}>Markup / cmd</TableHead>
                        <TableHead className={th}>Frais livr. / cmd</TableHead>
                        <TableHead className={th}>Uber Direct / cmd</TableHead>
                        <TableHead className={cn(th, "font-bold text-foreground")}>Gain / cmd</TableHead>
                        <TableHead className={cn(th, "font-bold text-foreground")}>Écart vs emporté / cmd</TableHead>
                        <TableHead className={th}>Remise / cmd</TableHead>
                        <TableHead className={th}>Remises accordées</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data ?? []).map((r) => (
                        <TableRow key={r.kind} className={cn(!r.inGain && "text-muted-foreground")}>
                          <TableCell className="text-sm">
                            <div className="font-medium">
                              {OFFER_KIND_LABEL[r.kind]}
                              {!r.inGain && <span className="ml-2 text-[11px] font-normal">hors du gain affiché</span>}
                            </div>
                            {r.labels && <div className="max-w-xs truncate text-[11px] text-muted-foreground" title={r.labels}>{r.labels}</div>}
                          </TableCell>
                          <TableCell className={td}>
                            {int(r.pricedOrders)}
                            {r.orders > r.pricedOrders && (
                              <span className="ml-1 text-[11px] text-muted-foreground" title={`${r.orders - r.pricedOrders} commande(s) sans course Uber Direct retrouvée, hors moyennes`}>
                                +{int(r.orders - r.pricedOrders)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className={td}>{eur(r.itemsPerOrder)}</TableCell>
                          <TableCell className={td}>{eur(r.markupPerOrder)}</TableCell>
                          <TableCell className={td}>{eur(r.feesPerOrder)}</TableCell>
                          <TableCell className={td}>{eur(r.uberPerOrder)}</TableCell>
                          <TableCell className={cn(td, "font-semibold", tone(r.gainPerOrder))}>{eur(r.gainPerOrder, true)}</TableCell>
                          <TableCell className={cn(td, "font-semibold", tone(r.gapPerOrder))}>{eur(r.gapPerOrder, true)}</TableCell>
                          <TableCell className={td}>{r.discounts > 0 ? eur(r.discountPerOrder) : "—"}</TableCell>
                          <TableCell className={td}>{r.discounts > 0 ? eur(r.discounts) : "—"}</TableCell>
                        </TableRow>
                      ))}
                      {(data ?? []).length === 0 && (
                        <TableRow><TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">Aucune commande livrée.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              <p className="max-w-3xl text-xs text-muted-foreground">
                Montants {tax === "ht" ? "hors taxe" : "TTC"}. Le gain est calculé comme si l'offre n'existait pas (articles au prix catalogue). Les remises accordées
                {totalDiscounts > 0 && <> — <span className="font-medium text-foreground">{eur(totalDiscounts)}</span> sur la période —</>} sont le coût des offres :
                elles ne sont pas déduites du gain livraison. « Article offert » reste hors du gain, car l'article gratuit y serait compté comme payé.
              </p>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type SortKey = "name" | "orders" | FigKey;

export default function ChataigneDeliveryGain() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } = useAnalyticsContext();
  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ecart");
  const [sortAsc, setSortAsc] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"total" | "order">("total");
  // Par défaut : toutes les commandes, offre neutralisée (le test du modèle sur tout le volume).
  const [scope, setScope] = useState<GainScope>("all");
  // Par défaut hors taxe : c'est ce qui reste réellement au restaurant.
  const [tax, setTax] = useState<TaxMode>("ht");

  const { data: settings } = useQuery<GainSettings>({
    queryKey: ["chataigne-delivery-gain-settings", selectedChainId],
    queryFn: async () => {
      const { data, error } = await rpc("get_chataigne_delivery_gain_settings", { p_chain_id: selectedChainId });
      if (error) throw error;
      const r = (data ?? [])[0] ?? {};
      return {
        vatItems: num(r.vat_items), vatFees: num(r.vat_customer_fees), vatUber: num(r.vat_uber_direct),
        vatNote: r.vat_note == null ? null : String(r.vat_note), stripePct: num(r.stripe_pct), stripeFixed: num(r.stripe_fixed_eur),
      };
    },
    enabled: !!selectedChainId,
  });
  const vs = (kind: VatKind) => vatSuffix(kind, tax, settings);

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
    queryKey: ["chataigne-delivery-gain", start, end, restaurantIds, scope, tax],
    queryFn: async () => {
      const { data, error } = await rpc("get_chataigne_delivery_gain", {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantIds,
        p_scope: scope,
        p_tax: tax,
      });
      if (error) throw error;
      return parseDeliveryGainRows(data);
    },
    enabled: !!restaurantIds && restaurantIds.length > 0,
  });

  const totals = useMemo(() => deliveryGainTotals(data ?? []), [data]);
  const hasUber = totals.pricedOrders > 0;
  const hasFees = totals.takeawayGap != null;
  // Sans réglage de frais (ou sans Uber Direct relié), les colonnes correspondantes ne sont pas affichées.
  const cols = useMemo(
    () =>
      FIG_COLS.filter((c) => (hasFees || !FEE_KEYS.includes(c.key)) && (hasUber || ["mk", "liv"].includes(c.key))).map((c) => ({
        ...c,
        tip: c.tip + vatSuffix(c.vat, tax, settings),
      })),
    [hasFees, hasUber, tax, settings],
  );
  const effectiveSort: SortKey = sortKey === "name" || sortKey === "orders" || cols.some((c) => c.key === sortKey) ? sortKey : hasUber ? "gain" : "mk";

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? [])
      .filter((r) => r.orders > 0 && (!q || r.restaurant_name.toLowerCase().includes(q)))
      .map((r) => ({ r, f: restaurantFigures(r, mode === "order") }));
    const val = (x: (typeof list)[number]): number | string | null =>
      effectiveSort === "name" ? x.r.restaurant_name.toLowerCase() : effectiveSort === "orders" ? x.r.orders : x.f[effectiveSort];
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // les valeurs inconnues toujours en bas
      if (vb == null) return -1;
      const c = typeof va === "string" ? va.localeCompare(String(vb), "fr") : (va as number) - (vb as number);
      return sortAsc ? c : -c;
    });
  }, [data, search, effectiveSort, sortAsc, mode]);

  const onSort = (k: SortKey) => {
    if (k === effectiveSort) setSortAsc((v) => !v);
    else {
      setSortKey(k);
      setSortAsc(k === "name");
    }
  };
  const arrow = (k: SortKey) => effectiveSort === k && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />);

  const periodLabel = `du ${format(startDate, "d MMMM", { locale: fr })} au ${format(endDate, "d MMMM yyyy", { locale: fr })}`;

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map(({ r }) => {
        const f = restaurantFigures(r);
        return {
          Restaurant: r.restaurant_name,
          [scope === "all" ? "Commandes livrées (offre neutralisée)" : "Commandes livrées sans offre"]: r.orders,
          "dont avec course Uber Direct (base des montants)": r.real_orders,
          [scope === "all" ? "Commandes « article offert » (non comptées)" : "Commandes avec offre (non comptées)"]: r.orders_with_offer,
          [`Articles payés en livraison (€ ${tax === "ht" ? "HT" : "TTC"})`]: f.art,
          [`Mêmes articles au prix emporté (€ ${tax === "ht" ? "HT" : "TTC"})`]: f.emp,
          "Markup (€)": f.mk,
          "Frais de livraison payés par le client (€)": f.liv,
          "Frais de service payés par le client (€)": f.svc,
          "Total payé par le client (€)": f.tot,
          "Course facturée par Uber Direct (€)": f.ud,
          "Distance moyenne (km)": f.km,
          "Gain livraison (€)": f.gain,
          "Frais de service en plus par rapport à l'emporté (€)": f.svcx,
          "Frais Stripe en plus, estimé (€)": f.stripex,
          "Écart vs emporté (€)": f.ecart,
          "Articles sans prix emporté connu": r.qty_no_ref,
        };
      }),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Gain livraison");
    XLSX.writeFile(wb, `gain-livraison-whatsapp_${tax}_${scope === "all" ? "toutes-commandes" : "sans-offre"}_${start}_${end}.xlsx`);
  };

  const colCount = cols.length + 2;

  return (
    <AppLayout>
      <ChannelNavShell>
        <TooltipProvider delayDuration={100}>
        <div className="space-y-6 p-4 md:p-6">
          <AnalyticsHeader />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ce que la livraison rapporte au restaurant</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Commande WhatsApp livrée par Uber Direct, {periodLabel}.{" "}
                {scope === "all"
                  ? "Toutes les commandes livrées, comptées comme si l'offre client n'existait pas (bienvenue, parrainage, promo)"
                  : "Seulement les commandes livrées sans aucune offre client (ni bienvenue, ni parrainage, ni promo)"}
                {data ? <> : <span className="font-medium text-foreground">{int(totals.orders)} commandes</span>. Montants {tax === "ht" ? "hors taxe" : "TTC"}.</> : "."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
              <Tabs value={tax} onValueChange={(v) => setTax(v as TaxMode)}>
                <TabsList>
                  <TabsTrigger value="ht" title="Ce qui reste réellement au restaurant : la TVA encaissée sur les ventes est retirée, la TVA payée à Uber Direct aussi (le restaurant la récupère).">Hors taxe</TabsTrigger>
                  <TabsTrigger value="ttc" title="Les montants tels que le client les paie et tels qu'Uber Direct les facture, TVA comprise.">TTC</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs value={scope} onValueChange={(v) => { setScope(v as GainScope); setOpenId(null); }}>
                <TabsList>
                  <TabsTrigger value="all" title="Toutes les commandes livrées, comptées comme si l'offre client n'existait pas. La remise est un coût d'acquisition, visible dans « Par offre ».">Toutes les commandes</TabsTrigger>
                  <TabsTrigger value="no_offer" title="Seulement les commandes livrées sans aucune offre client. Moins de commandes, et un panier plus petit.">Sans offre uniquement</TabsTrigger>
                </TabsList>
              </Tabs>
              </div>
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
                {scope === "all" ? "Aucune commande livrée sur cette période" : "Aucune commande livrée sans offre client sur cette période"}
                {totals.ordersWithOffer > 0 && <> ({int(totals.ordersWithOffer)} commandes livrées {scope === "all" ? "avec un article offert" : "avec une offre"}, non comptées ici)</>}.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ---------------- Par commande, en moyenne ---------------- */}
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Par commande, en moyenne</h2>
                <div className="text-sm font-medium text-muted-foreground">1. Le client paie-t-il la course ?</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip label="Markup" value={eur(totals.markupPerOrder)} tip={"Ce que le restaurant encaisse en plus sur les articles parce que la commande est livrée : le prix livraison est plus élevé que le prix emporté." + vs("items")} />
                  <Plus className="h-4 w-4 text-muted-foreground" aria-label="plus" />
                  <Chip label="Frais de livraison client" value={eur(totals.feesPerOrder)} tip={"Frais de livraison payés par le client, en moyenne par commande." + vs("fees")} />
                  <Minus className="h-4 w-4 text-muted-foreground" aria-label="moins" />
                  <Chip label="Facturé par Uber Direct" value={eur(totals.uberPerOrder)} tip={"Ce qu'Uber Direct facture au restaurant pour la course, en moyenne. Montant lu chez Uber Direct, jamais saisi à la main." + vs("uber")} />
                  <Equal className="h-4 w-4 text-muted-foreground" aria-label="égale" />
                  <Chip
                    label="Gain livraison"
                    value={eur(totals.gainPerOrder, true)}
                    sub={totals.gainPerOrder == null ? undefined : totals.gainPerOrder >= 0 ? "oui, la course est couverte" : "non, il manque ce montant"}
                    tip={"Markup + frais de livraison payés par le client − course Uber Direct. Négatif : le restaurant paie une partie de la course de sa poche." + vs("mix")}
                    highlight={totals.gainPerOrder == null ? undefined : totals.gainPerOrder >= 0 ? "good" : "bad"}
                  />
                </div>
                {hasFees && (
                  <>
                    <div className="pt-2 text-sm font-medium text-muted-foreground">2. La livraison rapporte-t-elle plus que la même commande à emporter ?</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip
                        label="Gain livraison"
                        value={eur(totals.gainPerOrder, true)}
                        tip="Le résultat de la première ligne : ce qu'il reste (ou ce qu'il manque) une fois la course payée."
                      />
                      <Plus className="h-4 w-4 text-muted-foreground" aria-label="plus" />
                      <Chip
                        label="Frais de service en plus"
                        value={eur(perOrder(totals.serviceExtra, totals.pricedOrders))}
                        tip={"Un client livré paie un frais de service plus élevé qu'un client qui vient chercher sa commande. La différence reste au restaurant. Les deux montants sont lus dans les commandes." + vs("fees")}
                      />
                      <Minus className="h-4 w-4 text-muted-foreground" aria-label="moins" />
                      <Chip
                        label="Paiement en plus (estimé)"
                        value={eur(perOrder(totals.stripeExtra, totals.pricedOrders))}
                        tip={"Le client livré paie un total plus élevé, donc le paiement par carte coûte un peu plus cher au restaurant. Estimation : pourcentage réglé dans Mijotek." + vs("pay")}
                      />
                      <Equal className="h-4 w-4 text-muted-foreground" aria-label="égale" />
                      <Chip
                        label="Écart vs emporté"
                        value={eur(totals.takeawayGapPerOrder, true)}
                        sub={(totals.takeawayGapPerOrder ?? 0) >= 0 ? "oui, la livraison laisse plus" : "non, la livraison laisse moins"}
                        tip={"Ce qu'une commande livrée laisse au restaurant en plus (ou en moins) que la même commande à emporter : gain livraison + frais de service en plus − paiement en plus. Le frais Châtaigne est le même dans les deux cas, il n'entre pas dans la comparaison." + vs("mix")}
                        highlight={(totals.takeawayGapPerOrder ?? 0) >= 0 ? "good" : "bad"}
                      />
                    </div>
                  </>
                )}
              </section>

              {/* ---------------- Résultat sur la période ---------------- */}
              {hasUber ? (
                <Card className={cn((totals.gain ?? 0) < 0 ? "border-destructive/30 bg-destructive/10" : "border-success/30 bg-success/10")}>
                  <CardContent className="space-y-2 p-5">
                    <div className="text-sm text-muted-foreground">Gain livraison sur la période</div>
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
                    {hasFees && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">
                          Comparé à l'emporté, le client livré paie aussi {eur(totals.serviceExtra)} de frais de service en plus, et le paiement coûte {eur(totals.stripeExtra)} de plus (estimé).
                          Écart vs emporté :{" "}
                        </span>
                        <span className={cn("font-semibold tabular-nums", tone(totals.takeawayGap))}>{eur(totals.takeawayGap, true)}</span>
                        <span className="text-muted-foreground">
                          , soit {eur(totals.takeawayGapPerOrder, true)} par commande : une commande livrée laisse {(totals.takeawayGap ?? 0) >= 0 ? "plus" : "moins"} au restaurant que la même à emporter.
                        </span>
                      </p>
                    )}
                    {totals.ordersWithoutUber > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {int(totals.ordersWithoutUber)} commande{totals.ordersWithoutUber > 1 ? "s" : ""} sans course Uber Direct retrouvée : non comptée{totals.ordersWithoutUber > 1 ? "s" : ""}.
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
                  <Tabs value={mode} onValueChange={(v) => setMode(v as "total" | "order")}>
                    <TabsList>
                      <TabsTrigger value="total" title="Montants additionnés sur toutes les commandes du restaurant">Total</TabsTrigger>
                      <TabsTrigger value="order" title="Moyenne par commande, pour comparer des restaurants de tailles différentes">Par commande</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <span className="text-sm text-muted-foreground">{int(rows.length)} restaurant{rows.length > 1 ? "s" : ""}</span>
                </div>
                <Card>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap text-xs">
                            <button type="button" onClick={() => onSort("name")} className="inline-flex items-center gap-1 font-semibold hover:text-foreground">
                              Restaurant {arrow("name")}
                            </button>
                          </TableHead>
                          <HeadTip col={{ label: "Cmd", tip: scope === "all" ? "Commandes livrées dont la course Uber Direct est connue, offre neutralisée : tous les montants de la ligne portent sur ces commandes." : "Commandes livrées sans offre client dont la course Uber Direct est connue : tous les montants de la ligne portent sur ces commandes." }}>
                            <button type="button" onClick={() => onSort("orders")} className="inline-flex items-center gap-1">Cmd {arrow("orders")}</button>
                          </HeadTip>
                          {cols.map((c) => (
                            <HeadTip key={c.key} col={c}>
                              <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1">
                                {c.label} {arrow(c.key)}
                              </button>
                            </HeadTip>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(({ r, f }) => {
                          const open = openId === r.restaurant_id || rows.length === 1;
                          const without = r.orders - r.real_orders;
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
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                  {int(hasUber ? r.real_orders : r.orders)}
                                  {hasUber && without > 0 && (
                                    <span className="ml-1 text-[11px] text-muted-foreground" title={`${without} commande(s) sans course Uber Direct retrouvée, non comptée(s)`}>
                                      +{int(without)}
                                    </span>
                                  )}
                                </TableCell>
                                {cols.map((c) => <FigCell key={c.key} col={c} value={f[c.key]} />)}
                              </TableRow>
                              {open && (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={colCount} className="bg-muted/40 p-3">
                                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                                      Détail des {int(r.orders)} commande{r.orders > 1 ? "s" : ""} de {r.restaurant_name} — cliquez sur une commande pour voir ce que le client a commandé
                                    </div>
                                    <OrdersDetail restaurantId={r.restaurant_id} restaurantName={r.restaurant_name} start={start} end={end} cols={cols} scope={scope} tax={tax} />
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={colCount} className="py-6 text-center text-sm text-muted-foreground">Aucun restaurant ne correspond.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
                <p className="text-xs text-muted-foreground">
                  Passez la souris sur un intitulé de colonne pour voir comment il est calculé. Cliquez sur un restaurant pour voir ses commandes.
                  Avec 1 à 3 commandes, un restaurant peut varier beaucoup d'une semaine à l'autre.
                </p>
              </section>

              {/* ---------------- Par offre ---------------- */}
              {restaurantIds && <OffersView start={start} end={end} restaurantIds={restaurantIds} scope={scope} tax={tax} />}

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
                      <span className="font-medium text-foreground">Frais de livraison et de service</span> : montants payés par le client, lus dans le détail de chaque commande WhatsApp.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Uber Direct</span> : {hasUber
                        ? <>prix de chaque course, lu chez Uber Direct chaque nuit et rattaché à la commande par son numéro. Aucun prix n'est saisi à la main.</>
                        : <>non relié pour cette enseigne.</>}
                    </li>
                    {hasFees && (
                      <li>
                        <span className="font-medium text-foreground">Écart vs emporté</span> = gain livraison + frais de service payés en plus par le client livré − frais Stripe en plus.
                        Les frais de service (livraison et emporté) sont lus dans les commandes. Le supplément Stripe est une estimation réglée dans Mijotek.
                        Le frais Châtaigne est le même en livraison et en emporté : il n'entre pas dans la comparaison.
                      </li>
                    )}
                    <li>
                      <span className="font-medium text-foreground">TVA</span> : en vue hors taxe, chaque montant est ramené hors TVA avec le taux réglé pour l'enseigne.
                      Articles et markup : {pct(settings?.vatItems)}. Frais de livraison et de service payés par le client : {pct(settings?.vatFees)}.
                      Course Uber Direct : {pct(settings?.vatUber)} (le montant lu chez Uber Direct est TTC). Frais de paiement et frais Châtaigne : pas de TVA.
                      {settings?.vatNote && <> {settings.vatNote}</>}
                    </li>
                    <li>
                      {scope === "all" ? (
                        <>
                          <span className="font-medium text-foreground">Offres client</span> : une commande avec offre est comptée comme si l'offre n'existait pas
                          (articles au prix catalogue, total hors remise). La remise est un coût d'acquisition, visible dans « Par offre ».
                          {totals.ordersWithOffer > 0 && <> {int(totals.ordersWithOffer)} commandes avec un article offert ne sont pas comptées : l'article gratuit y serait compté comme payé.</>}
                        </>
                      ) : (
                        <>{int(totals.ordersWithOffer)} commandes livrées avec une offre client ne sont pas comptées dans cette vue.</>
                      )}
                    </li>
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
        </TooltipProvider>
      </ChannelNavShell>
    </AppLayout>
  );
}
