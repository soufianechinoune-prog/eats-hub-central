import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, Eye, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const REPORT_TYPES = [
  { value: "payment_order_level", label: "Informations de paiement (niveau commande)", description: "Détail financier par commande" },
  { value: "payment_item_level", label: "Informations de paiement (niveau articles)", description: "Détail par article commandé" },
  { value: "payout_summary", label: "Récapitulatif des versements", description: "Résumé des versements Uber" },
];

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  success: boolean;
  reportType: string;
  stats: {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  errorDetails: string[];
}

export default function ReportImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [reportType, setReportType] = useState<string>("payment_order_level");
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier CSV",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      parsePreview(content);
    };
    reader.readAsText(selectedFile);
  };

  const parsePreview = (content: string) => {
    const lines = content.split("\n").filter((line) => line.trim());
    if (lines.length < 3) {
      toast({
        title: "Fichier invalide",
        description: "Le fichier CSV semble vide ou mal formaté",
        variant: "destructive",
      });
      return;
    }

    // Find header row (contains "Id. de la commande" or similar)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (
        lines[i].includes("Id. de la commande") ||
        lines[i].includes("Id. du flux") ||
        lines[i].includes("Nom du restaurant")
      ) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      toast({
        title: "Format non reconnu",
        description: "Impossible de trouver les en-têtes du rapport",
        variant: "destructive",
      });
      return;
    }

    // Parse headers
    const headerLine = lines[headerRowIndex];
    const parsedHeaders = parseCSVLine(headerLine);
    setHeaders(parsedHeaders.slice(0, 15)); // Limit for preview

    // Parse data rows (first 50 for preview)
    const dataLines = lines.slice(headerRowIndex + 1, headerRowIndex + 51);
    const rows: ParsedRow[] = [];

    for (const line of dataLines) {
      const values = parseCSVLine(line);
      if (values.length < 3) continue;

      const row: ParsedRow = {};
      parsedHeaders.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });
      rows.push(row);
    }

    setPreviewData(rows);
    setStep("preview");
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
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

  const handleImport = async () => {
    if (!csvContent) {
      toast({
        title: "Erreur",
        description: "Aucun fichier à importer",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("parse-payment-report", {
        body: {
          csvContent,
          reportType,
        },
      });

      if (error) throw error;

      setImportResult(data as ImportResult);
      setStep("complete");

      if (data.success) {
        toast({
          title: "Import réussi",
          description: `${data.stats.inserted} commandes insérées, ${data.stats.updated} mises à jour`,
        });
      } else {
        toast({
          title: "Import terminé avec erreurs",
          description: data.error || "Certaines lignes n'ont pas pu être importées",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Erreur d'import",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setCsvContent("");
    setPreviewData([]);
    setHeaders([]);
    setImportResult(null);
    setStep("upload");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import des rapports Uber Eats</h1>
          <p className="text-muted-foreground mt-1">
            Importez vos rapports CSV pour alimenter automatiquement la base de données
          </p>
        </div>
        {step !== "upload" && (
          <Button variant="outline" onClick={resetImport}>
            Nouveau fichier
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === "upload" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === "upload" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span className="font-medium">Upload</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className={`flex items-center gap-2 ${step === "preview" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === "preview" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span className="font-medium">Prévisualisation</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className={`flex items-center gap-2 ${step === "importing" || step === "complete" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === "importing" || step === "complete" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            3
          </div>
          <span className="font-medium">Import</span>
        </div>
      </div>

      {step === "upload" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Type de rapport
              </CardTitle>
              <CardDescription>Sélectionnez le type de rapport que vous importez</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Seul le rapport "Informations de paiement (niveau commande)" est actuellement supporté.
                  Les autres types seront ajoutés prochainement.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Fichier CSV
              </CardTitle>
              <CardDescription>Glissez-déposez ou sélectionnez votre fichier</CardDescription>
            </CardHeader>
            <CardContent>
              <label
                htmlFor="csv-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Cliquez pour sélectionner</span> ou glissez-déposez
                  </p>
                  <p className="text-xs text-muted-foreground">Fichier CSV uniquement</p>
                </div>
                <input
                  id="csv-upload"
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </label>

              {file && (
                <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} Ko
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévisualisation des données
            </CardTitle>
            <CardDescription>
              {previewData.length} lignes détectées (affichage des 50 premières)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                {headers.length} colonnes
              </Badge>
              <Badge variant="outline" className="text-sm">
                {previewData.length} lignes prévisualisées
              </Badge>
            </div>

            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    {headers.map((header, idx) => (
                      <TableHead key={idx} className="whitespace-nowrap text-xs">
                        {header.length > 25 ? header.slice(0, 25) + "..." : header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {headers.map((header, cellIdx) => (
                        <TableCell key={cellIdx} className="text-xs whitespace-nowrap">
                          {(row[header] || "").length > 30
                            ? (row[header] || "").slice(0, 30) + "..."
                            : row[header] || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetImport}>
                Annuler
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                <Send className="h-4 w-4 mr-2" />
                Lancer l'import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="text-lg font-medium">Import en cours...</h3>
                <p className="text-sm text-muted-foreground">
                  Traitement du fichier, veuillez patienter
                </p>
              </div>
              <Progress value={undefined} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === "complete" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {importResult.success ? "Import réussi" : "Import terminé avec erreurs"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{importResult.stats.totalRows}</p>
                <p className="text-sm text-muted-foreground">Lignes totales</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{importResult.stats.inserted}</p>
                <p className="text-sm text-muted-foreground">Insérées</p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{importResult.stats.updated}</p>
                <p className="text-sm text-muted-foreground">Mises à jour</p>
              </div>
              <div className="p-4 bg-amber-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-600">{importResult.stats.skipped}</p>
                <p className="text-sm text-muted-foreground">Ignorées</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{importResult.stats.errors}</p>
                <p className="text-sm text-muted-foreground">Erreurs</p>
              </div>
            </div>

            {importResult.errorDetails && importResult.errorDetails.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Détail des erreurs</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    {importResult.errorDetails.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={resetImport}>Importer un autre fichier</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
