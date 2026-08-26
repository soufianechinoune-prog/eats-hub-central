import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { AlertTriangle, ChevronDown, ChevronRight, FileDown, FileSpreadsheet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import {
  useChataigneMarkup,
  useChataignePriceAlerts,
  type MarkupRow,
} from "@/hooks/useChataigneTarification";
import { useChataigneTarifExport, type MarkupStore } from "@/hooks/useChataigneTarifExport";


const fmtEur = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v);

const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));

const versionLabel = (v: string) => (v === "A_CONFIRMER" ? "À affecter" : v);

export function groupMarkupStores(data: MarkupRow[] | undefined): MarkupStore[] {
  const map = new Map<string, { id: string; name: string | null; items: MarkupRow[] }>();
  for (const r of data ?? []) {
    const entry = map.get(r.restaurant_id) ?? {
      id: r.restaurant_id,
      name: r.restaurant_name,
      items: [],
    };
    entry.items.push(r);
    map.set(r.restaurant_id, entry);
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      avg: s.items.reduce((acc, i) => acc + i.markup_pct, 0) / (s.items.length || 1),
      items: [...s.items].sort((a, b) => b.markup_pct - a.markup_pct),
    }))
    .sort((a, b) => b.avg - a.avg);
}

/* --------------------------- 3. Alertes de prix -------------------------- */

function AlertsSection({ restaurantIds }: { restaurantIds: string[] | null | undefined }) {
  const { data, isLoading } = useChataignePriceAlerts(restaurantIds);
  const { exportAlertsXlsx } = useChataigneTarifExport();

  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart)),
    [data]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Écarts de prix EMPORT vs grille
          </CardTitle>
          <CardDescription>
            Compare le prix emport réellement pratiqué au prix de la grille de la version du
            restaurant. Concerne uniquement l'emport.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={() => exportAlertsXlsx(rows)}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading || restaurantIds === undefined ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun écart détecté sur le périmètre sélectionné.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Prix emport observé</TableHead>
                  <TableHead className="text-right">Prix grille</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.restaurant_id}-${r.item_name}-${i}`}>
                    <TableCell className="font-medium">{r.restaurant_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{versionLabel(r.version ?? "A_CONFIRMER")}</Badge>
                    </TableCell>
                    <TableCell>{r.item_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtEur(r.prix_emport_observe)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtEur(r.prix_grille)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        r.ecart > 0 ? "text-destructive" : "text-amber-600"
                      )}
                    >
                      {r.ecart > 0 ? "+" : ""}
                      {fmtEur(r.ecart)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------- 4. Markup livraison -------------------------- */

function MarkupSection({ restaurantIds }: { restaurantIds: string[] | null | undefined }) {
  const { data, isLoading } = useChataigneMarkup(restaurantIds);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { exportMarkupXlsx } = useChataigneTarifExport();

  const stores = useMemo(() => groupMarkupStores(data), [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Markup livraison
          </CardTitle>
          <CardDescription>
            Écart moyen entre le prix livraison et le prix emport, par point de vente.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={stores.length === 0}
          onClick={() => exportMarkupXlsx(stores)}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading || restaurantIds === undefined ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune donnée de markup sur le périmètre sélectionné.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Restaurant</TableHead>
                  <TableHead className="text-right">Produits comparés</TableHead>
                  <TableHead className="text-right">Markup moyen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((s) => (
                  <Fragment key={s.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          {open[s.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{s.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.items.length}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {fmtPct(s.avg)}
                      </TableCell>
                    </TableRow>
                    {open[s.id] && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/40 p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produit</TableHead>
                                <TableHead className="text-right">Prix emport</TableHead>
                                <TableHead className="text-right">Prix livraison</TableHead>
                                <TableHead className="text-right">Markup %</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {s.items.map((it, i) => (
                                <TableRow key={`${s.id}-${it.item_name}-${i}`}>
                                  <TableCell>{it.item_name}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {fmtEur(it.prix_emport)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {fmtEur(it.prix_livraison)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {fmtPct(it.markup_pct)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Page ---------------------------------- */

export default function ChataigneTarification() {
  const { selectedRestaurants, selectedChainId } = useAnalyticsContext();

  const { data: restaurants } = useQuery({
    queryKey: ["chataigne-tarif-restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("id").order("name");
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
    if (!resolved) return null;
    if (resolved === EMPTY_BRAND_SCOPE_RESTAURANT_IDS) return EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
    return resolved;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">Chataigne — Écarts & Markup</h1>
            <p className="text-muted-foreground">
              Écarts de prix emport et markup livraison, basés sur les prix sur place.
            </p>
          </div>
          <AnalyticsHeader />
        </div>

        <AlertsSection restaurantIds={restaurantFilter} />
        <MarkupSection restaurantIds={restaurantFilter} />
      </div>
    </AppLayout>
  );
}
