import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Tag, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import {
  ImportRow,
  productKey,
  useImportRestaurantPrices,
  useInstoreMatrix,
  useSetRestaurantPrice,
} from "@/hooks/useInstoreMatrix";
import { CHANNELS, ChannelImportRow, PriceChannel, useChannelPriceMatrix, useImportChannelPrices, useSetChannelPrice } from "@/hooks/useChannelPriceMatrix";

const fmtEur = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "—"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const norm = (s: string) => productKey(s.replace(/chicken\s*street/i, ""));

function PriceCell({ value, onSave }: { value: number | null; onSave: (p: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const commit = () => {
    setEditing(false);
    const p = Number(draft.replace(",", "."));
    if (!draft.trim() || !Number.isFinite(p) || p < 0 || p > 99999999.99 || (value !== null && Math.abs(p - value) < 0.001)) return;
    onSave(p);
  };
  if (editing)
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
  return (
    <Button
      type="button"
      variant="ghost"
      title="Modifier ce prix"
      onClick={() => {
        setDraft(value !== null ? String(value) : "");
        setEditing(true);
      }}
      className={cn(
        "h-8 w-24 justify-end px-2 text-right tabular-nums hover:bg-muted",
        value === null && "text-muted-foreground"
      )}
    >
      {fmtEur(value)}
    </Button>
  );
}

function ImportButton({ restaurants }: { restaurants: { id: string; name: string }[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const imp = useImportRestaurantPrices();
  const impChannels = useImportChannelPrices();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<(PriceChannel | "caisse")[]>(["caisse"]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: ImportRow[]; recognized: number; unknown: string[]; invalid: number } | null>(null);

  const onFile = async (chosen: File) => {
    setPreview(null);
    setFile(null);
    if (chosen.size > 20 * 1024 * 1024 || !/\.xlsx?$/i.test(chosen.name)) {
      toast({ title: "Fichier non pris en charge", description: "Choisissez un fichier Excel de moins de 20 Mo.", variant: "destructive" });
      return;
    }
    try {
    const wb = XLSX.read(await chosen.arrayBuffer());
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const hIdx = grid.findIndex((r) => productKey(String(r?.[0] ?? "")) === "produit");
    if (hIdx < 0) {
      toast({ title: "Format non reconnu", description: "Colonne « Produit » introuvable.", variant: "destructive" });
      return;
    }
    const header = grid[hIdx].map((c) => String(c ?? "").trim());
    const byName = new Map(restaurants.map((r) => [norm(r.name), r.id]));
    const cols: { i: number; id: string }[] = [];
    const unknown: string[] = [];
    header.forEach((h, i) => {
      if (i === 0 || !h || /m[ée]diane/i.test(h)) return;
      const normalized = norm(h);
      const id = byName.get(normalized) ?? (normalized.length >= 5 ? [...byName.entries()].filter(([k]) => k.includes(normalized)).map(([, id]) => id).filter((v, idx, arr) => arr.indexOf(v) === idx).length === 1 ? [...byName.entries()].find(([k]) => k.includes(normalized))?.[1] : undefined : undefined);
      if (id) cols.push({ i, id });
      else unknown.push(h);
    });
    const map = new Map<string, ImportRow>();
    let invalid = 0;
    for (const row of grid.slice(hIdx + 1)) {
      const label = String(row?.[0] ?? "").trim();
      if (!label) continue;
      const key = productKey(label);
      if (!key || key.length > 160 || label.length > 300) { invalid++; continue; }
      for (const c of cols) {
        const p = Number(String(row[c.i] ?? "").replace(",", "."));
        if (row[c.i] === undefined || row[c.i] === "") continue;
        if (!Number.isFinite(p) || p < 0 || p > 99999999.99) { invalid++; continue; }
        map.set(`${c.id}|${key}`, {
          restaurant_id: c.id,
          product_key: key,
          product_label: label,
          price: Math.round(p * 100) / 100,
        });
      }
    }
    setFile(chosen);
    setPreview({ rows: [...map.values()], recognized: cols.length, unknown, invalid });
    } catch {
      toast({ title: "Fichier illisible", description: "Vérifiez le format Excel.", variant: "destructive" });
    }
  };

  const submit = async () => {
    if (!preview?.rows.length || !channels.length) return;
    try {
      let total = 0;
      if (channels.includes("caisse")) total += await imp.mutateAsync(preview.rows);
      const other = channels.filter((c): c is PriceChannel => c !== "caisse");
      if (other.length) {
        const rows: ChannelImportRow[] = other.flatMap((channel) => preview.rows.map((row) => ({ ...row, channel })));
        total += await impChannels.mutateAsync(rows);
      }
      toast({ title: `${total} prix importés`, description: `${preview.recognized} restaurants reconnus` });
      setOpen(false);
      setPreview(null);
      setFile(null);
    } catch (e) {
      toast({ title: "Import incomplet", description: `Vérifiez les prix avant de réessayer. ${String(e)}`, variant: "destructive" });
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Importer le référentiel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer le référentiel</DialogTitle>
            <DialogDescription>Sélectionnez les canaux auxquels appliquer les prix du fichier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {([{ key: "caisse", label: "Caisse" }, ...CHANNELS] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 rounded border p-3">
                  <Checkbox id={`import-${key}`} checked={channels.includes(key)} onCheckedChange={(checked) => setChannels((prev) => checked === true ? [...prev, key] : prev.filter((c) => c !== key))} />
                  <Label htmlFor={`import-${key}`}>{label}</Label>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Le même tarif du fichier sera appliqué à chaque canal coché. Les autres prix restent inchangés.</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => ref.current?.click()}><Upload className="mr-2 h-4 w-4" />{file ? file.name : "Choisir un fichier Excel"}</Button>
            {preview && <div className="rounded border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{preview.rows.length} prix · {preview.recognized} restaurants reconnus</p>
              {!!preview.unknown.length && <p className="mt-1 text-destructive">Non reconnus : {preview.unknown.slice(0, 8).join(", ")}{preview.unknown.length > 8 ? ` et ${preview.unknown.length - 8} autres` : ""}</p>}
              {!!preview.invalid && <p className="mt-1 text-destructive">{preview.invalid} valeurs invalides ignorées</p>}
            </div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={!preview?.rows.length || !channels.length || imp.isPending || impChannels.isPending} onClick={() => void submit()}>{imp.isPending || impChannels.isPending ? "Import en cours…" : "Importer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function InstorePrices() {
  const { data, isLoading } = useInstoreMatrix();
  const { data: channelData = [], isLoading: channelLoading } = useChannelPriceMatrix();
  const { data: restaurants = [] } = useActiveRestaurants();
  const { selectedRestaurants } = useAnalyticsContext();
  const setPrice = useSetRestaurantPrice();
  const setChannelPrice = useSetChannelPrice();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("caisse");

  const selectedIds = useMemo(() => {
    const activeIds = new Set(restaurants.map((r) => r.id));
    return selectedRestaurants.filter((id) => activeIds.has(id));
  }, [selectedRestaurants, restaurants]);
  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const single = singleId !== null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => p.label.toLowerCase().includes(q))
      .map((p) => {
        const networkMedian = median(Object.values(p.prices));
        const vals = selectedIds.length
          ? selectedIds.flatMap((id) => p.prices[id] === undefined ? [] : [p.prices[id]])
          : Object.values(p.prices);
        const scopedMedian = median(vals);
        const med = single ? networkMedian : scopedMedian;
        const aligned = scopedMedian === null ? 0 : vals.filter((v) => Math.abs(v - scopedMedian) < 0.005).length;
        return {
          ...p,
          med,
          min: vals.length ? Math.min(...vals) : null,
          max: vals.length ? Math.max(...vals) : null,
          count: vals.length,
          alignPct: vals.length ? (aligned / vals.length) * 100 : 0,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [data, search, selectedIds, single]);

  const restaurantCount = useMemo(
    () => selectedIds.length || new Set((data ?? []).flatMap((p) => Object.keys(p.prices))).size,
    [data, selectedIds]
  );

  const channelRows = useMemo(() => {
    const combined = new Map<string, { key: string; label: string; prices: Partial<Record<PriceChannel, Record<string, number>>>; caisse: Record<string, number> }>();
    for (const p of data ?? []) combined.set(p.key, { key: p.key, label: p.label, prices: {}, caisse: p.prices });
    for (const p of channelData) {
      const row = combined.get(p.key) ?? { key: p.key, label: p.label, prices: {}, caisse: {} };
      row.prices[p.channel] = p.prices;
      combined.set(p.key, row);
    }
    const q = search.trim().toLowerCase();
    return [...combined.values()].filter((p) => p.label.toLowerCase().includes(q)).sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [data, channelData, search]);

  const save = (product_key: string, product_label: string, price: number) =>
    setPrice.mutate(
      { restaurant_id: singleId ?? "", product_key, product_label, price },
      {
        onSuccess: () => toast({ title: "Prix mis à jour", description: `${product_label} · ${fmtEur(price)}` }),
        onError: (e) => toast({ title: "Échec", description: String(e), variant: "destructive" }),
      }
    );

  const saveChannel = (channel: PriceChannel, product_key: string, product_label: string, price: number) => {
    if (!singleId) return;
    setChannelPrice.mutate({ restaurant_id: singleId, channel, product_key, product_label, price }, {
      onSuccess: () => toast({ title: "Prix mis à jour", description: `${product_label} · ${fmtEur(price)}` }),
      onError: (e) => toast({ title: "Échec", description: String(e), variant: "destructive" }),
    });
  };

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Prix & Tarifs</h1>
              <p className="text-muted-foreground">
                 Prix par produit et par canal, avec la caisse comme référence.
              </p>
            </div>
            <ImportButton restaurants={restaurants} />
          </div>

          <AnalyticsHeader hidePeriodSelector />

          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="caisse">Caisse · référence</TabsTrigger>
              <TabsTrigger value="canaux">Comparatif des canaux</TabsTrigger>
            </TabsList>
            <TabsContent value="canaux">
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" />Prix par canal</CardTitle>
                    <CardDescription>{channelRows.length} produits · {single ? "Prix du restaurant" : selectedIds.length > 1 ? "Médianes des restaurants sélectionnés" : "Médianes réseau"}</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="w-56 pl-8" placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading || channelLoading ? <Skeleton className="h-48 w-full" /> : channelRows.length === 0 ? <p className="py-10 text-center text-muted-foreground">Aucun tarif pour cette sélection.</p> : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="sticky left-0 z-10 min-w-[220px] bg-background">Produit</TableHead>
                          <TableHead className="min-w-[140px] text-right">Caisse</TableHead>
                          {CHANNELS.map((c) => <TableHead key={c.key} className="min-w-[140px] text-right">{c.label}</TableHead>)}
                        </TableRow></TableHeader>
                        <TableBody>{channelRows.map((p) => {
                          const scope = (prices: Record<string, number>) => median(selectedIds.length ? selectedIds.flatMap((id) => prices[id] === undefined ? [] : [prices[id]]) : Object.values(prices));
                          const base = singleId ? p.caisse[singleId] ?? null : scope(p.caisse);
                          return <TableRow key={p.key}>
                            <TableCell className="sticky left-0 z-10 bg-background font-medium">{p.label}</TableCell>
                            <TableCell className="text-right">{singleId ? <div className="flex justify-end"><PriceCell value={base} onSave={(price) => save(p.key, p.label, price)} /></div> : <span className="tabular-nums font-semibold">{fmtEur(base)}</span>}</TableCell>
                            {CHANNELS.map((c) => {
                              const prices = p.prices[c.key] ?? {};
                              const value = singleId ? prices[singleId] ?? null : scope(prices);
                              const delta = base !== null && base > 0 && value !== null ? Math.round((value / base - 1) * 100) : null;
                              return <TableCell key={c.key} className="text-right">
                                <div className="flex flex-col items-end">
                                  {singleId ? <PriceCell value={value} onSave={(price) => saveChannel(c.key, p.key, p.label, price)} /> : <span className="tabular-nums">{fmtEur(value)}</span>}
                                  {delta !== null && <span className={cn("text-xs tabular-nums", delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground")}>{delta > 0 ? "+" : ""}{delta} % vs caisse</span>}
                                </div>
                              </TableCell>;
                            })}
                          </TableRow>;
                        })}</TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="caisse">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" /> {single ? "Prix du restaurant" : selectedIds.length > 1 ? "Prix des restaurants sélectionnés" : "Vue réseau"}
                </CardTitle>
                <CardDescription>
                  {(data ?? []).length} produits · {restaurantCount} restaurants
                  {single && " · cliquez sur un prix pour le modifier"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="w-56 pl-8"
                    placeholder="Rechercher un produit…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (data ?? []).length === 0 ? (
                <div className="rounded-md border border-dashed py-12 text-center">
                  <p className="text-sm font-medium">Aucun prix chargé pour cette enseigne.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Importez le fichier de référentiel pour commencer.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Produit</TableHead>
                        {single && <TableHead className="text-right">Prix restaurant</TableHead>}
                        <TableHead className="text-right">Médiane réseau</TableHead>
                        {single ? (
                          <TableHead className="text-right">Écart</TableHead>
                        ) : (
                          <>
                            <TableHead className="text-right">Min</TableHead>
                            <TableHead className="text-right">Max</TableHead>
                            <TableHead className="text-right">Alignés médiane</TableHead>
                            <TableHead className="text-right">Restos</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((p) => {
                        const own = singleId ? p.prices[singleId] ?? null : null;
                        const diff = own !== null && p.med !== null ? own - p.med : null;
                        return (
                          <TableRow key={p.key}>
                            <TableCell className="font-medium">{p.label}</TableCell>
                            {single && (
                              <TableCell className="text-right">
                                <div className="flex justify-end">
                                  <PriceCell value={own} onSave={(v) => save(p.key, p.label, v)} />
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="text-right tabular-nums">{fmtEur(p.med)}</TableCell>
                            {single ? (
                              <TableCell className="text-right">
                                {diff === null ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : Math.abs(diff) < 0.005 ? (
                                  <Badge variant="secondary">aligné</Badge>
                                ) : (
                                  <Badge variant={diff > 0 ? "default" : "destructive"}>
                                    {diff > 0 ? "+" : ""}
                                    {fmtEur(diff)}
                                  </Badge>
                                )}
                              </TableCell>
                            ) : (
                              <>
                                <TableCell className="text-right tabular-nums">{fmtEur(p.min)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmtEur(p.max)}</TableCell>
                                <TableCell className="text-right tabular-nums">{p.alignPct.toFixed(0)} %</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">{p.count}</TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
