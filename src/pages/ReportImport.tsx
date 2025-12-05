import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, Eye, Send, History, ShieldCheck, Building2, Calendar, Download, TrendingUp, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import ImportHistory from "@/components/reports/ImportHistory";
import { useQuery } from "@tanstack/react-query";

const REPORT_TYPES = [
  { value: "sales_over_time", label: "Sales Over Time (KPIs officiels)", description: "CA, Commandes, Panier moyen - Source de vérité", icon: TrendingUp },
  { value: "payment_order_level", label: "Informations de paiement (niveau commande)", description: "Détail financier par commande" },
  { value: "payment_item_level", label: "Informations de paiement (niveau articles)", description: "Détail par article commandé" },
  { value: "payout_summary", label: "Récapitulatif des versements", description: "Résumé agrégé par versement" },
];

interface ParsedRow {
  [key: string]: string;
}

interface SkipInfo {
  rowIndex: number;
  reason: string;
  details: string;
}

interface RestaurantStats {
  id: string;
  name: string;
  orderCount: number;
}

interface ValidationData {
  dateRange: {
    start: string | null;
    end: string | null;
  };
  restaurants: RestaurantStats[];
  unknownStoreIds: string[];
  skippedDetails: SkipInfo[];
}

interface ImportResult {
  success: boolean;
  reportType: string;
  dryRun?: boolean;
  stats: {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  validation?: ValidationData;
  errorDetails: string[];
}

export default function ReportImport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("import");
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [reportType, setReportType] = useState<string>("sales_over_time");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "validation" | "importing" | "complete">("upload");

  // Fetch restaurants for selector
  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

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
    setValidationResult(null);

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

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      // Check for Sales Over Time headers
      if (lines[i].includes("Période") && lines[i].includes("Ventes")) {
        headerRowIndex = i;
        break;
      }
      // Check for payment report headers
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

    const headerLine = lines[headerRowIndex];
    const parsedHeaders = parseCSVLine(headerLine);
    setHeaders(parsedHeaders.slice(0, 15));

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

