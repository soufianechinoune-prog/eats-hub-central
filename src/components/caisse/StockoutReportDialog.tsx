import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, endOfQuarter, format, startOfMonth, startOfQuarter } from "date-fns";
import { FileText, Download, Loader2, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { supabase } from "@/integrations/supabase/client";
import { buildStockoutReport, reportDate, reportHours, stockoutReportDefaults, stockoutRestaurantSections, stockoutReportMethod, type ReportStockout } from "@/lib/stockoutReport";
import { exportStockoutExcel, exportStockoutPdf } from "@/lib/stockoutReportExport";

interface Props { chainId: string | null }
export function StockoutReportDialog({ chainId }: Props) {
  const [open, setOpen] = useState(false);
  const defaults = stockoutReportDefaults();
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [mode, setMode] = useState(defaults.mode);
  const [restaurant, setRestaurant] = useState(defaults.restaurant);
  const [product, setProduct] = useState(defaults.product);
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const { data: activeRestaurants = [] } = useActiveRestaurants();
  const scope = activeRestaurants;
  const ids = useMemo(() => scope.map(r => r.id), [scope]);
  const today = format(new Date(), "yyyy-MM-dd");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end && start <= today && (Date.parse(end) - Date.parse(start)) / 86400000 <= 366;
  const ready = !!chainId && chainId !== "00000000-0000-0000-0000-000000000000" && ids.length > 0 && valid;
  const q = useQuery({
    queryKey: ["stockout-report", chainId, ids, start, end], enabled: open && ready, retry: false, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_splash_stockouts", { p_restaurant_ids: ids, p_start: start, p_end: end });
      if (error) throw error;
      return (data ?? []) as ReportStockout[];
    },
  });
  const products = useMemo(() => [...new Set((q.data ?? []).filter(r => !r.item_id.startsWith("ing")).map(r => r.product_name))].sort((a, b) => a.localeCompare(b, "fr")), [q.data]);
  const selectedRestaurant = scope.some(r => r.id === restaurant) ? restaurant : "all";
  const selectedProduct = product === "all" || products.includes(product) ? product : "all";
  const report = useMemo(() => valid ? buildStockoutReport(q.data ?? [], scope, start, end, selectedRestaurant === "all" ? null : selectedRestaurant, selectedProduct === "all" ? null : selectedProduct) : null, [q.data, scope, start, end, selectedRestaurant, selectedProduct, valid]);
  const setPeriod = (value: string, date = start) => {
    setMode(value);
    if (value === "custom") return;
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const a = value === "month" ? startOfMonth(d) : startOfQuarter(d);
    const b = value === "month" ? endOfMonth(d) : endOfQuarter(d);
    setStart(format(a, "yyyy-MM-dd")); setEnd(format(b, "yyyy-MM-dd") > today ? today : format(b, "yyyy-MM-dd"));
  };
  const download = async (type: "pdf" | "excel") => {
    if (!report || !chainId || !report.rows.length || !ready || q.isFetching || q.isError) return;
    setBusy(type);
    try { await (type === "pdf" ? exportStockoutPdf : exportStockoutExcel)(report, chainId); toast.success(type === "pdf" ? "Rapport PDF téléchargé" : "Classeur Excel téléchargé"); }
    catch { toast.error("Le téléchargement a échoué. Réessayez."); }
    finally { setBusy(null); }
  };
  const onOpen = (value: boolean) => {
    setOpen(value);
    if (value) { const next = stockoutReportDefaults(); setStart(next.start); setEnd(next.end); setMode(next.mode); setRestaurant(next.restaurant); setProduct(next.product); }
  };
  const sections = report ? stockoutRestaurantSections(report) : [];
  return <Dialog open={open} onOpenChange={onOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><FileText className="mr-1.5 h-4 w-4" />Bilan & Rapport</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-24px)] max-w-4xl overflow-y-auto">
      <DialogHeader><DialogTitle>Bilan des ruptures</DialogTitle><DialogDescription>Synthèse produits réseau · Fiches par restaurant · PDF et Excel</DialogDescription></DialogHeader>
      <div className="grid gap-3 border-b pb-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label>Période</Label><Select value={mode} onValueChange={setPeriod}><SelectTrigger aria-label="Type de période du rapport"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">Mois civil</SelectItem><SelectItem value="quarter">Trimestre</SelectItem><SelectItem value="custom">Dates au choix</SelectItem></SelectContent></Select></div>
        {mode === "custom" ? <div className="space-y-1.5"><Label htmlFor="report-start">Du</Label><Input id="report-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div> : <div className="space-y-1.5"><Label htmlFor="report-month">{mode === "month" ? "Mois" : "Mois du trimestre"}</Label><Input id="report-month" type="month" value={start.slice(0, 7)} onChange={e => setPeriod(mode, `${e.target.value}-01`)} /></div>}
        {mode === "custom" ? <div className="space-y-1.5"><Label htmlFor="report-end">Au</Label><Input id="report-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div> : <div className="flex items-end pb-2 text-sm text-muted-foreground">{start} → {end}</div>}
        <div className="space-y-1.5"><Label>Restaurant</Label><Select value={selectedRestaurant} onValueChange={setRestaurant}><SelectTrigger aria-label="Restaurant du rapport"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Ensemble du réseau</SelectItem>{scope.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Produit</Label><Select value={selectedProduct} onValueChange={setProduct}><SelectTrigger aria-label="Produit du rapport"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les produits</SelectItem>{products.map(p => <SelectItem value={p} key={p}>{p}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="flex items-start gap-2 border-l-2 border-warning bg-warning/10 p-3 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>Couverture Splash encore partielle. Aucun événement ne prouve pas l’absence de rupture. Les désactivations avant lancement peuvent être volontaires. Les heures cumulées concernent les produits, pas la fermeture du restaurant.</span></div>
      {!valid ? <p className="text-sm text-destructive">Choisissez une période valide, d’un an maximum, commençant au plus tard aujourd’hui.</p> : !ready ? <p className="text-sm text-muted-foreground">Aucun restaurant actif dans ce périmètre.</p> : q.isPending || q.isFetching ? <Skeleton className="h-60 w-full" /> : q.isError ? <div className="space-y-2 text-sm text-destructive">Impossible de charger les ruptures.<Button variant="outline" size="sm" onClick={() => q.refetch()}>Réessayer</Button></div> : report && <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[["Ruptures enregistrées", report.total.events], ["Produits concernés", report.total.products], ["Heures-produit", reportHours(report.total.minutes)], ["Restos avec événements", `${report.observedCount} / ${report.scopeCount}`]].map(([label, value]) => <div key={label} className="border-l-2 border-primary/40 pl-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value}</div></div>)}
        </div>
        {!report.rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">Aucune rupture enregistrée sur cette période et pour cette sélection.</p> : <>
          <section className="space-y-3 border-b py-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-semibold">01 · Synthèse par produit{report.restaurantId ? " · Restaurant sélectionné" : " · Réseau"}</h3><span className="text-xs text-muted-foreground">{report.products.length} produits</span></div><Table><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-right">Ruptures</TableHead><TableHead className="text-right">Restaurants</TableHead><TableHead className="text-right">Durée cumulée</TableHead></TableRow></TableHeader><TableBody>{report.products.map(p => <TableRow key={p.name}><TableCell className="min-w-40 font-medium">{p.name}</TableCell><TableCell className="text-right tabular-nums">{p.events}</TableCell><TableCell className="text-right tabular-nums">{p.restaurants}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{reportHours(p.minutes)}</TableCell></TableRow>)}</TableBody></Table></section>
          <section className="space-y-3 border-b py-3"><h3 className="text-sm font-semibold">Heures-produit dans le temps</h3><div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.days}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="date" tickFormatter={d => `${d.slice(8)}/${d.slice(5, 7)}`} tick={{ fontSize: 10 }} minTickGap={28} /><YAxis tickFormatter={m => `${Math.round(m / 60)} h`} tick={{ fontSize: 10 }} width={48} /><Tooltip labelFormatter={d => String(d)} formatter={(value: number) => [reportHours(value), "Heures-produit"]} contentStyle={{ background: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--popover-foreground))" }} /><Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></section>
          <section className="space-y-4"><h3 className="text-base font-semibold">02 · Fiches restaurant <span className="text-sm font-normal text-muted-foreground">({sections.length})</span></h3>{sections.map(r => <details key={r.id} className="border-b pb-3"><summary className="cursor-pointer text-sm font-semibold">{r.name}<span className="mt-1 block text-xs font-normal text-muted-foreground">{r.products} produits · {r.events} ruptures · {reportHours(r.minutes)}</span></summary><Table className="mt-3"><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>Début de rupture</TableHead><TableHead>Remise en stock</TableHead><TableHead className="text-right">Durée sur période</TableHead></TableRow></TableHeader><TableBody>{r.rows.map((row, i) => <TableRow key={`${row.item_id}-${row.started_at}-${i}`}><TableCell className="min-w-40 font-medium">{row.product_name}</TableCell><TableCell className="whitespace-nowrap text-xs">{reportDate(row.started_at)}</TableCell><TableCell className="whitespace-nowrap text-xs">{row.ended_at && Date.parse(row.ended_at) <= report.generatedAt ? reportDate(row.ended_at) : "En cours"}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{reportHours(row.minutes)}</TableCell></TableRow>)}</TableBody></Table></details>)}</section>
          <section className="border-t pt-3"><h3 className="text-sm font-semibold">Remise en stock · ruptures résolues</h3><p className="mt-1 text-xs text-muted-foreground">{report.resolvedCount} résolues · Durée complète moyenne : {report.resolvedAverage === null ? "—" : reportHours(report.resolvedAverage)} · Moins de 3 h : {report.quick} · Plus de 24 h : {report.prolonged}</p></section>
        </>}
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Périmètre & méthode de calcul</summary><ul className="mt-2 space-y-2">{stockoutReportMethod.map(line => <li key={line}>{line}</li>)}</ul></details>
      </>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3"><Button variant="outline" disabled={!!busy || !ready || q.isFetching || q.isError || !report?.rows.length} onClick={() => download("excel")}>{busy === "excel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Excel détaillé</Button><Button disabled={!!busy || !ready || q.isFetching || q.isError || !report?.rows.length} onClick={() => download("pdf")}>{busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}PDF réseau & restaurants</Button></div>
    </DialogContent>
  </Dialog>;
}