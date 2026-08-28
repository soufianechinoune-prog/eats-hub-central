import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  Check,
  ChevronsUpDown,
  Equal,
  Euro,
  FileSpreadsheet,
  Gift,
  Info,
  Layers,
  Truck,
} from "lucide-react";


import { AppLayout } from "@/components/layout/AppLayout";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { useDataGranularity } from "@/hooks/useDataGranularity";

/* ------------------------------- helpers -------------------------------- */

function InfoTooltip({ text, label }: { text: string; label?: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 align-middle text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={label || text}
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-xs text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const fmtEur = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(v) ? v : 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));

interface PnlRow {
  restaurant_id: string;
  restaurant_name: string;
  version: string;
  naan_tenders_price: number | null;
  nb_livraisons: number;
  markup_total: number;
  frais_livraison: number;
  nb_bogo: number;
  bogo_full_value: number;
}

interface ComputedRow extends PnlRow {
  coutUber: number;
  coutBogo: number;
  gain: number;
}

type SortKey =
  | "restaurant_name"
  | "version"
  | "naan_tenders_price"
  | "nb_livraisons"
  | "markup_total"
  | "frais_livraison"
  | "coutUber"
  | "coutBogo"
  | "gain";

/* -------------------------------- page ---------------------------------- */

export default function DeliveryProfitability() {
  const {
    selectedRestaurants,
    selectedChainId,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
  } = useAnalyticsContext();
  const [versionFilter, setVersionFilter] = useState<string[]>([]);
  const [versionOpen, setVersionOpen] = useState(false);

  const [bogoMode, setBogoMode] = useState<"eur" | "pct">("eur");
  const [bogoEur, setBogoEur] = useState(3.5);
  const [bogoPct, setBogoPct] = useState(30);
  const [riderCost, setRiderCost] = useState(3.6);

  const [sortKey, setSortKey] = useState<SortKey>("gain");
  const [sortAsc, setSortAsc] = useState(false);

  const { startDate, endDate } = useDataGranularity({
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  });

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, city, is_pinned, is_active")
        .order("name");
      if (selectedChainId) query = query.eq("chain_id", selectedChainId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const chainRestaurantIds = useMemo(() => restaurants?.map((r) => r.id) ?? [], [restaurants]);

  // undefined = scope pas encore résolu → requête en attente ; null = toutes marques
  const restaurantFilter = useMemo<string[] | null | undefined>(() => {
    if (!restaurants) return undefined;
    const resolved = resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    });
    return resolved ?? null;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const { data, isLoading, error: rpcError } = useQuery<PnlRow[], Error>({
    queryKey: ["delivery-pnl", start, end, restaurantFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_delivery_pnl", {
        p_start: start,
        p_end: end,
        p_restaurant_ids: restaurantFilter ?? null,
      });
      if (error) throw error;
      return (data ?? []) as PnlRow[];
    },
    enabled: restaurantFilter !== undefined,
  });

  /* ---- versions présentes ---- */
  const versions = useMemo(() => {
    const set = new Set<string>();
    for (const r of data ?? []) set.add(r.version || "—");
    return [...set].sort();
  }, [data]);

  /* ---- calcul client ---- */
  const rows = useMemo<ComputedRow[]>(() => {
    const base = (data ?? []).filter(
      (r) => versionFilter.length === 0 || versionFilter.includes(r.version || "—")
    );
    return base.map((r) => {
      const coutUber = riderCost * Number(r.nb_livraisons || 0);
      const coutBogo =
        bogoMode === "eur"
          ? bogoEur * Number(r.nb_bogo || 0)
          : (bogoPct / 100) * Number(r.bogo_full_value || 0);
      const markup = Number(r.markup_total || 0);
      const fees = Number(r.frais_livraison || 0);
      return {
        ...r,
        nb_livraisons: Number(r.nb_livraisons || 0),
        markup_total: markup,
        frais_livraison: fees,
        nb_bogo: Number(r.nb_bogo || 0),
        bogo_full_value: Number(r.bogo_full_value || 0),
        coutUber,
        coutBogo,
        gain: markup + fees - coutUber - coutBogo,
      };
    });
  }, [data, versionFilter, riderCost, bogoMode, bogoEur, bogoPct]);

  const totals = useMemo(() => {
    const acc = rows.reduce(
      (t, r) => ({
        nb: t.nb + r.nb_livraisons,
        markup: t.markup + r.markup_total,
        fees: t.fees + r.frais_livraison,
        uber: t.uber + r.coutUber,
        bogo: t.bogo + r.coutBogo,
        nbBogo: t.nbBogo + r.nb_bogo,
        gain: t.gain + r.gain,
      }),
      { nb: 0, markup: 0, fees: 0, uber: 0, bogo: 0, nbBogo: 0, gain: 0 }
    );
    return { ...acc, gainPerOrder: acc.nb > 0 ? acc.gain / acc.nb : 0 };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv), "fr");
      }
      return Number(av) - Number(bv);
    });
    return sortAsc ? sorted : sorted.reverse();
  }, [rows, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "restaurant_name" || key === "version");
    }
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(
      sortedRows.map((r) => ({
        Restaurant: r.restaurant_name,
        Version: r.version,
        "Prix Naan (grille)": r.naan_tenders_price === null ? null : Number(r.naan_tenders_price.toFixed(2)),
        Livraisons: r.nb_livraisons,
        Markup: Number(r.markup_total.toFixed(2)),
        "Frais livraison": Number(r.frais_livraison.toFixed(2)),
        "Coût Uber": Number(r.coutUber.toFixed(2)),
        "Nb BOGO": r.nb_bogo,
        "Coût BOGO": Number(r.coutBogo.toFixed(2)),
        "Gain net": Number(r.gain.toFixed(2)),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rentabilité livraison");
    const params = XLSX.utils.json_to_sheet([
      { Paramètre: "Période", Valeur: `${start} → ${end}` },
      {
        Paramètre: "Coût BOGO",
        Valeur: bogoMode === "eur" ? `${bogoEur.toFixed(2)} € / BOGO` : `${bogoPct} % de la valeur`,
      },
      { Paramètre: "Coût livreur TTC", Valeur: `${riderCost.toFixed(2)} €` },
      { Paramètre: "Versions filtrées", Valeur: versionFilter.join(", ") || "Toutes" },
    ]);
    XLSX.utils.book_append_sheet(wb, params, "Hypothèses");
    XLSX.writeFile(wb, `rentabilite_livraison_${start}_${end}.xlsx`);
  };

  const positive = totals.gain >= 0;

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <AnalyticsHeader />

        {/* ------------------------- Titre ------------------------- */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Rentabilité Livraison</h1>
            <p className="text-sm text-muted-foreground">
              Canal Chataigne · gain net réel par livraison, hypothèses ajustables en direct.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={rows.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
          </Button>
        </div>

        {rpcError && (
          <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            <strong>Erreur RPC get_delivery_pnl :</strong> {rpcError.message}
          </div>
        )}

        {/* ------------------------- Filtres ------------------------- */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            {/* versions */}
            <Popover open={versionOpen} onOpenChange={setVersionOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between gap-2 min-w-[190px]">
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    {versionFilter.length === 0
                      ? "Toutes les versions"
                      : `${versionFilter.length} version${versionFilter.length > 1 ? "s" : ""}`}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher…" />
                  <CommandList>
                    <CommandEmpty>Aucune version.</CommandEmpty>
                    <CommandGroup>
                      {versions.map((v) => {
                        const active = versionFilter.includes(v);
                        return (
                          <CommandItem
                            key={v}
                            onSelect={() =>
                              setVersionFilter((prev) =>
                                active ? prev.filter((x) => x !== v) : [...prev, v]
                              )
                            }
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")}
                            />
                            {v}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {versionFilter.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setVersionFilter([])}>
                Réinitialiser les versions
              </Button>
            )}

            <Badge variant="secondary" className="ml-auto">
              {fmtInt(rows.length)} restaurant{rows.length > 1 ? "s" : ""} affiché
              {rows.length > 1 ? "s" : ""}
            </Badge>
          </CardContent>
        </Card>

        {/* ------------------------- Curseurs ------------------------- */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4 text-fuchsia-500" /> Coût réel du BOGO (naan offert)
                <InfoTooltip
                  text="Ce qu'un naan offert t'a réellement coûté (coût matière, pas le prix de vente). En € = montant fixe par naan ; en % = part du prix du naan."
                  label="Coût réel du BOGO : informations"
                />
              </CardTitle>
              <CardDescription>
                {fmtInt(totals.nbBogo)} BOGO sur la période · valeur faciale{" "}
                {fmtEur(rows.reduce((s, r) => s + r.bogo_full_value, 0))}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={bogoMode} onValueChange={(v) => setBogoMode(v as "eur" | "pct")}>
                <TabsList>
                  <TabsTrigger value="eur">En €</TabsTrigger>
                  <TabsTrigger value="pct">En %</TabsTrigger>
                </TabsList>
              </Tabs>
              {bogoMode === "eur" ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Coût matière par BOGO</span>
                    <span className="text-2xl font-bold tabular-nums">{bogoEur.toFixed(2)} €</span>
                  </div>
                  <Slider
                    value={[bogoEur]}
                    onValueChange={([v]) => setBogoEur(v)}
                    min={0}
                    max={12}
                    step={0.1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0 €</span>
                    <span>12 €</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      % de la valeur faciale remisée
                    </span>
                    <span className="text-2xl font-bold tabular-nums">{bogoPct} %</span>
                  </div>
                  <Slider
                    value={[bogoPct]}
                    onValueChange={([v]) => setBogoPct(v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0 %</span>
                    <span>100 %</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bike className="h-4 w-4 text-sky-500" /> Coût livreur (TTC)
                <InfoTooltip
                  text="Prix payé au livreur par course. 3,60 € pendant l'offre Uber (jusqu'à fin septembre). Monte le curseur pour simuler le tarif après l'offre."
                  label="Coût livreur : informations"
                />
              </CardTitle>
              <CardDescription>Appliqué à chaque livraison de la période.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Prix par course</span>
                  <span className="text-2xl font-bold tabular-nums">{riderCost.toFixed(2)} €</span>
                </div>
                <Slider
                  value={[riderCost]}
                  onValueChange={([v]) => setRiderCost(v)}
                  min={3.6}
                  max={8}
                  step={0.05}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>3,60 €</span>
                  <span>8,00 €</span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Gain valable tant que l'offre Uber à 3,60 € dure (fin septembre). Au-delà, remontez
                  le curseur pour simuler le tarif réel.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------- KPI hero ------------------------- */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card
              className={cn(
                "border-2",
                positive ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  {positive ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  Gain livraison net
                  <InfoTooltip
                    text="Somme sur la période = Markup + Frais de livraison − Coût Uber − Coût BOGO, tous restos du périmètre."
                    label="Gain livraison net : informations"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    positive ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {fmtEur(totals.gain)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">sur la période sélectionnée</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Euro className="h-4 w-4" /> Gain / livraison
                  <InfoTooltip
                    text="Gain net total ÷ nombre de livraisons = marge nette moyenne par commande livrée."
                    label="Gain par livraison : informations"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    totals.gainPerOrder >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {fmtEur(totals.gainPerOrder, 2)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">marge nette moyenne</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Truck className="h-4 w-4" /> Nb livraisons
                  <InfoTooltip
                    text="Nombre total de commandes livrées Chataigne sur la période et le périmètre."
                    label="Nombre de livraisons : informations"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{fmtInt(totals.nb)}</p>
                <p className="mt-1 text-xs text-muted-foreground">commandes livrées Chataigne</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Gift className="h-4 w-4" /> Coût réel BOGO
                  <InfoTooltip
                    text="Coût total des naans offerts selon le réglage de la jauge (€ ou %)."
                    label="Coût réel BOGO : informations"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-fuchsia-600">
                  {fmtEur(totals.bogo)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtInt(totals.nbBogo)} offres consommées
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ------------------------- Décomposition ------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Décomposition du gain
              <InfoTooltip
                text="Markup + Frais de livraison − Coût livreur − Coût BOGO = Gain net. Chaque bloc se recalcule quand tu bouges les jauges ou les filtres."
                label="Décomposition du gain : informations"
              />
            </CardTitle>
            <CardDescription>
              Markup + Frais de livraison − Coût livreur − Coût BOGO = Gain net
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-9 md:items-stretch">
              <ChainStep
                className="md:col-span-2"
                label="Markup livraison"
                value={totals.markup}
                sign="+"
                tone="emerald"
              />
              <ChainOperator symbol="+" />
              <ChainStep
                className="md:col-span-2"
                label="Frais de livraison"
                value={totals.fees}
                sign="+"
                tone="sky"
              />
              <ChainOperator symbol="−" />
              <ChainStep
                className="md:col-span-2"
                label="Coût livreur"
                value={-totals.uber}
                sign="−"
                tone="red"
              />
              <ChainOperator symbol="−" />
              <ChainStep
                className="md:col-span-1"
                label="Coût BOGO"
                value={-totals.bogo}
                sign="−"
                tone="fuchsia"
              />
            </div>
            <Separator className="my-4" />
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4",
                positive
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-red-500/40 bg-red-500/10"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Equal className="h-4 w-4" /> Gain net livraison
              </span>
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  positive ? "text-emerald-600" : "text-red-600"
                )}
              >
                {fmtEur(totals.gain)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ------------------------- Tableau ------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Détail par restaurant</CardTitle>
            <CardDescription>Cliquez sur une colonne pour trier.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sortedRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune livraison Chataigne sur le périmètre sélectionné.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Restaurant" k="restaurant_name" {...{ sortKey, sortAsc, toggleSort }} />
                      <SortableHead label="Version" k="version" {...{ sortKey, sortAsc, toggleSort }} />
                      <SortableHead
                        label="Prix Naan (grille)"
                        k="naan_tenders_price"
                        align="right"
                        tooltip="Prix du Naan Tenders à l'unité selon la version de prix du restaurant. Référence pour vérifier le coût du BOGO."
                        {...{ sortKey, sortAsc, toggleSort }}
                      />
                      <SortableHead
                        label="Livraisons"
                        k="nb_livraisons"
                        align="right"
                        tooltip="Nombre de commandes livrées (canal Chataigne) sur la période et le périmètre sélectionnés."
                        {...{ sortKey, sortAsc, toggleSort }}
                      />
                      <SortableHead
                        label="Markup"
                        k="markup_total"
                        align="right"
                        tooltip="Surprix produits appliqué en livraison vs le prix sur place. Pour chaque produit livré : (prix livraison − prix sur place) × quantité, cumulé sur la période."
                        {...{ sortKey, sortAsc, toggleSort }}
                      />
                      <SortableHead
                        label="Frais livr."
                        k="frais_livraison"
                        align="right"
                        tooltip="Frais de livraison payés par le client et encaissés par le restaurant."
                        {...{ sortKey, sortAsc, toggleSort }}
                      />
                      <SortableHead
                        label="Coût Uber"
                        k="coutUber"
                        align="right"
                        tooltip="Coût du livreur payé à Uber = prix par course (curseur, 3,60 € par défaut) × nombre de livraisons."
                        {...{ sortKey, sortAsc, toggleSort }}
                      />
                      <SortableHead
                        label="Coût BOGO"
                        k="coutBogo"
                        align="right"
                        tooltip="Coût réel des naans offerts. En € : coût matière fixe × nombre de BOGO. En % : pourcentage × valeur faciale des naans offerts."
                        {...{ sortKey, sortAsc, toggleSort }}
                      />
                      <SortableHead
                        label="Gain net"
                        k="gain"
                        align="right"
                        tooltip="Ce qui reste en poche = Markup + Frais de livraison − Coût Uber − Coût BOGO."
                        {...{ sortKey, sortAsc, toggleSort }}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((r) => (
                      <TableRow key={r.restaurant_id}>
                        <TableCell className="font-medium">{r.restaurant_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.version}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.naan_tenders_price === null ? "—" : fmtEur(r.naan_tenders_price, 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(r.nb_livraisons)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtEur(r.markup_total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtEur(r.frais_livraison)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          −{fmtEur(r.coutUber)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          −{fmtEur(r.coutBogo)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            r.gain >= 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {fmtEur(r.gain)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-semibold tabular-nums">
                        {fmtInt(totals.nb)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {fmtEur(totals.markup)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {fmtEur(totals.fees)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        −{fmtEur(totals.uber)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        −{fmtEur(totals.bogo)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-base font-bold tabular-nums",
                          positive ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {fmtEur(totals.gain)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

/* ----------------------------- sub components ---------------------------- */

function ChainOperator({ symbol }: { symbol: string }) {
  return (
    <div className="hidden items-center justify-center text-xl font-semibold text-muted-foreground md:flex">
      {symbol}
    </div>
  );
}

function ChainStep({
  label,
  value,
  sign,
  tone,
  className,
}: {
  label: string;
  value: number;
  sign: "+" | "−";
  tone: "emerald" | "sky" | "red" | "fuchsia";
  className?: string;
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-600",
    red: "border-red-500/30 bg-red-500/10 text-red-600",
    fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-600",
  };
  return (
    <div className={cn("rounded-xl border p-4", tones[tone], className)}>
      <p className="text-xs font-medium opacity-80">
        {sign} {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{fmtEur(value)}</p>
    </div>
  );
}

function SortableHead({
  label,
  k,
  align = "left",
  tooltip,
  sortKey,
  sortAsc,
  toggleSort,
}: {
  label: string;
  k: SortKey;
  align?: "left" | "right";
  tooltip?: string;
  sortKey: SortKey;
  sortAsc: boolean;
  toggleSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead
      className={cn("cursor-pointer select-none", align === "right" && "text-right")}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} label={`${label} : informations`} />}
        {active &&
          (sortAsc ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          ))}
      </span>
    </TableHead>
  );
}
