import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Check, 
  AlertCircle, 
  Loader2,
  Plus,
  RefreshCw,
  Link2,
} from "lucide-react";
import { DeliverooIcon } from "@/components/icons/PlatformIcons";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { findPotentialMatches, normalizeName } from "@/lib/fuzzyMatch";

interface DeliverooImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  existingItems: { id: string; name: string; price_uber: number | null; price_deliveroo: number | null }[];
}

interface ParsedItem {
  name: string;
  description: string;
  price: number;
  category: string;
}

interface MatchedItem extends ParsedItem {
  existingId: string | null;
  existingName: string | null;
  existingPrice: number | null;
  matchType: "exact" | "fuzzy" | "new";
  similarity: number;
}

// Category extraction patterns
const CATEGORY_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /menu enfant/i, category: "Menu enfant" },
  { pattern: /menu.*naan/i, category: "Menus Naans" },
  { pattern: /menu.*fried|menu.*chicken|menu.*wing|menu.*tender|menu.*nugget/i, category: "Menus Fried Chicken" },
  { pattern: /menu.*wrap/i, category: "Menus Wraps" },
  { pattern: /menu.*burger(?!.*naan)/i, category: "Menus Burgers" },
  { pattern: /menu.*burger.*naan/i, category: "Menus Burgers Naan" },
  { pattern: /xtra/i, category: "Menu Xtra" },
  { pattern: /menu.*family/i, category: "Menus Family" },
  { pattern: /bucket/i, category: "À la carte" },
  { pattern: /bowl/i, category: "Bowls Street" },
  { pattern: /^burger(?!.*naan)/i, category: "Burgers" },
  { pattern: /burger.*naan/i, category: "Burger Naan" },
  { pattern: /^naan/i, category: "Sandwichs Naans" },
  { pattern: /wrap|little/i, category: "Sandwichs Wraps" },
  { pattern: /wing|tender|nugget/i, category: "Fried Chicken" },
  { pattern: /box|onion ring|mozza|chili cheese/i, category: "À partager" },
  { pattern: /tiramisu|tarte|dessert/i, category: "Desserts" },
  { pattern: /coca|fanta|sprite|oasis|perrier|eau|fuze|schweppes|orangina|powerade|cristaline/i, category: "Boissons" },
  { pattern: /frite|cheese naan|sauce|extra/i, category: "Extras" },
];

