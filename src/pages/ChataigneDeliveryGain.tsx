import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, ChevronDown, Equal, FileSpreadsheet, Minus, Plus, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { deliveryGainTotals, parseDeliveryGainRows, perOrder, type DeliveryGainRow } from "@/lib/deliveryGain";

/** Avant cette date, Uber Direct n'indiquait que le prix plafonné (3,60 €) : pas de « vrai tarif » lisible. */
const UBER_REAL_PRICE_SINCE = "2026-09-29";

const eur = (v: number | null | undefined, sign = false) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Math.abs(v));
  if (v < 0) return `−${s}`;
  return sign && v > 0 ? `+${s}` : s;
};
const int = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const tone = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v < 0 ? "text-destructive" : "text-success";

type SortKey = "name" | "orders" | "markup" | "fees" | "gainCap" | "gainCapOrder" | "gainReal" | "gainRealOrder";

const sortValue = (r: DeliveryGainRow, k: SortKey): number | string | null => {
  switch (k) {
    case "name": return r.restaurant_name.toLowerCase();
    case "orders": return r.orders;
    case "markup": return r.markup;
    case "fees": return r.delivery_fees;
    case "gainCap": return r.gain_cap;
    case "gainCapOrder": return perOrder(r.gain_cap, r.cap_orders);
    case "gainReal": return r.gain_real;
    case "gainRealOrder": return perOrder(r.gain_real, r.real_orders);
  }
};

function Chip({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" }) {
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
    </div>
  );
}

