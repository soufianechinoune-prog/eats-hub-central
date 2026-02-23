import { useState } from "react";
import { Upload, CheckCircle, AlertTriangle, Loader2, Calendar, History, Building2, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export default function DeliverooImportTab({ restaurants }: DeliverooImportTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [detectedRestaurants, setDetectedRestaurants] = useState<string[]>([]);
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
  const [validationStats, setValidationStats] = useState<ImportStats | null>(null);
  const [validationRestaurants, setValidationRestaurants] = useState<RestaurantStat[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [importResult, setImportResult] = useState<{ stats: ImportStats; errorDetails: string[] } | null>(null);

  const resetImport = () => {
    setFile(null);
    setCsvContent("");
    setStep("upload");
    setPreviewRows([]);
    setDetectedRestaurants([]);
    setUnmatchedNames([]);
    setValidationStats(null);
    setValidationRestaurants([]);
    setDateRange({ start: null, end: null });
    setImportResult(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({ title: "Format invalide", description: "Veuillez sélectionner un fichier CSV", variant: "destructive" });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      await validateFile(content, selectedFile.name);
    };
    reader.readAsText(selectedFile);
  };

  const validateFile = async (content: string, fileName: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-deliveroo-statement", {
        body: { csvContent: content, fileName, dryRun: true },
      });

      if (error) throw error;

      setValidationStats(data.stats);
      setValidationRestaurants(data.restaurants || []);
      setUnmatchedNames(data.unmatchedNames || []);
      setDateRange(data.dateRange || { start: null, end: null });

      // Build preview from first lines
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
        if (preview.length >= 20) break;
      }
      setPreviewRows(preview);

      // Detect unique restaurant names
      const names = [...new Set(preview.map(r => r.restaurant_name))];
      setDetectedRestaurants(names);

      setStep("preview");
    } catch (err: any) {
      toast({ title: "Erreur de validation", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!csvContent || !file) return;

    setStep("importing");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("parse-deliveroo-statement", {
        body: { csvContent, fileName: file.name, dryRun: false },
      });

      if (error) throw error;

      setImportResult({ stats: data.stats, errorDetails: data.errorDetails || [] });

      // Save import record
      await supabase.from("csv_imports").insert({
        file_name: file.name,
        file_size: file.size,
        report_type: "deliveroo_statement",
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

      setStep("complete");

      toast({
        title: data.stats.errors > 0 ? "Import partiel" : "Import réussi",
        description: `${data.stats.inserted} lignes importées`,
        variant: data.stats.errors > 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({ title: "Erreur d'import", description: err.message, variant: "destructive" });
      setStep("preview");
    } finally {
      setIsLoading(false);
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

  return (
    <div className="space-y-6">
      {step !== "upload" && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={resetImport}>Nouveau fichier</Button>
        </div>
      )}

      {/* Upload step */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <img src={deliverooLogo} alt="Deliveroo" className="h-6 w-6 object-contain" />
              Relevé de paiement Deliveroo
            </CardTitle>
            <CardDescription>
              Importez le fichier CSV "statement" téléchargé depuis Deliveroo Partner Hub
            </CardDescription>
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
                <p className="text-xs text-muted-foreground">Fichier CSV uniquement</p>
              </div>
              <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} disabled={isLoading} />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Preview & validation step */}
      {step === "preview" && (
        <>
          {/* Unmatched restaurants warning */}
          {unmatchedNames.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Restaurants non reconnus</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>Les noms Deliveroo suivants ne sont pas liés à un restaurant :</p>
                <ul className="list-disc list-inside">
                  {unmatchedNames.map(name => <li key={name} className="font-mono text-sm">{name}</li>)}
                </ul>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate("/deliveroo-matching")}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Configurer le matching
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Aperçu du relevé
              </CardTitle>
              <CardDescription>{file?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{validationStats?.totalRows || 0}</p>
                  <p className="text-xs text-muted-foreground">Lignes</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{validationRestaurants.length}</p>
                  <p className="text-xs text-muted-foreground">Restaurant(s)</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-sm font-medium">{formatDate(dateRange.start)}</p>
                  <p className="text-xs text-muted-foreground">Début</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-sm font-medium">{formatDate(dateRange.end)}</p>
                  <p className="text-xs text-muted-foreground">Fin</p>
                </div>
              </div>

              {/* Restaurant breakdown */}
              {validationRestaurants.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Restaurants détectés</h4>
                  <div className="flex flex-wrap gap-2">
                    {validationRestaurants.map(r => (
                      <Badge key={r.id} variant={r.id === 'unknown' ? 'destructive' : 'secondary'}>
                        {r.name} ({r.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {previewRows.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        <TableHead>N° commande</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="max-w-[200px] truncate text-sm">{row.restaurant_name}</TableCell>
                          <TableCell className="font-mono text-xs">{row.deliveroo_order_id}</TableCell>
                          <TableCell className="text-sm">{row.delivery_datetime?.split(' ')[0] || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{row.history_type}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{row.order_amount || '—'}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{row.total_payable || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetImport}>Annuler</Button>
                <Button onClick={handleImport} disabled={unmatchedNames.length > 0}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer {validationStats?.totalRows || 0} lignes
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Importing step */}
      {step === "importing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg font-medium">Import en cours...</p>
            <p className="text-sm text-muted-foreground">{file?.name}</p>
          </CardContent>
        </Card>
      )}

      {/* Complete step */}
      {step === "complete" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.stats.errors === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              Import terminé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{importResult.stats.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{importResult.stats.inserted}</p>
                <p className="text-xs text-muted-foreground">Insérées</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{importResult.stats.updated}</p>
                <p className="text-xs text-muted-foreground">Mises à jour</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{importResult.stats.errors}</p>
                <p className="text-xs text-muted-foreground">Erreurs</p>
              </div>
            </div>

            {importResult.errorDetails.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Détail erreurs</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {importResult.errorDetails.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button onClick={resetImport}>Importer un autre fichier</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
