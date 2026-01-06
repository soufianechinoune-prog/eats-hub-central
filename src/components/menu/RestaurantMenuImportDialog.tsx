import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { calculateSimilarity, normalizeName } from "@/lib/fuzzyMatch";

interface Restaurant {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
}

interface ParsedItem {
  name: string;
  price: number | null;
  description: string | null;
  matchedMenuItem: MenuItem | null;
  similarity: number;
}

type Platform = "uber" | "deliveroo";

interface RestaurantMenuImportDialogProps {
  restaurants: Restaurant[];
  onImportComplete?: () => void;
}

export function RestaurantMenuImportDialog({
  restaurants,
  onImportComplete,
}: RestaurantMenuImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("uber");
  const [rawText, setRawText] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Fetch menu items when dialog opens
  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching menu items:", error);
      return;
    }

    setMenuItems(data || []);
  };

  // Parse the raw text into items
  const parseMenuText = (text: string): ParsedItem[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const items: ParsedItem[] = [];
    let currentItem: Partial<ParsedItem> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if it's a price line (e.g., "7,90 €" or "14,99€")
      const priceMatch = trimmed.match(/^(\d+[,\.]\d{2})\s*€?$/);
      if (priceMatch && currentItem) {
        currentItem.price = parseFloat(priceMatch[1].replace(",", "."));
        continue;
      }

      // Check if it's a category header (all caps, no price)
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes("€")) {
        // Skip category headers
        continue;
      }

      // Check if it's a product name (starts with capital, contains text)
      if (trimmed.length > 2 && /^[A-ZÀ-Ü🔥🌶️🧀]/.test(trimmed)) {
        // Save previous item if exists
        if (currentItem && currentItem.name) {
          items.push(currentItem as ParsedItem);
        }

        // Find best matching menu item
        let bestMatch: MenuItem | null = null;
        let bestSimilarity = 0;

        for (const menuItem of menuItems) {
          const similarity = calculateSimilarity(trimmed, menuItem.name);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = menuItem;
          }
        }

        currentItem = {
          name: trimmed,
          price: null,
          description: null,
          matchedMenuItem: bestSimilarity >= 60 ? bestMatch : null,
          similarity: bestSimilarity,
        };
      } else if (currentItem && !currentItem.description && trimmed.length > 10) {
        // It's likely a description
        currentItem.description = trimmed;
      }
    }

    // Don't forget the last item
    if (currentItem && currentItem.name) {
      items.push(currentItem as ParsedItem);
    }

    return items;
  };

  const handleParse = () => {
    setLoading(true);
    const parsed = parseMenuText(rawText);
    setParsedItems(parsed);
    setLoading(false);
  };

  const handleImport = async () => {
    if (!selectedRestaurant || parsedItems.length === 0) return;

    setImporting(true);

    try {
      const itemsToInsert = parsedItems
        .filter((item) => item.matchedMenuItem && item.price !== null)
        .map((item) => ({
          restaurant_id: selectedRestaurant,
          menu_item_id: item.matchedMenuItem!.id,
          price_uber: platform === "uber" ? item.price : null,
          price_deliveroo: platform === "deliveroo" ? item.price : null,
          description_override: item.description,
        }));

      if (itemsToInsert.length === 0) {
        toast.error("Aucun produit à importer");
        return;
      }

      const { error } = await supabase
        .from("restaurant_menu_prices")
        .upsert(itemsToInsert, {
          onConflict: "restaurant_id,menu_item_id",
          ignoreDuplicates: false,
        });

      if (error) throw error;

      toast.success(`${itemsToInsert.length} produits importés avec succès`);
      setOpen(false);
      setRawText("");
      setParsedItems([]);
      onImportComplete?.();
    } catch (error) {
      console.error("Error importing:", error);
      toast.error("Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  const matchedCount = parsedItems.filter((i) => i.matchedMenuItem).length;
  const unmatchedCount = parsedItems.filter((i) => !i.matchedMenuItem).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          fetchMenuItems();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importer menu restaurant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importer les prix d'un restaurant</DialogTitle>
          <DialogDescription>
            Collez le texte du menu copié depuis Uber Eats ou Deliveroo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Restaurant & Platform Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Restaurant</label>
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
            <div>
              <label className="text-sm font-medium mb-2 block">Plateforme</label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uber">Uber Eats</SelectItem>
                  <SelectItem value="deliveroo">Deliveroo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Raw Text Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Texte du menu (copier-coller depuis la plateforme)
            </label>
            <Textarea
              placeholder={`Collez ici le texte du menu...\n\nExemple:\nMenu Enfant\n7,90 €\nTenders, frites et boisson\n\nMenu Burger Raclette\n14,99 €\nBurger raclette, frites et boisson`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
            />
          </div>

          <Button onClick={handleParse} disabled={!rawText.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Analyser le texte
          </Button>

          {/* Parsed Results */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {matchedCount} matchés
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {unmatchedCount} non matchés
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {parsedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        item.matchedMenuItem
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200"
                          : "bg-amber-50 dark:bg-amber-950/20 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </div>
                          )}
                          {item.matchedMenuItem && (
                            <div className="text-xs text-emerald-600 mt-1">
                              → {item.matchedMenuItem.name} ({item.similarity}%)
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {item.price !== null ? (
                            <Badge variant="outline">{item.price.toFixed(2)} €</Badge>
                          ) : (
                            <Badge variant="destructive">Pas de prix</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedRestaurant || matchedCount === 0 || importing}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Importer {matchedCount} produits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