export default function ChataigneDeliveryGain() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } = useAnalyticsContext();
  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("gainCap");
  const [sortAsc, setSortAsc] = useState(false);

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

  const hasReal = totals.realOrders > 0;
  const beforeRealPrices = start < UBER_REAL_PRICE_SINCE;
  const periodLabel = `du ${format(startDate, "d MMMM", { locale: fr })} au ${format(endDate, "d MMMM yyyy", { locale: fr })}`;

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Restaurant: r.restaurant_name,
        "Commandes livrées sans offre": r.orders,
        "Commandes avec offre (non comptées)": r.orders_with_offer,
        "Markup (€ TTC)": r.markup,
        "Frais de livraison client (€ TTC)": r.delivery_fees,
        "Coût Uber Direct avec offre (€ TTC)": r.cap_cost,
        "Gain avec offre (€)": r.gain_cap,
        "Gain avec offre par commande (€)": perOrder(r.gain_cap, r.cap_orders),
        "Commandes avec prix Uber réel connu": r.real_orders,
        "Coût Uber Direct réel (€ TTC)": r.real_cost,
        "Gain au vrai tarif (€)": r.gain_real,
        "Gain au vrai tarif par commande (€)": perOrder(r.gain_real, r.real_orders),
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
                  <Chip label="Prélevé par Uber Direct" value={eur(totals.capCostPerOrder)} />
                  <Equal className="h-4 w-4 text-muted-foreground" aria-label="égale" />
                  <Chip
                    label="Gagné par le restaurant"
                    value={eur(totals.gainCapPerOrder, true)}
                    highlight={(totals.gainCapPerOrder ?? 0) >= 0 ? "good" : "bad"}
                  />
                </div>
              </section>

              {/* ---------------- Avec l'offre / au vrai tarif ---------------- */}
              <section className="grid gap-4 md:grid-cols-2">
                <Card className="border-border">
                  <CardContent className="space-y-2 p-5">
                    <div className="text-sm text-muted-foreground">Avec le prix Uber Direct facturé au restaurant ({eur(totals.capCostPerOrder)} par course)</div>
                    <div className={cn("text-3xl font-bold tabular-nums", tone(totals.gainCap))}>{eur(totals.gainCap, true)}</div>
                    <p className="text-sm text-muted-foreground">
                      {(totals.gainCap ?? 0) >= 0 ? "gagnés" : "perdus"} sur les {int(totals.capOrders)} commandes, soit {eur(totals.gainCapPerOrder, true)} par commande.{" "}
                      {totals.lossOrdersCap === 0
                        ? "Aucune commande n'est à perte."
                        : `${int(totals.lossOrdersCap)} commande${totals.lossOrdersCap > 1 ? "s sont" : " est"} à perte.`}
                    </p>
                  </CardContent>
                </Card>

                {hasReal ? (
                  <Card className={cn((totals.gainRealPerOrder ?? 0) < 0 ? "border-destructive/30 bg-destructive/10" : "border-success/30 bg-success/10")}>
                    <CardContent className="space-y-2 p-5">
                      <div className="text-sm text-muted-foreground">Si on payait le vrai tarif Uber Direct ({eur(totals.realCostPerOrder)} en moyenne)</div>
                      <div className={cn("text-3xl font-bold tabular-nums", tone(totals.gainRealPerOrder))}>{eur(totals.gainRealPerOrder, true)}</div>
                      <p className="text-sm text-muted-foreground">
                        par commande, soit environ {eur(totals.gainReal, true)} sur la période.{" "}
                        {(totals.gainRealPerOrder ?? 0) < 0
                          ? "Le markup et les frais de livraison ne couvrent pas tout à fait la course."
                          : "Le markup et les frais de livraison couvrent la course."}
                        {totals.realOrders < totals.orders && <> Prix réel connu pour {int(totals.realOrders)} commandes sur {int(totals.orders)}.</>}
                      </p>
                      {beforeRealPrices && (
                        <p className="text-xs text-muted-foreground">
                          Attention : avant le 29 septembre 2026, Uber n'indiquait que le prix plafonné. Le vrai tarif n'est fiable qu'à partir de cette date.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="space-y-2 p-5">
                      <div className="text-sm text-muted-foreground">Si on payait le vrai tarif Uber Direct</div>
                      <div className="text-3xl font-bold text-muted-foreground">—</div>
                      <p className="text-sm text-muted-foreground">
                        Le prix réel des courses Uber Direct n'est pas encore relié à Mijotek pour cette enseigne. Le calcul de gauche utilise le prix plafonné.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>

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
                          <Th k="gainCap">Gain</Th>
                          <Th k="gainCapOrder">Par commande</Th>
                          {hasReal && <Th k="gainReal">Gain au vrai tarif</Th>}
                          {hasReal && <Th k="gainRealOrder">Par commande</Th>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => {
                          const gc = perOrder(r.gain_cap, r.cap_orders);
                          const gr = perOrder(r.gain_real, r.real_orders);
                          return (
                            <TableRow key={r.restaurant_id}>
                              <TableCell className="whitespace-nowrap font-medium">{r.restaurant_name}</TableCell>
                              <TableCell className="text-right tabular-nums">{int(r.orders)}</TableCell>
                              <TableCell className="text-right tabular-nums">{eur(r.markup)}</TableCell>
                              <TableCell className="text-right tabular-nums">{eur(r.delivery_fees)}</TableCell>
                              <TableCell className={cn("text-right font-semibold tabular-nums", tone(r.gain_cap))}>{eur(r.gain_cap)}</TableCell>
                              <TableCell className={cn("text-right tabular-nums", tone(gc))}>{eur(gc)}</TableCell>
                              {hasReal && <TableCell className={cn("text-right tabular-nums", tone(r.gain_real))}>{eur(r.gain_real)}</TableCell>}
                              {hasReal && <TableCell className={cn("text-right tabular-nums", tone(gr))}>{eur(gr)}</TableCell>}
                            </TableRow>
                          );
                        })}
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={hasReal ? 8 : 6} className="py-6 text-center text-sm text-muted-foreground">Aucun restaurant ne correspond.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
                <p className="text-xs text-muted-foreground">
                  « Gain » = markup + frais de livraison client − prix Uber Direct facturé au restaurant.
                  {hasReal && " « Gain au vrai tarif » = même calcul avec le prix réel de chaque course."} Avec 1 à 3 commandes, un restaurant peut varier beaucoup d'une semaine à l'autre.
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
                      <span className="font-medium text-foreground">Uber Direct</span> : {hasReal
                        ? <>prix réel de chaque course, lu chez Uber Direct chaque nuit et rattaché à la commande par son numéro. Le prix facturé au restaurant est plafonné par l'offre en cours (réglage Mijotek, pas lu chez Uber).</>
                        : <>prix plafonné par l'offre en cours (réglage Mijotek). Le prix réel des courses n'est pas relié pour cette enseigne.</>}
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
