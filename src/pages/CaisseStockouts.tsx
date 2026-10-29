import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Search, PackageX, Clock, Store, Radio, ChevronRight, CheckCircle2, X, Check, ChevronsUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { cn } from "@/lib/utils";
import { filterStockoutProduct, rankStockoutRestaurants, selectStockoutHistory } from "@/lib/stockoutHistory";
import { StockoutReportDialog } from "@/components/caisse/StockoutReportDialog";

interface Stockout {
  restaurant_id: string;
  restaurant_name: string;
  item_id: string;
  product_name: string;
  category: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  is_ongoing: boolean;
}

const fmtDur = (m: number) => {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${String(Math.round(m % 60)).padStart(2, "0")}`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
};
const fmtDt = (s: string) => format(new Date(s), "dd MMM HH:mm", { locale: fr });
const hourOf = (s: string) => new Date(s).getHours();
const isRush = (s: string) => { const h = hourOf(s); return (h >= 11 && h < 14) || (h >= 18 && h < 22); };
// Splash envoie aussi la fiche ingrédient interne (ing…) avec le produit (prd…) : on n'affiche que le produit.
const isTechnical = (r: Stockout) => r.item_id.startsWith("ing");

export default function CaisseStockouts() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } = useAnalyticsContext();
  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const [liveMode, setLiveMode] = useState(true);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const start = liveMode ? format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd") : format(startDate, "yyyy-MM-dd");
  const periodEnd = format(endDate, "yyyy-MM-dd");
  const yesterdayStr = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
  const end = liveMode || periodEnd >= yesterdayStr ? todayStr : periodEnd;
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [onlyOngoing, setOnlyOngoing] = useState(false);
  const [openResto, setOpenResto] = useState<string | null>(null);
  const [historyResto, setHistoryResto] = useState<string | null>(null);

  const { data: restaurants } = useQuery({
    queryKey: ["stockouts-restaurants", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async () => {
      if (!selectedChainId) return [];
      const { data, error } = await supabase.from("restaurants").select("id").eq("chain_id", selectedChainId);
      if (error) throw error;
      return (data ?? []).map((r) => r.id as string);
    },
  });
  const ids = useMemo(() => {
    if (!restaurants) return undefined;
    return resolveBrandScopedRestaurantIds({ selectedRestaurantIds: selectedRestaurants, selectedChainId, chainRestaurantIds: restaurants }) ?? restaurants;
  }, [restaurants, selectedRestaurants, selectedChainId]);

  const q = useQuery({
    queryKey: ["splash-stockouts", start, end, ids],
    enabled: !!ids && ids.length > 0,
    retry: false,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_splash_stockouts", { p_restaurant_ids: ids, p_start: start, p_end: end });
      if (error) throw error;
      return ((data ?? []) as Stockout[]).filter((r) => !isTechnical(r));
    },
  });

  const scoped = useMemo(
    () => (q.data ?? []).filter((r) => !liveMode || r.is_ongoing || format(new Date(r.started_at), "yyyy-MM-dd") === todayStr),
    [q.data, liveMode, todayStr],
  );

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return filterStockoutProduct(scoped, product).filter((r) =>
      (!onlyOngoing || r.is_ongoing) &&
      (!s || r.product_name.toLowerCase().includes(s) || r.restaurant_name.toLowerCase().includes(s)));
  }, [scoped, search, onlyOngoing, product]);

  const availableProducts = useMemo(() => [...new Set((q.data ?? []).map(r => r.product_name))].sort((a, b) => a.localeCompare(b, "fr")), [q.data]);
  const chooseProduct = (name: string | null) => {
    setProduct(name);
    setProductPickerOpen(false);
  };

  const activeResto = !liveMode && scoped.some(r => r.restaurant_id === historyResto) ? historyResto : null;
  const detailRows = useMemo(() => selectStockoutHistory(rows, activeResto, "all", "recent"), [rows, activeResto]);
  const selectedRestoName = scoped.find(r => r.restaurant_id === activeResto)?.restaurant_name;
  const selectRestaurant = (id: string) => {
    if (liveMode) setOpenResto(id);
    else setHistoryResto(id);
  };

  const kpis = useMemo(() => ({
    total: detailRows.length,
    ongoing: detailRows.filter((r) => r.is_ongoing).length,
    restos: new Set(detailRows.map((r) => r.restaurant_id)).size,
    avg: detailRows.length ? detailRows.reduce((a, r) => a + Number(r.duration_minutes), 0) / detailRows.length : 0,
  }), [detailRows]);

  const byResto = useMemo(() => rankStockoutRestaurants(rows, "products"), [rows]);
  const rankValue = (r: typeof byResto[number]) => r.productCount;
  const maxRank = Math.max(1, ...byResto.map(rankValue));

  const detail = useMemo(() => {
    if (!openResto) return null;
    const list = filterStockoutProduct(q.data ?? [], product).filter((r) => r.restaurant_id === openResto);
    const hours = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, n: 0 }));
    list.forEach((r) => { hours[hourOf(r.started_at)].n += 1; });
    const min = list.reduce((a, r) => a + Number(r.duration_minutes), 0);
    const days = Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / 86400000 + 1);
    const openMinutes = days * 14 * 60; // ~14 h d'ouverture par jour
    const products = new Map<string, { n: number; min: number }>();
    list.forEach((r) => { const p = products.get(r.product_name) ?? { n: 0, min: 0 }; p.n++; p.min += Number(r.duration_minutes); products.set(r.product_name, p); });
    return {
      name: list[0]?.restaurant_name ?? "", list, hours, min,
      rushShare: list.length ? Math.round((list.filter((r) => isRush(r.started_at)).length / list.length) * 100) : 0,
      availability: Math.max(0, 100 - (min / Math.max(1, products.size) / openMinutes) * 100),
      products: [...products.entries()].sort((a, b) => b[1].min - a[1].min),
    };
  }, [openResto, q.data, start, end, product]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(detailRows.map((r) => ({
      Restaurant: r.restaurant_name, Produit: r.product_name, Catégorie: r.category ?? "", "Réf. Splash": r.item_id,
      Début: format(new Date(r.started_at), "dd/MM/yyyy HH:mm"),
      Fin: r.ended_at ? format(new Date(r.ended_at), "dd/MM/yyyy HH:mm") : "En cours",
      "Durée (min)": Math.round(Number(r.duration_minutes)),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ruptures");
    XLSX.writeFile(wb, `ruptures_${start}_${end}.xlsx`);
  };

  const Kpi = ({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: string; tone: string }) => (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-xl p-2.5", tone)}><Icon className="h-5 w-5" /></div>
        <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold tabular-nums">{value}</div></div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Ruptures & Disponibilité</h1>
              <p className="text-sm text-muted-foreground">Produits passés hors stock en caisse, remontés en direct par Splash.</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              <Button variant={liveMode ? "default" : "ghost"} size="sm" onClick={() => setLiveMode(true)}>
                <span className="relative mr-2 flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" /></span>
                État actuel
              </Button>
              <Button variant={!liveMode ? "default" : "ghost"} size="sm" onClick={() => setLiveMode(false)}>Historique</Button>
            </div>
          </div>
          {!liveMode && <AnalyticsHeader />}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={PackageX} tone="bg-primary/10 text-primary" label={liveMode ? "Ruptures aujourd'hui" : "Ruptures sur la période"} value={String(kpis.total)} />
            <Kpi icon={Radio} tone="bg-destructive/10 text-destructive" label="En cours" value={String(kpis.ongoing)} />
            <Kpi icon={Store} tone="bg-accent/15 text-accent" label="Restaurants concernés" value={String(kpis.restos)} />
            <Kpi icon={Clock} tone="bg-secondary text-secondary-foreground" label="Durée moyenne" value={kpis.total ? fmtDur(kpis.avg) : "—"} />
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={productPickerOpen} aria-label="Choisir un produit" className="w-full justify-between sm:w-[280px]">
                      <span className="min-w-0 truncate">{product ?? "Tous les produits"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] p-0">
                    <Command>
                      <CommandInput placeholder="Rechercher un produit…" />
                      <CommandList>
                        <CommandEmpty>Aucun produit trouvé sur cette période.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="Tous les produits" onSelect={() => chooseProduct(null)}><Check className={cn("mr-2 h-4 w-4", product ? "opacity-0" : "opacity-100")} />Tous les produits</CommandItem>
                          {availableProducts.map(name => <CommandItem key={name} value={name} onSelect={() => chooseProduct(name)}><Check className={cn("mr-2 h-4 w-4 shrink-0", product === name ? "opacity-100" : "opacity-0")} /><span className="break-words">{name}</span></CommandItem>)}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {product && <Button variant="ghost" size="icon" aria-label="Effacer le filtre produit" title="Tous les produits" onClick={() => chooseProduct(null)}><X className="h-4 w-4" /></Button>}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit ou un restaurant…" className="pl-9" />
                </div>
                <Button variant={onlyOngoing ? "destructive" : "outline"} size="sm" onClick={() => setOnlyOngoing((v) => !v)}>En cours uniquement</Button>
                <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!detailRows.length}><Download className="mr-1.5 h-4 w-4" />Excel</Button>
                <StockoutReportDialog chainId={selectedChainId} />
              </div>
            </CardContent>
          </Card>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card className="min-w-0">
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Par restaurant</CardTitle>
                  {activeResto && <Button size="sm" variant="ghost" onClick={() => setHistoryResto(null)}>Tous <X className="ml-1 h-3.5 w-3.5" /></Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {byResto.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun restaurant concerné.</p>}
                {byResto.map((r) => (
                  <Button variant="ghost" key={r.id} onClick={() => selectRestaurant(r.id)} aria-pressed={activeResto === r.id} className={cn("group block h-auto w-full rounded-lg p-2 text-left whitespace-normal", activeResto === r.id && "bg-primary/10 ring-1 ring-primary/30")}>
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words font-medium">{r.name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {r.ongoing > 0 && <Badge variant="destructive" className="h-5 px-1.5">{r.ongoing} en cours</Badge>}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-normal text-muted-foreground">{r.productCount} produit{r.productCount > 1 ? "s" : ""} · {r.n} rupture{r.n > 1 ? "s" : ""} · {fmtDur(r.min)} cumulées</div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(rankValue(r) / maxRank) * 100}%` }} />
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="space-y-3 pb-2">
                <div><CardTitle className="break-words text-base">{selectedRestoName ?? product ?? "Détail rupture par rupture"}</CardTitle><CardDescription>{detailRows.length} rupture{detailRows.length > 1 ? "s" : ""} · {selectedRestoName ? "Restaurant sélectionné" : "Tous les restaurants du périmètre"}{selectedRestoName && product ? ` · ${product}` : ""}</CardDescription></div>
              </CardHeader>
              <CardContent>
                {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.error ? (
                  <p className="py-8 text-center text-sm text-destructive">Impossible de charger les ruptures.</p>
                ) : detailRows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-accent" />Aucune rupture remontée par la caisse pour ce périmètre.
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Produit</TableHead><TableHead>Restaurant</TableHead><TableHead>Période</TableHead><TableHead className="text-right">Durée</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailRows.map((r) => (
                        <TableRow key={`${r.restaurant_id}-${r.item_id}-${r.started_at}`} className={liveMode ? "cursor-pointer" : ""} onClick={() => liveMode && setOpenResto(r.restaurant_id)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 shrink-0 rounded-full", r.is_ongoing ? "bg-destructive" : "bg-accent")} />
                              <span className="font-medium">{r.product_name}</span>
                            </div>
                            {r.category && <div className="ml-4 text-xs text-muted-foreground">{r.category}</div>}
                          </TableCell>
                          <TableCell><Button variant="link" className="h-auto p-0 text-left whitespace-normal" onClick={() => selectRestaurant(r.restaurant_id)}>{r.restaurant_name}</Button></TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {fmtDt(r.started_at)} → {r.ended_at ? fmtDt(r.ended_at) : <Badge variant="destructive" className="ml-1">En cours</Badge>}
                            <div><Badge variant="outline" className={cn("mt-1 text-[10px]", isRush(r.started_at) && "border-destructive/40 text-destructive")}>{isRush(r.started_at) ? "Plein rush" : "Hors rush"}</Badge></div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right"><span className={cn("rounded-md px-2 py-0.5 text-sm font-medium tabular-nums", Number(r.duration_minutes) > 120 ? "bg-destructive/10 text-destructive" : "bg-muted")}>{fmtDur(Number(r.duration_minutes))}</span></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Sheet open={!!openResto} onOpenChange={(o) => !o && setOpenResto(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            {detail && (
              <>
                <SheetHeader>
                  <SheetTitle>{detail.name}</SheetTitle>
                  <SheetDescription>Ruptures du {format(new Date(start), "dd MMM", { locale: fr })} au {format(new Date(end), "dd MMM", { locale: fr })}</SheetDescription>
                </SheetHeader>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-primary/10 p-3"><div className="text-xs text-muted-foreground">Ruptures</div><div className="text-xl font-semibold text-primary">{detail.list.length}</div></div>
                  <div className="rounded-xl bg-destructive/10 p-3"><div className="text-xs text-muted-foreground">Temps cumulé</div><div className="text-xl font-semibold text-destructive">{fmtDur(detail.min)}</div></div>
                  <div className="rounded-xl bg-accent/15 p-3"><div className="text-xs text-muted-foreground">En plein rush</div><div className="text-xl font-semibold text-accent">{detail.rushShare} %</div></div>
                </div>
                <div className="mt-3 rounded-xl border p-3">
                  <div className="flex justify-between text-sm"><span>Taux de disponibilité estimé</span><span className="font-semibold tabular-nums">{detail.availability.toFixed(1)} %</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-destructive/20"><div className="h-full bg-accent" style={{ width: `${detail.availability}%` }} /></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Sur ~14 h d'ouverture par jour, pour les produits concernés.</p>
                </div>
                <div className="mt-6">
                  <div className="mb-2 text-sm font-medium">Heure de déclenchement</div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={detail.hours.slice(8)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis dataKey="h" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                        <Tooltip formatter={(v: number) => [`${v} rupture(s)`, ""]} />
                        <Bar dataKey="n" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <div className="text-sm font-medium">Produits</div>
                  {detail.products.map(([name, p]) => (
                    <div key={name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <span>{name}</span><span className="tabular-nums text-muted-foreground">× {p.n} · {fmtDur(p.min)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-2">
                  <div className="text-sm font-medium">Chronologie</div>
                  {detail.list.map((r) => (
                    <div key={`${r.item_id}-${r.started_at}`} className="flex items-center gap-3 border-l-2 border-primary/40 pl-3 text-sm">
                      <span className="w-28 tabular-nums text-muted-foreground">{fmtDt(r.started_at)}</span>
                      <span className="flex-1">{r.product_name}</span>
                      {r.is_ongoing ? <Badge variant="destructive">En cours</Badge> : <span className="tabular-nums">{fmtDur(Number(r.duration_minutes))}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </ChannelNavShell>
    </AppLayout>
  );
}
