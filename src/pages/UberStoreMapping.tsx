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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, AlertCircle, Search, Save, RefreshCw } from "lucide-react";
import { normalizeName, calculateSimilarity } from "@/lib/fuzzyMatch";

interface UberStore {
  storeId: string;
  storeName: string;
  matchedRestaurantId: string | null;
  matchedRestaurantName: string | null;
  suggestedRestaurantId: string | null;
  suggestedRestaurantName: string | null;
  similarity: number;
}

interface Restaurant {
  id: string;
  name: string;
  uber_store_id: string | null;
}

export default function UberStoreMapping() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [uberStores, setUberStores] = useState<UberStore[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(true);

  // Fetch all restaurants
  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ["restaurants-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_store_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Extract uber stores from CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setCsvContent(text);
    
    // Parse CSV to extract store_id and store_name
    const lines = text.split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
    
    // Find store_id and store_name columns (support multiple formats)
    const storeIdIndex = headers.findIndex(h => 
      h.includes("store_id") || 
      h.includes("id. externe du restaurant") ||
      h.includes("restaurant_id") || 
      h === "store id"
    );
    const storeNameIndex = headers.findIndex(h => 
      h.includes("store_name") || 
      h === "restaurant" ||
      h.includes("restaurant_name") || 
      h === "store name"
    );

    // Allow name-only matching if no store_id column
    if (storeIdIndex === -1 && storeNameIndex === -1) {
      toast({
        title: "Format CSV non reconnu",
        description: "Le fichier doit contenir au minimum une colonne 'Restaurant' ou 'store_name'",
        variant: "destructive",
      });
      return;
    }

    // Mode "nom uniquement" si pas de colonne store_id
    const useNameAsId = storeIdIndex === -1;

    // Extract unique stores
    const storesMap = new Map<string, string>();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Handle CSV with quoted fields
      const cells = line.match(/("([^"]|"")*"|[^,]*)/g)?.map(c => 
        c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()
      ) || [];
      
      const storeName = cells[storeNameIndex];
      if (!storeName) continue;
      
      // Use external ID if available, otherwise generate key from name
      const rawStoreId = useNameAsId ? null : cells[storeIdIndex];
      const storeKey = rawStoreId && rawStoreId.trim() 
        ? rawStoreId.trim() 
        : `name:${normalizeName(storeName)}`;
      
      if (!storesMap.has(storeKey)) {
        storesMap.set(storeKey, storeName);
      }
    }

    // Match with existing restaurants
    const stores: UberStore[] = [];
    storesMap.forEach((storeName, storeId) => {
      // Check if already matched
      const matchedRestaurant = restaurants.find(r => r.uber_store_id === storeId);
      
      // Find best match by name similarity
      let bestMatch: { id: string; name: string; similarity: number } | null = null;
      for (const restaurant of restaurants) {
        const similarity = calculateSimilarity(storeName, restaurant.name);
        if (similarity > 60 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { id: restaurant.id, name: restaurant.name, similarity };
        }
      }

      stores.push({
        storeId,
        storeName,
        matchedRestaurantId: matchedRestaurant?.id || null,
        matchedRestaurantName: matchedRestaurant?.name || null,
        suggestedRestaurantId: bestMatch?.id || null,
        suggestedRestaurantName: bestMatch?.name || null,
        similarity: bestMatch?.similarity || 0,
      });
    });

    // Sort: unmatched first, then by similarity
    stores.sort((a, b) => {
      if (a.matchedRestaurantId && !b.matchedRestaurantId) return 1;
      if (!a.matchedRestaurantId && b.matchedRestaurantId) return -1;
      return b.similarity - a.similarity;
    });

    setUberStores(stores);
    
    const unmatchedCount = stores.filter(s => !s.matchedRestaurantId).length;
    toast({
      title: `${stores.length} restaurants Uber détectés`,
      description: `${stores.length - unmatchedCount} déjà associés, ${unmatchedCount} à mapper`,
    });
  };

  // Save mappings mutation
  const saveMappingsMutation = useMutation({
    mutationFn: async (mappingsToSave: Record<string, string>) => {
      const updates = Object.entries(mappingsToSave).map(([storeId, restaurantId]) => ({
        storeId,
        restaurantId,
      }));

      for (const { storeId, restaurantId } of updates) {
        const { error } = await supabase
          .from("restaurants")
          .update({ uber_store_id: storeId })
          .eq("id", restaurantId);
        
        if (error) throw error;
      }

      return updates.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Associations enregistrées",
        description: `${count} restaurant(s) mis à jour`,
      });
      queryClient.invalidateQueries({ queryKey: ["restaurants-for-mapping"] });
      setMappings({});
      
      // Re-process to update matched status
      if (csvContent) {
        const input = document.createElement("input");
        input.type = "file";
        // Trigger re-analysis would require re-uploading
      }
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les associations",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Filter stores
  const filteredStores = useMemo(() => {
    let result = uberStores;
    
    if (showOnlyUnmapped) {
      result = result.filter(s => !s.matchedRestaurantId);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.storeName.toLowerCase().includes(term) ||
        s.storeId.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [uberStores, showOnlyUnmapped, searchTerm]);

  const handleSelectRestaurant = (storeId: string, restaurantId: string) => {
    setMappings(prev => ({
      ...prev,
      [storeId]: restaurantId,
    }));
  };

  const handleSave = () => {
    if (Object.keys(mappings).length === 0) {
      toast({
        title: "Aucune association",
        description: "Sélectionnez au moins un restaurant à associer",
        variant: "destructive",
      });
      return;
    }
    saveMappingsMutation.mutate(mappings);
  };

  const handleAutoMatch = () => {
    const autoMappings: Record<string, string> = {};
    
    for (const store of uberStores) {
      if (!store.matchedRestaurantId && store.suggestedRestaurantId && store.similarity >= 80) {
        // Check if this restaurant is not already mapped to another store
        const alreadyMapped = uberStores.some(s => 
          s.matchedRestaurantId === store.suggestedRestaurantId ||
          autoMappings[s.storeId] === store.suggestedRestaurantId
        );
        
        if (!alreadyMapped) {
          autoMappings[store.storeId] = store.suggestedRestaurantId;
        }
      }
    }
    
    setMappings(prev => ({ ...prev, ...autoMappings }));
    
    toast({
      title: `${Object.keys(autoMappings).length} associations automatiques`,
      description: "Vérifiez et validez les associations proposées",
    });
  };

  const matchedCount = uberStores.filter(s => s.matchedRestaurantId).length;
  const pendingCount = Object.keys(mappings).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mapping Uber Eats</h1>
          <p className="text-muted-foreground">
            Associez les restaurants Uber Eats à vos restaurants en base
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
            Uploadez un export Uber Eats contenant les colonnes store_id et store_name
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {uberStores.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{uberStores.length}</div>
                <p className="text-sm text-muted-foreground">Stores Uber détectés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">{matchedCount}</div>
                <p className="text-sm text-muted-foreground">Déjà associés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-destructive">{uberStores.length - matchedCount}</div>
                <p className="text-sm text-muted-foreground">À mapper</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-accent-foreground">{pendingCount}</div>
                <p className="text-sm text-muted-foreground">En attente de sauvegarde</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
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
                variant={showOnlyUnmapped ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyUnmapped(!showOnlyUnmapped)}
              >
                {showOnlyUnmapped ? "Non associés uniquement" : "Tous les stores"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleAutoMatch}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Auto-match (≥80%)
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={pendingCount === 0 || saveMappingsMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer ({pendingCount})
              </Button>
            </div>
          </div>

          {/* Mapping Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Uber</TableHead>
                    <TableHead>Store ID</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Suggestion</TableHead>
                    <TableHead>Restaurant à associer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.map((store) => (
                    <TableRow key={store.storeId}>
                      <TableCell className="font-medium">{store.storeName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {store.storeId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {store.matchedRestaurantId ? (
                          <Badge variant="default">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {store.matchedRestaurantName}
                          </Badge>
                        ) : mappings[store.storeId] ? (
                          <Badge variant="secondary">
                            En attente
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Non associé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {store.suggestedRestaurantName && !store.matchedRestaurantId && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{store.suggestedRestaurantName}</span>
                            <Badge variant="outline">
                              {store.similarity}%
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {!store.matchedRestaurantId && (
                          <Select
                            value={mappings[store.storeId] || ""}
                            onValueChange={(value) => handleSelectRestaurant(store.storeId, value)}
                          >
                            <SelectTrigger className="w-64">
                              <SelectValue placeholder="Sélectionner un restaurant" />
                            </SelectTrigger>
                            <SelectContent>
                              {store.suggestedRestaurantId && (
                                <SelectItem value={store.suggestedRestaurantId}>
                                  ⭐ {store.suggestedRestaurantName} ({store.similarity}%)
                                </SelectItem>
                              )}
                              {restaurants
                                .filter(r => r.id !== store.suggestedRestaurantId)
                                .map((restaurant) => (
                                  <SelectItem key={restaurant.id} value={restaurant.id}>
                                    {restaurant.name}
                                    {restaurant.uber_store_id && " ✓"}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
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
