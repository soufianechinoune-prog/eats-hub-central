import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, Loader2, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { REPORT_TYPE_CONFIG } from '@/lib/reportImportConfig';
import { inspectUberCsv, type UberCsvInspection } from '@/lib/uberCsvInspection';

interface Entry { id: string; file: File; content: string; inspection: UberCsvInspection; type: string; }
interface Props {
  restaurants: { id: string; name: string }[];
  currentFile: File | null;
  busy: boolean;
  completed: boolean;
  onOpen: (file: File, content: string, type: string, restaurantId: string) => void;
}
const dateLabel = (date: string | null) => date ? date.split('-').reverse().join('/') : '—';
const categories = {
  Paiements: ['payment_order_level', 'payment_item_level', 'payout_summary'],
  Opérations: ['sales_over_time', 'downtime_report', 'order_history', 'inaccurate_orders', 'order_accuracy_summary', 'item_issues_leaderboard', 'success_score', 'conversion_funnel'],
  Avis: ['reviews_order', 'reviews_item'],
  Marketing: ['marketing_campaigns'],
};
export default function UberImportWorkspace({ restaurants, currentFile, busy, completed, onOpen }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [scope, setScope] = useState('network');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const addFiles = async (files: File[]) => {
    setReading(true); setError('');
    try {
      const next: Entry[] = [];
      for (const file of files) {
        if (!/\.csv$/i.test(file.name)) { setError('Seuls les fichiers CSV sont acceptés.'); continue; }
        const content = await file.text();
        const inspection = inspectUberCsv(content, file.name);
        next.push({ id: crypto.randomUUID(), file, content, inspection, type: inspection.type || '' });
      }
      setEntries(old => [...old, ...next.filter(n => !old.some(e => e.file.name === n.file.name && e.file.size === n.file.size))]);
    } catch { setError('Impossible de lire le fichier. Réessayez.'); }
    finally { setReading(false); if (input.current) input.current.value = ''; }
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />Périmètre</div>
      <Select value={scope} onValueChange={setScope} disabled={busy}>
        <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="network">Tous les restaurants de l’enseigne</SelectItem>
          {restaurants.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div className="rounded-lg border-2 border-dashed bg-card px-5 py-8 text-center transition-colors hover:border-primary/50"
      onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void addFiles(Array.from(e.dataTransfer.files)); }}>
      <Upload className="mx-auto mb-3 h-7 w-7 text-primary" />
      <h2 className="text-lg font-semibold">Rapports Uber Eats</h2>
      <Button className="mt-4 gap-2" disabled={reading || busy} onClick={() => input.current?.click()}>
        {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Ajouter des fichiers CSV
      </Button>
      <input ref={input} type="file" className="hidden" accept=".csv" multiple onChange={e => void addFiles(Array.from(e.target.files || []))} />
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {entries.length > 0 && <>
      <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{entries.length}</strong> {entries.length === 1 ? 'fichier' : 'fichiers'}</span>
        <span><strong className="text-foreground">{entries.reduce((s, e) => s + e.inspection.rowCount, 0).toLocaleString('fr-FR')}</strong> lignes</span>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Fichier / rapport</TableHead><TableHead>Période des données</TableHead><TableHead>Restaurants</TableHead><TableHead className="text-right">Lignes</TableHead><TableHead>État</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>{entries.map(e => {
          const active = e.file === currentFile;
          const needsRestaurant = REPORT_TYPE_CONFIG[e.type]?.requiresRestaurant && scope === 'network';
          const blocked = !e.type || !e.inspection.rowCount || !!e.inspection.unsupported || needsRestaurant;
          return <TableRow key={e.id} className={active ? 'bg-primary/5' : undefined}>
            <TableCell className="min-w-64 max-w-96"><p className="truncate text-sm font-medium" title={e.file.name}>{e.file.name}</p>
              <Select value={e.type} disabled={busy || !!e.inspection.unsupported} onValueChange={type => setEntries(old => old.map(x => x.id === e.id ? { ...x, type } : x))}>
                <SelectTrigger className="mt-2 h-8 text-xs"><SelectValue placeholder="Rapport non reconnu" /></SelectTrigger>
                <SelectContent>{Object.entries(categories).map(([label, types]) => <SelectGroup key={label}><SelectLabel>{label}</SelectLabel>{types.map(key => <SelectItem key={key} value={key}>{REPORT_TYPE_CONFIG[key].label}</SelectItem>)}</SelectGroup>)}</SelectContent>
              </Select>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">{dateLabel(e.inspection.dateRange.start)} → {dateLabel(e.inspection.dateRange.end)}</TableCell>
            <TableCell>{e.inspection.stores.length || '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{e.inspection.rowCount.toLocaleString('fr-FR')}</TableCell>
            <TableCell><Badge variant={blocked ? 'outline' : 'secondary'}>{active && completed ? 'Terminé' : active ? 'En cours' : blocked ? 'À vérifier' : 'À analyser'}</Badge>
              {blocked && <p className="mt-1 max-w-48 text-xs text-destructive">{e.inspection.unsupported || (!e.inspection.rowCount ? 'Fichier vide' : needsRestaurant ? 'Restaurant requis pour ce rapport' : 'Choisir un type de rapport')}</p>}
            </TableCell>
            <TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="outline" disabled={busy || blocked} onClick={() => onOpen(e.file, e.content, e.type, scope === 'network' ? '' : scope)}>
              {active && completed ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Analyser</Button>
              <Button variant="ghost" size="icon" disabled={busy} title="Retirer le fichier" aria-label="Retirer le fichier" onClick={() => setEntries(old => old.filter(x => x.id !== e.id))}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table></div>
    </>}
  </section>;
}
