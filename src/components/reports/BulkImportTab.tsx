import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, Trash2, Building2, Calendar, RefreshCw, ChevronRight, FileText, Undo2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  REPORT_TYPE_CONFIG as SHARED_REPORT_CONFIG, 
  getEdgeFunctionName, 
  getTargetTables,
  validateReportTypeForContent 
} from "@/lib/reportImportConfig";

// Mapping from report type to database tables for deletion (uses shared config)
const REPORT_TYPE_TABLES: Record<string, string[]> = Object.fromEntries(
  Object.entries(SHARED_REPORT_CONFIG).map(([key, config]) => [key, config.targetTables])
);

// Report type definitions with labels (derived from shared config)
const REPORT_TYPE_CONFIG: Record<string, { 
  label: string; 
  requiresRestaurant: boolean;
  edgeFunctionName: string;
}> = Object.fromEntries(
  Object.entries(SHARED_REPORT_CONFIG).map(([key, config]) => [
    key, 
    { 
      label: config.label, 
      requiresRestaurant: config.requiresRestaurant,
      // CRITICAL: Use getEdgeFunctionName to ensure guardrails are applied
      edgeFunctionName: getEdgeFunctionName(key),
    }
  ])
);

interface BulkFile {
  id: string;
  file: File;
  content: string;
  detectedType: string | null;
  detectionSource: "filename" | "content" | null;
  selectedType: string;
  dateRange: { start: string | null; end: string | null };
  restaurantId: string;
  autoDetectedRestaurant: string | null;
  status: "pending" | "ready" | "processing" | "success" | "error" | "config-error";
  error?: string;
  result?: {
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  selected: boolean;
}

interface BulkImportTabProps {
  restaurants: Array<{ id: string; name: string; city?: string }>;
}

// Parse CSV line handling quoted values
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Detect report type from filename (very reliable for Uber files)
const detectReportTypeFromFilename = (filename: string): string | null => {
  const name = filename.toLowerCase();
  
  // Sales Over Time
  if (name.includes("sales_over_time") || name.includes("sales-over-time") || name.includes("ventes_sur")) {
    return "sales_over_time";
  }
  
  // Payout summary - CHECK BEFORE payment reports (common_template can be payout too)
  if (name.includes("payout") || name.includes("versement") || name.includes("payment_summary") || name.includes("payout_summary")) {
    return "payout_summary";
  }
  
  // Marketing campaigns
  if (name.includes("marketing") || name.includes("offers") || name.includes("ads") || 
      name.includes("offres") || name.includes("campagnes")) {
    return "marketing_campaigns";
  }
  
  // Downtime report
  if (name.includes("menu_downtime") || name.includes("downtime") || name.includes("inactivite") ||
      name.includes("inactivité")) {
    return "downtime_report";
  }
  
  // Order history
  if (name.includes("order_history") || name.includes("order-history") || 
      name.includes("historique_commandes") || name.includes("historique-commandes")) {
    return "order_history";
  }
  
  // Conversion funnel
  if (name.includes("user_conversion") || name.includes("conversion") || 
      name.includes("entonnoir") || name.includes("tunnel")) {
    return "conversion_funnel";
  }
  
  // Reviews - item level (has sku in name)
  if ((name.includes("restaurant_rating") || name.includes("rating") || name.includes("avis")) && 
      (name.includes("sku") || name.includes("item") || name.includes("article"))) {
    return "reviews_item";
  }
  
  // Reviews - order level
  if (name.includes("restaurant_rating") || name.includes("rating") || name.includes("avis")) {
    return "reviews_order";
  }
  
  // Inaccurate orders
  if (name.includes("inaccurate_orders") || name.includes("inaccurate-orders") || 
      name.includes("commandes_incorrectes") || name.includes("erreur_commandes")) {
    return "inaccurate_orders";
  }
  
  // Item issues leaderboard
  if (name.includes("item_issues") || name.includes("item-issues") || 
      name.includes("articles_problematiques") || name.includes("problemes_articles")) {
    return "item_issues_leaderboard";
  }
  
  // Order accuracy summary
  if (name.includes("order_accuracy") || name.includes("accuracy") || 
      name.includes("precision_commandes") || name.includes("exactitude")) {
    return "order_accuracy_summary";
  }
  
  // Payment reports (common_template) - CHECK LAST as fallback
  // Only match if NOT already matched as payout_summary
  if (name.includes("common_template") || name.includes("payment")) {
    // Check if item level
    if (name.includes("item") || name.includes("article")) {
      return "payment_item_level";
    }
    return "payment_order_level";
  }
  
  return null;
};

// Auto-detect report type based on CSV headers
// CRITICAL: Order of detection matters! Item-level MUST be checked BEFORE payout_summary
// because item-level files also contain "Id. de référence du versement" column
const detectReportTypeFromContent = (headerLine: string): string | null => {
  const lowerHeader = headerLine.toLowerCase();
  
  // Helper: Check if this looks like item-level data (article/item columns present)
  const hasItemColumns = 
    lowerHeader.includes("nom du plat") || 
    lowerHeader.includes("titre de l'article") || 
    lowerHeader.includes("item title") ||
    lowerHeader.includes("nom du plat/de l'article") ||
    lowerHeader.includes("nom de l'article");
  
  // Helper: Check if this has order-level identifiers
  const hasOrderId = 
    lowerHeader.includes("id. de la commande") || 
    lowerHeader.includes("id de la commande") ||
    lowerHeader.includes("order id");
  
  const hasFlowId = 
    lowerHeader.includes("id. du flux") || 
    lowerHeader.includes("flow id");
  
  // =========================================================
  // PRIORITY 1: ITEM-LEVEL PAYMENT REPORTS (most specific)
  // These have order/flow IDs AND item columns
  // =========================================================
  if ((hasOrderId || hasFlowId) && hasItemColumns) {
    return "payment_item_level";
  }
  
  // =========================================================
  // PRIORITY 2: OTHER SPECIFIC REPORT TYPES
  // =========================================================
  
  // Marketing campaigns - Offers
  if ((lowerHeader.includes("type d'offre") || lowerHeader.includes("offer type")) && 
      (lowerHeader.includes("audience") || lowerHeader.includes("budget"))) {
    return "marketing_campaigns";
  }
  // Marketing campaigns - Ads
  if ((lowerHeader.includes("nom de la campagne") || lowerHeader.includes("campaign name")) && 
      (lowerHeader.includes("impressions") || lowerHeader.includes("clics") || lowerHeader.includes("clicks"))) {
    return "marketing_campaigns";
  }
  // Sales Over Time
  if ((lowerHeader.includes("période") || lowerHeader.includes("period")) && 
      (lowerHeader.includes("ventes") || lowerHeader.includes("sales"))) {
    return "sales_over_time";
  }
  // Reviews Order Level
  if ((lowerHeader.includes("note du restaurant") || lowerHeader.includes("restaurant rating")) && 
      (lowerHeader.includes("uuid de la commande") || lowerHeader.includes("order uuid"))) {
    return "reviews_order";
  }
  // Reviews Item Level
  if ((lowerHeader.includes("note de l'article") || lowerHeader.includes("item rating") || lowerHeader.includes("note article")) && 
      (lowerHeader.includes("titre de l'article") || lowerHeader.includes("item title") || lowerHeader.includes("titre article"))) {
    return "reviews_item";
  }
  // Downtime Report
  if ((lowerHeader.includes("ouverture du restaurant") || lowerHeader.includes("restaurant open")) && 
      (lowerHeader.includes("disponibilité du menu") || lowerHeader.includes("menu availability"))) {
    return "downtime_report";
  }
  // Order History - has order ID + specific time columns (NOT item columns)
  if (hasOrderId && !hasItemColumns &&
      (lowerHeader.includes("temps d'attente du coursier") || lowerHeader.includes("heure de la commande") || lowerHeader.includes("courier wait time"))) {
    return "order_history";
  }
  // Inaccurate Orders (detail)
  if ((lowerHeader.includes("problème avec la commande") || lowerHeader.includes("articles incorrects") || lowerHeader.includes("order issue")) &&
      (lowerHeader.includes("client remboursé") || lowerHeader.includes("customer refund"))) {
    return "inaccurate_orders";
  }
  // Item Issues Leaderboard
  if ((lowerHeader.includes("articles incorrects") || lowerHeader.includes("incorrect items")) && 
      lowerHeader.includes("nombre") &&
      (lowerHeader.includes("problème avec le plat") || lowerHeader.includes("dish issue"))) {
    return "item_issues_leaderboard";
  }
  // Order Accuracy Summary
  if ((lowerHeader.includes("jour") || lowerHeader.includes("mois") || lowerHeader.includes("day") || lowerHeader.includes("month")) && 
      (lowerHeader.includes("commandes incorrectes") || lowerHeader.includes("articles manquants") || lowerHeader.includes("inaccurate orders"))) {
    return "order_accuracy_summary";
  }
  // Conversion Funnel
  if ((lowerHeader.includes("utilisateurs ayant visité") || lowerHeader.includes("utilisateurs ayant visite") || lowerHeader.includes("users who visited")) &&
      (lowerHeader.includes("menu a été consulté") || lowerHeader.includes("menu consulté") || lowerHeader.includes("plat ajouté") || lowerHeader.includes("item added"))) {
    return "conversion_funnel";
  }
  
  // =========================================================
  // PRIORITY 3: PAYOUT SUMMARY (aggregated data, NO order IDs)
  // CRITICAL: Only detect as payout_summary if NO order ID present!
  // =========================================================
  if (!hasOrderId && !hasFlowId) {
    // Has order count + total amount = aggregated payout summary
    if ((lowerHeader.includes("nombre de commandes") || lowerHeader.includes("order count")) &&
        (lowerHeader.includes("montant total") || lowerHeader.includes("total amount") || lowerHeader.includes("order total"))) {
      return "payout_summary";
    }
    // Has payout-specific identifiers
    if ((lowerHeader.includes("identifiant de versement") || lowerHeader.includes("payout id") ||
         lowerHeader.includes("id. de référence du versement") || lowerHeader.includes("payout reference"))) {
      return "payout_summary";
    }
    if ((lowerHeader.includes("date du versement") || lowerHeader.includes("date de versement") || lowerHeader.includes("payout date"))) {
      return "payout_summary";
    }
  }
  
  // =========================================================
  // PRIORITY 4: ORDER-LEVEL PAYMENT REPORTS (fallback)
  // Has order/flow IDs but no item columns
  // =========================================================
  if (hasOrderId || hasFlowId) {
    return "payment_order_level";
  }
  
  return null;
};

// Extract date range from CSV content
const extractDateRange = (content: string, reportType: string): { start: string | null; end: string | null } => {
  const lines = content.split("\n").filter(l => l.trim());
  
  // For conversion funnel - look for specific date columns
  if (reportType === "conversion_funnel") {
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].includes("Date de début") || lines[i].includes("Date de fin")) {
        const headers = parseCSVLine(lines[i]);
        const startDateIdx = headers.findIndex(h => h.toLowerCase().includes("date de début"));
        const endDateIdx = headers.findIndex(h => h.toLowerCase().includes("date de fin"));
        
        for (let j = i + 1; j < lines.length; j++) {
          const values = parseCSVLine(lines[j]);
          if (values.some(v => v.includes("Cette période"))) {
            const startStr = values[startDateIdx] || null;
            const endStr = values[endDateIdx] || null;
            
            const parseDate = (str: string | null): string | null => {
              if (!str) return null;
              const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
              const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
              if (isoMatch) return str;
              return null;
            };
            
            return { start: parseDate(startStr), end: parseDate(endStr) };
          }
        }
      }
    }
  }
  
  // Generic date extraction - look for date patterns in first rows
  const datePattern = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  const dates: string[] = [];
  
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    const matches = lines[i].match(datePattern);
    if (matches) {
      matches.forEach(m => {
        // Normalize to YYYY-MM-DD
        const isoMatch = m.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          dates.push(m);
        } else {
          const frMatch = m.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (frMatch) {
            dates.push(`${frMatch[3]}-${frMatch[2].padStart(2, '0')}-${frMatch[1].padStart(2, '0')}`);
          }
        }
      });
    }
  }
  
  if (dates.length > 0) {
    dates.sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }
  
  return { start: null, end: null };
};

