import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Check, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { calculateSimilarity, normalizeName } from "@/lib/fuzzyMatch";
import { extractCityName } from "@/lib/restaurantUtils";

type Platform = "uber" | "deliveroo";

interface Restaurant {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
}

interface CsvColumn {
  csvName: string;
  matchedRestaurant: Restaurant | null;
  confidence: number;
}

interface CsvRow {
  productName: string;
  category: string;
  matchedMenuItem: MenuItem | null;
  similarity: number;
  prices: Record<string, number | null>; // csvColumnName -> price
}

type Step = "upload" | "mapping" | "preview" | "importing";

const IGNORED_COLUMNS = ["produit", "categorie", "catégorie", "category", "ecart %", "écart %", "ecart €", "écart €", "ecart", "écart"];

export function BulkPriceImportDialog({ onImportComplete }: { onImportComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [platform, setPlatform] = useState<Platform>("uber");
  const [csvColumns, setCsvColumns] = useState<CsvColumn[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDbData = useCallback(async () => {
    const [{ data: rests }, { data: items }] = await Promise.all([
      supabase.from("restaurants").select("id, name").eq("is_active", true).order("name"),
      supabase.from("menu_items").select("id, name, category").eq("is_active", true),
    ]);
    setRestaurants(rests || []);
    setMenuItems(items || []);
    return { restaurants: rests || [], menuItems: items || [] };
  }, []);

  const matchRestaurant = (csvName: string, rests: Restaurant[]): { restaurant: Restaurant | null; confidence: number } => {
    const normalizedCsv = normalizeName(csvName);
    let best: Restaurant | null = null;
    let bestScore = 0;

    for (const r of rests) {
      const city = normalizeName(extractCityName(r.name));
      const fullName = normalizeName(r.name);
      
      if (city === normalizedCsv || fullName === normalizedCsv) return { restaurant: r, confidence: 100 };
      
      const cityScore = calculateSimilarity(normalizedCsv, city);
      const nameScore = calculateSimilarity(normalizedCsv, fullName);
      const score = Math.max(cityScore, nameScore);
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return { restaurant: bestScore >= 70 ? best : null, confidence: bestScore };
  };

  const matchMenuItem = (productName: string, items: MenuItem[]): { item: MenuItem | null; similarity: number } => {
    let best: MenuItem | null = null;
    let bestScore = 0;
    const norm = normalizeName(productName);

    for (const item of items) {
      const itemNorm = normalizeName(item.name);
      if (norm === itemNorm) return { item, similarity: 100 };
      const score = calculateSimilarity(productName, item.name);
      if (score > bestScore) { bestScore = score; best = item; }
    }
    return { item: bestScore >= 70 ? best : null, similarity: bestScore };
  };

  const parseCsv = async (text: string) => {
    setIsLoading(true);
    const { restaurants: rests, menuItems: items } = await loadDbData();

    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { toast.error("Le fichier est vide"); setIsLoading(false); return; }

    const headers = lines[0].split(";").map(h => h.trim());
    
    // Detect restaurant columns (skip first 2: Produit, Catégorie)
    const restaurantHeaders: CsvColumn[] = [];
    for (let i = 2; i < headers.length; i++) {
      const h = headers[i];
      if (!h || IGNORED_COLUMNS.includes(normalizeName(h))) continue;
      const { restaurant, confidence } = matchRestaurant(h, rests);
      restaurantHeaders.push({ csvName: h, matchedRestaurant: restaurant, confidence });
    }

    // Parse rows
    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";").map(c => c.trim());
      const productName = cols[0]?.trim();
      const category = cols[1]?.trim() || "";
      if (!productName) continue;

      const { item, similarity } = matchMenuItem(productName, items);
      const prices: Record<string, number | null> = {};

      for (const rh of restaurantHeaders) {
        const colIdx = headers.indexOf(rh.csvName);
        const raw = cols[colIdx]?.trim();
        if (!raw) { prices[rh.csvName] = null; continue; }
        const parsed = parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, ""));
        prices[rh.csvName] = isNaN(parsed) ? null : parsed;
      }

      rows.push({ productName, category, matchedMenuItem: item, similarity, prices });
    }

    setCsvColumns(restaurantHeaders);
    setCsvRows(rows);
    setStep("mapping");
    setIsLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCsv(ev.target?.result as string);
    reader.readAsText(file, "utf-8");
  };

  const updateColumnMapping = (csvName: string, restaurantId: string) => {
    const restaurant = restaurants.find(r => r.id === restaurantId) || null;
    setCsvColumns(prev => prev.map(c => c.csvName === csvName ? { ...c, matchedRestaurant: restaurant, confidence: restaurant ? 100 : 0 } : c));
  };

  const stats = useMemo(() => {
    const matchedRestaurants = csvColumns.filter(c => c.matchedRestaurant).length;
    const matchedProducts = csvRows.filter(r => r.matchedMenuItem).length;
    const totalPrices = csvRows.reduce((acc, r) => {
      return acc + csvColumns.filter(c => c.matchedRestaurant).reduce((a, c) => a + (r.prices[c.csvName] != null && r.matchedMenuItem ? 1 : 0), 0);
    }, 0);
    return { matchedRestaurants, totalRestaurants: csvColumns.length, matchedProducts, totalProducts: csvRows.length, totalPrices };
  }, [csvColumns, csvRows]);

  const handleImport = async () => {
    setStep("importing");
    setIsLoading(true);

    const priceField = platform === "uber" ? "price_uber" : "price_deliveroo";
    const records: { menu_item_id: string; restaurant_id: string; [key: string]: string | number | null }[] = [];

    for (const row of csvRows) {
      if (!row.matchedMenuItem) continue;
      for (const col of csvColumns) {
        if (!col.matchedRestaurant) continue;
        const price = row.prices[col.csvName];
        if (price == null) continue;
        records.push({
          menu_item_id: row.matchedMenuItem.id,
          restaurant_id: col.matchedRestaurant.id,
          [priceField]: price,
        });
      }
    }

    if (records.length === 0) {
      toast.error("Aucun prix à importer");
      setIsLoading(false);
      setStep("preview");
      return;
    }

    // Batch upsert
    const batchSize = 100;
    let imported = 0;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("restaurant_menu_prices")
        .upsert(batch, { onConflict: "restaurant_id,menu_item_id" });
      if (error) {
        toast.error(`Erreur à la ligne ${i}: ${error.message}`);
        setIsLoading(false);
        setStep("preview");
        return;
      }
      imported += batch.length;
    }

    toast.success(`${imported} prix importés avec succès`);
    setIsLoading(false);
    setOpen(false);
    setStep("upload");
    onImportComplete?.();
  };

  const resetDialog = () => {
    setStep("upload");
    setCsvColumns([]);
    setCsvRows([]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Import CSV multi-restaurants
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import de prix multi-restaurants</DialogTitle>
          <DialogDescription>
            Importez un fichier CSV avec les prix par restaurant (séparateur ;)
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Plateforme :</span>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uber">Uber Eats</SelectItem>
                  <SelectItem value="deliveroo">Deliveroo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier CSV</span>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
            {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours...</div>}
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{stats.matchedRestaurants}/{stats.totalRestaurants} restaurants matchés</Badge>
              <Badge variant="outline">{stats.matchedProducts}/{stats.totalProducts} produits matchés</Badge>
            </div>
            <div className="text-sm font-medium">Mapping des restaurants</div>
            <ScrollArea className="flex-1 max-h-[40vh]">
              <div className="space-y-2">
                {csvColumns.map(col => (
                  <div key={col.csvName} className="flex items-center gap-3 p-2 rounded border bg-card">
                    <span className="text-sm font-medium min-w-[120px]">{col.csvName}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={col.matchedRestaurant?.id || "none"}
                      onValueChange={(v) => updateColumnMapping(col.csvName, v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner un restaurant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Ignorer —</SelectItem>
                        {restaurants.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {col.matchedRestaurant ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="text-sm font-medium">Produits non reconnus ({csvRows.filter(r => !r.matchedMenuItem).length})</div>
            <ScrollArea className="max-h-[20vh]">
              <div className="space-y-1">
                {csvRows.filter(r => !r.matchedMenuItem).map((r, i) => (
                  <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    {r.productName} <span className="text-xs">({r.similarity}%)</span>
                  </div>
                ))}
                {csvRows.filter(r => !r.matchedMenuItem).length === 0 && (
                  <div className="text-sm text-green-600">Tous les produits ont été reconnus ✓</div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {(step === "preview" || step === "importing") && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <div>✅ <strong>{stats.matchedRestaurants}</strong> restaurants reconnus</div>
              <div>✅ <strong>{stats.matchedProducts}</strong> produits matchés</div>
              <div>📊 <strong>{stats.totalPrices}</strong> prix à importer ({platform === "uber" ? "Uber Eats" : "Deliveroo"})</div>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Import en cours...</div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={resetDialog}>Retour</Button>
              <Button onClick={() => setStep("preview")} disabled={stats.totalPrices === 0}>
                Aperçu ({stats.totalPrices} prix)
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>Retour</Button>
              <Button onClick={handleImport} disabled={isLoading}>
                Importer {stats.totalPrices} prix
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
