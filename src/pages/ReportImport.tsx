import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, Eye, Send, History, ShieldCheck, Building2, Calendar, Download, TrendingUp, BookOpen, Megaphone, Star, MessageSquare, Clock, HelpCircle, Trash2, Package } from "lucide-react";
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
import BatchRestaurantImport from "@/components/reports/BatchRestaurantImport";
import { useQuery } from "@tanstack/react-query";

// Report types organized by theme
const REPORT_THEMES = [
  {
    id: "sales",
    label: "Ventes & Finances",
    icon: TrendingUp,
    types: [
      { value: "sales_over_time", label: "Sales Over Time (KPIs officiels)", description: "CA, Commandes, Panier moyen - Source de vérité", icon: TrendingUp },
      { value: "payment_order_level", label: "Informations de paiement (niveau commande)", description: "Détail financier par commande" },
      { value: "payment_item_level", label: "Informations de paiement (niveau articles)", description: "Détail par article commandé" },
      { value: "payout_summary", label: "Récapitulatif des versements", description: "Résumé agrégé par versement" },
    ]
  },
  {
    id: "marketing",
    label: "Marketing & Conversion",
    icon: Megaphone,
    types: [
      { value: "marketing_campaigns", label: "Campagnes Marketing", description: "Offres promotionnelles et annonces publicitaires", icon: Megaphone },
      { value: "conversion_funnel", label: "Tunnel de conversion", description: "Visites, vues menu, ajouts panier, commandes (user-conversion)", icon: TrendingUp },
    ]
  },
  {
    id: "reviews",
    label: "Avis Clients",
    icon: Star,
    types: [
      { value: "reviews_order", label: "Avis par commande", description: "Notes globales et tags par commande (restaurant_rating_local)", icon: Star },
      { value: "reviews_item", label: "Avis par produit", description: "Notes et tags par article (restaurant_rating_sku_local)", icon: MessageSquare },
    ]
  },
  {
    id: "operations",
    label: "Opérations",
    icon: Clock,
    types: [
      { value: "downtime_report", label: "Temps d'inactivité", description: "Disponibilité horaire des restaurants (menu_downtime_local)", icon: Clock },
      { value: "order_history", label: "Historique des commandes", description: "Temps d'attente coursier, préparation, livraison (order_history_local)", icon: Clock },
      { value: "inaccurate_orders", label: "Commandes incorrectes (détail)", description: "Détail des erreurs par commande (inaccurate_orders_v3_xxx.csv)", icon: AlertTriangle },
      { value: "order_accuracy_summary", label: "Résumé commandes incorrectes", description: "Données agrégées jour/mois (order-accuracy-inaccurate-issues-summary)", icon: AlertTriangle },
      { value: "item_issues_leaderboard", label: "Top articles problématiques", description: "Classement des produits avec erreurs (item-issues-leaderboard)", icon: AlertTriangle },
    ]
  }
];

// Flat list for backward compatibility
const REPORT_TYPES = REPORT_THEMES.flatMap(theme => theme.types);

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

interface OrphanInfo {
  count: number;
  missingFlowIds: string[];
  totalMissingFlowIds: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  recommendation: string;
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
  orphanInfo?: OrphanInfo;
  errorDetails: string[];
}

// Multi-file batch state
interface BatchFile {
  file: File;
  content: string;
  dateRange: { start: string | null; end: string | null };
  daysCount: number;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
  result?: ImportResult;
}

interface BatchResult {
  totalFiles: number;
  successFiles: number;
  errorFiles: number;
  totalDays: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}

