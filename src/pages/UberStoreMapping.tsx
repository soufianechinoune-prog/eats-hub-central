import { useState, useMemo } from "react";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Lock, Pencil, Plus, Search, Loader2, RefreshCw } from "lucide-react";
import { normalizeName, calculateRestaurantSimilarity, normalizeForLooseMatch, cityStartsWith } from "@/lib/fuzzyMatch";

type ImportAction = "protected" | "rename" | "create" | "update_uuid";

interface ImportItem {
  storeId: string;
  storeName: string; // Nom du CSV (source de vérité)
  action: ImportAction;
  matchedRestaurantId?: string;
  matchedRestaurantName?: string;
  similarity?: number;
}

interface Restaurant {
  id: string;
  name: string;
  uber_store_id: string | null;
  chain_id: string | null;
}

const SIMILARITY_THRESHOLD = 90;

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: check if a string is a valid UUID
const isValidUUID = (str: string | null | undefined): boolean => {
  if (!str) return false;
  return UUID_REGEX.test(str.trim());
};

// Helper: auto-detect CSV delimiter (comma or semicolon)
const detectDelimiter = (headerLine: string): string => {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
};

// Helper: parse a single CSV line respecting quotes
const parseCSVLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

// Helper: normalize header string (remove BOM, quotes, trim, lowercase)
const normalizeHeader = (h: string): string => {
  return h
    .replace(/^\uFEFF/, "") // Remove BOM
    .replace(/^"|"$/g, "")  // Remove surrounding quotes
    .replace(/\u00A0/g, " ") // Replace non-breaking spaces
    .trim()
    .toLowerCase();
};

