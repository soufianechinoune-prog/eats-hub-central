import { useState } from "react";
import { Upload, CheckCircle, AlertTriangle, Loader2, Calendar, History, Building2, FileSpreadsheet, Tag, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import deliverooLogo from "@/assets/deliveroo-logo.png";

interface DeliverooImportTabProps {
  restaurants: Array<{ id: string; name: string; city: string | null }>;
}

interface PreviewRow {
  restaurant_name: string;
  deliveroo_order_id: string;
  delivery_datetime: string;
  history_type: string;
  order_amount: string;
  total_payable: string;
}

interface ImportStats {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface RestaurantStat {
  id: string;
  name: string;
  count: number;
}

interface FileValidation {
  file: File;
  csvContent: string;
  stats: ImportStats | null;
  restaurants: RestaurantStat[];
  unmatchedNames: string[];
  dateRange: { start: string | null; end: string | null };
  previewRows: PreviewRow[];
}

interface FileResult {
  fileName: string;
  stats: ImportStats;
  errorDetails: string[];
}

export default function DeliverooImportTab({ restaurants }: DeliverooImportTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [importLabel, setImportLabel] = useState("");
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [fileValidations, setFileValidations] = useState<FileValidation[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [allResults, setAllResults] = useState<FileResult[]>([]);

  const resetImport = () => {
    setImportLabel("");
    setStep("upload");
    setFileValidations([]);
    setAllResults([]);
    setImportProgress({ current: 0, total: 0 });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const csvFiles = selectedFiles.filter(f => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) {
      toast({ title: "Format invalide", description: "Veuillez sélectionner des fichiers CSV", variant: "destructive" });
      return;
    }
    if (csvFiles.length !== selectedFiles.length) {
      toast({ title: "Fichiers ignorés", description: `${selectedFiles.length - csvFiles.length} fichier(s) non-CSV ignoré(s)` });
    }

    setIsLoading(true);
    setAllResults([]);

    const validations: FileValidation[] = [];

    // Phase 1: Read ALL files into memory immediately to avoid stale File handles
    const fileContents = new Map<File, string>();
    for (const file of csvFiles) {
      if (file.size === 0) {
        toast({ title: `Fichier vide : ${file.name}`, description: "Ce fichier ne contient aucune donnée", variant: "destructive" });
        continue;
      }
      try {
        const content = await readFileAsText(file);
        fileContents.set(file, content);
      } catch (readErr: any) {
        console.error(`[Deliveroo] Failed to read file: ${file.name} (${file.size} bytes)`, readErr);
        toast({
          title: `Erreur lecture : ${file.name}`,
          description: readErr?.message || "Erreur inconnue lors de la lecture du fichier. Vérifiez que le fichier n'est pas corrompu.",
          variant: "destructive",
        });
      }
    }

    // Phase 2: Process dry-runs using pre-read content
    try {
      for (const [file, content] of fileContents) {
        try {
          console.log(`[Deliveroo] Dry-run starting: ${file.name}`);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 90_000);

          const { data, error } = await supabase.functions.invoke("parse-deliveroo-statement", {
            body: { csvContent: content, fileName: file.name, dryRun: true },
          });
          clearTimeout(timeout);

          if (error) throw error;

          console.log(`[Deliveroo] Dry-run done: ${file.name}, rows: ${data.stats?.totalRows}`);
          const preview = buildPreview(content);
          validations.push({
            file,
            csvContent: content,
            stats: data.stats,
            restaurants: data.restaurants || [],
            unmatchedNames: data.unmatchedNames || [],
            dateRange: data.dateRange || { start: null, end: null },
            previewRows: preview,
          });
        } catch (err: any) {
          console.error(`[Deliveroo] Dry-run error: ${file.name}`, err);
          toast({ title: `Erreur : ${file.name}`, description: err.message, variant: "destructive" });
        }
      }

      if (validations.length > 0) {
        setFileValidations(validations);
        setStep("preview");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const removeFile = (index: number) => {
    const updated = fileValidations.filter((_, i) => i !== index);
    if (updated.length === 0) {
      resetImport();
    } else {
      setFileValidations(updated);
    }
  };

  const readFileAsText = async (file: File): Promise<string> => {
    const fileSizeLabel = `${(file.size / 1024).toFixed(1)} Ko`;
    const encodings = ["utf-8", "windows-1252", "iso-8859-1"] as const;
    let lastError: any = null;

    // Method A: file.arrayBuffer() + TextDecoder (3 retries)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buffer = await file.arrayBuffer();
        if (!buffer || buffer.byteLength === 0) {
          throw new Error(`Le fichier est vide (${fileSizeLabel})`);
        }
        for (const encoding of encodings) {
          const text = new TextDecoder(encoding).decode(buffer);
          if (text.trim().length > 0) return text;
        }
        throw new Error(`Le fichier est vide (${fileSizeLabel})`);
      } catch (err: any) {
        lastError = err;
        console.warn(`[readFileAsText] Method A attempt ${attempt} failed for ${file.name}:`, err?.name, err?.message);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Method B: FileReader.readAsText fallback
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, "utf-8");
      });
      if (text.trim().length > 0) return text;
    } catch (err: any) {
      lastError = err;
      console.warn(`[readFileAsText] Method B (FileReader) failed for ${file.name}:`, err?.name, err?.message);
    }

    // Method C: FileReader.readAsArrayBuffer fallback
    try {
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });
      for (const encoding of encodings) {
        const text = new TextDecoder(encoding).decode(buffer);
        if (text.trim().length > 0) return text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[readFileAsText] Method C (FileReader+ArrayBuffer) failed for ${file.name}:`, err?.name, err?.message);
    }

    // Build actionable error message
    const errName = lastError?.name || "UnknownError";
    const errMsg = lastError?.message || "Erreur inconnue";
    const isNotReadable = errName === "NotReadableError";
    const helpText = isNotReadable
      ? "Le fichier est verrouillé ou inaccessible. Fermez Excel/Numbers, copiez le fichier dans un dossier local (pas iCloud/OneDrive/Drive), puis réessayez."
      : `Impossible de lire le fichier (${fileSizeLabel}). Essayez de le ré-exporter depuis Deliveroo.`;
    throw new Error(`${helpText} [${errName}: ${errMsg}]`);
  };

  const buildPreview = (content: string): PreviewRow[] => {
    const lines = content.split('\n').filter((l: string) => l.trim());
    const preview: PreviewRow[] = [];
    let foundHeader = false;
    for (const line of lines) {
      if (line.includes('Nom du restaurant') && line.includes('Historique')) {
        foundHeader = true;
        continue;
      }
      if (!foundHeader) continue;
      if (line.startsWith('Payments for') || line.startsWith('Other payments')) break;

      const fields = parseCSVLine(line);
      if (fields.length >= 11 && fields[0] && fields[3]) {
        preview.push({
          restaurant_name: fields[0],
          deliveroo_order_id: fields[1],
          delivery_datetime: fields[2],
          history_type: fields[3],
          order_amount: fields[4],
          total_payable: fields[10],
        });
      }
      if (preview.length >= 10) break;
    }
    return preview;
  };

  const handleImport = async () => {
    setStep("importing");
    setIsLoading(true);
    setImportProgress({ current: 0, total: fileValidations.length });

    const results: FileResult[] = [];

    try {
      for (let i = 0; i < fileValidations.length; i++) {
        const fv = fileValidations[i];
        setImportProgress({ current: i + 1, total: fileValidations.length });

        try {
          console.log(`[Deliveroo] Import starting (${i + 1}/${fileValidations.length}): ${fv.file.name}`);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 90_000);

          const { data, error } = await supabase.functions.invoke("parse-deliveroo-statement", {
            body: { csvContent: fv.csvContent, fileName: fv.file.name, dryRun: false },
          });
          clearTimeout(timeout);

          if (error) throw error;

          console.log(`[Deliveroo] Import done: ${fv.file.name}, inserted: ${data.stats?.inserted}`);
          results.push({ fileName: fv.file.name, stats: data.stats, errorDetails: data.errorDetails || [] });

          await supabase.from("csv_imports").insert({
            file_name: fv.file.name,
            file_size: fv.file.size,
            report_type: "deliveroo_statement",
            label: importLabel || null,
            total_rows: data.stats.totalRows,
            inserted_count: data.stats.inserted,
            updated_count: data.stats.updated,
            skipped_count: data.stats.skipped,
            error_count: data.stats.errors,
            status: "completed",
            date_range_start: data.dateRange?.start,
            date_range_end: data.dateRange?.end,
            restaurants_count: data.restaurants?.length || 0,
            restaurant_ids: (data.restaurants || []).map((r: any) => r.id).filter((id: string) => id !== 'unknown'),
          });
        } catch (err: any) {
          console.error(`[Deliveroo] Import error: ${fv.file.name}`, err);
          results.push({
            fileName: fv.file.name,
            stats: { totalRows: fv.stats?.totalRows || 0, inserted: 0, updated: 0, skipped: 0, errors: fv.stats?.totalRows || 0 },
            errorDetails: [err.message],
          });
        }
      }
    } finally {
      setAllResults(results);
      setStep("complete");
      setIsLoading(false);

      const totalInserted = results.reduce((s, r) => s + r.stats.inserted, 0);
      const totalErrors = results.reduce((s, r) => s + r.stats.errors, 0);
      toast({
        title: totalErrors > 0 ? "Import partiel" : "Import réussi",
        description: `${totalInserted} lignes importées depuis ${results.length} fichier(s)`,
        variant: totalErrors > 0 ? "destructive" : "default",
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Aggregated stats across all files
  const allUnmatched = [...new Set(fileValidations.flatMap(fv => fv.unmatchedNames))];
  const totalRows = fileValidations.reduce((s, fv) => s + (fv.stats?.totalRows || 0), 0);
  const allRestaurants = fileValidations.flatMap(fv => fv.restaurants);
  const uniqueRestaurantMap = new Map<string, RestaurantStat>();
  allRestaurants.forEach(r => {
    const existing = uniqueRestaurantMap.get(r.id);
    if (existing) existing.count += r.count;
    else uniqueRestaurantMap.set(r.id, { ...r });
  });
  const mergedRestaurants = Array.from(uniqueRestaurantMap.values());

  return (
    <div className="space-y-6">
      {step !== "upload" && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={resetImport}>Nouveau fichier</Button>
        </div>
      )}

      {/* Upload step */}
      {step === "upload" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Type de rapport
              </CardTitle>
              <CardDescription>Sélectionnez le type de rapport que vous importez</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value="deliveroo_statement" disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deliveroo_statement">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Relevé de paiement</span>
                      <span className="text-xs text-muted-foreground">Facture / Statement depuis Partner Hub</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="space-y-2">
                <Label htmlFor="import-label" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Nom de l'import
                </Label>
                <Input
                  id="import-label"
                  placeholder="Ex: Facture février 2026, Relevé S8..."
                  value={importLabel}
                  onChange={(e) => setImportLabel(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Fichiers CSV
              </CardTitle>
              <CardDescription>Sélectionnez un ou plusieurs fichiers CSV</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isLoading ? (
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  ) : (
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  )}
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Cliquez pour sélectionner</span> ou glissez-déposez
                  </p>
                  <p className="text-xs text-muted-foreground">Plusieurs fichiers CSV acceptés</p>
                </div>
                <input type="file" className="hidden" accept=".csv" multiple onChange={handleFileChange} disabled={isLoading} />
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview & validation step */}
      {step === "preview" && (
        <>
          {allUnmatched.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Restaurants non reconnus</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>Les noms Deliveroo suivants ne sont pas liés à un restaurant :</p>
                <ul className="list-disc list-inside">
                  {allUnmatched.map(name => <li key={name} className="font-mono text-sm">{name}</li>)}
                </ul>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate("/deliveroo-matching")}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Configurer le matching
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Aperçu — {fileValidations.length} fichier{fileValidations.length > 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Global stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{fileValidations.length}</p>
                  <p className="text-xs text-muted-foreground">Fichier(s)</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{totalRows}</p>
                  <p className="text-xs text-muted-foreground">Lignes</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{mergedRestaurants.length}</p>
                  <p className="text-xs text-muted-foreground">Restaurant(s)</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{mergedRestaurants.reduce((s, r) => s + r.count, 0)}</p>
                  <p className="text-xs text-muted-foreground">Commandes</p>
                </div>
              </div>

              {/* Per-file details */}
              <div className="space-y-3">
                {fileValidations.map((fv, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{fv.file.name}</span>
                        <Badge variant="outline" className="shrink-0">{fv.stats?.totalRows || 0} lignes</Badge>
                        {fv.dateRange.start && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDate(fv.dateRange.start)} → {formatDate(fv.dateRange.end)}
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeFile(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {fv.restaurants.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {fv.restaurants.map(r => (
                          <Badge key={r.id} variant={r.id === 'unknown' ? 'destructive' : 'secondary'} className="text-xs">
                            {r.name} ({r.count})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetImport}>Annuler</Button>
                <Button onClick={handleImport} disabled={allUnmatched.length > 0}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer {totalRows} lignes
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Importing step */}
      {step === "importing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Import en cours...</p>
            <p className="text-sm text-muted-foreground">
              Fichier {importProgress.current} / {importProgress.total}
            </p>
            <Progress value={(importProgress.current / importProgress.total) * 100} className="w-64" />
          </CardContent>
        </Card>
      )}

      {/* Complete step */}
      {step === "complete" && allResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {allResults.every(r => r.stats.errors === 0) ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              Import terminé — {allResults.length} fichier{allResults.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Global totals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{allResults.reduce((s, r) => s + r.stats.totalRows, 0)}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{allResults.reduce((s, r) => s + r.stats.inserted, 0)}</p>
                <p className="text-xs text-muted-foreground">Insérées</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{allResults.reduce((s, r) => s + r.stats.updated, 0)}</p>
                <p className="text-xs text-muted-foreground">Mises à jour</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{allResults.reduce((s, r) => s + r.stats.errors, 0)}</p>
                <p className="text-xs text-muted-foreground">Erreurs</p>
              </div>
            </div>

            {/* Per-file results */}
            {allResults.length > 1 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Détail par fichier</h4>
                {allResults.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between border rounded-lg p-3">
                    <span className="text-sm truncate max-w-[250px]">{r.fileName}</span>
                    <div className="flex gap-3 text-sm">
                      <span className="text-green-600">+{r.stats.inserted}</span>
                      <span className="text-blue-600">↻{r.stats.updated}</span>
                      {r.stats.errors > 0 && <span className="text-red-600">✗{r.stats.errors}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {allResults.some(r => r.errorDetails.length > 0) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Détail erreurs</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {allResults.flatMap(r => r.errorDetails).slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button onClick={resetImport}>Importer d'autres fichiers</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