// Try to find restaurant from store_id in content
const findRestaurantFromContent = (content: string, restaurants: Array<{ id: string; name: string; city?: string }>): string | null => {
  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length < 2) return null;
  
  // Look for store_id column
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  const storeIdIndex = headers.findIndex(h => 
    h.toLowerCase().includes("store id") || 
    h.toLowerCase().includes("store_id") ||
    h.toLowerCase().includes("id du restaurant")
  );
  
  if (storeIdIndex >= 0 && lines.length > 1) {
    const firstDataRow = parseCSVLine(lines[1]);
    const storeId = firstDataRow[storeIdIndex]?.trim();
    if (storeId) {
      // Find matching restaurant
      const found = restaurants.find(r => r.id === storeId);
      if (found) return found.id;
    }
  }
  
  return null;
};

export default function BulkImportTab({ restaurants }: BulkImportTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [step, setStep] = useState<"select-restaurant" | "upload" | "configure" | "importing" | "complete">("select-restaurant");
  const [progress, setProgress] = useState(0);
  const [selectAll, setSelectAll] = useState(true);
  const [defaultRestaurantId, setDefaultRestaurantId] = useState<string>("");
  const [preSelectedRestaurant, setPreSelectedRestaurant] = useState<string>("");
  const [isCanceling, setIsCanceling] = useState(false);
  const bulkImportIdRef = useRef<string | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const getSelectedRestaurantName = () => {
    const restaurant = restaurants.find(r => r.id === preSelectedRestaurant);
    return restaurant ? `${restaurant.name}${restaurant.city ? ` (${restaurant.city})` : ""}` : "";
  };

  const processFile = async (file: File, preRestaurantId: string): Promise<BulkFile> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const lines = content.split("\n").filter(l => l.trim());
        
        // Find header row (skip metadata rows)
        let headerLine = "";
        for (let i = 0; i < Math.min(10, lines.length); i++) {
          const line = lines[i];
          // Skip lines that look like metadata
          if (!line.startsWith("Téléchargé le") && 
              !line.startsWith("Rapport :") &&
              !line.includes("Légende du rapport") &&
              line.includes(",")) {
            headerLine = line;
            break;
          }
        }
        
        // First try filename-based detection (most reliable)
        const typeFromFilename = detectReportTypeFromFilename(file.name);
        // Fallback to content-based detection
        const typeFromContent = detectReportTypeFromContent(headerLine);
        
        const detectedType = typeFromFilename || typeFromContent;
        const detectionSource: "filename" | "content" | null = typeFromFilename ? "filename" : (typeFromContent ? "content" : null);
        
        const dateRange = extractDateRange(content, detectedType || "");
        const autoRestaurant = findRestaurantFromContent(content, restaurants);
        
        const config = detectedType ? REPORT_TYPE_CONFIG[detectedType] : null;
        const needsRestaurant = config?.requiresRestaurant ?? false;
        
        // Use pre-selected restaurant for types that require it, or auto-detected if available
        const restaurantId = needsRestaurant ? (preRestaurantId || autoRestaurant || "") : (autoRestaurant || "");
        const hasRestaurant = !!restaurantId;
        
        resolve({
          id: generateId(),
          file,
          content,
          detectedType,
          detectionSource,
          selectedType: detectedType || "",
          dateRange,
          restaurantId,
          autoDetectedRestaurant: autoRestaurant,
          status: !detectedType ? "config-error" : 
                  (needsRestaurant && !hasRestaurant) ? "config-error" : "ready",
          error: !detectedType ? "Type non détecté" : 
                 (needsRestaurant && !hasRestaurant) ? "Restaurant requis" : undefined,
          selected: true,
        });
      };
      reader.readAsText(file);
    });
  };

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".csv"));
    
    if (droppedFiles.length === 0) {
      toast({
        title: "Aucun fichier CSV",
        description: "Veuillez déposer des fichiers CSV uniquement",
        variant: "destructive",
      });
      return;
    }
    
    const processedFiles = await Promise.all(droppedFiles.map(f => processFile(f, preSelectedRestaurant)));
    setFiles(prev => [...prev, ...processedFiles]);
    setStep("configure");
  }, [restaurants, toast, preSelectedRestaurant]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(f => f.name.endsWith(".csv"));
    
    if (selectedFiles.length === 0) return;
    
    const processedFiles = await Promise.all(selectedFiles.map(f => processFile(f, preSelectedRestaurant)));
    setFiles(prev => [...prev, ...processedFiles]);
    setStep("configure");
  }, [restaurants, preSelectedRestaurant]);

  const updateFile = (id: string, updates: Partial<BulkFile>) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, ...updates };
      
      // Recalculate status
      const config = updated.selectedType ? REPORT_TYPE_CONFIG[updated.selectedType] : null;
      const needsRestaurant = config?.requiresRestaurant ?? false;
      
      if (!updated.selectedType) {
        updated.status = "config-error";
        updated.error = "Type requis";
      } else if (needsRestaurant && !updated.restaurantId) {
        updated.status = "config-error";
        updated.error = "Restaurant requis";
      } else {
        updated.status = "ready";
        updated.error = undefined;
      }
      
      return updated;
    }));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const applyRestaurantToAll = () => {
    if (!defaultRestaurantId) return;
    setFiles(prev => prev.map(f => {
      const config = f.selectedType ? REPORT_TYPE_CONFIG[f.selectedType] : null;
      const needsRestaurant = config?.requiresRestaurant ?? false;
      
      if (needsRestaurant && !f.restaurantId) {
        return {
          ...f,
          restaurantId: defaultRestaurantId,
          status: "ready" as const,
          error: undefined,
        };
      }
      return f;
    }));
  };

  const toggleSelectAll = () => {
    const newValue = !selectAll;
    setSelectAll(newValue);
    setFiles(prev => prev.map(f => ({ ...f, selected: newValue })));
  };

  const startImport = async () => {
    const filesToImport = files.filter(f => f.selected && f.status === "ready");
    
    if (filesToImport.length === 0) {
      toast({
        title: "Aucun fichier prêt",
        description: "Configurez les fichiers avant de lancer l'import",
        variant: "destructive",
      });
      return;
    }

    // Generate unique bulk import ID for this session
    bulkImportIdRef.current = crypto.randomUUID();

    setStep("importing");
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToImport.length; i++) {
      const bulkFile = filesToImport[i];
      const config = REPORT_TYPE_CONFIG[bulkFile.selectedType];
      
      // Update status to processing
      setFiles(prev => prev.map(f => 
        f.id === bulkFile.id ? { ...f, status: "processing" as const } : f
      ));

      try {
        // Build request body based on report type
        let body: Record<string, any> = {
          csvContent: bulkFile.content,
          fileName: bulkFile.file.name, // Required by some edge functions to extract date range
        };
        
        // Add restaurant if required
        if (config.requiresRestaurant) {
          body.restaurantId = bulkFile.restaurantId;
        }
        
        // Special handling for payment reports
        if (bulkFile.selectedType === "payment_order_level") {
          body.level = "order";
        } else if (bulkFile.selectedType === "payment_item_level") {
          body.level = "item";
        }

        const { data, error } = await supabase.functions.invoke(config.edgeFunctionName, {
          body,
        });

        if (error) throw error;

        // Update file with success
        setFiles(prev => prev.map(f => 
          f.id === bulkFile.id ? {
            ...f,
            status: "success" as const,
            result: {
              inserted: data.stats?.inserted || 0,
              updated: data.stats?.updated || 0,
              skipped: data.stats?.skipped || 0,
              errors: data.stats?.errors || 0,
            },
          } : f
        ));

        // Record in csv_imports with bulk_import_id
        await supabase.from("csv_imports").insert({
          file_name: bulkFile.file.name,
          file_size: bulkFile.file.size,
          report_type: bulkFile.selectedType,
          total_rows: data.stats?.totalRows || 0,
          inserted_count: data.stats?.inserted || 0,
          updated_count: data.stats?.updated || 0,
          skipped_count: data.stats?.skipped || 0,
          error_count: data.stats?.errors || 0,
          status: "completed",
          date_range_start: bulkFile.dateRange.start,
          date_range_end: bulkFile.dateRange.end,
          restaurants_count: bulkFile.restaurantId ? 1 : (data.validation?.restaurants?.length || 0),
          restaurant_ids: bulkFile.restaurantId ? [bulkFile.restaurantId] : (data.validation?.restaurants?.map((r: any) => r.id) || []),
          bulk_import_id: bulkImportIdRef.current,
        });

        successCount++;
      } catch (error: any) {
        console.error(`Error importing ${bulkFile.file.name}:`, error);
        setFiles(prev => prev.map(f => 
          f.id === bulkFile.id ? {
            ...f,
            status: "error" as const,
            error: error.message || "Erreur d'import",
          } : f
        ));
        errorCount++;
      }

      setProgress(((i + 1) / filesToImport.length) * 100);
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["csv-imports"] });
    
    setStep("complete");
    
    toast({
      title: successCount === filesToImport.length ? "Import terminé" : "Import partiel",
      description: `${successCount}/${filesToImport.length} fichiers importés avec succès`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const resetImport = () => {
    setFiles([]);
    setStep("select-restaurant");
    setProgress(0);
    setDefaultRestaurantId("");
    setPreSelectedRestaurant("");
    bulkImportIdRef.current = null;
  };

  const goBackToRestaurantSelection = () => {
    setFiles([]);
    setStep("select-restaurant");
  };

  // Cancel import and delete imported data
  const cancelImport = async () => {
    if (!bulkImportIdRef.current) {
      toast({
        title: "Erreur",
        description: "Impossible d'identifier la session d'import",
        variant: "destructive",
      });
      return;
    }

    setIsCanceling(true);
    const errors: string[] = [];

    try {
      // Get successfully imported files
      const successFiles = files.filter(f => f.status === "success");
      
      // Delete data from each table based on report type, restaurant, and date range
      for (const file of successFiles) {
        const tables = REPORT_TYPE_TABLES[file.selectedType] || [];
        
        for (const tableName of tables) {
          try {
            // Determine the date column for each table
            const dateColumn = tableName === "orders" ? "order_time" : 
                               tableName === "order_items" ? "created_at" :
                               tableName === "customer_reviews" ? "order_date" :
                               tableName === "menu_item_reviews" ? "review_date" :
                               tableName === "hourly_availability" ? "hour_start" :
                               tableName === "promotions" ? "start_date" :
                               "date";
            
            // Build conditions for the delete query
            const conditions: string[] = [];
            const params: Record<string, any> = {};
            
            if (file.restaurantId) {
              conditions.push(`restaurant_id = '${file.restaurantId}'`);
            }
            
            if (file.dateRange.start && file.dateRange.end) {
              if (tableName === "orders") {
                conditions.push(`${dateColumn} >= '${file.dateRange.start}T00:00:00'`);
                conditions.push(`${dateColumn} <= '${file.dateRange.end}T23:59:59'`);
              } else {
                conditions.push(`${dateColumn} >= '${file.dateRange.start}'`);
                conditions.push(`${dateColumn} <= '${file.dateRange.end}'`);
              }
            }
            
            // Only proceed if we have conditions (to avoid deleting everything)
            if (conditions.length > 0) {
              const whereClause = conditions.join(" AND ");
              
              // Use rpc to execute delete - safer approach that bypasses type issues
              const { error: deleteError } = await supabase.rpc("delete_imported_data" as any, {
                p_table_name: tableName,
                p_where_clause: whereClause,
              }).maybeSingle();
              
              // If rpc doesn't exist, try direct delete on known tables
              if (deleteError?.message?.includes("function") || deleteError?.code === "42883") {
                // Fallback: use direct queries for known tables only
                if (tableName === "daily_sales_uber") {
                  const query = supabase.from("daily_sales_uber").delete();
                  if (file.restaurantId) {
                    await query
                      .eq("restaurant_id", file.restaurantId)
                      .gte("date", file.dateRange.start || "1900-01-01")
                      .lte("date", file.dateRange.end || "2100-12-31");
                  }
                } else if (tableName === "customer_reviews") {
                  const query = supabase.from("customer_reviews").delete();
                  if (file.restaurantId) {
                    await query
                      .eq("restaurant_id", file.restaurantId)
                      .gte("order_date", file.dateRange.start || "1900-01-01")
                      .lte("order_date", file.dateRange.end || "2100-12-31");
                  }
                } else if (tableName === "daily_conversion") {
                  const query = supabase.from("daily_conversion").delete();
                  if (file.restaurantId) {
                    await query
                      .eq("restaurant_id", file.restaurantId)
                      .gte("date", file.dateRange.start || "1900-01-01")
                      .lte("date", file.dateRange.end || "2100-12-31");
                  }
                } else if (tableName === "hourly_availability") {
                  const query = supabase.from("hourly_availability").delete();
                  if (file.restaurantId) {
                    await query
                      .eq("restaurant_id", file.restaurantId)
                      .gte("hour_start", file.dateRange.start || "1900-01-01")
                      .lte("hour_start", file.dateRange.end || "2100-12-31");
                  }
                } else if (tableName === "promotions") {
                  const query = supabase.from("promotions").delete();
                  if (file.restaurantId) {
                    await query
                      .eq("restaurant_id", file.restaurantId)
                      .gte("start_date", file.dateRange.start || "1900-01-01")
                      .lte("start_date", file.dateRange.end || "2100-12-31");
                  }
                } else if (tableName === "orders") {
                  const query = supabase.from("orders").delete();
                  if (file.restaurantId) {
                    await query
                      .eq("restaurant_id", file.restaurantId)
                      .gte("order_time", `${file.dateRange.start || "1900-01-01"}T00:00:00`)
                      .lte("order_time", `${file.dateRange.end || "2100-12-31"}T23:59:59`);
                  }
                }
                // For tables that don't match, we skip silently
              } else if (deleteError) {
                errors.push(`${tableName}: ${deleteError.message}`);
              }
            }
          } catch (err: any) {
            errors.push(`${tableName}: ${err.message}`);
          }
        }
      }

      // Delete csv_imports entries for this bulk import
      const { error: csvError } = await supabase
        .from("csv_imports")
        .delete()
        .eq("bulk_import_id", bulkImportIdRef.current);
      
      if (csvError) {
        errors.push(`csv_imports: ${csvError.message}`);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries();

      if (errors.length > 0) {
        toast({
          title: "Annulation partielle",
          description: `Import annulé avec ${errors.length} erreur(s)`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Import annulé",
          description: `Les données importées ont été supprimées`,
        });
      }

      resetImport();
    } catch (error: any) {
      toast({
        title: "Erreur lors de l'annulation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const readyCount = files.filter(f => f.selected && f.status === "ready").length;
  const errorCount = files.filter(f => f.status === "config-error").length;
  const successCount = files.filter(f => f.status === "success").length;
  const failedCount = files.filter(f => f.status === "error").length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const getRestaurantName = (id: string) => {
    const restaurant = restaurants.find(r => r.id === id);
    return restaurant ? `${restaurant.name}${restaurant.city ? ` (${restaurant.city})` : ""}` : "";
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Restaurant Selection */}
      {step === "select-restaurant" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Étape 1 : Sélectionnez le restaurant
            </CardTitle>
            <CardDescription>
              Choisissez le restaurant pour lequel vous allez importer les fichiers.
              Tous les fichiers ajoutés seront automatiquement associés à ce restaurant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-md">
              <Select value={preSelectedRestaurant} onValueChange={setPreSelectedRestaurant}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Choisir un restaurant..." />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}{r.city ? ` (${r.city})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setStep("upload")} 
                disabled={!preSelectedRestaurant}
                className="gap-2"
              >
                Continuer
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <span className="text-sm text-muted-foreground">
                ou
              </span>
              
              <Button 
                variant="outline"
                onClick={() => {
                  setPreSelectedRestaurant("");
                  setStep("upload");
                }}
              >
                Importer sans pré-sélection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload Zone */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Étape 2 : Ajoutez vos fichiers
                </CardTitle>
                <CardDescription>
                  {preSelectedRestaurant ? (
                    <span className="flex items-center gap-2 mt-1">
                      <Building2 className="h-4 w-4" />
                      Restaurant sélectionné : <strong>{getSelectedRestaurantName()}</strong>
                    </span>
                  ) : (
                    "Importez plusieurs fichiers CSV - le restaurant sera assigné automatiquement ou manuellement"
                  )}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={goBackToRestaurantSelection}>
                Changer de restaurant
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                multiple
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="bulk-file-input"
              />
              <label htmlFor="bulk-file-input" className="cursor-pointer">
                <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Déposez vos fichiers CSV ici
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou cliquez pour sélectionner
                </p>
                <p className="text-xs text-muted-foreground">
                  Tous types de rapports acceptés • Détection automatique du type
                </p>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Table */}
      {(step === "configure" || step === "importing" || step === "complete") && files.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  {files.length} fichier{files.length > 1 ? "s" : ""} 
                  {preSelectedRestaurant && (
                    <span className="font-normal text-muted-foreground">
                      pour {getSelectedRestaurantName()}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {step === "configure" && `${readyCount} prêt${readyCount > 1 ? "s" : ""} à importer${errorCount > 0 ? ` • ${errorCount} nécessite${errorCount > 1 ? "nt" : ""} configuration` : ""}`}
                  {step === "importing" && "Import en cours..."}
                  {step === "complete" && `${successCount} réussi${successCount > 1 ? "s" : ""}${failedCount > 0 ? ` • ${failedCount} échoué${failedCount > 1 ? "s" : ""}` : ""}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {step === "configure" && (
                  <>
                    <Select value={defaultRestaurantId} onValueChange={setDefaultRestaurantId}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Appliquer resto à tous" />
                      </SelectTrigger>
                      <SelectContent>
                        {restaurants.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={applyRestaurantToAll} disabled={!defaultRestaurantId}>
                      Appliquer
                    </Button>
                  </>
                )}
                {step === "configure" && (
                  <Button variant="ghost" size="icon" onClick={() => document.getElementById("bulk-file-input-add")?.click()}>
                    <Upload className="h-4 w-4" />
                  </Button>
                )}
                <input
                  type="file"
                  multiple
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="bulk-file-input-add"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {step === "importing" && (
              <div className="mb-4">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {Math.round(progress)}% - Import en cours...
                </p>
              </div>
            )}
            
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {step === "configure" && (
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={selectAll} 
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead>Fichier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    {step === "complete" && (
                      <TableHead className="text-center">Résultat</TableHead>
                    )}
                    {step === "configure" && (
                      <TableHead className="w-10"></TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((bulkFile) => {
                    const config = bulkFile.selectedType ? REPORT_TYPE_CONFIG[bulkFile.selectedType] : null;
                    const needsRestaurant = config?.requiresRestaurant ?? false;
                    
                    return (
                      <TableRow key={bulkFile.id} className={!bulkFile.selected ? "opacity-50" : ""}>
                        {step === "configure" && (
                          <TableCell>
                            <Checkbox 
                              checked={bulkFile.selected}
                              onCheckedChange={(checked) => updateFile(bulkFile.id, { selected: !!checked })}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="max-w-[180px]">
                            <p className="font-medium truncate text-sm" title={bulkFile.file.name}>
                              {bulkFile.file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(bulkFile.file.size / 1024).toFixed(1)} Ko
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {step === "configure" ? (
                            <div className="space-y-1">
                              <Select 
                                value={bulkFile.selectedType} 
                                onValueChange={(v) => updateFile(bulkFile.id, { selectedType: v })}
                              >
                                <SelectTrigger className="w-[160px] h-8 text-xs">
                                  <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(REPORT_TYPE_CONFIG).map(([key, cfg]) => (
                                    <SelectItem key={key} value={key} className="text-xs">
                                      {cfg.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {bulkFile.detectionSource && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {bulkFile.detectionSource === "filename" ? "Détecté (fichier)" : "Détecté (contenu)"}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {config?.label || bulkFile.selectedType}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {bulkFile.dateRange.start ? (
                            <>
                              {formatDate(bulkFile.dateRange.start)}
                              {bulkFile.dateRange.end && bulkFile.dateRange.end !== bulkFile.dateRange.start && (
                                <> → {formatDate(bulkFile.dateRange.end)}</>
                              )}
                            </>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {needsRestaurant ? (
                            step === "configure" ? (
                              <Select 
                                value={bulkFile.restaurantId} 
                                onValueChange={(v) => updateFile(bulkFile.id, { restaurantId: v })}
                              >
                                <SelectTrigger className={`w-[160px] h-8 text-xs ${!bulkFile.restaurantId ? "border-destructive" : ""}`}>
                                  <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {restaurants.map((r) => (
                                    <SelectItem key={r.id} value={r.id} className="text-xs">
                                      {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs">
                                {getRestaurantName(bulkFile.restaurantId) || "-"}
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {bulkFile.autoDetectedRestaurant ? (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  Auto
                                </span>
                              ) : (
                                "N/A"
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {bulkFile.status === "ready" && (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                              Prêt
                            </Badge>
                          )}
                          {bulkFile.status === "config-error" && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                              {bulkFile.error}
                            </Badge>
                          )}
                          {bulkFile.status === "processing" && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Import...
                            </Badge>
                          )}
                          {bulkFile.status === "success" && (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                          {bulkFile.status === "error" && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Erreur
                            </Badge>
                          )}
                        </TableCell>
                        {step === "complete" && (
                          <TableCell className="text-center text-xs">
                            {bulkFile.result ? (
                              <span>
                                +{bulkFile.result.inserted} / ~{bulkFile.result.updated}
                              </span>
                            ) : bulkFile.error ? (
                              <span className="text-destructive">{bulkFile.error}</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        )}
                        {step === "configure" && (
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFile(bulkFile.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Summary after import */}
      {step === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {failedCount === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {failedCount === 0 ? "Import terminé avec succès" : "Import terminé avec erreurs"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{files.length}</p>
                <p className="text-sm text-muted-foreground">Fichiers traités</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{successCount}</p>
                <p className="text-sm text-muted-foreground">Réussis</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{failedCount}</p>
                <p className="text-sm text-muted-foreground">Erreurs</p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {files.filter(f => f.status === "success").reduce((sum, f) => sum + (f.result?.inserted || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Lignes insérées</p>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" disabled={isCanceling || successCount === 0}>
                    {isCanceling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4" />
                    )}
                    Annuler l'import
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Confirmer l'annulation
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        Cette action va <strong>supprimer toutes les données</strong> importées lors de cette session :
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li><strong>{successCount}</strong> fichier{successCount > 1 ? "s" : ""} importé{successCount > 1 ? "s" : ""}</li>
                        <li><strong>{files.filter(f => f.status === "success").reduce((sum, f) => sum + (f.result?.inserted || 0), 0)}</strong> lignes insérées</li>
                        {preSelectedRestaurant && (
                          <li>Restaurant : <strong>{getSelectedRestaurantName()}</strong></li>
                        )}
                      </ul>
                      <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Attention :</strong> Si d'autres imports ont été faits pour le même restaurant et la même période, ils pourraient aussi être affectés.
                        </AlertDescription>
                      </Alert>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Garder les données</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={cancelImport}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer les données
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button variant="outline" onClick={resetImport}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Nouvel import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {step === "configure" && (
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={goBackToRestaurantSelection}>
            Annuler
          </Button>
          <Button 
            onClick={startImport} 
            disabled={readyCount === 0}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Importer {readyCount} fichier{readyCount > 1 ? "s" : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
