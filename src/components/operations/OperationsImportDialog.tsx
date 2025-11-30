import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OperationsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurants: Array<{ id: string; name: string }>;
}

interface ParsedError {
  date: string;
  errorType: string;
  itemTitle: string | null;
  itemId: string | null;
  customization: string | null;
  financialImpact: number;
  errorDescription: string | null;
  customerName: string | null;
  orderId: string | null;
}

type ImportStep = "upload" | "preview" | "importing" | "complete";

export function OperationsImportDialog({
  open,
  onOpenChange,
  restaurants,
}: OperationsImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedError[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetState = () => {
    setStep("upload");
    setSelectedRestaurant("");
    setParsedData([]);
    setImportProgress(0);
    setImportedCount(0);
    setErrorCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split("\n");
    return lines.map((line) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const parsePrice = (value: string): number => {
    if (!value) return 0;
    // Handle French format: "1 234,56" or "1234.56"
    const cleaned = value
      .replace(/[€$\s]/g, "")
      .replace(/\s/g, "")
      .replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const parseDate = (dateStr: string): string => {
    // Handle various date formats
    // DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD
    if (!dateStr) return new Date().toISOString();

    // Try ISO format first
    if (dateStr.includes("-")) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date.toISOString();
    }

    // Try French format DD/MM/YYYY
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(date.getTime())) return date.toISOString();
    }

    return new Date().toISOString();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.endsWith(".csv");
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (!isCSV && !isExcel) {
      toast({
        title: "Format non supporté",
        description: "Veuillez importer un fichier CSV ou Excel (.xlsx)",
        variant: "destructive",
      });
      return;
    }

    try {
      let rows: string[][] = [];

      if (isCSV) {
        const text = await file.text();
        rows = parseCSV(text);
      } else {
        // For Excel, we need to use a library - for now, suggest CSV
        toast({
          title: "Excel non supporté",
          description: "Pour l'instant, veuillez exporter votre fichier Excel en CSV avant l'import.",
          variant: "destructive",
        });
        return;
      }

      if (rows.length < 2) {
        toast({
          title: "Fichier vide",
          description: "Le fichier ne contient pas de données à importer.",
          variant: "destructive",
        });
        return;
      }

      // Find header row and map columns
      const headers = rows[0].map((h) => h.toLowerCase().trim());
      
      // Column mapping based on Uber Eats export format
      const dateIdx = headers.findIndex((h) => 
        h.includes("date") || h.includes("jour")
      );
      const errorTypeIdx = headers.findIndex((h) => 
        h.includes("type") || h.includes("issue") || h.includes("problème") || h.includes("raison")
      );
      const itemIdx = headers.findIndex((h) => 
        h.includes("item") || h.includes("article") || h.includes("produit")
      );
      const customIdx = headers.findIndex((h) => 
        h.includes("custom") || h.includes("personnalis")
      );
      const amountIdx = headers.findIndex((h) => 
        h.includes("refund") || h.includes("remboursement") || h.includes("montant") || h.includes("amount")
      );
      const descIdx = headers.findIndex((h) => 
        h.includes("description") || h.includes("détail") || h.includes("detail")
      );
      const orderIdx = headers.findIndex((h) => 
        h.includes("order") || h.includes("commande")
      );

      const parsed: ParsedError[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2 || row.every((cell) => !cell.trim())) continue;

        const errorType = errorTypeIdx >= 0 ? row[errorTypeIdx]?.trim() : "Erreur non spécifiée";
        const financialImpact = amountIdx >= 0 ? parsePrice(row[amountIdx]) : 0;

        // Skip rows without meaningful data
        if (!errorType && financialImpact === 0) continue;

        parsed.push({
          date: dateIdx >= 0 ? parseDate(row[dateIdx]) : new Date().toISOString(),
          errorType: errorType || "Erreur non spécifiée",
          itemTitle: itemIdx >= 0 ? row[itemIdx]?.trim() || null : null,
          itemId: null,
          customization: customIdx >= 0 ? row[customIdx]?.trim() || null : null,
          financialImpact,
          errorDescription: descIdx >= 0 ? row[descIdx]?.trim() || null : null,
          customerName: null,
          orderId: orderIdx >= 0 ? row[orderIdx]?.trim() || null : null,
        });
      }

      if (parsed.length === 0) {
        toast({
          title: "Aucune donnée",
          description: "Aucune erreur de commande n'a pu être extraite du fichier.",
          variant: "destructive",
        });
        return;
      }

      setParsedData(parsed);
      setStep("preview");

      toast({
        title: "Fichier analysé",
        description: `${parsed.length} erreurs de commande détectées.`,
      });
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({
        title: "Erreur de lecture",
        description: "Impossible de lire le fichier.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedRestaurant) {
      toast({
        title: "Restaurant requis",
        description: "Veuillez sélectionner un restaurant.",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    let imported = 0;
    let errors = 0;

    const batchSize = 50;
    const batches = Math.ceil(parsedData.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = parsedData.slice(i * batchSize, (i + 1) * batchSize);
      
      const records = batch.map((item) => ({
        restaurant_id: selectedRestaurant,
        error_date: item.date,
        error_type: item.errorType,
        error_category: categorizeError(item.errorType),
        item_title: item.itemTitle,
        item_id: item.itemId,
        error_description: item.errorDescription || item.customization,
        financial_impact: item.financialImpact,
        customer_name: item.customerName,
        uber_order_id: item.orderId,
      }));

      const { error } = await supabase
        .from("order_errors")
        .insert(records);

      if (error) {
        console.error("Import error:", error);
        errors += batch.length;
      } else {
        imported += batch.length;
      }

      setImportProgress(((i + 1) / batches) * 100);
      setImportedCount(imported);
      setErrorCount(errors);
    }

    setStep("complete");
    queryClient.invalidateQueries({ queryKey: ["order-errors"] });
    queryClient.invalidateQueries({ queryKey: ["order-accuracy-stats"] });

    toast({
      title: "Import terminé",
      description: `${imported} erreurs importées${errors > 0 ? `, ${errors} échecs` : ""}.`,
    });
  };

  const categorizeError = (errorType: string): string => {
    const type = errorType.toLowerCase();
    if (type.includes("missing") || type.includes("manquant")) return "missing_item";
    if (type.includes("wrong") || type.includes("incorrect") || type.includes("mauvais")) return "wrong_item";
    if (type.includes("quality") || type.includes("qualité")) return "quality";
    if (type.includes("late") || type.includes("retard")) return "late";
    if (type.includes("damaged") || type.includes("endommagé")) return "damaged";
    return "other";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const totalImpact = parsedData.reduce((sum, item) => sum + item.financialImpact, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importer des données opérationnelles</DialogTitle>
          <DialogDescription>
            Importez les rapports d'erreurs de commandes depuis Uber Eats
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Restaurant concerné</Label>
              <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">
                Glissez un fichier CSV ici ou cliquez pour parcourir
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Formats supportés : CSV (export Uber Eats "Order Accuracy")
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Comment obtenir ce fichier ?
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Connectez-vous à Uber Eats Manager</li>
                <li>Allez dans "Performance" → "Order Accuracy"</li>
                <li>Sélectionnez la période souhaitée</li>
                <li>Cliquez sur "Export" → "CSV"</li>
                <li>Importez le fichier téléchargé ici</li>
              </ol>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg py-1">
                  {parsedData.length} erreurs détectées
                </Badge>
                <Badge variant="destructive" className="text-lg py-1">
                  Impact: {formatCurrency(totalImpact)}
                </Badge>
              </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type d'erreur</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 100).map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {new Date(item.date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.errorType}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.itemTitle || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.financialImpact)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 100 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ... et {parsedData.length - 100} autres erreurs
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Retour
              </Button>
              <Button onClick={handleImport} disabled={!selectedRestaurant}>
                <Upload className="mr-2 h-4 w-4" />
                Importer {parsedData.length} erreurs
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-6 py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">Import en cours...</p>
              <p className="text-muted-foreground">
                {importedCount} / {parsedData.length} erreurs importées
              </p>
            </div>
            <Progress value={importProgress} className="h-2" />
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-6 py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <p className="text-xl font-medium">Import terminé !</p>
              <p className="text-muted-foreground mt-2">
                {importedCount} erreurs importées avec succès
                {errorCount > 0 && (
                  <span className="text-destructive">
                    {" "}• {errorCount} échecs
                  </span>
                )}
              </p>
            </div>
            <Button onClick={handleClose}>Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
