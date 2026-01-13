import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, Send, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

// Required report types for a complete import
const REQUIRED_REPORT_TYPES = [
  { value: "sales_over_time", label: "Sales Over Time", theme: "Ventes & Finances", priority: 1 },
  { value: "payment_order_level", label: "Informations paiement (commande)", theme: "Ventes & Finances", priority: 2 },
  { value: "payment_item_level", label: "Informations paiement (articles)", theme: "Ventes & Finances", priority: 3 },
  { value: "payout_summary", label: "Récapitulatif versements", theme: "Ventes & Finances", priority: 4 },
  { value: "marketing_campaigns", label: "Campagnes Marketing", theme: "Marketing & Conversion", priority: 5 },
  { value: "conversion_funnel", label: "Tunnel de conversion", theme: "Marketing & Conversion", priority: 6 },
  { value: "reviews_order", label: "Avis par commande", theme: "Avis Clients", priority: 7 },
  { value: "reviews_item", label: "Avis par produit", theme: "Avis Clients", priority: 8 },
  { value: "downtime_report", label: "Temps d'inactivité", theme: "Opérations", priority: 9 },
  { value: "order_history", label: "Historique commandes", theme: "Opérations", priority: 10 },
  { value: "inaccurate_orders", label: "Commandes incorrectes", theme: "Opérations", priority: 11 },
  { value: "order_accuracy_summary", label: "Résumé commandes incorrectes", theme: "Opérations", priority: 12 },
  { value: "item_issues_leaderboard", label: "Top articles problématiques", theme: "Opérations", priority: 13 },
];

interface BatchFile {
  file: File;
  content: string;
  detectedType: string | null;
  detectedTypeLabel: string | null;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
  result?: any;
}

interface BatchRestaurantImportProps {
  onComplete?: () => void;
}