export function DeliverooImportDialog({ 
  open, 
  onOpenChange, 
  onImportComplete,
  existingItems 
}: DeliverooImportDialogProps) {
  const { toast } = useToast();
  
  const [step, setStep] = useState<"paste" | "preview" | "importing">("paste");
  const [rawText, setRawText] = useState("");
  const [parsedItems, setParsedItems] = useState<MatchedItem[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const resetState = () => {
    setStep("paste");
    setRawText("");
    setParsedItems([]);
    setImportProgress(0);
    setErrors([]);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  // Parse the pasted text from Deliveroo
  const parseDeliverooText = (text: string): ParsedItem[] => {
    const items: ParsedItem[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    let currentCategory = "";
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      // Skip emoji-only lines or category headers
      if (/^[🔥👧🧒❤💥🤩🫓🍔🌮🌯🍜🤤🍗✴✨💦]+$/.test(line) || 
          /^[A-Z\s&]+[🔥👧🧒❤💥🤩🫓🍔🌮🌯🍜🤤🍗✴✨💦]+$/.test(line)) {
        // Try to extract category from next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine && !nextLine.includes('€')) {
            currentCategory = nextLine.replace(/[🔥👧🧒❤💥🤩🫓🍔🌮🌯🍜🤤🍗✴✨💦]/g, '').trim();
          }
        }
        i++;
        continue;
      }

      // Check if line ends with a price (e.g., "14,95 €")
      const priceMatch = line.match(/(\d+[,.]?\d*)\s*€$/);
      
      if (priceMatch) {
        // This line contains a product with price
        const price = parseFloat(priceMatch[1].replace(',', '.'));
        const nameWithPrice = line.replace(/\d+[,.]?\d*\s*€$/, '').trim();
        
        // Check if previous line(s) were part of this product
        let name = nameWithPrice;
        let description = "";
        
        // Look back for description lines (lines without price before this one)
        let descLines: string[] = [];
        let j = i - 1;
        while (j >= 0) {
          const prevLine = lines[j];
          // Stop if we hit another price line or category marker
          if (/\d+[,.]?\d*\s*€$/.test(prevLine) || 
              /^[🔥👧🧒❤💥🤩🫓🍔🌮🌯🍜🤤🍗✴✨💦]+$/.test(prevLine)) {
            break;
          }
          // Skip rating/popularity markers
          if (prevLine.includes("Très bien noté") || prevLine.includes("Populaire") || prevLine === "·") {
            j--;
            continue;
          }
          // Check if this looks like a product name (shorter, no long description indicators)
          if (prevLine.length < 60 && !prevLine.includes("servi avec") && !prevLine.includes("accompagné")) {
            // This might be the actual product name
            if (!name || name.length > prevLine.length) {
              name = prevLine;
            }
          } else {
            descLines.unshift(prevLine);
          }
          j--;
        }
        
        description = descLines.join(' ').trim();
        
        // Clean up name - remove ratings and emojis from end
        name = name.replace(/Très bien noté\s*·?\s*/gi, '')
                   .replace(/Populaire\s*·?\s*/gi, '')
                   .replace(/\s*·\s*/g, ' ')
                   .trim();
        
        // Detect category from name if not set
        let itemCategory = currentCategory;
        for (const { pattern, category } of CATEGORY_PATTERNS) {
          if (pattern.test(name)) {
            itemCategory = category;
            break;
          }
        }

        if (name && price > 0) {
          items.push({
            name,
            description,
            price,
            category: itemCategory || "Autre",
          });
        }
      }
      
      i++;
    }

    return items;
  };

  // Match parsed items with existing items using fuzzy matching
  const matchItems = (parsed: ParsedItem[]): MatchedItem[] => {
    // Only match against items that don't have Deliveroo price (Uber-only items)
    const uberOnlyItems = existingItems.filter(i => i.price_uber && !i.price_deliveroo);
    
    return parsed.map(item => {
      const normalizedItemName = normalizeName(item.name);
      
      // First, try exact match on all existing items
      const exactMatch = existingItems.find(existing => 
        normalizeName(existing.name) === normalizedItemName
      );
      
      if (exactMatch) {
        return {
          ...item,
          existingId: exactMatch.id,
          existingName: exactMatch.name,
          existingPrice: exactMatch.price_deliveroo,
          matchType: "exact" as const,
          similarity: 100,
        };
      }

      // Then try fuzzy match on Uber-only items
      const fuzzyMatches = findPotentialMatches(
        item.name,
        uberOnlyItems.map(i => ({ id: i.id, name: i.name, price_uber: i.price_uber, price_deliveroo: i.price_deliveroo })),
        65
      );

      if (fuzzyMatches.length > 0) {
        const bestMatch = fuzzyMatches[0];
        return {
          ...item,
          existingId: bestMatch.id,
          existingName: bestMatch.name,
          existingPrice: null,
          matchType: "fuzzy" as const,
          similarity: bestMatch.similarity,
        };
      }

      return {
        ...item,
        existingId: null,
        existingName: null,
        existingPrice: null,
        matchType: "new" as const,
        similarity: 0,
      };
    });
  };

  const handleParse = () => {
    if (!rawText.trim()) {
      toast({
        title: "Texte vide",
        description: "Veuillez coller le contenu du catalogue Deliveroo",
        variant: "destructive",
      });
      return;
    }

    const parsed = parseDeliverooText(rawText);
    
    if (parsed.length === 0) {
      toast({
        title: "Aucun produit détecté",
        description: "Impossible de parser le texte. Vérifiez le format.",
        variant: "destructive",
      });
      return;
    }

    const matched = matchItems(parsed);
    setParsedItems(matched);
    setStep("preview");
  };

  const handleImport = async () => {
    setStep("importing");
    setImportProgress(0);
    setErrors([]);

    const toUpdate = parsedItems.filter(i => (i.matchType === "exact" || i.matchType === "fuzzy") && i.existingId);
    const toCreate = parsedItems.filter(i => i.matchType === "new");

    let processed = 0;
    const total = toUpdate.length + toCreate.length;
    const importErrors: string[] = [];

    // Update existing items
    for (const item of toUpdate) {
      const updateData: Record<string, any> = { 
        price_deliveroo: item.price,
        description_deliveroo: item.description || null,
      };
      
      // If names are different (fuzzy match), store both names
      if (item.matchType === "fuzzy" && item.existingName && item.name !== item.existingName) {
        updateData.name_uber = item.existingName;
        updateData.name_deliveroo = item.name;
      }
      
      const { error } = await supabase
        .from("menu_items")
        .update(updateData)
        .eq("id", item.existingId!);

      if (error) {
        importErrors.push(`Erreur mise à jour "${item.name}": ${error.message}`);
      }
      processed++;
      setImportProgress(Math.round((processed / total) * 100));
    }

    // Create new items
    for (const item of toCreate) {
      const { error } = await supabase
        .from("menu_items")
        .insert({
          name: item.name,
          description_deliveroo: item.description || null,
          price_deliveroo: item.price,
          category: item.category,
          is_active: true,
        });

      if (error) {
        importErrors.push(`Erreur création "${item.name}": ${error.message}`);
      }
      processed++;
      setImportProgress(Math.round((processed / total) * 100));
    }

    if (importErrors.length > 0) {
      setErrors(importErrors);
      toast({
        title: "Import partiel",
        description: `${processed - importErrors.length} sur ${total} produits importés`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Import réussi",
        description: `${toUpdate.length} mis à jour, ${toCreate.length} créés`,
      });
      onImportComplete();
      handleClose();
    }
  };

  const updatedCount = parsedItems.filter(i => i.matchType === "exact").length;
  const fuzzyCount = parsedItems.filter(i => i.matchType === "fuzzy").length;
  const newCount = parsedItems.filter(i => i.matchType === "new").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DeliverooIcon className="h-5 w-5" />
            Import Catalogue Deliveroo
          </DialogTitle>
          <DialogDescription>
            {step === "paste" && "Collez le contenu du menu Deliveroo"}
            {step === "preview" && "Vérifiez les produits détectés avant l'import"}
            {step === "importing" && "Import en cours..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Paste */}
          {step === "paste" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Contenu du catalogue Deliveroo</Label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Copiez-collez ici le contenu du menu Deliveroo (depuis le site ou l'application)..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Instructions :</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ouvrez votre menu sur Deliveroo Manager ou l'app Deliveroo</li>
                  <li>Sélectionnez et copiez tout le contenu du menu</li>
                  <li>Collez-le dans le champ ci-dessus</li>
                </ol>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {updatedCount} à mettre à jour
                </Badge>
                {fuzzyCount > 0 && (
                  <Badge variant="outline" className="gap-1 text-purple-500 border-purple-500">
                    <Link2 className="h-3 w-3" />
                    {fuzzyCount} correspondances détectées
                  </Badge>
                )}
                <Badge variant="default" className="gap-1">
                  <Plus className="h-3 w-3" />
                  {newCount} nouveaux
                </Badge>
              </div>

              <Tabs defaultValue="all" className="w-full">
                <TabsList>
                  <TabsTrigger value="all">Tous ({parsedItems.length})</TabsTrigger>
                  <TabsTrigger value="update">Mise à jour ({updatedCount})</TabsTrigger>
                  {fuzzyCount > 0 && (
                    <TabsTrigger value="fuzzy">Correspondances ({fuzzyCount})</TabsTrigger>
                  )}
                  <TabsTrigger value="new">Nouveaux ({newCount})</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  <ScrollArea className="h-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="text-right">Prix</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium max-w-[250px]">
                              <div className="space-y-1">
                                <span className="truncate block">{item.name}</span>
                                {item.matchType === "fuzzy" && item.existingName && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Link2 className="h-3 w-3 text-purple-500" />
                                    ↔ {item.existingName} ({item.similarity}%)
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.price.toFixed(2)} €
                            </TableCell>
                            <TableCell className="text-center">
                              {item.matchType === "exact" ? (
                                <Badge variant="secondary" className="gap-1">
                                  <RefreshCw className="h-3 w-3" />
                                  Maj
                                </Badge>
                              ) : item.matchType === "fuzzy" ? (
                                <Badge variant="outline" className="gap-1 text-purple-500 border-purple-500">
                                  <Link2 className="h-3 w-3" />
                                  Match
                                </Badge>
                              ) : (
                                <Badge variant="default" className="gap-1">
                                  <Plus className="h-3 w-3" />
                                  Créer
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="fuzzy">
                  <ScrollArea className="h-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit Deliveroo</TableHead>
                          <TableHead>Similarité</TableHead>
                          <TableHead>Produit Uber existant</TableHead>
                          <TableHead className="text-right">Prix</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedItems.filter(i => i.matchType === "fuzzy").map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                item.similarity >= 90 ? "text-emerald-500 border-emerald-500" :
                                item.similarity >= 75 ? "text-amber-500 border-amber-500" :
                                "text-orange-500 border-orange-500"
                              }>
                                {item.similarity}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{item.existingName}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.price.toFixed(2)} €
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="update">
                  <ScrollArea className="h-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Ancien prix</TableHead>
                          <TableHead className="text-right">Nouveau prix</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedItems.filter(i => i.matchType === "exact").map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {item.existingPrice?.toFixed(2) ?? "-"} €
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.price.toFixed(2)} €
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="new">
                  <ScrollArea className="h-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="text-right">Prix</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedItems.filter(i => i.matchType === "new").map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.price.toFixed(2)} €
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center w-full max-w-xs">
                <Progress value={importProgress} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {importProgress}% - Import en cours...
                </p>
              </div>
              {errors.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {errors.slice(0, 3).map((err, i) => <p key={i}>{err}</p>)}
                    {errors.length > 3 && <p>... et {errors.length - 3} autres erreurs</p>}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "paste" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleParse} className="gap-2">
                <FileText className="h-4 w-4" />
                Analyser
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("paste")}>
                Retour
              </Button>
              <Button onClick={handleImport} className="gap-2">
                <Check className="h-4 w-4" />
                Importer {parsedItems.length} produits
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
