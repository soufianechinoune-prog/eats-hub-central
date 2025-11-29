import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  ArrowRight,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  existingCategories: string[];
}

type FieldMapping = {
  csvColumn: string;
  dbField: string | null;
};

const DB_FIELDS = [
  { key: "name", label: "Nom du produit", required: true },
  { key: "category", label: "Catégorie", required: false },
  { key: "description", label: "Description", required: false },
  { key: "price_uber", label: "Prix Uber Eats", required: false },
  { key: "price_deliveroo", label: "Prix Deliveroo", required: false },
  { key: "food_cost", label: "Food Cost", required: false },
];

// Common CSV column name patterns for auto-mapping
const COLUMN_PATTERNS: Record<string, string[]> = {
  name: ["nom", "name", "produit", "product", "article", "titre", "title", "libellé", "libelle", "designation", "désignation"],
  category: ["catégorie", "categorie", "category", "type", "famille", "groupe", "group"],
  description: ["description", "desc", "détail", "detail", "composition", "ingredients", "ingrédients"],
  price_uber: ["prix uber", "uber", "prix_uber", "price_uber", "tarif uber", "uber eats", "uber price"],
  price_deliveroo: ["prix deliveroo", "deliveroo", "prix_deliveroo", "price_deliveroo", "tarif deliveroo"],
  food_cost: ["food cost", "foodcost", "coût", "cout", "cost", "prix achat", "prix_achat", "coût matière", "cout matiere"],
};

