import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Search, PackageX, Clock, Store, Radio } from "lucide-react";
import * as XLSX from "xlsx";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";

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

export default function CaisseStockouts() {
  const { selectedRestaurants, selectedChainId, selectedYear, selectedMonth, periodMode, dateRange } = useAnalyticsContext();
  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");
  const [search, setSearch] = useState("");
  const [onlyOngoing, setOnlyOngoing] = useState(false);

  const { data: restaurants } = useQuery({
    queryKey: ["stockouts-restaurants", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("id").eq("chain_id", selectedChainId!);
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
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_splash_stockouts", { p_restaurant_ids: ids, p_start: start, p_end: end });
      if (error) throw error;
      return (data ?? []) as Stockout[];
    },
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) =>
      (!onlyOngoing || r.is_ongoing) &&
      (!s || r.product_name.toLowerCase().includes(s) || r.restaurant_name.toLowerCase().includes(s)));
  }, [q.data, search, onlyOngoing]);

  const kpis = useMemo(() => {
    const all = q.data ?? [];
    return {
      total: all.length,
      ongoing: all.filter((r) => r.is_ongoing).length,
      restos: new Set(all.map((r) => r.restaurant_id)).size,
      avg: all.length ? all.reduce((a, r) => a + Number(r.duration_minutes), 0) / all.length : 0,
    };
  }, [q.data]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { name: string; n: number; min: number }>();
    (q.data ?? []).forEach((r) => {
      const x = m.get(r.product_name) ?? { name: r.product_name, n: 0, min: 0 };
      x.n += 1; x.min += Number(r.duration_minutes);
      m.set(r.product_name, x);
    });
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }, [q.data]);

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

  const Kpi = ({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) => (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className="rounded-lg bg-muted p-2"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold tabular-nums">{value}</div></div>
    </CardContent></Card>
  );

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ruptures & Disponibilité</h1>
            <p className="text-sm text-muted-foreground">Produits passés hors stock en caisse, remontés en direct par Splash. Historique à partir de l'activation du flux.</p>
          </div>
          <AnalyticsHeader />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={PackageX} label="Ruptures sur la période" value={String(kpis.total)} />
            <Kpi icon={Radio} label="En cours" value={String(kpis.ongoing)} />
            <Kpi icon={Store} label="Restaurants concernés" value={String(kpis.restos)} />
            <Kpi icon={Clock} label="Durée moyenne" value={kpis.total ? fmtDur(kpis.avg) : "—"} />
          </div>

          {topProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Produits les plus souvent en rupture</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {topProducts.map((p) => (
                  <Badge key={p.name} variant="secondary" className="gap-1.5 py-1">
                    {p.name}<span className="text-muted-foreground">× {p.n} · {fmtDur(p.min)}</span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Détail rupture par rupture</CardTitle>
                <CardDescription>{rows.length} rupture{rows.length > 1 ? "s" : ""}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produit ou restaurant" className="w-56 pl-8" />
                </div>
                <Button variant={onlyOngoing ? "default" : "outline"} size="sm" onClick={() => setOnlyOngoing((v) => !v)}>En cours uniquement</Button>
                <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!rows.length}><Download className="mr-1.5 h-4 w-4" />Exporter Excel</Button>
              </div>
            </CardHeader>
            <CardContent>
              {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.error ? (
                <p className="py-8 text-center text-sm text-destructive">Impossible de charger les ruptures.</p>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Aucune rupture remontée par la caisse sur cette période pour ce périmètre.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Restaurant</TableHead><TableHead>Produit</TableHead><TableHead>Début</TableHead>
                    <TableHead>Retour en stock</TableHead><TableHead className="text-right">Durée</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`${r.restaurant_id}-${r.item_id}-${r.started_at}`}>
                        <TableCell className="font-medium">{r.restaurant_name}</TableCell>
                        <TableCell>{r.product_name}{r.category && <span className="ml-2 text-xs text-muted-foreground">{r.category}</span>}</TableCell>
                        <TableCell className="tabular-nums">{fmtDt(r.started_at)}</TableCell>
                        <TableCell>{r.ended_at ? <span className="tabular-nums">{fmtDt(r.ended_at)}</span> : <Badge variant="destructive">En cours</Badge>}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtDur(Number(r.duration_minutes))}</TableCell>
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