export default function BatchRestaurantImport({ onComplete }: BatchRestaurantImportProps) {
  const { toast } = useToast();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [step, setStep] = useState<"select" | "preview" | "importing" | "complete">("select");
  const [isLoading, setIsLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // Fetch restaurants
  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-for-batch-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, uber_store_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-detect report type based on CSV headers
  const detectReportType = (headerLine: string): { type: string | null; label: string | null } => {
    // Marketing campaigns - Offers
    if (headerLine.includes("Type d'offre") && headerLine.includes("Audience")) {
      return { type: "marketing_campaigns", label: "Campagnes Marketing" };
    }
    // Marketing campaigns - Ads
    if (headerLine.includes("Nom de la campagne") && headerLine.includes("Impressions")) {
      return { type: "marketing_campaigns", label: "Campagnes Marketing" };
    }
    // Sales Over Time
    if (headerLine.includes("Période") && headerLine.includes("Ventes")) {
      return { type: "sales_over_time", label: "Sales Over Time" };
    }
    // Reviews Order Level
    if ((headerLine.includes("Note du restaurant") || headerLine.includes("restaurant rating")) && 
        (headerLine.includes("UUID de la commande") || headerLine.includes("Order UUID"))) {
      return { type: "reviews_order", label: "Avis par commande" };
    }
    // Reviews Item Level
    if ((headerLine.includes("Note de l'article") || headerLine.includes("Item rating")) && 
        (headerLine.includes("Titre de l'article") || headerLine.includes("Item title"))) {
      return { type: "reviews_item", label: "Avis par produit" };
    }
    // Downtime Report
    if (headerLine.includes("Ouverture du restaurant à") && headerLine.includes("Disponibilité du menu")) {
      return { type: "downtime_report", label: "Temps d'inactivité" };
    }
    // Order History
    if ((headerLine.includes("Id. de la commande") || headerLine.includes("Id de la commande")) && 
        (headerLine.includes("Temps d'attente du coursier") || headerLine.includes("Heure de la commande"))) {
      return { type: "order_history", label: "Historique commandes" };
    }
    // Inaccurate Orders (detail)
    if ((headerLine.includes("Problème avec la commande") || headerLine.includes("Articles incorrects")) &&
        headerLine.includes("Client remboursé")) {
      return { type: "inaccurate_orders", label: "Commandes incorrectes" };
    }
    // Item Issues Leaderboard
    if (headerLine.includes("Articles incorrects") && headerLine.includes("Nombre") &&
        headerLine.includes("Problème avec le plat")) {
      return { type: "item_issues_leaderboard", label: "Top articles problématiques" };
    }
    // Order Accuracy Summary
    if ((headerLine.includes("Jour") || headerLine.includes("Mois")) && 
        (headerLine.includes("Commandes incorrectes") || headerLine.includes("Articles manquants"))) {
      return { type: "order_accuracy_summary", label: "Résumé commandes incorrectes" };
    }
    // Conversion Funnel
    if ((headerLine.includes("Utilisateurs ayant visité") || headerLine.includes("Utilisateurs ayant visite")) &&
        (headerLine.includes("menu a été consulté") || headerLine.includes("menu consulté") || headerLine.includes("Plat ajouté"))) {
      return { type: "conversion_funnel", label: "Tunnel de conversion" };
    }
    // Payout Summary
    if (headerLine.includes("Identifiant de versement") || headerLine.includes("Date de versement")) {
      return { type: "payout_summary", label: "Récapitulatif versements" };
    }
    // Payment reports (default fallback for order/item level)
    if (headerLine.includes("Id. de la commande") || headerLine.includes("Id. du flux")) {
      if (headerLine.includes("Titre de l'article") || headerLine.includes("Item title")) {
        return { type: "payment_item_level", label: "Informations paiement (articles)" };
      }
      return { type: "payment_order_level", label: "Informations paiement (commande)" };
    }
    return { type: null, label: null };
  };

  // Find header row and detect type
  const analyzeFile = (content: string): { type: string | null; label: string | null } => {
    const lines = content.split("\n").filter(l => l.trim());
    
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i];
      const detected = detectReportType(line);
      if (detected.type) {
        return detected;
      }
    }
    return { type: null, label: null };
  };

  // Handle file drop/selection
  const handleFilesChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).slice(0, 15); // Max 15 files
    
    // Validate all are CSV
    const invalidFile = fileArray.find(f => !f.name.endsWith(".csv"));
    if (invalidFile) {
      toast({
        title: "Format invalide",
        description: `Le fichier "${invalidFile.name}" n'est pas un CSV`,
        variant: "destructive",
      });
      return;
    }

    // Read all files and detect types
    const batchFilesPromises = fileArray.map(async (file): Promise<BatchFile> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const detected = analyzeFile(content);
          resolve({
            file,
            content,
            detectedType: detected.type,
            detectedTypeLabel: detected.label,
            status: "pending",
          });
        };
        reader.readAsText(file);
      });
    });

    const loadedFiles = await Promise.all(batchFilesPromises);
    setBatchFiles(loadedFiles);
    setStep("preview");
  }, [toast]);

  // Get detected and missing types
  const detectedTypes = batchFiles
    .filter(f => f.detectedType)
    .map(f => f.detectedType!);
  
  const missingTypes = REQUIRED_REPORT_TYPES.filter(
    rt => !detectedTypes.includes(rt.value)
  );

  const filesGroupedByTheme = REQUIRED_REPORT_TYPES.reduce((acc, rt) => {
    if (!acc[rt.theme]) acc[rt.theme] = [];
    const matchingFile = batchFiles.find(f => f.detectedType === rt.value);
    acc[rt.theme].push({
      ...rt,
      file: matchingFile,
      isDetected: !!matchingFile,
    });
    return acc;
  }, {} as Record<string, Array<typeof REQUIRED_REPORT_TYPES[0] & { file?: BatchFile; isDetected: boolean }>>);

  // Handle batch import
  const handleBatchImport = async () => {
    if (!selectedRestaurantId) {
      toast({
        title: "Restaurant requis",
        description: "Veuillez sélectionner un restaurant",
        variant: "destructive",
      });
      return;
    }

    const filesToImport = batchFiles.filter(f => f.detectedType);
    if (filesToImport.length === 0) {
      toast({
        title: "Aucun fichier valide",
        description: "Aucun fichier n'a pu être détecté",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    setIsLoading(true);
    setBatchProgress(0);

    const results: BatchFile[] = [...batchFiles];
    let successCount = 0;
    let errorCount = 0;

    // Function map for edge functions
    const functionMap: Record<string, string> = {
      sales_over_time: "parse-sales-over-time",
      payment_order_level: "parse-payment-report",
      payment_item_level: "parse-item-report",
      payout_summary: "parse-payout-summary",
      marketing_campaigns: "parse-marketing-campaigns",
      reviews_order: "parse-reviews-order",
      reviews_item: "parse-reviews-item",
      downtime_report: "parse-downtime-report",
      order_history: "parse-order-history",
      inaccurate_orders: "parse-inaccurate-orders",
      order_accuracy_summary: "parse-order-accuracy-summary",
      item_issues_leaderboard: "parse-item-issues-leaderboard",
      conversion_funnel: "parse-conversion-report",
    };

    // Process files with detected types
    const filesToProcess = results.filter(f => f.detectedType);
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const currentFile = filesToProcess[i];
      const idx = results.findIndex(r => r.file.name === currentFile.file.name);
      
      results[idx].status = "processing";
      setBatchFiles([...results]);

      try {
        const functionName = functionMap[currentFile.detectedType!] || "parse-payment-report";
        
        const body: Record<string, any> = {
          csvContent: currentFile.content,
          reportType: currentFile.detectedType,
          dryRun: false,
          fileName: currentFile.file.name,
          restaurantId: selectedRestaurantId,
        };

        const { data, error } = await supabase.functions.invoke(functionName, { body });

        if (error) throw error;

        results[idx].status = "success";
        results[idx].result = data;
        successCount++;

        // Save import record
        await supabase.from("csv_imports").insert({
          file_name: currentFile.file.name,
          file_size: currentFile.file.size,
          report_type: currentFile.detectedType,
          total_rows: data.stats?.totalRows || 0,
          inserted_count: data.stats?.inserted || 0,
          updated_count: data.stats?.updated || 0,
          skipped_count: data.stats?.skipped || 0,
          error_count: data.stats?.errors || 0,
          status: "completed",
          date_range_start: data.validation?.dateRange?.start || null,
          date_range_end: data.validation?.dateRange?.end || null,
          restaurants_count: 1,
          restaurant_ids: [selectedRestaurantId],
        });

      } catch (error: any) {
        results[idx].status = "error";
        results[idx].error = error.message || "Erreur d'import";
        errorCount++;
      }

      setBatchFiles([...results]);
      setBatchProgress(((i + 1) / filesToProcess.length) * 100);
    }

    setStep("complete");
    setIsLoading(false);

    toast({
      title: successCount === filesToProcess.length ? "Import terminé" : "Import partiel",
      description: `${successCount}/${filesToProcess.length} fichiers importés avec succès`,
      variant: successCount === filesToProcess.length ? "default" : "destructive",
    });
  };

  const resetImport = () => {
    setBatchFiles([]);
    setBatchProgress(0);
    setStep("select");
  };

  const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);

  return (
    <div className="space-y-6">
      {/* Restaurant selector - always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            1. Sélectionner le restaurant
          </CardTitle>
          <CardDescription>
            Tous les fichiers seront importés pour ce restaurant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
            <SelectTrigger className={`w-full max-w-md ${!selectedRestaurantId ? 'border-primary ring-1 ring-primary' : ''}`}>
              <SelectValue placeholder="Sélectionner un restaurant" />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="font-medium">{r.name}</span>
                  {r.city && <span className="text-muted-foreground ml-1">({r.city})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* File upload area */}
      {step === "select" && selectedRestaurantId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              2. Déposer les fichiers CSV
            </CardTitle>
            <CardDescription>
              Glissez tous les fichiers CSV pour {selectedRestaurant?.name} (max 15 fichiers)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="batch-csv-upload"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Cliquez pour sélectionner</span> ou glissez-déposez
                </p>
                <p className="text-xs text-muted-foreground">
                  Jusqu'à 15 fichiers CSV (tous types de rapports)
                </p>
              </div>
              <input
                id="batch-csv-upload"
                type="file"
                className="hidden"
                accept=".csv"
                multiple
                onChange={handleFilesChange}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Preview with checklist */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Fichiers détectés : {batchFiles.filter(f => f.detectedType).length}/{REQUIRED_REPORT_TYPES.length}
                </CardTitle>
                <CardDescription>
                  {missingTypes.length > 0 
                    ? `${missingTypes.length} type(s) manquant(s) - l'import reste possible`
                    : "Tous les types de fichiers sont présents ✓"
                  }
                </CardDescription>
              </div>
              <Button variant="outline" onClick={resetImport}>
                Recommencer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Grouped checklist by theme */}
            {Object.entries(filesGroupedByTheme).map(([theme, items]) => (
              <div key={theme} className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">{theme}</h4>
                <div className="grid gap-2">
                  {items.map((item) => (
                    <div
                      key={item.value}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        item.isDetected 
                          ? "bg-green-500/5 border-green-500/20" 
                          : "bg-muted/30 border-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.isDetected ? (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${!item.isDetected && "text-muted-foreground"}`}>
                            {item.label}
                          </p>
                          {item.file && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {item.file.file.name}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.isDetected ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          Détecté
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Manquant
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Unknown files warning */}
            {batchFiles.filter(f => !f.detectedType).length > 0 && (
              <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-600">
                  {batchFiles.filter(f => !f.detectedType).length} fichier(s) non reconnu(s)
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    {batchFiles.filter(f => !f.detectedType).map((f, idx) => (
                      <li key={idx}>{f.file.name}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Missing files info */}
            {missingTypes.length > 0 && (
              <Alert className="bg-amber-500/5 border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-600">
                  {missingTypes.length} type(s) manquant(s)
                </AlertTitle>
                <AlertDescription className="text-sm">
                  Vous pourrez les importer plus tard. Types manquants : {missingTypes.map(t => t.label).join(", ")}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetImport}>
                Annuler
              </Button>
              <Button 
                onClick={handleBatchImport} 
                disabled={!selectedRestaurantId || batchFiles.filter(f => f.detectedType).length === 0 || isLoading}
              >
                <Send className="h-4 w-4 mr-2" />
                Importer {batchFiles.filter(f => f.detectedType).length} fichier(s)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing progress */}
      {step === "importing" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="text-lg font-medium">Import en cours...</h3>
                <p className="text-sm text-muted-foreground">
                  {batchFiles.filter(f => f.status === "success").length}/{batchFiles.filter(f => f.detectedType).length} fichiers traités
                </p>
              </div>
              <Progress value={batchProgress} className="w-64" />
              
              {/* Live status */}
              <div className="mt-4 w-full max-w-md space-y-2">
                {batchFiles.filter(f => f.detectedType).map((bf, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-2 text-sm ${
                      bf.status === "processing" ? "text-primary font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {bf.status === "pending" && <div className="w-4 h-4 rounded-full border-2" />}
                    {bf.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {bf.status === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {bf.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="truncate">{bf.detectedTypeLabel || bf.file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete summary */}
      {step === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {batchFiles.filter(f => f.status === "error").length === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              Import terminé pour {selectedRestaurant?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{batchFiles.filter(f => f.detectedType).length}</p>
                <p className="text-sm text-muted-foreground">Fichiers traités</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {batchFiles.filter(f => f.status === "success").length}
                </p>
                <p className="text-sm text-muted-foreground">Réussis</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">
                  {batchFiles.filter(f => f.status === "error").length}
                </p>
                <p className="text-sm text-muted-foreground">Erreurs</p>
              </div>
              <div className="p-4 bg-amber-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-600">{missingTypes.length}</p>
                <p className="text-sm text-muted-foreground">Types manquants</p>
              </div>
            </div>

            {/* Error details */}
            {batchFiles.filter(f => f.status === "error").length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Fichiers en erreur</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    {batchFiles.filter(f => f.status === "error").map((bf, idx) => (
                      <li key={idx}>
                        <strong>{bf.detectedTypeLabel || bf.file.name}</strong>: {bf.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Missing types reminder */}
            {missingTypes.length > 0 && (
              <Alert className="bg-amber-500/5 border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-600">Types non importés</AlertTitle>
                <AlertDescription className="text-sm">
                  {missingTypes.map(t => t.label).join(", ")}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button onClick={() => {
                resetImport();
                onComplete?.();
              }}>
                Importer un autre restaurant
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
