import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, Eye, Send, History, ShieldCheck, Building2, Calendar, Download, TrendingUp, BookOpen, Megaphone, Star, MessageSquare, Clock, HelpCircle, Trash2, Layers, Award, Info } from "lucide-react";
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
import BulkImportTab from "@/components/reports/BulkImportTab";
import UnknownStoreMapping from "@/components/reports/UnknownStoreMapping";
import DeliverooImportTab from "@/components/reports/DeliverooImportTab";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";
import { SuccessScorePreviewEditor } from "@/components/success-score/SuccessScorePreviewEditor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

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
  },
  {
    id: "performance",
    label: "Performance",
    icon: Award,
    types: [
      { value: "success_score", label: "Score de Réussite", description: "Indicateurs mensuels Uber Eats (Excellence opé., Notes, Menu)", icon: Award },
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
  salesPeriod?: {
    start: string | null;
    end: string | null;
  };
  restaurants: RestaurantStats[];
  unknownStoreIds: string[];
  unknownStoreDetails?: Record<string, { name: string }>;
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
    merged?: number;
    expandedRecords?: number;
  };
  validation?: ValidationData;
  orphanInfo?: OrphanInfo;
  errorDetails: string[];
}

/**
 * Scan the first 20 lines of a CSV to find the real header row.
 * Uber Eats exports often have metadata lines before the actual column headers.
 */
function findHeaderLineIndex(lines: string[]): number {
  const knownHeaderMarkers = [
    "Id. de la commande",
    "Id. du flux",
    "Nom du restaurant",
    "Date de la commande",
    "UUID de la commande",
    "Nom du plat/de l'article",
    "Titre de l'article",
    "Date du versement",
    "Ouverture du restaurant",
    "Temps d'attente du coursier",
    "Problème avec la commande",
    "Commandes incorrectes",
    "Store name",
    "Note de l'article",
    "Type d'offre",
    "Utilisateurs ayant visité",
    "Période",
  ];

  let bestIndex = -1;
  let bestCount = 0;
  let firstMatchIndex = -1;

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i];
    const matchCount = knownHeaderMarkers.filter(marker => line.includes(marker)).length;
    if (matchCount > 0 && firstMatchIndex === -1) {
      firstMatchIndex = i;
    }
    if (matchCount > bestCount) {
      bestCount = matchCount;
      bestIndex = i;
    }
  }

  // Require at least 2 markers for confidence; fallback to first single match
  if (bestCount >= 2) return bestIndex;
  if (firstMatchIndex !== -1) return firstMatchIndex;
  return 0;
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

// Chunking progress state for large files
interface ChunkProgress {
  current: number;
  total: number;
  percent: number;
  totalInserted: number;
  totalErrors: number;
}

// Chunk size for large file imports (5,000 lines per chunk to avoid WORKER_LIMIT)
const CHUNK_SIZE = 5000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

interface RestaurantOption {
  id: string;
  name: string;
  city: string | null;
  chain_id?: string | null;
}

async function fetchAccessibleRestaurants({
  selectedChainId,
  includeAllChains,
}: {
  selectedChainId: string | null;
  includeAllChains: boolean;
}): Promise<RestaurantOption[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: role }, { data: accessRows, error: accessError }] = await Promise.all([
    supabase.rpc("get_user_role"),
    supabase
      .from("user_chain_access")
      .select("chain_id")
      .eq("user_id", user.id)
      .not("chain_id", "is", null),
  ]);

  if (accessError) {
    console.error("[ReportImport] Failed to load user chain access", accessError);
    throw accessError;
  }

  const isSuperAdmin = role === "super_admin";
  const accessibleChainIds = Array.from(
    new Set(
      (accessRows ?? [])
        .map((row) => row.chain_id)
        .filter((chainId): chainId is string => Boolean(chainId))
    )
  );

  let query = supabase
    .from("restaurants")
    .select("id, name, city, chain_id")
    .eq("is_active", true);

  if (includeAllChains) {
    if (!isSuperAdmin) {
      if (accessibleChainIds.length === 0) return [];
      query = query.in("chain_id", accessibleChainIds);
    }
  } else if (selectedChainId) {
    query = query.eq("chain_id", selectedChainId);
  } else if (!isSuperAdmin) {
    if (accessibleChainIds.length === 0) return [];
    query = query.in("chain_id", accessibleChainIds);
  }

  const { data, error } = await query.order("name");

  if (error) {
    console.error("[ReportImport] Failed to load restaurants", {
      includeAllChains,
      selectedChainId,
      error,
    });
    throw error;
  }

  return data ?? [];
}