export default function ReportImport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("batch");
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [reportType, setReportType] = useState<string>("sales_over_time");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "validation" | "importing" | "complete" | "batch-preview" | "batch-importing" | "batch-complete">("upload");
  
  // Multi-file batch state
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  
  // Delete existing data option
  const [deleteExisting, setDeleteExisting] = useState(false);

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

  // Extract date range from conversion CSV content
  const extractConversionDateRange = (content: string): { start: string | null; end: string | null; daysCount: number } => {
    const lines = content.split("\n").filter(l => l.trim());
    let startDateIdx = -1, endDateIdx = -1;
    
    // Find header row
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].includes("Date de début") || lines[i].includes("Date de fin")) {
        const headers = parseCSVLine(lines[i]);
        startDateIdx = headers.findIndex(h => h.toLowerCase().includes("date de début"));
        endDateIdx = headers.findIndex(h => h.toLowerCase().includes("date de fin"));
        
        // Find first data row with "Cette période"
        for (let j = i + 1; j < lines.length; j++) {
          const values = parseCSVLine(lines[j]);
          if (values.some(v => v.includes("Cette période"))) {
            const startStr = values[startDateIdx] || null;
            const endStr = values[endDateIdx] || null;
            
            // Parse dates (format: DD/MM/YYYY or YYYY-MM-DD)
            const parseDate = (str: string | null): string | null => {
              if (!str) return null;
              const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
              const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
              if (isoMatch) return str;
              return null;
            };
            
            const start = parseDate(startStr);
            const end = parseDate(endStr);
            const daysCount = start && end ? Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0;
            
            return { start, end, daysCount };
          }
        }
        break;
      }
    }
    return { start: null, end: null, daysCount: 0 };
  };

  // Handle multiple file selection for conversion_funnel
  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).slice(0, 10); // Max 10 files
    
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

    setImportResult(null);
    setValidationResult(null);
    setBatchResult(null);

    // Read all files and extract date ranges
    const batchFilesPromises = fileArray.map(async (file): Promise<BatchFile> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const dateRange = extractConversionDateRange(content);
          resolve({
            file,
            content,
            dateRange: { start: dateRange.start, end: dateRange.end },
            daysCount: dateRange.daysCount,
            status: "pending",
          });
        };
        reader.readAsText(file);
      });
    });

    const loadedFiles = await Promise.all(batchFilesPromises);
    
    // Sort by start date
    loadedFiles.sort((a, b) => {
      if (!a.dateRange.start || !b.dateRange.start) return 0;
      return a.dateRange.start.localeCompare(b.dateRange.start);
    });

    setBatchFiles(loadedFiles);
    setStep("batch-preview");
  };

  // Process batch import
  const handleBatchImport = async () => {
    if (!selectedRestaurantId) {
      toast({
        title: "Restaurant requis",
        description: "Veuillez sélectionner un restaurant",
        variant: "destructive",
      });
      return;
    }

    setStep("batch-importing");
    setIsLoading(true);
    setBatchProgress(0);

    const results: BatchFile[] = [...batchFiles];
    let successCount = 0;
    let errorCount = 0;
    let totalDays = 0;
    let minDate: string | null = null;
    let maxDate: string | null = null;

    for (let i = 0; i < results.length; i++) {
      results[i].status = "processing";
      setBatchFiles([...results]);

      try {
        const { data, error } = await supabase.functions.invoke("parse-conversion-report", {
          body: {
            csvContent: results[i].content,
            restaurantId: selectedRestaurantId,
            dryRun: false,
          },
        });

        if (error) throw error;

        results[i].status = "success";
        results[i].result = data as ImportResult;
        successCount++;
        totalDays += results[i].daysCount;

        // Track min/max dates
        if (results[i].dateRange.start) {
          if (!minDate || results[i].dateRange.start < minDate) minDate = results[i].dateRange.start;
        }
        if (results[i].dateRange.end) {
          if (!maxDate || results[i].dateRange.end > maxDate) maxDate = results[i].dateRange.end;
        }

        // Save import record
        await supabase.from("csv_imports").insert({
          file_name: results[i].file.name,
          file_size: results[i].file.size,
          report_type: "conversion_funnel",
          total_rows: data.stats?.totalRows || 0,
          inserted_count: data.stats?.inserted || 0,
          updated_count: data.stats?.updated || 0,
          skipped_count: data.stats?.skipped || 0,
          error_count: data.stats?.errors || 0,
          status: "completed",
          date_range_start: results[i].dateRange.start,
          date_range_end: results[i].dateRange.end,
          restaurants_count: 1,
          restaurant_ids: [selectedRestaurantId],
        });

      } catch (error: any) {
        results[i].status = "error";
        results[i].error = error.message || "Erreur d'import";
        errorCount++;
      }

      setBatchFiles([...results]);
      setBatchProgress(((i + 1) / results.length) * 100);
    }

    setBatchResult({
      totalFiles: results.length,
      successFiles: successCount,
      errorFiles: errorCount,
      totalDays,
      dateRangeStart: minDate,
      dateRangeEnd: maxDate,
    });

    setStep("batch-complete");
    setIsLoading(false);

    toast({
      title: successCount === results.length ? "Import terminé" : "Import partiel",
      description: `${successCount}/${results.length} fichiers importés avec succès`,
      variant: successCount === results.length ? "default" : "destructive",
    });
  };

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

  // Auto-detect report type based on CSV headers
  const detectReportType = (headerLine: string): string | null => {
    // Marketing campaigns - Offers
    if (headerLine.includes("Type d'offre") && headerLine.includes("Audience")) {
      return "marketing_campaigns";
    }
    // Marketing campaigns - Ads
    if (headerLine.includes("Nom de la campagne") && headerLine.includes("Impressions")) {
      return "marketing_campaigns";
    }
    // Sales Over Time
    if (headerLine.includes("Période") && headerLine.includes("Ventes")) {
      return "sales_over_time";
    }
    // Reviews Order Level
    if ((headerLine.includes("Note du restaurant") || headerLine.includes("restaurant rating")) && 
        (headerLine.includes("UUID de la commande") || headerLine.includes("Order UUID"))) {
      return "reviews_order";
    }
    // Reviews Item Level
    if ((headerLine.includes("Note de l'article") || headerLine.includes("Item rating")) && 
        (headerLine.includes("Titre de l'article") || headerLine.includes("Item title"))) {
      return "reviews_item";
    }
    // Downtime Report
    if (headerLine.includes("Ouverture du restaurant à") && headerLine.includes("Disponibilité du menu")) {
      return "downtime_report";
    }
    // Order History
    if ((headerLine.includes("Id. de la commande") || headerLine.includes("Id de la commande")) && 
        (headerLine.includes("Temps d'attente du coursier") || headerLine.includes("Heure de la commande"))) {
      return "order_history";
    }
    // Inaccurate Orders (detail)
    if ((headerLine.includes("Problème avec la commande") || headerLine.includes("Articles incorrects")) &&
        headerLine.includes("Client remboursé")) {
      return "inaccurate_orders";
    }
    // Item Issues Leaderboard
    if (headerLine.includes("Articles incorrects") && headerLine.includes("Nombre") &&
        headerLine.includes("Problème avec le plat")) {
      return "item_issues_leaderboard";
    }
    // Order Accuracy Summary
    if ((headerLine.includes("Jour") || headerLine.includes("Mois")) && 
        (headerLine.includes("Commandes incorrectes") || headerLine.includes("Articles manquants"))) {
      return "order_accuracy_summary";
    }
    // Conversion Funnel
    if ((headerLine.includes("Utilisateurs ayant visité") || headerLine.includes("Utilisateurs ayant visite")) &&
        (headerLine.includes("menu a été consulté") || headerLine.includes("menu consulté") || headerLine.includes("Plat ajouté"))) {
      return "conversion_funnel";
    }
    // Payout Summary
    if (headerLine.includes("Identifiant de versement") || headerLine.includes("Date de versement")) {
      return "payout_summary";
    }
    // Payment reports (default fallback for order/item level)
    if (headerLine.includes("Id. de la commande") || headerLine.includes("Id. du flux")) {
      if (headerLine.includes("Titre de l'article") || headerLine.includes("Item title")) {
        return "payment_item_level";
      }
      return "payment_order_level";
    }
    return null;
  };

  const parsePreview = (content: string) => {
    const lines = content.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
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
      // Check for marketing campaign headers (offers)
      if (lines[i].includes("Type d'offre") && lines[i].includes("Audience")) {
        headerRowIndex = i;
        break;
      }
      // Check for marketing campaign headers (ads)
      if (lines[i].includes("Nom de la campagne") && lines[i].includes("Impressions")) {
        headerRowIndex = i;
        break;
      }
      // Check for reviews order-level headers
      if ((lines[i].includes("Note du restaurant") || lines[i].includes("restaurant rating")) && 
          (lines[i].includes("UUID de la commande") || lines[i].includes("Order UUID"))) {
        headerRowIndex = i;
        break;
      }
      // Check for reviews item-level headers
      if ((lines[i].includes("Note de l'article") || lines[i].includes("Item rating")) && 
          (lines[i].includes("Titre de l'article") || lines[i].includes("Item title"))) {
        headerRowIndex = i;
        break;
      }
      // Check for downtime report headers
      if (lines[i].includes("Ouverture du restaurant à") && 
          lines[i].includes("Disponibilité du menu") &&
          lines[i].includes("Restaurant en ligne")) {
        headerRowIndex = i;
        break;
      }
      // Check for order history headers
      if ((lines[i].includes("Id. de la commande") || lines[i].includes("Id de la commande")) && 
          (lines[i].includes("Temps d'attente du coursier") || lines[i].includes("Heure de la commande"))) {
        headerRowIndex = i;
        break;
      }
      // Check for inaccurate orders headers
      if ((lines[i].includes("Problème avec la commande") || lines[i].includes("Articles incorrects")) &&
          lines[i].includes("Client remboursé")) {
        headerRowIndex = i;
        break;
      }
      // Check for item issues leaderboard v3 headers (new format)
      if (lines[i].includes("Articles incorrects") && lines[i].includes("Nombre") &&
          lines[i].includes("Problème avec le plat")) {
        headerRowIndex = i;
        break;
      }
      // Check for order accuracy summary headers (daily or monthly)
      if ((lines[i].includes("Jour") || lines[i].includes("Mois")) && 
          (lines[i].includes("Commandes incorrectes") || lines[i].includes("Articles manquants"))) {
        headerRowIndex = i;
        break;
      }
      // Check for conversion funnel headers
      if ((lines[i].includes("Utilisateurs ayant visité") || lines[i].includes("Utilisateurs ayant visite")) &&
          (lines[i].includes("menu a été consulté") || lines[i].includes("menu consulté") || lines[i].includes("Plat ajouté"))) {
        headerRowIndex = i;
        break;
      }
      // Check for payout summary headers
      if (lines[i].includes("Identifiant de versement") || lines[i].includes("Date de versement")) {
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

    // Auto-detect report type from headers
    const detectedType = detectReportType(headerLine);
    if (detectedType && detectedType !== reportType) {
      setReportType(detectedType);
      const typeLabel = REPORT_TYPES.find(t => t.value === detectedType)?.label || detectedType;
      toast({
        title: "Type de rapport détecté",
        description: `Type automatiquement défini sur "${typeLabel}"`,
      });
    }

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

    // For sales_over_time, marketing_campaigns, reviews, order_accuracy_summary, item_issues_leaderboard, and conversion_funnel, restaurant selection is required
    const requiresRestaurant = ["sales_over_time", "marketing_campaigns", "reviews_order", "reviews_item", "order_accuracy_summary", "item_issues_leaderboard", "conversion_funnel"].includes(reportType);
    if (requiresRestaurant && !selectedRestaurantId) {
      toast({
        title: "Restaurant requis",
        description: "Veuillez sélectionner un restaurant pour ce type de rapport",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const functionMap: Record<string, string> = {
        sales_over_time: "parse-sales-over-time",
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
      const functionName = functionMap[reportType] || "parse-payment-report";
      
      const body: Record<string, any> = {
        csvContent,
        reportType,
        dryRun: true,
        fileName: file?.name,
      };

      // Add restaurantId for specific report types
      const reportTypesWithRestaurant = ["sales_over_time", "marketing_campaigns", "reviews_order", "reviews_item", "downtime_report", "order_history", "order_accuracy_summary", "item_issues_leaderboard", "conversion_funnel"];
      if (reportTypesWithRestaurant.includes(reportType) && selectedRestaurantId) {
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

      const functionMap: Record<string, string> = {
        sales_over_time: "parse-sales-over-time",
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
      const functionName = functionMap[reportType] || "parse-payment-report";
      
      const body: Record<string, any> = {
        csvContent,
        reportType,
        dryRun: false,
        fileName: file?.name,
      };

      // Add restaurantId for specific report types
      const reportTypesWithRestaurant = ["sales_over_time", "marketing_campaigns", "reviews_order", "reviews_item", "downtime_report", "order_history", "order_accuracy_summary", "item_issues_leaderboard", "conversion_funnel"];
      if (reportTypesWithRestaurant.includes(reportType) && selectedRestaurantId) {
        body.restaurantId = selectedRestaurantId;
      }
      
      // Add deleteExisting option for order_accuracy_summary
      if (reportType === "order_accuracy_summary" && deleteExisting) {
        body.deleteExisting = true;
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
              : reportType === "marketing_campaigns"
                ? `${importData.stats?.inserted || 0} campagnes importées dans les actions`
                : reportType === "downtime_report"
                  ? `${importData.stats?.inserted || 0} créneaux horaires importés`
                  : reportType === "inaccurate_orders"
                    ? `${importData.stats?.inserted || 0} erreurs de commande importées`
                    : reportType === "conversion_funnel"
                      ? `${importData.stats?.inserted || 0} jours de conversion importés`
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
    setBatchFiles([]);
    setBatchProgress(0);
    setBatchResult(null);
    setDeleteExisting(false);
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
          <TabsTrigger value="batch" className="gap-2">
            <Package className="h-4 w-4" />
            Import par restaurant
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import fichier
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
                  <div className="flex gap-2">
                    <Select value={reportType} onValueChange={(value) => {
                      setReportType(value);
                      setSelectedRestaurantId("");
                    }}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPORT_THEMES.map((theme) => (
                          <div key={theme.id}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 flex items-center gap-2">
                              <theme.icon className="h-3.5 w-3.5" />
                              {theme.label}
                            </div>
                            {theme.types.map((type) => (
                              <SelectItem key={type.value} value={type.value} className="pl-6">
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-2">
                                    {type.icon && <type.icon className="h-4 w-4 text-primary" />}
                                    {type.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{type.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        // Map report type to guide section ID
                        const guideMap: Record<string, string> = {
                          sales_over_time: "sales-over-time",
                          payment_order_level: "payment-orders",
                          payment_item_level: "payment-items",
                          payout_summary: "payout-summary",
                          marketing_campaigns: "marketing-campaigns",
                          reviews_order: "reviews-order",
                          reviews_item: "reviews-item",
                          downtime_report: "downtime-report",
                          order_history: "order-history",
                          order_accuracy_summary: "order-accuracy-summary",
                          item_issues_leaderboard: "item-issues-leaderboard",
                        };
                        const sectionId = guideMap[reportType] || "";
                        navigate(`/import-guide#${sectionId}`);
                      }}
                      title="Voir le tutoriel pour ce type de rapport"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Restaurant selector for specific report types */}
                  {(reportType === "sales_over_time" || reportType === "marketing_campaigns" || reportType === "order_accuracy_summary" || reportType === "item_issues_leaderboard" || reportType === "conversion_funnel") && (
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
                        {reportType === "marketing_campaigns" 
                          ? "Les fichiers d'offres ne contiennent pas d'identifiant restaurant. Pour les annonces, le restaurant sera auto-détecté si possible."
                          : reportType === "conversion_funnel"
                          ? "Le tunnel de conversion ne contient pas d'identifiant restaurant. Sélectionnez celui concerné."
                          : "Ce rapport ne contient pas d'identifiant restaurant, sélectionnez celui concerné."}
                      </p>
                      
                      {/* Delete existing data option for order_accuracy_summary */}
                      {reportType === "order_accuracy_summary" && selectedRestaurantId && (
                        <div className="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg mt-3">
                          <input
                            type="checkbox"
                            id="deleteExisting"
                            checked={deleteExisting}
                            onChange={(e) => setDeleteExisting(e.target.checked)}
                            className="h-4 w-4 rounded border-destructive/50 text-destructive focus:ring-destructive"
                          />
                          <label htmlFor="deleteExisting" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                              <Trash2 className="h-4 w-4" />
                              Supprimer les données existantes
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Efface les données de la période avant d'importer pour éviter les doublons
                            </p>
                          </label>
                        </div>
                      )}
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
                  ) : reportType === "marketing_campaigns" ? (
                    <Alert className="bg-primary/5 border-primary/20">
                      <Megaphone className="h-4 w-4 text-primary" />
                      <AlertTitle className="text-primary">Campagnes Marketing</AlertTitle>
                      <AlertDescription>
                        Importez vos offres promotionnelles ou annonces publicitaires depuis Uber Manager &gt; Marketing &gt; Historique des campagnes.
                        Les campagnes seront ajoutées aux actions et visibles sur les graphiques Analytics.
                      </AlertDescription>
                    </Alert>
                  ) : (reportType === "reviews_order" || reportType === "reviews_item") ? (
                    <Alert className="bg-amber-500/10 border-amber-500/20">
                      <Star className="h-4 w-4 text-amber-500" />
                      <AlertTitle className="text-amber-600">Avis Clients</AlertTitle>
                      <AlertDescription>
                        {reportType === "reviews_order" 
                          ? "Fichier restaurant_rating_local.csv - Contient les notes globales (1-5 étoiles) et tags par commande."
                      : "Fichier restaurant_rating_sku_local.csv - Contient les notes par article (pouce haut/bas) et tags produits."}
                      </AlertDescription>
                    </Alert>
                  ) : reportType === "conversion_funnel" ? (
                    <Alert className="bg-emerald-500/10 border-emerald-500/20">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <AlertTitle className="text-emerald-600">Tunnel de conversion</AlertTitle>
                      <AlertDescription>
                        Fichier user-conversion*.csv - Visites, vues menu, ajouts panier et commandes. 
                        Importez plusieurs fichiers (max 10) en une seule fois pour gagner du temps.
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
                    {reportType === "conversion_funnel" ? "Fichiers CSV (max 10)" : "Fichier CSV"}
                  </CardTitle>
                  <CardDescription>
                    {reportType === "conversion_funnel" 
                      ? "Sélectionnez plusieurs fichiers de conversion pour les importer en une fois"
                      : "Glissez-déposez ou sélectionnez votre fichier"}
                  </CardDescription>
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
                      <p className="text-xs text-muted-foreground">
                        {reportType === "conversion_funnel" 
                          ? "Fichiers CSV (jusqu'à 10 fichiers)" 
                          : "Fichier CSV uniquement"}
                      </p>
                    </div>
                    <input
                      id="csv-upload"
                      type="file"
                      className="hidden"
                      accept=".csv"
                      multiple={reportType === "conversion_funnel"}
                      onChange={reportType === "conversion_funnel" ? handleMultiFileChange : handleFileChange}
                    />
                  </label>

                  {file && reportType !== "conversion_funnel" && (
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
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Aperçu des données
                    </CardTitle>
                    <CardDescription>
                      {previewData.length} lignes détectées (affichage des 50 premières)
                    </CardDescription>
                  </div>
                  
                  {/* Sélecteur de restaurant pour les types qui le nécessitent */}
                  {(reportType === "sales_over_time" || reportType === "marketing_campaigns" || reportType === "reviews_order" || reportType === "reviews_item") && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">Restaurant :</span>
                      <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                        <SelectTrigger className={`w-[280px] ${!selectedRestaurantId ? 'border-destructive ring-1 ring-destructive' : ''}`}>
                          <SelectValue placeholder="Sélectionner un restaurant *" />
                        </SelectTrigger>
                        <SelectContent>
                          {restaurants?.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name} {r.city && `(${r.city})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
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
                    <Alert variant={selectedRestaurantId ? "default" : "destructive"}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>
                        {selectedRestaurantId ? "Store ID non reconnu (non bloquant)" : "Restaurants non configurés"}
                      </AlertTitle>
                      <AlertDescription>
                        <p className="mb-2">
                          {validationResult.validation.unknownStoreIds.length} store_id(s) trouvé(s) dans le fichier mais non configuré(s) :
                        </p>
                        {selectedRestaurantId ? (
                          <p className="mb-2 text-sm text-muted-foreground">
                            Comme vous avez sélectionné un restaurant manuellement, l’import associera quand même toutes les lignes à ce restaurant.
                          </p>
                        ) : (
                          <p className="mb-2 text-sm text-muted-foreground">
                            Si le fichier contient plusieurs restaurants, ceux dont le store_id n’est pas configuré risquent d’être ignorés.
                          </p>
                        )}
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

                  {/* Orphan items warning for item-level imports */}
                  {validationResult.orphanInfo && validationResult.orphanInfo.count > 0 && (
                    <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-700">
                        {validationResult.orphanInfo.count} articles orphelins détectés
                      </AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p className="text-sm">
                          Ces articles ne peuvent pas être importés car leurs commandes parentes n'existent pas dans la base de données.
                        </p>
                        
                        {validationResult.orphanInfo.dateRange.start && validationResult.orphanInfo.dateRange.end && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">
                              Période concernée : {formatDate(validationResult.orphanInfo.dateRange.start)} → {formatDate(validationResult.orphanInfo.dateRange.end)}
                            </span>
                          </div>
                        )}
                        
                        <div className="p-3 bg-background rounded-lg border border-amber-300">
                          <p className="text-sm font-medium text-foreground mb-2">
                            💡 Action requise :
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {validationResult.orphanInfo.recommendation}
                          </p>
                        </div>

                        {validationResult.orphanInfo.missingFlowIds.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs text-muted-foreground mb-1">
                              Exemples de flow_id manquants ({validationResult.orphanInfo.totalMissingFlowIds} au total) :
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {validationResult.orphanInfo.missingFlowIds.slice(0, 5).map((id) => (
                                <Badge key={id} variant="outline" className="font-mono text-xs">
                                  {id.substring(0, 8)}...
                                </Badge>
                              ))}
                              {validationResult.orphanInfo.totalMissingFlowIds > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{validationResult.orphanInfo.totalMissingFlowIds - 5} autres
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
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

                {/* Orphan items warning in complete step */}
                {importResult.orphanInfo && importResult.orphanInfo.count > 0 && (
                  <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700">
                      {importResult.orphanInfo.count} articles non importés (orphelins)
                    </AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-sm">
                        Ces articles n'ont pas pu être importés car leurs commandes parentes n'existent pas dans la base.
                      </p>
                      
                      {importResult.orphanInfo.dateRange.start && importResult.orphanInfo.dateRange.end && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">
                            Période concernée : {formatDate(importResult.orphanInfo.dateRange.start)} → {formatDate(importResult.orphanInfo.dateRange.end)}
                          </span>
                        </div>
                      )}
                      
                      <div className="p-3 bg-background rounded-lg border border-amber-300">
                        <p className="text-sm font-medium text-foreground mb-2">
                          💡 Pour importer ces articles :
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {importResult.orphanInfo.recommendation}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

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

          {/* Batch preview step for multi-file conversion import */}
          {step === "batch-preview" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      {batchFiles.length} fichiers sélectionnés
                    </CardTitle>
                    <CardDescription>
                      Vérifiez les périodes détectées avant d'importer
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Restaurant :</span>
                    <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                      <SelectTrigger className={`w-[280px] ${!selectedRestaurantId ? 'border-destructive ring-1 ring-destructive' : ''}`}>
                        <SelectValue placeholder="Sélectionner un restaurant *" />
                      </SelectTrigger>
                      <SelectContent>
                        {restaurants?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} {r.city && `(${r.city})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-sm">
                    {batchFiles.reduce((acc, f) => acc + f.daysCount, 0)} jours au total
                  </Badge>
                  {batchFiles.length > 0 && batchFiles[0].dateRange.start && batchFiles[batchFiles.length - 1].dateRange.end && (
                    <Badge variant="secondary" className="text-sm">
                      {formatDate(batchFiles[0].dateRange.start)} → {formatDate(batchFiles[batchFiles.length - 1].dateRange.end)}
                    </Badge>
                  )}
                </div>

                <div className="border rounded-lg overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Fichier</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead className="text-center">Jours</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchFiles.map((bf, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{bf.file.name}</TableCell>
                          <TableCell className="text-sm">
                            {bf.dateRange.start && bf.dateRange.end 
                              ? `${formatDate(bf.dateRange.start)} → ${formatDate(bf.dateRange.end)}`
                              : <span className="text-muted-foreground">Non détectée</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{bf.daysCount || "?"}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {bf.status === "pending" && <Badge variant="secondary">En attente</Badge>}
                            {bf.status === "processing" && <Badge className="bg-blue-500">En cours...</Badge>}
                            {bf.status === "success" && <Badge className="bg-green-500">✓ OK</Badge>}
                            {bf.status === "error" && <Badge variant="destructive">Erreur</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={resetImport}>
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleBatchImport} 
                    disabled={!selectedRestaurantId || isLoading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Importer les {batchFiles.length} fichiers
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Batch importing step */}
          {step === "batch-importing" && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <div className="text-center">
                    <h3 className="text-lg font-medium">Import en cours...</h3>
                    <p className="text-sm text-muted-foreground">
                      Traitement de {batchFiles.filter(f => f.status === "success").length + 1}/{batchFiles.length} fichiers
                    </p>
                  </div>
                  <Progress value={batchProgress} className="w-64" />
                  
                  {/* Live status */}
                  <div className="mt-4 w-full max-w-md space-y-2">
                    {batchFiles.map((bf, idx) => (
                      <div key={idx} className={`flex items-center gap-2 text-sm ${bf.status === "processing" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {bf.status === "pending" && <div className="w-4 h-4 rounded-full border-2" />}
                        {bf.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {bf.status === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {bf.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                        <span className="truncate">{bf.file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Batch complete step */}
          {step === "batch-complete" && batchResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {batchResult.errorFiles === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  {batchResult.errorFiles === 0 ? "Import terminé avec succès" : "Import terminé avec erreurs"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{batchResult.totalFiles}</p>
                    <p className="text-sm text-muted-foreground">Fichiers traités</p>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{batchResult.successFiles}</p>
                    <p className="text-sm text-muted-foreground">Réussis</p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">{batchResult.errorFiles}</p>
                    <p className="text-sm text-muted-foreground">Erreurs</p>
                  </div>
                  <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{batchResult.totalDays}</p>
                    <p className="text-sm text-muted-foreground">Jours importés</p>
                  </div>
                </div>

                {batchResult.dateRangeStart && batchResult.dateRangeEnd && (
                  <Alert className="bg-primary/5 border-primary/20">
                    <Calendar className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary">Période couverte</AlertTitle>
                    <AlertDescription>
                      Du {formatDate(batchResult.dateRangeStart)} au {formatDate(batchResult.dateRangeEnd)}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error details */}
                {batchFiles.filter(f => f.status === "error").length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Fichiers en erreur</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        {batchFiles.filter(f => f.status === "error").map((bf, idx) => (
                          <li key={idx}>{bf.file.name}: {bf.error}</li>
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
                  <Button onClick={resetImport}>Importer d'autres fichiers</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="batch" className="mt-6">
          <BatchRestaurantImport onComplete={() => setActiveTab("history")} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ImportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