export default function UberStoreMapping() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { selectedChainId } = useAnalyticsContext();

  // Fetch restaurants filtered by active chain
  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ["restaurants-for-mapping", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, uber_store_id, chain_id")
        .eq("is_active", true)
        .order("name");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Get restaurants that already have a REAL UUID (strict validation)
  const restaurantsWithRealUUID = useMemo(() => {
    return new Set(
      restaurants
        .filter((r) => isValidUUID(r.uber_store_id))
        .map((r) => r.id)
    );
  }, [restaurants]);

  // Parse CSV and automatically categorize each item
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let text = await file.text();
    
    // Remove BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast({
        title: "Fichier vide",
        description: "Le fichier CSV ne contient pas de données",
        variant: "destructive",
      });
      return;
    }

    // Auto-detect delimiter from first line
    const delimiter = detectDelimiter(lines[0]);
    
    // Parse headers with proper CSV parsing
    const rawHeaders = parseCSVLine(lines[0], delimiter);
    const headers = rawHeaders.map(normalizeHeader);

    // Find store_name column
    const storeNameIndex = headers.findIndex(
      (h) =>
        h.includes("store_name") ||
        h === "restaurant" ||
        h.includes("restaurant_name") ||
        h.includes("nom du restaurant") ||
        h === "store name"
    );

    if (storeNameIndex === -1) {
      toast({
        title: "Format CSV non reconnu",
        description: "Le fichier doit contenir une colonne 'Restaurant' ou 'store_name'",
        variant: "destructive",
      });
      return;
    }

    // Find store_id column - prioritize column that contains actual UUIDs
    // First, find all candidate columns
    const candidateIdColumns: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (
        h.includes("store_id") ||
        h.includes("id. externe du restaurant") ||
        h.includes("id. du restaurant") ||
        h.includes("restaurant_id") ||
        h === "store id"
      ) {
        candidateIdColumns.push(i);
      }
    }

    // Sample first few data rows to find which column contains UUIDs
    let storeIdIndex = -1;
    if (candidateIdColumns.length > 0) {
      const sampleSize = Math.min(10, lines.length - 1);
      let bestColumn = -1;
      let maxUUIDCount = 0;

      for (const colIdx of candidateIdColumns) {
        let uuidCount = 0;
        for (let i = 1; i <= sampleSize; i++) {
          const cells = parseCSVLine(lines[i], delimiter);
          if (isValidUUID(cells[colIdx])) {
            uuidCount++;
          }
        }
        if (uuidCount > maxUUIDCount) {
          maxUUIDCount = uuidCount;
          bestColumn = colIdx;
        }
      }

      // Use the column with most UUIDs, or fallback to last candidate
      storeIdIndex = bestColumn !== -1 ? bestColumn : candidateIdColumns[candidateIdColumns.length - 1];
    }

    const useNameAsId = storeIdIndex === -1;

    // Extract unique stores
    const storesMap = new Map<string, string>();
    let uuidCount = 0;
    let placeholderCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const cells = parseCSVLine(line, delimiter);
      const storeName = cells[storeNameIndex];
      if (!storeName) continue;

      const rawStoreId = useNameAsId ? null : cells[storeIdIndex];
      let storeKey: string;

      if (rawStoreId && rawStoreId.trim()) {
        storeKey = rawStoreId.trim();
        if (isValidUUID(storeKey)) {
          uuidCount++;
        } else {
          placeholderCount++;
        }
      } else {
        storeKey = `name:${normalizeName(storeName)}`;
        placeholderCount++;
      }

      if (!storesMap.has(storeKey)) {
        storesMap.set(storeKey, storeName);
      }
    }

    // Warning if no UUIDs found
    if (uuidCount === 0 && storesMap.size > 0) {
      toast({
        title: "Aucun UUID détecté",
        description: "Ce fichier ne contient pas de store_id au format UUID. Vérifie que tu as bien exporté le bon rapport Uber Eats (ex: Récapitulatif des versements).",
        variant: "destructive",
      });
      // Don't return - still allow user to see what was found
    }

    // Categorize each store
    const items: ImportItem[] = [];
    const usedRestaurantIds = new Set<string>();

    storesMap.forEach((storeName, storeId) => {
      // Check if this store UUID is already matched to a restaurant with REAL UUID
      const alreadyMatchedRestaurant = restaurants.find(
        (r) => r.uber_store_id === storeId && isValidUUID(r.uber_store_id)
      );

      if (alreadyMatchedRestaurant) {
        items.push({
          storeId,
          storeName,
          action: "protected",
          matchedRestaurantId: alreadyMatchedRestaurant.id,
          matchedRestaurantName: alreadyMatchedRestaurant.name,
        });
        usedRestaurantIds.add(alreadyMatchedRestaurant.id);
        return;
      }

      // Find best match by name similarity (excluding already used ones)
      let bestMatch: { id: string; name: string; similarity: number; hasRealUUID: boolean } | null = null;
      
      for (const restaurant of restaurants) {
        if (usedRestaurantIds.has(restaurant.id)) continue;
        
        // Try standard similarity first
        const similarity = calculateRestaurantSimilarity(storeName, restaurant.name);
        
        // Also try loose matching for different formats (CHICKEN STREET ATHIS-MONS vs Chicken Street - Athis-Mons)
        const looseStoreName = normalizeForLooseMatch(storeName);
        const looseRestaurantName = normalizeForLooseMatch(restaurant.name);
        const exactLooseMatch = looseStoreName === looseRestaurantName;
        
        // Also check partial city match (Bonneuil vs Bonneuil-sur-Marne)
        const partialCityMatch = cityStartsWith(storeName, restaurant.name);
        
        // Determine best similarity
        let looseSimilarity = similarity;
        if (exactLooseMatch) {
          looseSimilarity = 100;
        } else if (partialCityMatch) {
          looseSimilarity = 95; // High confidence for partial city match
        }
        
        const bestSimilarity = Math.max(similarity, looseSimilarity);
        
        if (bestSimilarity >= SIMILARITY_THRESHOLD && (!bestMatch || bestSimilarity > bestMatch.similarity)) {
          const hasRealUUID = restaurantsWithRealUUID.has(restaurant.id);
          bestMatch = { id: restaurant.id, name: restaurant.name, similarity: bestSimilarity, hasRealUUID };
        }
      }

      if (bestMatch) {
        // If restaurant has real UUID, only update the UUID (preserve name and data)
        // If restaurant has placeholder ID, rename + update UUID
        const action: ImportAction = bestMatch.hasRealUUID ? "update_uuid" : "rename";
        items.push({
          storeId,
          storeName,
          action,
          matchedRestaurantId: bestMatch.id,
          matchedRestaurantName: bestMatch.name,
          similarity: bestMatch.similarity,
        });
        usedRestaurantIds.add(bestMatch.id);
      } else {
        items.push({
          storeId,
          storeName,
          action: "create",
        });
      }
    });

    // Sort: protected first, then update_uuid, then rename, then create
    items.sort((a, b) => {
      const order = { protected: 0, update_uuid: 1, rename: 2, create: 3 };
      return order[a.action] - order[b.action];
    });

    setImportItems(items);

    const counts = {
      protected: items.filter((i) => i.action === "protected").length,
      update_uuid: items.filter((i) => i.action === "update_uuid").length,
      rename: items.filter((i) => i.action === "rename").length,
      create: items.filter((i) => i.action === "create").length,
    };

    const uuidInfo = uuidCount > 0 
      ? `(${uuidCount} UUIDs valides trouvés)` 
      : "(⚠️ Aucun UUID)";

    toast({
      title: `${items.length} restaurants détectés ${uuidInfo}`,
      description: `${counts.protected} protégés, ${counts.update_uuid} UUID à mettre à jour, ${counts.rename} à renommer, ${counts.create} à créer`,
    });
  };

  // Apply changes mutation
  const applyChangesMutation = useMutation({
    mutationFn: async (items: ImportItem[]) => {
      let renamed = 0;
      let created = 0;

      // Get the default chain_id from an existing restaurant
      const defaultChainId = restaurants.find((r) => r.chain_id)?.chain_id || null;

      let uuidUpdated = 0;
      
      for (const item of items) {
        if (item.action === "protected") continue;

        if (item.action === "update_uuid" && item.matchedRestaurantId) {
          // Only update UUID, preserve name and all data
          const { error } = await supabase
            .from("restaurants")
            .update({
              uber_store_id: item.storeId,
            })
            .eq("id", item.matchedRestaurantId);

          if (error) throw error;
          uuidUpdated++;
        } else if (item.action === "rename" && item.matchedRestaurantId) {
          const { error } = await supabase
            .from("restaurants")
            .update({
              name: item.storeName,
              uber_store_id: item.storeId,
            })
            .eq("id", item.matchedRestaurantId);

          if (error) throw error;
          renamed++;
        } else if (item.action === "create") {
          const { error } = await supabase.from("restaurants").insert({
            name: item.storeName,
            uber_store_id: item.storeId,
            chain_id: defaultChainId,
            is_active: true,
          });

          if (error) throw error;
          created++;
        }
      }

      return { renamed, created, uuidUpdated };
    },
    onSuccess: (result) => {
      const parts = [];
      if (result.uuidUpdated > 0) parts.push(`${result.uuidUpdated} UUID mis à jour`);
      if (result.renamed > 0) parts.push(`${result.renamed} renommé(s)`);
      if (result.created > 0) parts.push(`${result.created} créé(s)`);
      toast({
        title: "Import terminé",
        description: parts.join(", ") || "Aucune modification",
      });
      queryClient.invalidateQueries({ queryKey: ["restaurants-for-mapping"] });
      setImportItems([]);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'appliquer les changements",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Filter items
  const filteredItems = useMemo(() => {
    if (!searchTerm) return importItems;

    const term = searchTerm.toLowerCase();
    return importItems.filter(
      (item) =>
        item.storeName.toLowerCase().includes(term) ||
        item.matchedRestaurantName?.toLowerCase().includes(term)
    );
  }, [importItems, searchTerm]);

  // Counts
  const counts = useMemo(
    () => ({
      protected: importItems.filter((i) => i.action === "protected").length,
      update_uuid: importItems.filter((i) => i.action === "update_uuid").length,
      rename: importItems.filter((i) => i.action === "rename").length,
      create: importItems.filter((i) => i.action === "create").length,
    }),
    [importItems]
  );

  const handleApply = () => {
    if (counts.rename === 0 && counts.create === 0 && counts.update_uuid === 0) {
      toast({
        title: "Rien à faire",
        description: "Tous les restaurants sont déjà protégés",
        variant: "destructive",
      });
      return;
    }
    applyChangesMutation.mutate(importItems);
  };

  const getActionIcon = (action: ImportAction) => {
    switch (action) {
      case "protected":
        return <Lock className="h-4 w-4" />;
      case "update_uuid":
        return <RefreshCw className="h-4 w-4" />;
      case "rename":
        return <Pencil className="h-4 w-4" />;
      case "create":
        return <Plus className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: ImportAction) => {
    switch (action) {
      case "protected":
        return (
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" />
            Protégé
          </Badge>
        );
      case "update_uuid":
        return (
          <Badge className="gap-1 bg-amber-600 hover:bg-amber-700">
            <RefreshCw className="h-3 w-3" />
            Mettre à jour UUID
          </Badge>
        );
      case "rename":
        return (
          <Badge variant="default" className="gap-1">
            <Pencil className="h-3 w-3" />
            Renommer
          </Badge>
        );
      case "create":
        return (
          <Badge className="gap-1 bg-green-600 hover:bg-green-700">
            <Plus className="h-3 w-3" />
            Créer
          </Badge>
        );
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Uber Eats</h1>
          <p className="text-muted-foreground">
            Importez les noms officiels depuis un fichier CSV Uber Eats
          </p>
        </div>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer un fichier CSV
          </CardTitle>
          <CardDescription>
            Les noms du CSV deviendront les noms officiels des restaurants. 
            Les restaurants non matchés seront créés automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="max-w-md"
            disabled={loadingRestaurants}
          />
        </CardContent>
      </Card>

      {importItems.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{importItems.length}</div>
                <p className="text-sm text-muted-foreground">Total détectés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div className="text-2xl font-bold">{counts.protected}</div>
                </div>
                <p className="text-sm text-muted-foreground">Protégés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-amber-600" />
                  <div className="text-2xl font-bold text-amber-600">{counts.update_uuid}</div>
                </div>
                <p className="text-sm text-muted-foreground">UUID à mettre à jour</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-primary" />
                  <div className="text-2xl font-bold text-primary">{counts.rename}</div>
                </div>
                <p className="text-sm text-muted-foreground">À renommer</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-green-600" />
                  <div className="text-2xl font-bold text-green-600">{counts.create}</div>
                </div>
                <p className="text-sm text-muted-foreground">À créer</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Apply Button */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button
              onClick={handleApply}
              disabled={
                applyChangesMutation.isPending ||
                (counts.rename === 0 && counts.create === 0 && counts.update_uuid === 0)
              }
              size="lg"
            >
              {applyChangesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  Appliquer les changements ({counts.update_uuid + counts.rename + counts.create})
                </>
              )}
            </Button>
          </div>

          {/* Items Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom CSV (nouveau nom)</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Restaurant actuel</TableHead>
                    <TableHead>Similarité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.storeId}>
                      <TableCell className="font-medium">{item.storeName}</TableCell>
                      <TableCell>{getActionBadge(item.action)}</TableCell>
                      <TableCell>
                        {item.matchedRestaurantName ? (
                          <span className={item.action === "rename" ? "text-muted-foreground line-through" : item.action === "update_uuid" ? "font-medium" : ""}>
                            {item.matchedRestaurantName}
                            {item.action === "update_uuid" && <span className="text-xs text-muted-foreground ml-2">(données préservées)</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.similarity ? (
                          <Badge variant="outline">{item.similarity}%</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
