import { useState, useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeName } from "@/lib/fuzzyMatch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParsedRow {
  storeName: string;
  status: string;
  operationalExcellence: number | null;
  menuDetails: number | null;
  ratings: number | null;
  sustainablePackaging: number | null;
  unfulfilledOrders: number | null;
  avoidableCourierWait: number | null;
  incorrectOrders: number | null;
  foodQuality: number | null;
  sales: number | null;
  // Matching
  matchedRestaurantId: string | null;
  matchedRestaurantName: string | null;
  matchConfidence: number;
}

const STATUS_MAP: Record<string, string> = {
  "Excellent": "Excellent",
  "Great": "Great",
  "Très bon": "Great",
  "Tres bon": "Great",
  "Good": "Good",
  "Bon": "Good",
  "Fair": "Fair",
  "Correct": "Fair",
  "Poor": "Poor",
  "Insuffisant": "Poor",
};

function parsePercentage(val: string): number | null {
  if (!val || val === "NA" || val === "N/A" || val === "-") return null;
  const cleaned = val.replace("%", "").replace(",", ".").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseNumber(val: string): number | null {
  if (!val || val === "NA" || val === "N/A" || val === "-") return null;
  const cleaned = val.replace(",", ".").replace(/\s/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

interface Props {
  onSuccess?: () => void;
}

export function SuccessScoreCsvImport({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [scoreMonth, setScoreMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setParsedRows([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast.error("Le fichier est vide ou invalide");
      return;
    }

    // Fetch restaurants for matching
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name")
      .order("name");

    if (!restaurants?.length) {
      toast.error("Aucun restaurant trouvé dans la base");
      return;
    }

    // Parse header
    const header = lines[0].replace(/^\uFEFF/, ""); // BOM
    const cols = header.split(",").map(c => c.trim().toLowerCase());

    // Find column indices
    const storeIdx = cols.findIndex(c => c.includes("store") || c.includes("nom"));
    const statusIdx = cols.findIndex(c => c === "status" || c.includes("statut"));
    const opExIdx = cols.findIndex(c => c.includes("excellence"));
    const menuIdx = cols.findIndex(c => c.includes("menu"));
    const noteIdx = cols.findIndex(c => c === "note" || c.includes("rating"));
    const packIdx = cols.findIndex(c => c.includes("emballage") || c.includes("recyclable"));
    const unfulfIdx = cols.findIndex(c => c.includes("non ex") || c.includes("unfulfilled"));
    const waitIdx = cols.findIndex(c => c.includes("attente") || c.includes("wait"));
    const incorrectIdx = cols.findIndex(c => c.includes("incorrect"));
    const foodIdx = cols.findIndex(c => c.includes("go") || c.includes("qualit") || c.includes("food"));
    const salesIdx = cols.findIndex(c => c === "sales" || c.includes("ventes") || c.includes("ca"));

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parsing (handles commas in values if quoted)
      const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      
      const storeName = storeIdx >= 0 ? values[storeIdx] : "";
      if (!storeName) continue;

      // Match restaurant
      const normalizedStore = normalizeName(storeName);
      let bestMatch: { id: string; name: string } | null = null;
      let bestScore = 0;

      for (const r of restaurants) {
        const normalizedR = normalizeName(r.name);
        
        // Exact
        if (normalizedStore === normalizedR) {
          bestMatch = r;
          bestScore = 100;
          break;
        }
        
        // Contains check (city-based)
        const storeParts = normalizedStore.split(" - ");
        const rParts = normalizedR.split(" - ");
        const storeCity = storeParts[storeParts.length - 1]?.trim();
        const rCity = rParts[rParts.length - 1]?.trim();
        
        if (storeCity && rCity && storeCity === rCity) {
          bestMatch = r;
          bestScore = 95;
          break;
        }
        
        // Partial city match
        if (storeCity && rCity && (storeCity.includes(rCity) || rCity.includes(storeCity))) {
          if (90 > bestScore) {
            bestScore = 90;
            bestMatch = r;
          }
        }
        
        // Levenshtein-like
        if (normalizedStore.includes(normalizedR) || normalizedR.includes(normalizedStore)) {
          if (80 > bestScore) {
            bestScore = 80;
            bestMatch = r;
          }
        }
      }

      const statusRaw = statusIdx >= 0 ? values[statusIdx] : "";
      const tier = STATUS_MAP[statusRaw] || STATUS_MAP[statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1)] || "Fair";

      rows.push({
        storeName,
        status: tier,
        operationalExcellence: opExIdx >= 0 ? parseNumber(values[opExIdx]) : null,
        menuDetails: menuIdx >= 0 ? parsePercentage(values[menuIdx]) : null,
        ratings: noteIdx >= 0 ? parseNumber(values[noteIdx]) : null,
        sustainablePackaging: packIdx >= 0 ? parsePercentage(values[packIdx]) : null,
        unfulfilledOrders: unfulfIdx >= 0 ? parsePercentage(values[unfulfIdx]) : null,
        avoidableCourierWait: waitIdx >= 0 ? parsePercentage(values[waitIdx]) : null,
        incorrectOrders: incorrectIdx >= 0 ? parsePercentage(values[incorrectIdx]) : null,
        foodQuality: foodIdx >= 0 ? parsePercentage(values[foodIdx]) : null,
        sales: salesIdx >= 0 ? parseNumber(values[salesIdx]) : null,
        matchedRestaurantId: bestMatch?.id || null,
        matchedRestaurantName: bestMatch?.name || null,
        matchConfidence: bestScore,
      });
    }

    setParsedRows(rows);
    setStep("preview");
  };

  const handleImport = async () => {
    const matchedRows = parsedRows.filter(r => r.matchedRestaurantId);
    if (!matchedRows.length) {
      toast.error("Aucun restaurant associé");
      return;
    }

    setStep("importing");
    let success = 0;
    let failed = 0;
    const normalizedMonth = scoreMonth.length === 7 ? `${scoreMonth}-01` : scoreMonth;
    const errors: string[] = [];

    for (const row of matchedRows) {
      const { error } = await supabase
        .from("success_scores")
        .upsert({
          restaurant_id: row.matchedRestaurantId!,
          score_month: normalizedMonth,
          score_tier: row.status,
          operational_excellence: row.operationalExcellence,
          menu_details: row.menuDetails,
          ratings: row.ratings,
          sustainable_packaging: row.sustainablePackaging,
          unfulfilled_orders: row.unfulfilledOrders,
          avoidable_courier_wait: row.avoidableCourierWait,
          incorrect_orders: row.incorrectOrders,
          food_quality: row.foodQuality,
          sales_amount: row.sales,
        } as any, {
          onConflict: "restaurant_id,score_month",
        });

      if (error) {
        console.error("Upsert error:", error);
        failed++;
      } else {
        success++;
      }
    }

    setImportResult({ success, failed });
    toast.success(`${success} restaurants importés`);
    onSuccess?.();
  };

  const matched = parsedRows.filter(r => r.matchedRestaurantId);
  const unmatched = parsedRows.filter(r => !r.matchedRestaurantId);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importer CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Score de Réussite
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mois concerné</Label>
              <Input
                type="month"
                value={scoreMonth}
                onChange={(e) => setScoreMonth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fichier CSV (export Uber Eats)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground">
                Format attendu : Store name, Status, Excellence opérationnelle, Détails du menu, Note, Emballages recyclables, Commandes non exécutées, Temps attente coursier, Commandes incorrectes, Goût et qualité, Sales
              </p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {matched.length} associés
              </Badge>
              {unmatched.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {unmatched.length} non associés
                </Badge>
              )}
              <span className="text-muted-foreground ml-auto">
                Mois : {scoreMonth}
              </span>
            </div>

            <ScrollArea className="h-[400px] rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store CSV</TableHead>
                    <TableHead>Restaurant associé</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-center">Exc. Op.</TableHead>
                    <TableHead className="text-center">Note</TableHead>
                    <TableHead className="text-center">Menu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i} className={!row.matchedRestaurantId ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs font-medium">{row.storeName}</TableCell>
                      <TableCell className="text-xs">
                        {row.matchedRestaurantName || (
                          <span className="text-destructive">Non trouvé</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">{row.status}</TableCell>
                      <TableCell className="text-center text-xs">
                        {row.operationalExcellence?.toFixed(1) ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {row.ratings?.toFixed(1) ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {row.menuDetails != null ? `${row.menuDetails}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Annuler</Button>
              <Button onClick={handleImport} disabled={!matched.length}>
                Importer {matched.length} restaurants
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && !importResult && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Import en cours...</p>
          </div>
        )}

        {importResult && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">{importResult.success} restaurants importés</p>
              {importResult.failed > 0 && (
                <p className="text-sm text-destructive">{importResult.failed} erreurs</p>
              )}
            </div>
            <Button onClick={() => { setOpen(false); reset(); }}>Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