export default function ReportImport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedChainId } = useAnalyticsContext();
  const [platform, setPlatform] = useState<"uber" | "deliveroo">("uber");
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
  const [step, setStep] = useState<"upload" | "preview" | "validation" | "importing" | "complete" | "batch-preview" | "batch-importing" | "batch-complete">("upload");
  
  // Multi-file batch state
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  
  // Chunking progress for large files
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null);
  const [isRevalidatingAfterMapping, setIsRevalidatingAfterMapping] = useState(false);
  
  // Delete existing data option
  const [deleteExisting, setDeleteExisting] = useState(false);
  
  // Score month for success_score report type
  const [scoreMonth, setScoreMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });

  // Fetch restaurants for selector (filtered by selected chain when relevant)
  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-for-import", selectedChainId],
    queryFn: () => fetchAccessibleRestaurants({ selectedChainId, includeAllChains: false }),
  });

  // Fetch restaurants for mapping dropdown using the user's real accessible chains
  const { data: allRestaurants = [] } = useQuery({
    queryKey: ["all-restaurants-for-mapping", selectedChainId],
    queryFn: () => fetchAccessibleRestaurants({ selectedChainId, includeAllChains: true }),
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
    // Reviews Item Level - MUST be checked BEFORE reviews_order because SKU files contain BOTH sets of headers
    // SKU files have: "Nom du plat", "Prix du plat", "Catégorie du menu" + "UUID de la commande" + "Valeur de la note"
    const hasSkuItemColumns = headerLine.includes("Nom du plat") || headerLine.includes("Prix du plat") || 
                              headerLine.includes("Catégorie du menu") || headerLine.includes("Id. externe de l'article");
    if ((headerLine.includes("Note de l'article") || headerLine.includes("Item rating") || 
         headerLine.includes("Titre de l'article") || headerLine.includes("Item title") ||
         hasSkuItemColumns) && 
        (headerLine.includes("UUID de la commande") || headerLine.includes("Order UUID") ||
         headerLine.includes("Note de l'article") || headerLine.includes("Titre de l'article"))) {
      return "reviews_item";
    }
    // Reviews Order Level - MUST be checked AFTER reviews_item
    if ((headerLine.includes("Note du restaurant") || headerLine.includes("Valeur de la note") || headerLine.includes("restaurant rating") || headerLine.includes("rating value")) && 
        (headerLine.includes("UUID de la commande") || headerLine.includes("Order UUID")) &&
        !hasSkuItemColumns) {
      return "reviews_order";
    }
    // Downtime Report
    if (headerLine.includes("Ouverture du restaurant à") && headerLine.includes("Disponibilité du menu")) {
      return "downtime_report";
    }
    // Inaccurate Orders (detail) — tested BEFORE order_history (shares common headers)
    if ((headerLine.includes("Problème avec la commande") || headerLine.includes("Articles incorrects")) &&
        headerLine.includes("Client remboursé")) {
      return "inaccurate_orders";
    }
    // Order History
    if ((headerLine.includes("Id. de la commande") || headerLine.includes("Id de la commande")) && 
        (headerLine.includes("Temps d'attente du coursier") || headerLine.includes("Heure de la commande"))) {
      return "order_history";
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
    // Success Score
    if (headerLine.includes("Store name") && 
        headerLine.includes("Operational excellence") && 
        headerLine.includes("Status")) {
      return "success_score";
    }
    // Helper: Check for item-level columns
    const hasItemColumns = 
      headerLine.includes("Titre de l'article") || 
      headerLine.includes("Item title") ||
      headerLine.includes("Nom du plat") ||
      headerLine.includes("Nom de l'article") ||
      headerLine.includes("Nom du plat/de l'article");
    
    // Helper: Check for order identifiers
    const hasOrderId = headerLine.includes("Id. de la commande") || headerLine.includes("Id de la commande");
    const hasFlowId = headerLine.includes("Id. du flux");
    
    // PRIORITY 1: ITEM-LEVEL PAYMENT (most specific - has order/flow ID AND item columns)
    if ((hasOrderId || hasFlowId) && hasItemColumns) {
      return "payment_item_level";
    }
    
    // PRIORITY 2: PAYOUT SUMMARY (aggregated - NO order IDs)
    if (!hasOrderId && !hasFlowId) {
      if (
        headerLine.includes("Identifiant de versement") || 
        headerLine.includes("Id. de référence du versement") ||
        headerLine.includes("Date de versement") ||
        headerLine.includes("Date du versement") ||
        (headerLine.includes("Montant total") && headerLine.includes("Nombre de commandes"))
      ) {
        return "payout_summary";
      }
    }
    
    // PRIORITY 3: ORDER-LEVEL PAYMENT (has order/flow ID, no item columns)
    if (hasOrderId || hasFlowId) {
      return "payment_order_level";
    }
    
    return null;
  };

  const parsePreview = (content: string) => {
    // Remove BOM if present
    const cleanedContent = content.replace(/^\uFEFF/, '');
    const { records: lines, headerIndex: detectedHeaderIndex } = parseCSVRecords(cleanedContent);
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
      // Check for reviews item-level headers (includes SKU variants: "Nom du plat", "Prix du plat", "Catégorie du menu")
      if ((lines[i].includes("Note de l'article") || lines[i].includes("Item rating") ||
           lines[i].includes("Nom du plat") || lines[i].includes("Prix du plat") || 
           lines[i].includes("Catégorie du menu") || lines[i].includes("Id. externe de l'article")) && 
          (lines[i].includes("Titre de l'article") || lines[i].includes("Item title") ||
           lines[i].includes("UUID de la commande") || lines[i].includes("Nom du plat"))) {
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
      // Check for Success Score headers
      if (lines[i].includes("Store name") && 
          lines[i].includes("Operational excellence") && 
          lines[i].includes("Status")) {
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

  /**
   * CSV-aware record counting and extraction.
   * Properly handles newlines inside quoted fields (e.g. invoice URLs).
   * Returns: { records: array of raw CSV lines (one per record), headerIndex }
   */
  const parseCSVRecords = (content: string): { records: string[]; headerIndex: number } => {
    const records: string[] = [];
    let currentRecord = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentRecord += '""';
          i++;
        } else if (char === '"') {
          currentRecord += char;
          inQuotes = false;
        } else {
          currentRecord += char;
        }
      } else {
        if (char === '"') {
          currentRecord += char;
          inQuotes = true;
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          if (currentRecord.trim()) {
            records.push(currentRecord);
          }
          currentRecord = '';
          if (char === '\r') i++;
        } else if (char !== '\r') {
          currentRecord += char;
        }
      }
    }
    if (currentRecord.trim()) {
      records.push(currentRecord);
    }

    const headerIndex = findHeaderLineIndex(records);
    return { records, headerIndex };
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

    // For sales_over_time, marketing_campaigns, order_accuracy_summary, item_issues_leaderboard, and conversion_funnel, restaurant selection is required
    const requiresRestaurantSelection = ["sales_over_time", "marketing_campaigns", "order_accuracy_summary", "item_issues_leaderboard", "conversion_funnel"].includes(reportType);
    if (requiresRestaurantSelection && !selectedRestaurantId) {
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
        success_score: "parse-success-score",
      };
      const functionName = functionMap[reportType] || "parse-payment-report";
      
      // For large order_history files, send only a sample for validation
      let contentToValidate = csvContent;
      let totalLinesCount = 0;
      let isLargeFile = false;
      
      const LARGE_FILE_REPORT_TYPES = ["order_history", "inaccurate_orders", "payment_order_level", "payment_item_level", "reviews_item"];
      if (LARGE_FILE_REPORT_TYPES.includes(reportType)) {
        const { records, headerIndex } = parseCSVRecords(csvContent);
        totalLinesCount = records.length - 1 - headerIndex; // Exclude header and metadata lines
        
        // If file is large, use uniform sampling for representative dry run
        if (totalLinesCount > CHUNK_SIZE) {
          isLargeFile = true;
          const dataRecords = records.slice(headerIndex + 1);
          const sampleSize = 1000;
          const step = Math.max(1, Math.floor(dataRecords.length / sampleSize));
          const sampledRecords: string[] = [];
          for (let i = 0; i < dataRecords.length && sampledRecords.length < sampleSize; i += step) {
            sampledRecords.push(dataRecords[i]);
          }
          const headerRecords = records.slice(0, headerIndex + 1);
          contentToValidate = [...headerRecords, ...sampledRecords].join('\n');
          
          // Scan full file for date range client-side
          const headerFields = parseCSVLine(records[headerIndex]);
          const dateColIndex = headerFields.findIndex(h => 
            h.toLowerCase().includes("date de la commande") || 
            h.toLowerCase().includes("heure de la commande") ||
            h.toLowerCase().includes("order date")
          );
          if (dateColIndex >= 0) {
            let minDate: string | null = null;
            let maxDate: string | null = null;
            // Scan a larger uniform sample (every 100th record) for speed
            const dateScanStep = Math.max(1, Math.floor(dataRecords.length / 5000));
            // Always include first and last records
            const indicesToScan = new Set<number>();
            indicesToScan.add(0);
            indicesToScan.add(dataRecords.length - 1);
            for (let i = 0; i < dataRecords.length; i += dateScanStep) {
              indicesToScan.add(i);
            }
            for (const idx of indicesToScan) {
              const fields = parseCSVLine(dataRecords[idx]);
              const dateVal = fields[dateColIndex]?.trim();
              if (dateVal) {
                // Parse various date formats
                let isoDate: string | null = null;
                const ddmmyyyy = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (ddmmyyyy) {
                  isoDate = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
                } else {
                  const isoMatch = dateVal.match(/(\d{4})-(\d{2})-(\d{2})/);
                  if (isoMatch) isoDate = isoMatch[0];
                }
                if (isoDate) {
                  if (!minDate || isoDate < minDate) minDate = isoDate;
                  if (!maxDate || isoDate > maxDate) maxDate = isoDate;
                }
              }
            }
            // Store scanned date range to override sample's date range later
            (window as any).__scannedDateRange = { start: minDate, end: maxDate };
          }
        }
      }
      
      const body: Record<string, any> = {
        csvContent: contentToValidate,
        reportType,
        dryRun: true,
        fileName: file?.name,
      };

      // Add restaurantId for specific report types (reviews_order/reviews_item are multi-restaurant and identify via CSV)
      const reportTypesWithRestaurant = ["sales_over_time", "marketing_campaigns", "downtime_report", "order_history", "order_accuracy_summary", "item_issues_leaderboard", "conversion_funnel"];
      if (reportTypesWithRestaurant.includes(reportType) && selectedRestaurantId) {
        body.restaurantId = selectedRestaurantId;
      }

      // Add scoreMonth for success_score
      if (reportType === "success_score" && scoreMonth) {
        body.scoreMonth = scoreMonth;
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) throw error;

      // For large files, adjust the validation result to show actual totals
      let validationData = data as ImportResult;
      if (isLargeFile) {
        // Extrapolate all counts from sample to full file
        const sampleTotal = validationData.stats.totalRows;
        const ratio = sampleTotal > 0 ? totalLinesCount / sampleTotal : 1;
        validationData = {
          ...validationData,
          stats: {
            ...validationData.stats,
            totalRows: totalLinesCount,
            inserted: Math.round(validationData.stats.inserted * ratio),
            updated: Math.round(validationData.stats.updated * ratio),
            skipped: Math.round(validationData.stats.skipped * ratio),
          },
        };
        
        // Override date range with client-side full scan if available
        const scannedRange = (window as any).__scannedDateRange;
        if (scannedRange && validationData.validation) {
          validationData = {
            ...validationData,
            validation: {
              ...validationData.validation,
              dateRange: {
                start: scannedRange.start || validationData.validation.dateRange.start,
                end: scannedRange.end || validationData.validation.dateRange.end,
              },
            },
          };
          delete (window as any).__scannedDateRange;
        }
        
        toast({
          title: "Fichier volumineux détecté",
          description: `${totalLinesCount.toLocaleString()} lignes seront importées en ${Math.ceil(totalLinesCount / CHUNK_SIZE)} chunks`,
        });
      }

      setValidationResult(validationData);
      setStep("validation");

      if (!isLargeFile) {
        toast({
          title: "Analyse terminée",
          description: "Vérifiez les données avant de confirmer l'import",
        });
      }
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
    setChunkProgress(null);

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
        success_score: "parse-success-score",
      };
      const functionName = functionMap[reportType] || "parse-payment-report";
      
      // Check if file needs chunking (for order_history with large files)
      const { records: allRecords, headerIndex } = parseCSVRecords(csvContent);
      const dataLinesCount = allRecords.length - 1 - headerIndex; // Exclude header and metadata lines
      const LARGE_FILE_REPORT_TYPES = ["order_history", "inaccurate_orders", "payment_order_level", "payment_item_level", "reviews_item"];
      const needsChunking = LARGE_FILE_REPORT_TYPES.includes(reportType) && dataLinesCount > CHUNK_SIZE;
      
      let importData: ImportResult;
      
      if (needsChunking) {
        // Large file: process in chunks
        // Include ALL pre-header lines (description + header) in each chunk
        // Only send the header row (not the description line) to reduce payload size
        const preHeaderLines = [allRecords[headerIndex]];
        const dataLines = allRecords.slice(headerIndex + 1);
        const totalChunks = Math.ceil(dataLines.length / CHUNK_SIZE);
        
        let totalInserted = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let totalMerged = 0;
        let totalExpandedRecords = 0;
        let allRestaurants: RestaurantStats[] = [];
        let minDate: string | null = null;
        let maxDate: string | null = null;
        const errorDetails: string[] = [];
        const allUnknownStoreIds: string[] = [];
        const allUnknownStoreDetails: Record<string, { name: string }> = {};
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, dataLines.length);
          const chunkLines = [...preHeaderLines, ...dataLines.slice(start, end)];
          const chunkCsv = chunkLines.join('\n');
          
          setChunkProgress({
            current: i + 1,
            total: totalChunks,
            percent: ((i + 1) / totalChunks) * 100,
            totalInserted,
            totalErrors,
          });
          
          const body: Record<string, any> = {
            csvContent: chunkCsv,
            reportType,
            dryRun: false,
            fileName: file?.name,
          };
          
          if (selectedRestaurantId) {
            body.restaurantId = selectedRestaurantId;
          }
          
          try {
            let chunkResult: any = null;
            let lastError: any = null;
            
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
              if (attempt > 0) {
                console.log(`Retry ${attempt} for chunk ${i + 1} after ${RETRY_DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
              }
              
              const { data, error } = await supabase.functions.invoke(functionName, { body });
              
              if (error) {
                lastError = error;
                console.warn(`Chunk ${i + 1} attempt ${attempt + 1} failed: ${error.message}`);
                continue; // retry
              }
              
              chunkResult = data;
              lastError = null;
              break; // success
            }
            
            if (lastError) {
              errorDetails.push(`Chunk ${i + 1}: ${lastError.message}`);
              totalErrors += (end - start); // count actual rows, not CHUNK_SIZE
              continue;
            }
            totalInserted += chunkResult.stats?.inserted || 0;
            totalUpdated += chunkResult.stats?.updated || 0;
            totalSkipped += chunkResult.stats?.skipped || 0;
            totalErrors += chunkResult.stats?.errors || 0;
            totalMerged += chunkResult.stats?.merged || 0;
            totalExpandedRecords += chunkResult.stats?.expandedRecords || 0;
            
            // Merge restaurants (support both root-level and validation-nested)
            const chunkRestaurants = chunkResult.validation?.restaurants || chunkResult.restaurants || [];
            for (const r of chunkRestaurants) {
              const existing = allRestaurants.find(ar => ar.id === r.id);
              if (existing) {
                existing.orderCount += r.count || r.orderCount || 0;
              } else {
                allRestaurants.push({ 
                  id: r.id, 
                  name: r.name, 
                  orderCount: r.count || r.orderCount || 0 
                });
              }
            }
            
            // Track date range (support both root-level and validation-nested)
            const chunkDateRange = chunkResult.validation?.dateRange || chunkResult.dateRange;
            if (chunkDateRange?.start) {
              if (!minDate || chunkDateRange.start < minDate) minDate = chunkDateRange.start;
            }
            if (chunkDateRange?.end) {
              if (!maxDate || chunkDateRange.end > maxDate) maxDate = chunkDateRange.end;
            }
            
            // Collect errors (support both errorDetails and errors)
            const chunkErrors = chunkResult.errorDetails || chunkResult.errors || [];
            if (chunkErrors.length > 0) {
              errorDetails.push(...chunkErrors.slice(0, 10).map((e: string) => `Chunk ${i + 1}: ${e}`));
            }
            
            // Collect skipped details from validation
            if (chunkResult.validation?.skippedDetails?.length > 0) {
              const skippedSample = chunkResult.validation.skippedDetails.slice(0, 5);
              errorDetails.push(...skippedSample.map((s: any) => `Chunk ${i + 1} - Ligne ${s.rowIndex}: ${s.details}`));
            }
            
            // Collect unknown store IDs from each chunk
            if (chunkResult.validation?.unknownStoreIds?.length > 0) {
              for (const uid of chunkResult.validation.unknownStoreIds) {
                if (!allUnknownStoreIds.includes(uid)) {
                  allUnknownStoreIds.push(uid);
                }
              }
            }
            if (chunkResult.validation?.unknownStoreDetails) {
              Object.assign(allUnknownStoreDetails, chunkResult.validation.unknownStoreDetails);
            }

            // Merge orphanInfo across chunks
            if (chunkResult.orphanInfo && chunkResult.orphanInfo.count > 0) {
              if (!aggregatedOrphanInfo) {
                aggregatedOrphanInfo = { ...chunkResult.orphanInfo };
              } else {
                aggregatedOrphanInfo.count += chunkResult.orphanInfo.count;
                aggregatedOrphanInfo.totalMissingFlowIds = (aggregatedOrphanInfo.totalMissingFlowIds || 0) + (chunkResult.orphanInfo.totalMissingFlowIds || 0);
                // Merge unique missing flow IDs (keep max 10 samples)
                const existingIds = new Set(aggregatedOrphanInfo.missingFlowIds);
                for (const fid of chunkResult.orphanInfo.missingFlowIds || []) {
                  if (aggregatedOrphanInfo.missingFlowIds.length < 10 && !existingIds.has(fid)) {
                    aggregatedOrphanInfo.missingFlowIds.push(fid);
                  }
                }
                // Expand date range
                if (chunkResult.orphanInfo.dateRange?.start && (!aggregatedOrphanInfo.dateRange.start || chunkResult.orphanInfo.dateRange.start < aggregatedOrphanInfo.dateRange.start)) {
                  aggregatedOrphanInfo.dateRange.start = chunkResult.orphanInfo.dateRange.start;
                }
                if (chunkResult.orphanInfo.dateRange?.end && (!aggregatedOrphanInfo.dateRange.end || chunkResult.orphanInfo.dateRange.end > aggregatedOrphanInfo.dateRange.end)) {
                  aggregatedOrphanInfo.dateRange.end = chunkResult.orphanInfo.dateRange.end;
                }
              }
            }
          } catch (chunkError: any) {
            errorDetails.push(`Chunk ${i + 1}: ${chunkError.message || 'Erreur inconnue'}`);
            totalErrors += (end - start);
          }
        }
        
        // Build aggregated result
        importData = {
          success: totalErrors === 0,
          reportType,
          stats: {
            totalRows: dataLines.length,
            inserted: totalInserted,
            updated: totalUpdated,
            skipped: totalSkipped,
            errors: totalErrors,
            merged: totalMerged,
            expandedRecords: totalExpandedRecords > 0 ? totalExpandedRecords : undefined,
          },
          validation: {
            dateRange: { start: minDate, end: maxDate },
            restaurants: allRestaurants,
            unknownStoreIds: allUnknownStoreIds,
            unknownStoreDetails: allUnknownStoreDetails,
            skippedDetails: [],
          },
          errorDetails,
        };
        
        setChunkProgress({
          current: totalChunks,
          total: totalChunks,
          percent: 100,
          totalInserted,
          totalErrors,
        });
        
      } else {
        // Normal import (small file or other report types)
        const body: Record<string, any> = {
          csvContent,
          reportType,
          dryRun: false,
          fileName: file?.name,
        };

        // Add restaurantId for specific report types
        const reportTypesWithRestaurant = ["sales_over_time", "marketing_campaigns", "downtime_report", "order_history", "order_accuracy_summary", "item_issues_leaderboard", "conversion_funnel"];
        if (reportTypesWithRestaurant.includes(reportType) && selectedRestaurantId) {
          body.restaurantId = selectedRestaurantId;
        }
        
        // Add deleteExisting option for order_accuracy_summary
        if (reportType === "order_accuracy_summary" && deleteExisting) {
          body.deleteExisting = true;
        }
        
        // Add scoreMonth for success_score
        if (reportType === "success_score") {
          body.scoreMonth = scoreMonth;
        }

        const { data, error } = await supabase.functions.invoke(functionName, { body });

        if (error) throw error;

        importData = data as ImportResult;
      }
      
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
                      : reportType === "success_score"
                        ? `${importData.stats?.inserted || 0} restaurants ajoutés, ${importData.stats?.updated || 0} mis à jour`
                        : `${importData.stats?.inserted || 0} commandes insérées, ${importData.stats?.updated || 0} mises à jour`;
        toast({
          title: "Import réussi",
          description: statsMessage,
        });
      } else {
        toast({
          title: "Import terminé avec erreurs",
          description: importData.errorDetails?.[0] || "Certaines lignes n'ont pas pu être importées",
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
      setChunkProgress(null);
    }
  };

  const handleRevalidateAfterMapping = async () => {
    if (!csvContent) {
      toast({
        title: "Erreur",
        description: "Aucun fichier à réanalyser",
        variant: "destructive",
      });
      return;
    }

    setIsRevalidatingAfterMapping(true);
    setImportResult(null);
    setValidationResult(null);
    setStep("validation");

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["restaurants-for-import"] }),
        queryClient.invalidateQueries({ queryKey: ["all-restaurants-for-mapping"] }),
      ]);

      toast({
        title: "Mappings enregistrés",
        description: "Réanalyse du fichier en cours…",
      });

      await handleValidate();
    } finally {
      setIsRevalidatingAfterMapping(false);
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
    setChunkProgress(null);
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
          <h1 className="text-3xl font-bold tracking-tight">Import des rapports</h1>
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

      {/* Platform-level tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setPlatform("uber")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            platform === "uber"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <img src={uberEatsLogo} alt="Uber Eats" className="h-5 w-5 object-contain" />
          Uber Eats
        </button>
        <button
          onClick={() => setPlatform("deliveroo")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            platform === "deliveroo"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <img src={deliverooLogo} alt="Deliveroo" className="h-5 w-5 object-contain" />
          Deliveroo
        </button>
      </div>

      {platform === "deliveroo" ? (
        <DeliverooImportTab restaurants={restaurants} />
      ) : (
      <>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Importer
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <Layers className="h-4 w-4" />
            Import groupé
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

                  {/* Month selector for success_score */}
                  {reportType === "success_score" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mois du score *</label>
                      <Select 
                        value={scoreMonth.slice(0, 7)} 
                        onValueChange={(value) => setScoreMonth(value + '-01')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le mois" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const months = [];
                            const now = new Date();
                            for (let i = 0; i < 12; i++) {
                              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                              const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                              const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                              months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
                            }
                            return months.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Le fichier CSV ne contient pas de date. Sélectionnez le mois du score à importer.
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
                  ) : reportType === "success_score" ? (
                    <Alert className="bg-amber-500/10 border-amber-500/20">
                      <Award className="h-4 w-4 text-amber-500" />
                      <AlertTitle className="text-amber-600">Score de Réussite</AlertTitle>
                      <AlertDescription>
                        Fichier quality-score-stores*.csv - Indicateurs mensuels Uber Eats : Excellence opérationnelle, Notes, Détails menu et Emballages durables.
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
                  
                  {/* Sélecteur de restaurant pour les types qui le nécessitent (reviews sont multi-restaurant) */}
                  {(reportType === "sales_over_time" || reportType === "marketing_campaigns") && (
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

                {/* Success Score: show editable preview */}
                {reportType === "success_score" ? (
                  <SuccessScorePreviewEditor
                    data={previewData}
                    headers={headers}
                    onDataChange={(newData) => {
                      setPreviewData(newData);
                      // Rebuild CSV content from edited data
                      const headerLine = headers.join(",");
                      const dataLines = newData.map(row => 
                        headers.map(h => {
                          const val = row[h] || "";
                          return val.includes(",") ? `"${val}"` : val;
                        }).join(",")
                      );
                      setCsvContent([headerLine, ...dataLines].join("\n"));
                    }}
                  />
                ) : (
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
                )}

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

          {step === "validation" && !validationResult && (isLoading || isRevalidatingAfterMapping) && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <div className="text-center">
                    <h3 className="text-lg font-medium">Réanalyse en cours...</h3>
                    <p className="text-sm text-muted-foreground">
                      Les mappings enregistrés sont en train d'être repris dans ce fichier.
                    </p>
                  </div>
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
                  {(() => {
                    const isEstimated = validationResult.stats.totalRows > CHUNK_SIZE;
                    return (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-muted rounded-lg text-center">
                            <p className="text-2xl font-bold">{validationResult.stats.totalRows.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">Lignes totales</p>
                          </div>
                          <div className="p-4 bg-green-500/10 rounded-lg text-center">
                            <p className="text-2xl font-bold text-green-600">{isEstimated ? '~' : ''}{validationResult.stats.inserted.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">À insérer</p>
                          </div>
                          <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                            <p className="text-2xl font-bold text-blue-600">{isEstimated ? '~' : ''}{validationResult.stats.updated.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">À mettre à jour</p>
                          </div>
                          <div className={`p-4 rounded-lg text-center ${
                            validationResult.stats.skipped > 0 && validationResult.validation?.unknownStoreIds?.length > 0
                              ? 'bg-red-500/10 ring-2 ring-red-500/30'
                              : 'bg-amber-500/10'
                          }`}>
                            <p className={`text-2xl font-bold ${
                              validationResult.stats.skipped > 0 && validationResult.validation?.unknownStoreIds?.length > 0
                                ? 'text-red-600'
                                : 'text-amber-600'
                            }`}>{isEstimated ? '~' : ''}{validationResult.stats.skipped.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">À ignorer</p>
                            {validationResult.stats.skipped > 0 && validationResult.validation?.unknownStoreIds?.length > 0 && (
                              <p className="text-xs text-red-500 mt-1">⚠️ Restaurant(s) non reconnu(s)</p>
                            )}
                          </div>
                        </div>
                        {isEstimated && (
                          <Alert className="bg-blue-500/5 border-blue-500/20">
                            <HelpCircle className="h-4 w-4 text-blue-500" />
                            <AlertDescription className="text-sm text-muted-foreground">
                              Les compteurs sont des <strong>estimations</strong> basées sur un échantillon représentatif de 1 000 enregistrements répartis uniformément dans le fichier.
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    );
                  })()}

                  {/* Date range - special display for payout_summary */}
                  {validationResult.validation?.dateRange && (
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        {reportType === "payout_summary" && validationResult.validation?.salesPeriod ? (
                          <>
                            <p className="text-sm font-medium">Période de ventes</p>
                            <p className="text-sm text-muted-foreground">
                              Du {formatDate(validationResult.validation.salesPeriod.start)} au {formatDate(validationResult.validation.salesPeriod.end)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Date de versement : {formatDate(validationResult.validation.dateRange.start)}
                              {validationResult.validation.dateRange.start !== validationResult.validation.dateRange.end && 
                                ` au ${formatDate(validationResult.validation.dateRange.end)}`}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium">Période des données</p>
                            <p className="text-sm text-muted-foreground">
                              Du {formatDate(validationResult.validation.dateRange.start)} au {formatDate(validationResult.validation.dateRange.end)}
                            </p>
                          </>
                        )}
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

                   {/* Unknown store IDs - Blocking warning + Interactive mapping */}
                  {validationResult.validation?.unknownStoreIds && validationResult.validation.unknownStoreIds.length > 0 && (
                    <>
                      <Alert variant="destructive" className="border-red-500 bg-red-500/10">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-700">
                          ⚠️ {validationResult.validation.unknownStoreIds.length} restaurant(s) non reconnu(s) — {validationResult.stats.skipped.toLocaleString()} lignes seront ignorées
                        </AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <p className="text-sm">
                            Des données de ce fichier ne seront <strong>pas importées</strong> car les restaurants suivants ne sont pas reconnus dans votre base.
                            Utilisez le mapping ci-dessous pour les associer, puis revalidez le fichier.
                          </p>
                        </AlertDescription>
                      </Alert>
                      <UnknownStoreMapping
                        unknownStoreIds={validationResult.validation.unknownStoreIds}
                        unknownStoreDetails={validationResult.validation.unknownStoreDetails}
                        restaurants={allRestaurants}
                        selectedRestaurantId={selectedRestaurantId}
                        onMappingComplete={handleRevalidateAfterMapping}
                      />
                    </>
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

                  {(() => {
                    const hasUnknownStores = (validationResult.validation?.unknownStoreIds?.length ?? 0) > 0;
                    return (
                      <div className="space-y-3 pt-4 border-t">
                        {hasUnknownStores && (
                          <Alert variant="destructive" className="border-red-500 bg-red-500/10">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              <strong>Import bloqué :</strong> {validationResult.validation!.unknownStoreIds!.length} restaurant(s) non reconnu(s). 
                              Mappez-les ci-dessus puis revalidez, ou les <strong>{validationResult.stats.skipped.toLocaleString()} lignes</strong> correspondantes seront définitivement perdues.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={resetImport}>
                            Annuler
                          </Button>
                          <Button variant="outline" onClick={() => setStep("preview")}>
                            Retour à l'aperçu
                          </Button>
                          <Button onClick={handleImport} disabled={isLoading || hasUnknownStores}>
                            <Send className="h-4 w-4 mr-2" />
                            Confirmer l'import
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
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
                      {chunkProgress 
                        ? `Traitement du chunk ${chunkProgress.current}/${chunkProgress.total}`
                        : "Traitement du fichier, veuillez patienter"}
                    </p>
                  </div>
                  
                  {/* Progress bar with chunk info */}
                  {chunkProgress ? (
                    <div className="w-80 space-y-2">
                      <Progress value={chunkProgress.percent} className="w-full" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{chunkProgress.totalInserted.toLocaleString()} lignes importées</span>
                        <span>{Math.round(chunkProgress.percent)}%</span>
                      </div>
                      {chunkProgress.totalErrors > 0 && (
                        <p className="text-xs text-destructive text-center">
                          {chunkProgress.totalErrors} erreurs
                        </p>
                      )}
                    </div>
                  ) : (
                    <Progress value={undefined} className="w-64" />
                  )}
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
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
                  {(importResult.stats.merged ?? 0) > 0 && (
                    <div className="p-4 bg-violet-500/10 rounded-lg text-center relative group">
                      <p className="text-2xl font-bold text-violet-600">{importResult.stats.merged}</p>
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        Fusionnées
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </p>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-md shadow-md text-xs text-popover-foreground w-56 hidden group-hover:block z-10">
                        Lignes CSV fusionnées car elles concernent la même commande (ex: TVA multiples)
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-amber-500/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-600">{importResult.stats.skipped}</p>
                    <p className="text-sm text-muted-foreground">Ignorées</p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">{importResult.stats.errors}</p>
                    <p className="text-sm text-muted-foreground">Erreurs</p>
                  </div>
                  {((importResult.stats as any).adjustments ?? 0) > 0 && (
                    <div className="p-4 bg-cyan-500/10 rounded-lg text-center relative group">
                      <p className="text-2xl font-bold text-cyan-600">{(importResult.stats as any).adjustments}</p>
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        Ajustements
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </p>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-md shadow-md text-xs text-popover-foreground w-56 hidden group-hover:block z-10">
                        Lignes hors commandes (éco-contribution, frais pub, marketing, etc.) importées dans les ajustements
                      </div>
                    </div>
                  )}
                </div>
                {/* Coherence check */}
                {(() => {
                  const accounted = importResult.stats.inserted + importResult.stats.updated + importResult.stats.skipped + (importResult.stats.merged ?? 0) + importResult.stats.errors + ((importResult.stats as any).adjustments ?? 0);
                  const total = importResult.stats.totalRows;
                  const expandedRecords = (importResult.stats as any).expandedRecords;
                  
                  // If records were expanded (e.g. multiple items per order) or skipped includes duplicates,
                  // accounted can exceed total — this is normal, show info instead of warning
                  if (accounted > total && total > 0) {
                    return (
                      <Alert className="border-blue-500 bg-blue-500/10">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-blue-700">
                          ℹ️ {accounted.toLocaleString()} enregistrements traités à partir de {total.toLocaleString()} lignes (articles multiples ou doublons détectés)
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  // Allow small tolerance (1-2 lines) for header/empty rows not processed
                  const diff = total - accounted;
                  if (diff > 0 && diff <= 2 && total > 0) {
                    return null; // Minor difference, likely header/empty lines — no warning needed
                  }
                  if (accounted !== total && total > 0) {
                    return (
                      <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-sm text-amber-700">
                          ⚠️ Incohérence : {accounted.toLocaleString()} lignes comptabilisées sur {total.toLocaleString()} totales ({(total - accounted).toLocaleString()} non comptabilisées)
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}

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

                {/* Unknown store mapping - post-import resolution */}
                {importResult.validation?.unknownStoreIds && importResult.validation.unknownStoreIds.length > 0 && (
                  <UnknownStoreMapping
                    unknownStoreIds={importResult.validation.unknownStoreIds}
                    unknownStoreDetails={importResult.validation.unknownStoreDetails}
                    restaurants={allRestaurants}
                    selectedRestaurantId={selectedRestaurantId}
                    onMappingComplete={handleRevalidateAfterMapping}
                  />
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

        <TabsContent value="bulk" className="mt-6">
          <BulkImportTab restaurants={restaurants} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ImportHistory />
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  );
}
