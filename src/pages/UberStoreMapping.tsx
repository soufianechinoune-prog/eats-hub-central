import { useState, useMemo } from "react";
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
import { Upload, Lock, Pencil, Plus, Search, Loader2 } from "lucide-react";
import { normalizeName, calculateRestaurantSimilarity } from "@/lib/fuzzyMatch";

type ImportAction = "protected" | "rename" | "create";

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

export default function UberStoreMapping() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all restaurants
  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ["restaurants-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_store_id, chain_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Get restaurants that already have a real UUID (not placeholder format)
  const restaurantsWithRealUUID = useMemo(() => {
    return new Set(
      restaurants
        .filter((r) => r.uber_store_id && !r.uber_store_id.startsWith("name:"))
        .map((r) => r.id)
    );
  }, [restaurants]);

  // Parse CSV and automatically categorize each item
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    // Parse CSV to extract store_id and store_name
    const lines = text.split("\n");
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));

    // Find store_id column - use findLastIndex to get the second "Id. du restaurant" (the one with UUIDs)
    let storeIdIndex = -1;
    for (let i = headers.length - 1; i >= 0; i--) {
      const h = headers[i];
      if (
        h.includes("store_id") ||
        h.includes("id. externe du restaurant") ||
        h.includes("id. du restaurant") ||
        h.includes("restaurant_id") ||
        h === "store id"
      ) {
        storeIdIndex = i;
        break;
      }
    }
    
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

    const useNameAsId = storeIdIndex === -1;

    // Extract unique stores
    const storesMap = new Map<string, string>();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const cells =
        line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) =>
          c
            .replace(/^"|"$/g, "")
            .replace(/""/g, '"')
            .trim()
        ) || [];

      const storeName = cells[storeNameIndex];
      if (!storeName) continue;

      const rawStoreId = useNameAsId ? null : cells[storeIdIndex];
      const storeKey =
        rawStoreId && rawStoreId.trim()
          ? rawStoreId.trim()
          : `name:${normalizeName(storeName)}`;

      if (!storesMap.has(storeKey)) {
        storesMap.set(storeKey, storeName);
      }
    }

    // Categorize each store
    const items: ImportItem[] = [];
    const usedRestaurantIds = new Set<string>();

    storesMap.forEach((storeName, storeId) => {
      // Check if this store UUID is already matched to a restaurant with real UUID
      const alreadyMatchedRestaurant = restaurants.find(
        (r) => r.uber_store_id === storeId && !r.uber_store_id.startsWith("name:")
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
      // Now we allow updating restaurants with placeholder uber_store_id (starting with "name:")
      let bestMatch: { id: string; name: string; similarity: number; hasPlaceholderId: boolean } | null = null;
      for (const restaurant of restaurants) {
        // Skip restaurants with real UUIDs (already configured) and already used ones
        if (restaurantsWithRealUUID.has(restaurant.id) || usedRestaurantIds.has(restaurant.id)) {
          continue;
        }

        const similarity = calculateRestaurantSimilarity(storeName, restaurant.name);
        if (similarity >= SIMILARITY_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
          const hasPlaceholderId = restaurant.uber_store_id?.startsWith("name:") || false;
          bestMatch = { id: restaurant.id, name: restaurant.name, similarity, hasPlaceholderId };
        }
      }

      if (bestMatch) {
        items.push({
          storeId,
          storeName,
          action: "rename",
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

    // Sort: protected first, then rename, then create
    items.sort((a, b) => {
      const order = { protected: 0, rename: 1, create: 2 };
      return order[a.action] - order[b.action];
    });

    setImportItems(items);

    const counts = {
      protected: items.filter((i) => i.action === "protected").length,
      rename: items.filter((i) => i.action === "rename").length,
      create: items.filter((i) => i.action === "create").length,
    };

    toast({
      title: `${items.length} restaurants détectés`,
      description: `${counts.protected} protégés, ${counts.rename} à renommer, ${counts.create} à créer`,
    });
  };

  // Apply changes mutation
  const applyChangesMutation = useMutation({
    mutationFn: async (items: ImportItem[]) => {
      let renamed = 0;
      let created = 0;

      // Get the default chain_id from an existing restaurant
      const defaultChainId = restaurants.find((r) => r.chain_id)?.chain_id || null;

      for (const item of items) {
        if (item.action === "protected") continue;

        if (item.action === "rename" && item.matchedRestaurantId) {
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

      return { renamed, created };
    },
    onSuccess: (result) => {
      toast({
        title: "Import terminé",
        description: `${result.renamed} renommé(s), ${result.created} créé(s)`,
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
      rename: importItems.filter((i) => i.action === "rename").length,
      create: importItems.filter((i) => i.action === "create").length,
    }),
    [importItems]
  );

  const handleApply = () => {
    if (counts.rename === 0 && counts.create === 0) {
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
          <div className="grid grid-cols-4 gap-4">
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
                (counts.rename === 0 && counts.create === 0)
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
                  Appliquer les changements ({counts.rename + counts.create})
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
                          <span className={item.action === "rename" ? "text-muted-foreground line-through" : ""}>
                            {item.matchedRestaurantName}
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
