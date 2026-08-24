import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ChevronDown, ChevronRight, Search, Tag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import {
  GRID_VERSIONS,
  useChataigneGridPrices,
  useChataigneMarkup,
  useChataignePriceAlerts,
  useChataigneVersionRestaurants,
  useSetGridPrice,
  useSetRestaurantVersion,
  type MarkupRow,
} from "@/hooks/useChataigneTarification";

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

const VERSION_SECTIONS = [...GRID_VERSIONS, "A_CONFIRMER"] as const;
const versionLabel = (v: string) => (v === "A_CONFIRMER" ? "À affecter" : v);

/* ------------------------- 1. Grilles tarifaires ------------------------- */

function PriceCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (price: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (value !== null && Math.abs(parsed - value) < 0.0001) return;
    onSave(parsed);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-8 w-24 text-right"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value !== null ? String(value) : "");
        setEditing(true);
      }}
      className={cn(
        "w-24 rounded-md border border-transparent px-2 py-1 text-right tabular-nums transition-colors hover:border-border hover:bg-muted",
        value === null && "text-muted-foreground"
      )}
    >
      {value === null ? "—" : fmtEur(value)}
    </button>
  );
}

function GridSection() {
  const { data, isLoading } = useChataigneGridPrices();
  const setPrice = useSetGridPrice();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const products = useMemo(() => {
    const map = new Map<string, { key: string; label: string; prices: Record<string, number> }>();
    for (const r of data ?? []) {
      const entry = map.get(r.product_key) ?? {
        key: r.product_key,
        label: r.product_label,
        prices: {},
      };
      entry.prices[r.version] = r.price;
      map.set(r.product_key, entry);
    }
    return [...map.values()]
      .filter((p) => p.label.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [data, search]);

  const save = (version: string, product_key: string, price: number) => {
    setPrice.mutate(
      { version, product_key, price },
      {
        onSuccess: () => toast({ title: "Prix mis à jour", description: `${version} · ${fmtEur(price)}` }),
        onError: (e: unknown) =>
          toast({
            title: "Échec de la mise à jour",
            description: e instanceof Error ? e.message : "Erreur inconnue",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Grilles tarifaires
          </CardTitle>
          <CardDescription>
            4 versions de grille. Cliquez sur un prix pour le modifier.
          </CardDescription>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun produit trouvé.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  {GRID_VERSIONS.map((v) => (
                    <TableHead key={v} className="text-right">
                      {v}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    {GRID_VERSIONS.map((v) => (
                      <TableCell key={v} className="text-right">
                        <div className="flex justify-end">
                          <PriceCell
                            value={p.prices[v] ?? null}
                            onSave={(price) => save(v, p.key, price)}
                          />
                        </div>
                      </TableCell>
                    ))}
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

/* --------------------- 2. Restaurants par version ------------------------ */

function VersionsSection() {
  const { data, isLoading } = useChataigneVersionRestaurants();
  const setVersion = useSetRestaurantVersion();
  const { toast } = useToast();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof data>();
    for (const v of VERSION_SECTIONS) map.set(v, []);
    for (const r of data ?? []) {
      const key = VERSION_SECTIONS.includes(r.version as never) ? r.version : "A_CONFIRMER";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    for (const [, rows] of map)
      rows?.sort((a, b) => (a.restaurant_name ?? "").localeCompare(b.restaurant_name ?? "", "fr"));
    return map;
  }, [data]);

  const change = (restaurant_id: string, version: string, name: string | null) => {
    setVersion.mutate(
      { restaurant_id, version },
      {
        onSuccess: () =>
          toast({ title: "Version mise à jour", description: `${name ?? "Restaurant"} → ${versionLabel(version)}` }),
        onError: (e: unknown) =>
          toast({
            title: "Échec de la mise à jour",
            description: e instanceof Error ? e.message : "Erreur inconnue",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restaurants par version</CardTitle>
        <CardDescription>
          Affectation de chaque point de vente à une grille tarifaire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" />)
        ) : (data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun restaurant.</p>
        ) : (
          VERSION_SECTIONS.map((v) => {
            const rows = grouped.get(v) ?? [];
            return (
              <div key={v} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{versionLabel(v)}</h3>
                  <Badge variant={v === "A_CONFIRMER" ? "destructive" : "secondary"}>
                    {rows.length} resto{rows.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun restaurant.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Restaurant</TableHead>
                          <TableHead>Ville</TableHead>
                          <TableHead className="text-right">Commandes</TableHead>
                          <TableHead>Méthode</TableHead>
                          <TableHead className="w-40">Version</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.restaurant_id}>
                            <TableCell className="font-medium">{r.restaurant_name ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtInt(r.nb_commandes)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.method === "manuel" ? "default" : "outline"}>
                                {r.method ?? "auto"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={r.version}
                                onValueChange={(val) =>
                                  change(r.restaurant_id, val, r.restaurant_name)
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VERSION_SECTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {versionLabel(opt)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- 3. Alertes de prix -------------------------- */

function AlertsSection({ restaurantIds }: { restaurantIds: string[] | null | undefined }) {
  const { data, isLoading } = useChataignePriceAlerts(restaurantIds);

  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart)),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Écarts de prix EMPORT vs grille
        </CardTitle>
        <CardDescription>
          Compare le prix emport réellement pratiqué au prix de la grille de la version du
          restaurant. Concerne uniquement l'emport.
        </CardDescription>
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

  const stores = useMemo(() => {
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
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Markup livraison
        </CardTitle>
        <CardDescription>
          Écart moyen entre le prix livraison et le prix emport, par point de vente.
        </CardDescription>
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
                  <>
                    <TableRow
                      key={s.id}
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
                      <TableRow key={`${s.id}-detail`}>
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
                  </>
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
            <h1 className="text-2xl font-bold">Tarification Chataigne</h1>
            <p className="text-muted-foreground">
              Grilles tarifaires, affectation des versions, écarts de prix et markup livraison.
            </p>
          </div>
          <AnalyticsHeader />
        </div>

        <GridSection />
        <VersionsSection />
        <AlertsSection restaurantIds={restaurantFilter} />
        <MarkupSection restaurantIds={restaurantFilter} />
      </div>
    </AppLayout>
  );
}
