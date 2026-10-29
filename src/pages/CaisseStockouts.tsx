import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Search, PackageX, Clock, Store, Radio, CheckCircle2, X, Check, ChevronsUpDown } from "lucide-react";
import * as XLSX from "xlsx";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { cn } from "@/lib/utils";
import { filterStockoutProduct } from "@/lib/stockoutHistory";

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
    return filterStockoutProduct(scoped, product)
      .filter((r) =>
        (!onlyOngoing || r.is_ongoing) &&
        (!s || r.product_name.toLowerCase().includes(s) || r.restaurant_name.toLowerCase().includes(s)))
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
  }, [scoped, search, onlyOngoing, product]);

  const availableProducts = useMemo(() => [...new Set((q.data ?? []).map(r => r.product_name))].sort((a, b) => a.localeCompare(b, "fr")), [q.data]);
  const chooseProduct = (name: string | null) => {
    setProduct(name);
    setProductPickerOpen(false);
  };

  const kpis = useMemo(() => ({
    total: rows.length,
    ongoing: rows.filter((r) => r.is_ongoing).length,
    restos: new Set(rows.map((r) => r.restaurant_id)).size,
    avg: rows.length ? rows.reduce((a, r) => a + Number(r.duration_minutes), 0) / rows.length : 0,
  }), [rows]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
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
            <CardContent className="p-4">
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
                <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!rows.length}><Download className="mr-1.5 h-4 w-4" />Excel</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {q.isLoading ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> : q.error ? (
                <p className="py-8 text-center text-sm text-destructive">Impossible de charger les ruptures.</p>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-accent" />Aucune rupture remontée par la caisse pour ce périmètre.
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Produit</TableHead><TableHead>Restaurant</TableHead><TableHead>Période</TableHead><TableHead className="text-right">Durée</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`${r.restaurant_id}-${r.item_id}-${r.started_at}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", r.is_ongoing ? "bg-destructive" : "bg-accent")} />
                            <span className="font-medium">{r.product_name}</span>
                          </div>
                          {r.category && <div className="ml-4 text-xs text-muted-foreground">{r.category}</div>}
                        </TableCell>
                        <TableCell>{r.restaurant_name}</TableCell>
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
      </ChannelNavShell>
    </AppLayout>
  );
}