  const handleValidate = async () => {
    if (!csvContent) {
      toast({
        title: "Erreur",
        description: "Aucun fichier à valider",
        variant: "destructive",
      });
      return;
    }

    // For sales_over_time, restaurant selection is required
    if (reportType === "sales_over_time" && !selectedRestaurantId) {
      toast({
        title: "Restaurant requis",
        description: "Veuillez sélectionner un restaurant pour ce type de rapport",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const functionName = reportType === "sales_over_time"
        ? "parse-sales-over-time"
        : reportType === "payment_item_level" 
          ? "parse-item-report" 
          : reportType === "payout_summary"
            ? "parse-payout-summary"
            : "parse-payment-report";
      
      const body: Record<string, any> = {
        csvContent,
        reportType,
        dryRun: true,
      };

      // Add restaurantId for sales_over_time
      if (reportType === "sales_over_time") {
        body.restaurantId = selectedRestaurantId;
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) throw error;

      setValidationResult(data as ImportResult);
      setStep("validation");

      toast({
        title: "Analyse terminée",
        description: "Vérifiez les données avant de confirmer l'import",
      });
    } catch (error: any) {
      console.error("Validation error:", error);
      toast({
        title: "Erreur d'analyse",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFileToStorage = async (): Promise<string | null> => {
    if (!file) return null;

    try {
      const timestamp = Date.now();
      const filePath = `${reportType}/${timestamp}_${file.name}`;
      
      const { error } = await supabase.storage
        .from("csv-imports")
        .upload(filePath, file);

      if (error) {
        console.error("Storage upload error:", error);
        return null;
      }

      return filePath;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const saveImportRecord = async (
    fileUrl: string | null,
    result: ImportResult
  ) => {
    try {
      const { error } = await supabase.from("csv_imports").insert({
        file_name: file?.name || "unknown.csv",
        file_size: file?.size || 0,
        report_type: reportType,
        total_rows: result.stats.totalRows,
        inserted_count: result.stats.inserted,
        updated_count: result.stats.updated,
        skipped_count: result.stats.skipped,
        error_count: result.stats.errors,
        file_url: fileUrl,
        status: result.success ? (result.stats.errors > 0 ? "partial" : "completed") : "failed",
        date_range_start: result.validation?.dateRange?.start || null,
        date_range_end: result.validation?.dateRange?.end || null,
        restaurants_count: result.validation?.restaurants?.length || 0,
        restaurant_ids: result.validation?.restaurants?.map(r => r.id) || [],
      });

      if (error) {
        console.error("Error saving import record:", error);
      }
    } catch (error) {
      console.error("Error saving import record:", error);
    }
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
      const fileUrl = await uploadFileToStorage();

      const functionName = reportType === "sales_over_time"
        ? "parse-sales-over-time"
        : reportType === "payment_item_level" 
          ? "parse-item-report" 
          : reportType === "payout_summary"
            ? "parse-payout-summary"
            : "parse-payment-report";
      
      const body: Record<string, any> = {
        csvContent,
        reportType,
        dryRun: false,
      };

      // Add restaurantId for sales_over_time
      if (reportType === "sales_over_time") {
        body.restaurantId = selectedRestaurantId;
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) throw error;

      const importData = data as ImportResult;
      setImportResult(importData);
      setStep("complete");

      await saveImportRecord(fileUrl, importData);

      if (importData.success) {
        const statsMessage = reportType === "sales_over_time"
          ? `${importData.stats?.inserted || 0} jours de données importés`
          : reportType === "payment_item_level"
            ? `${importData.stats?.inserted || 0} articles insérés, ${importData.stats?.updated || 0} mis à jour`
            : reportType === "payout_summary"
              ? `${importData.stats?.inserted || 0} versements importés`
              : `${importData.stats?.inserted || 0} commandes insérées, ${importData.stats?.updated || 0} mises à jour`;
        toast({
          title: "Import réussi",
          description: statsMessage,
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
      
      if (file) {
        await saveImportRecord(null, {
          success: false,
          reportType,
          stats: { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 1 },
          errorDetails: [error.message],
        });
      }

      toast({
        title: "Erreur d'import",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
      setStep("validation");
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
    setValidationResult(null);
    setSelectedRestaurantId("");
    setStep("upload");
  };

  const downloadSkippedRows = () => {
    if (!validationResult?.validation?.skippedDetails) return;
    
    const csvContent = [
      "Ligne,Raison,Détails",
      ...validationResult.validation.skippedDetails.map(s => 
        `${s.rowIndex},"${s.reason}","${s.details.replace(/"/g, '""')}"`
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lignes_ignorees_${file?.name || "import"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  const getSkipReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      "restaurant_not_found": "Restaurant non trouvé",
      "no_order_id": "Sans ID commande",
      "context_missing": "Contexte parent manquant",
    };
    return labels[reason] || reason;
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
        <Button 
          variant="outline" 
          onClick={() => navigate("/import-guide")}
          className="gap-2"
        >
          <BookOpen className="h-4 w-4" />
          Guide d'import
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Importer
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6 mt-6">
          {step !== "upload" && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={resetImport}>
                Nouveau fichier
              </Button>
            </div>
          )}

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
              <span className="font-medium">Aperçu</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 ${step === "validation" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === "validation" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                3
              </div>
              <span className="font-medium">Validation</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 ${step === "importing" || step === "complete" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === "importing" || step === "complete" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                4
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
                <CardContent className="space-y-4">
                  <Select value={reportType} onValueChange={(value) => {
                    setReportType(value);
                    setSelectedRestaurantId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              {type.icon && <type.icon className="h-4 w-4 text-primary" />}
                              {type.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Restaurant selector for Sales Over Time */}
                  {reportType === "sales_over_time" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Restaurant concerné *</label>
                      <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un restaurant" />
                        </SelectTrigger>
                        <SelectContent>
                          {restaurants.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              <span>{r.name}</span>
                              {r.city && <span className="text-muted-foreground ml-1">({r.city})</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Ce rapport ne contient pas d'identifiant restaurant, sélectionnez celui concerné.
                      </p>
                    </div>
                  )}

                  {reportType === "sales_over_time" ? (
                    <Alert className="bg-primary/5 border-primary/20">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <AlertTitle className="text-primary">Source de vérité KPIs</AlertTitle>
                      <AlertDescription>
                        Ce rapport contient les données officielles Uber Eats : CA, Commandes et Panier moyen.
                        Il sert de référence pour tous les KPIs agrégés.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Types supportés</AlertTitle>
                      <AlertDescription>
                        Les rapports "niveau commande" et "niveau articles" sont supportés.
                        Importez d'abord les commandes avant les articles pour permettre la liaison.
                      </AlertDescription>
                    </Alert>
                  )}
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
                  Aperçu des données
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
                  <Button onClick={handleValidate} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Analyser avant import
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "validation" && validationResult && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Validation de l'import
                  </CardTitle>
                  <CardDescription>
                    Vérifiez les informations avant de confirmer l'import définitif
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Stats preview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{validationResult.stats.totalRows}</p>
                      <p className="text-sm text-muted-foreground">Lignes totales</p>
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{validationResult.stats.inserted}</p>
                      <p className="text-sm text-muted-foreground">À insérer</p>
                    </div>
                    <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{validationResult.stats.updated}</p>
                      <p className="text-sm text-muted-foreground">À mettre à jour</p>
                    </div>
                    <div className="p-4 bg-amber-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-600">{validationResult.stats.skipped}</p>
                      <p className="text-sm text-muted-foreground">À ignorer</p>
                    </div>
                  </div>

                  {/* Date range */}
                  {validationResult.validation?.dateRange && (
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Période des données</p>
                        <p className="text-sm text-muted-foreground">
                          Du {formatDate(validationResult.validation.dateRange.start)} au {formatDate(validationResult.validation.dateRange.end)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Restaurants */}
                  {validationResult.validation?.restaurants && validationResult.validation.restaurants.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <p className="font-medium">{validationResult.validation.restaurants.length} restaurant(s) concerné(s)</p>
                      </div>
                      <div className="border rounded-lg overflow-auto max-h-[200px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Restaurant</TableHead>
                              <TableHead className="text-right">Commandes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationResult.validation.restaurants.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">{r.name}</TableCell>
                                <TableCell className="text-right">{r.orderCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Unknown store IDs warning */}
                  {validationResult.validation?.unknownStoreIds && validationResult.validation.unknownStoreIds.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Restaurants non configurés</AlertTitle>
                      <AlertDescription>
                        <p className="mb-2">
                          {validationResult.validation.unknownStoreIds.length} uber_store_id(s) non trouvé(s) dans la base :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {validationResult.validation.unknownStoreIds.slice(0, 10).map((id) => (
                            <Badge key={id} variant="outline" className="font-mono text-xs">
                              {id}
                            </Badge>
                          ))}
                          {validationResult.validation.unknownStoreIds.length > 10 && (
                            <Badge variant="outline">+{validationResult.validation.unknownStoreIds.length - 10} autres</Badge>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Skipped details */}
                  {validationResult.validation?.skippedDetails && validationResult.validation.skippedDetails.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-amber-600">
                          {validationResult.stats.skipped} ligne(s) ignorée(s)
                        </p>
                        <Button variant="outline" size="sm" onClick={downloadSkippedRows}>
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger
                        </Button>
                      </div>
                      <div className="border rounded-lg overflow-auto max-h-[200px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Ligne</TableHead>
                              <TableHead>Raison</TableHead>
                              <TableHead>Détails</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationResult.validation.skippedDetails.slice(0, 20).map((s, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">{s.rowIndex}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {getSkipReasonLabel(s.reason)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{s.details}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {validationResult.validation.skippedDetails.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Et {validationResult.validation.skippedDetails.length - 20} autres lignes ignorées...
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={resetImport}>
                      Annuler
                    </Button>
                    <Button variant="outline" onClick={() => setStep("preview")}>
                      Retour à l'aperçu
                    </Button>
                    <Button onClick={handleImport} disabled={isLoading}>
                      <Send className="h-4 w-4 mr-2" />
                      Confirmer l'import
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
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

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("history")}>
                    <History className="h-4 w-4 mr-2" />
                    Voir l'historique
                  </Button>
                  <Button onClick={resetImport}>Importer un autre fichier</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ImportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
