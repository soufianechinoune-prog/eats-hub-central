import { useState } from "react";
import { Upload, Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Summary {
  totalRows: number;
  skipped: number;
  matched: number;
  unmatchedRows: number;
  dateRange: { start: string | null; end: string | null };
  restaurants: Array<{ id: string; name: string; count: number; subtotal: number }>;
  unmatchedNames: Array<{ name: string; count: number; subtotal: number }>;
  revenue: number;
  netOfCommission: number;
  inserted?: number;
  errors?: string[];
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export default function DeliverooOrdersImportTab() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [imported, setImported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);


  const reset = () => { setFile(null); setCsv(""); setSummary(null); setImported(false); setProgress(null); };

  const CHUNK_ROWS = 3000;

  const runChunks = async (content: string, fileName: string, dryRun: boolean): Promise<Summary> => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0];
    const body = lines.slice(1);
    const chunks: string[] = [];
    for (let i = 0; i < body.length; i += CHUNK_ROWS) {
      chunks.push([header, ...body.slice(i, i + CHUNK_ROWS)].join("\n"));
    }

    const agg: Summary = {
      totalRows: 0, skipped: 0, matched: 0, unmatchedRows: 0,
      dateRange: { start: null, end: null },
      restaurants: [], unmatchedNames: [], revenue: 0, netOfCommission: 0, inserted: 0, errors: [],
    };
    const restMap = new Map<string, { id: string; name: string; count: number; subtotal: number }>();
    const unmatchedMap = new Map<string, { name: string; count: number; subtotal: number }>();

    for (let i = 0; i < chunks.length; i++) {
      setProgress({ current: i + 1, total: chunks.length });
      const { data, error } = await supabase.functions.invoke("ingest-deliveroo-orders", {
        body: { csvContent: chunks[i], fileName, dryRun },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const d = data as Summary;
      agg.totalRows += d.totalRows;
      agg.skipped += d.skipped;
      agg.matched += d.matched;
      agg.unmatchedRows += d.unmatchedRows;
      agg.revenue += d.revenue;
      agg.netOfCommission += d.netOfCommission;
      agg.inserted = (agg.inserted || 0) + (d.inserted || 0);
      if (d.errors?.length) agg.errors = [...(agg.errors || []), ...d.errors];
      if (d.dateRange.start && (!agg.dateRange.start || d.dateRange.start < agg.dateRange.start)) agg.dateRange.start = d.dateRange.start;
      if (d.dateRange.end && (!agg.dateRange.end || d.dateRange.end > agg.dateRange.end)) agg.dateRange.end = d.dateRange.end;
      for (const r of d.restaurants) {
        const e = restMap.get(r.id);
        if (e) { e.count += r.count; e.subtotal += r.subtotal; } else restMap.set(r.id, { ...r });
      }
      for (const u of d.unmatchedNames) {
        const e = unmatchedMap.get(u.name);
        if (e) { e.count += u.count; e.subtotal += u.subtotal; } else unmatchedMap.set(u.name, { ...u });
      }
    }

    agg.restaurants = Array.from(restMap.values()).sort((a, b) => b.subtotal - a.subtotal);
    agg.unmatchedNames = Array.from(unmatchedMap.values()).sort((a, b) => b.subtotal - a.subtotal);
    setProgress(null);
    return agg;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    setImported(false);
    try {
      const content = new TextDecoder("utf-8").decode(await f.arrayBuffer());
      const agg = await runChunks(content, f.name, true);
      setFile(f); setCsv(content); setSummary(agg);
    } catch (err: any) {
      toast({ title: "Erreur de lecture", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!csv) return;
    setLoading(true);
    try {
      const agg = await runChunks(csv, file?.name || "", false);
      setSummary(agg);
      setImported(true);
      toast({ title: "Import terminé", description: `${agg.inserted} commandes enregistrées` });
    } catch (err: any) {
      toast({ title: "Erreur d'import", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Rapport « Commandes » Deliveroo (niveau commande)</AlertTitle>
        <AlertDescription className="text-sm">
          Colonnes attendues : <code>deliveroo_name, order_number, status, sent_at, delivered_at, subtotal, commission, commission_vat, net</code>.
          Le <strong>Sous-total</strong> alimente le CA Deliveroo (avant promos, comme le CA Uber affiché).
          Le <strong>net</strong> est un « net de commission », <strong>pas</strong> le versement final (celui-ci vient des relevés).
          Les heures du CSV sont interprétées en heure de Paris.
        </AlertDescription>
      </Alert>

      {!summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Fichier CSV</CardTitle>
            <CardDescription>Import idempotent : un même (boutique, n° de commande) n'est jamais compté deux fois.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              {loading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
              <p className="mt-2 text-sm text-muted-foreground">Cliquez pour sélectionner un fichier CSV</p>
              <input type="file" className="hidden" accept=".csv" onChange={handleFile} disabled={loading} />
            </label>
          </CardContent>
        </Card>
      )}

      {summary && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {file?.name} · {summary.dateRange.start} → {summary.dateRange.end}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Nouveau fichier</Button>
              {!imported && (
                <Button onClick={runImport} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Confirmer l'import
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Commandes</p>
              <p className="text-2xl font-bold">{summary.totalRows.toLocaleString("fr-FR")}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">CA (sous-total, terminées)</p>
              <p className="text-2xl font-bold">{eur(summary.revenue)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Net de commission</p>
              <p className="text-2xl font-bold">{eur(summary.netOfCommission)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Rapprochement</p>
              <p className="text-2xl font-bold">{summary.matched}/{summary.totalRows}</p>
              <p className="text-xs text-muted-foreground">{summary.restaurants.length} restaurant(s)</p>
            </CardContent></Card>
          </div>

          {imported && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Import enregistré</AlertTitle>
              <AlertDescription>{summary.inserted} lignes écrites{summary.errors?.length ? ` — ${summary.errors.length} erreur(s)` : ""}.</AlertDescription>
            </Alert>
          )}

          {summary.unmatchedNames.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{summary.unmatchedNames.length} boutique(s) non rapprochée(s)</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  {summary.unmatchedNames.map((u) => (
                    <div key={u.name} className="flex justify-between gap-4">
                      <span>{u.name}</span>
                      <span className="tabular-nums">{u.count} cmd · {eur(u.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs">Leur CA est stocké mais non rattaché à un restaurant (donc exclu des dashboards) tant que le mapping n'est pas créé.</p>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Détail par restaurant</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead className="text-right">Commandes</TableHead>
                    <TableHead className="text-right">CA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.restaurants.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(r.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {summary.skipped > 0 && (
            <Badge variant="secondary">{summary.skipped} ligne(s) ignorée(s) (doublon interne ou date invalide)</Badge>
          )}
        </>
      )}
    </div>
  );
}