export function CsvImportDialog({ 
  open, 
  onOpenChange, 
  onImportComplete,
  existingCategories 
}: CsvImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const resetState = () => {
    setStep("upload");
    setCsvData([]);
    setCsvHeaders([]);
    setMappings([]);
    setImportProgress(0);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const result: string[][] = [];
    
    for (const line of lines) {
      const row: string[] = [];
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
        } else if ((char === ',' || char === ';') && !inQuotes) {
          row.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      result.push(row);
    }
    
    return result;
  };

  const autoMapColumns = (headers: string[]) => {
    const newMappings: FieldMapping[] = headers.map(header => {
      const normalizedHeader = header.toLowerCase().trim();
      
      for (const [dbField, patterns] of Object.entries(COLUMN_PATTERNS)) {
        if (patterns.some(pattern => 
          normalizedHeader.includes(pattern) || 
          pattern.includes(normalizedHeader) ||
          normalizedHeader === pattern
        )) {
          return { csvColumn: header, dbField };
        }
      }
      
      return { csvColumn: header, dbField: null };
    });
    
    return newMappings;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier CSV",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      
      if (parsed.length < 2) {
        toast({
          title: "Fichier vide",
          description: "Le fichier CSV ne contient pas de données",
          variant: "destructive",
        });
        return;
      }

      const headers = parsed[0];
      const data = parsed.slice(1);
      
      setCsvHeaders(headers);
      setCsvData(data);
      setMappings(autoMapColumns(headers));
      setStep("mapping");
    };
    
    reader.readAsText(file);
  };

  const updateMapping = (csvColumn: string, dbField: string | null) => {
    setMappings(prev => prev.map(m => 
      m.csvColumn === csvColumn 
        ? { ...m, dbField: dbField === "none" ? null : dbField }
        : m
    ));
  };

  const validateMappings = (): boolean => {
    const nameMapping = mappings.find(m => m.dbField === "name");
    if (!nameMapping) {
      setErrors(["La colonne 'Nom du produit' doit être mappée"]);
      return false;
    }
    
    const priceUber = mappings.find(m => m.dbField === "price_uber");
    const priceDeliveroo = mappings.find(m => m.dbField === "price_deliveroo");
    if (!priceUber && !priceDeliveroo) {
      setErrors(["Au moins un prix (Uber ou Deliveroo) doit être mappé"]);
      return false;
    }
    
    setErrors([]);
    return true;
  };

  const goToPreview = () => {
    if (validateMappings()) {
      setStep("preview");
    }
  };

  const getMappedValue = (row: string[], dbField: string): string | null => {
    const mapping = mappings.find(m => m.dbField === dbField);
    if (!mapping) return null;
    
    const columnIndex = csvHeaders.indexOf(mapping.csvColumn);
    if (columnIndex === -1) return null;
    
    return row[columnIndex]?.trim() || null;
  };

  const parsePrice = (value: string | null): number | null => {
    if (!value) return null;
    // Handle French number format (comma as decimal separator)
    const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  };

  const getPreviewData = () => {
    return csvData.slice(0, 5).map(row => ({
      name: getMappedValue(row, "name"),
      category: getMappedValue(row, "category"),
      description: getMappedValue(row, "description"),
      price_uber: parsePrice(getMappedValue(row, "price_uber")),
      price_deliveroo: parsePrice(getMappedValue(row, "price_deliveroo")),
      food_cost: parsePrice(getMappedValue(row, "food_cost")),
    }));
  };

  const handleImport = async () => {
    setStep("importing");
    setImportProgress(0);
    
    const itemsToImport = csvData.map(row => ({
      name: getMappedValue(row, "name"),
      category: getMappedValue(row, "category"),
      description: getMappedValue(row, "description"),
      price_uber: parsePrice(getMappedValue(row, "price_uber")),
      price_deliveroo: parsePrice(getMappedValue(row, "price_deliveroo")),
      food_cost: parsePrice(getMappedValue(row, "food_cost")),
      is_active: true,
    })).filter(item => item.name && (item.price_uber || item.price_deliveroo));

    if (itemsToImport.length === 0) {
      toast({
        title: "Aucun produit valide",
        description: "Aucun produit avec un nom et un prix n'a été trouvé",
        variant: "destructive",
      });
      setStep("preview");
      return;
    }

    // Import in batches of 50
    const batchSize = 50;
    let imported = 0;
    const importErrors: string[] = [];

    for (let i = 0; i < itemsToImport.length; i += batchSize) {
      const batch = itemsToImport.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from("menu_items")
        .insert(batch);

      if (error) {
        importErrors.push(`Erreur lot ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        imported += batch.length;
      }
      
      setImportProgress(Math.round((i + batch.length) / itemsToImport.length * 100));
    }

    if (importErrors.length > 0) {
      setErrors(importErrors);
      toast({
        title: "Import partiel",
        description: `${imported} produits importés sur ${itemsToImport.length}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Import réussi",
        description: `${imported} produits ont été importés`,
      });
      onImportComplete();
      handleClose();
    }
  };

  const mappedFieldsCount = mappings.filter(m => m.dbField).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Sélectionnez un fichier CSV à importer"}
            {step === "mapping" && "Associez les colonnes CSV aux champs de la base"}
            {step === "preview" && "Vérifiez les données avant l'import"}
            {step === "importing" && "Import en cours..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="p-6 bg-muted/50 rounded-full">
                <Upload className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Format attendu : CSV avec en-têtes (séparateur virgule ou point-virgule)
                </p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
              </div>
              <div className="text-xs text-muted-foreground max-w-md text-center">
                <p className="font-medium mb-2">Colonnes reconnues automatiquement :</p>
                <p>nom, catégorie, description, prix uber, prix deliveroo, food cost</p>
              </div>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {csvData.length} lignes détectées
                </Badge>
                <Badge variant={mappedFieldsCount >= 2 ? "default" : "secondary"}>
                  {mappedFieldsCount} colonnes mappées
                </Badge>
              </div>

              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {errors.map((err, i) => <p key={i}>{err}</p>)}
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3">
                  {mappings.map((mapping) => (
                    <div 
                      key={mapping.csvColumn}
                      className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{mapping.csvColumn}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Ex: {csvData[0]?.[csvHeaders.indexOf(mapping.csvColumn)] || "-"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={mapping.dbField || "none"}
                        onValueChange={(value) => updateMapping(mapping.csvColumn, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Ignorer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ignorer</SelectItem>
                          {DB_FIELDS.map((field) => {
                            const alreadyMapped = mappings.some(
                              m => m.dbField === field.key && m.csvColumn !== mapping.csvColumn
                            );
                            return (
                              <SelectItem 
                                key={field.key} 
                                value={field.key}
                                disabled={alreadyMapped}
                              >
                                {field.label} {field.required && "*"}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {mapping.dbField && (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  Aperçu des 5 premiers produits
                </Badge>
                <Badge>
                  {csvData.filter(row => getMappedValue(row, "name") && (parsePrice(getMappedValue(row, "price_uber")) || parsePrice(getMappedValue(row, "price_deliveroo")))).length} produits valides
                </Badge>
              </div>

              <ScrollArea className="h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Prix Uber</TableHead>
                      <TableHead className="text-right">Prix Deliveroo</TableHead>
                      <TableHead className="text-right">Food Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPreviewData().map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {item.name || <span className="text-destructive">Manquant</span>}
                        </TableCell>
                        <TableCell>
                          {item.category ? (
                            <Badge variant="secondary">{item.category}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.price_uber?.toFixed(2) ?? "-"} €
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.price_deliveroo?.toFixed(2) ?? "-"} €
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.food_cost?.toFixed(2) ?? "-"} €
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {csvData.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  ... et {csvData.length - 5} autres produits
                </p>
              )}
            </div>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Import en cours...</p>
                <p className="text-sm text-muted-foreground">
                  {importProgress}% complété
                </p>
              </div>
              <div className="w-full max-w-xs bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              {errors.length > 0 && (
                <Alert variant="destructive" className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {errors.map((err, i) => <p key={i}>{err}</p>)}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Retour
              </Button>
              <Button onClick={goToPreview}>
                Aperçu
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Retour
              </Button>
              <Button onClick={handleImport}>
                Importer {csvData.filter(row => getMappedValue(row, "name")).length} produits
              </Button>
            </>
          )}
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Annuler
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
