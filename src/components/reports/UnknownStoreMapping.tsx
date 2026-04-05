import { useState } from "react";
import { AlertTriangle, Store, Plus, Check, Loader2, Tag, Hash } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

interface Restaurant {
  id: string;
  name: string;
  city?: string | null;
}

interface UnknownStoreDetail {
  name: string;
  type?: 'store_id' | 'restaurant_name';
}

interface UnknownStoreMappingProps {
  unknownStoreIds: string[];
  unknownStoreDetails?: Record<string, UnknownStoreDetail>;
  restaurants: Restaurant[];
  onMappingComplete: () => void;
  selectedRestaurantId?: string;
}

// Normalize name for alias storage (same logic as parser)
function normalizeForAlias(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export default function UnknownStoreMapping({
  unknownStoreIds,
  unknownStoreDetails = {},
  restaurants,
  onMappingComplete,
  selectedRestaurantId,
}: UnknownStoreMappingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedChainId } = useAnalyticsContext();
  const [storeIdMappings, setStoreIdMappings] = useState<Record<string, string>>({});
  const [isApplying, setIsApplying] = useState(false);

  const allMapped = unknownStoreIds.every(id => storeIdMappings[id]);
  const mappedCount = Object.keys(storeIdMappings).filter(id => storeIdMappings[id]).length;

  // Determine if an unknown key is a real store_id or a restaurant name
  const getUnknownType = (key: string): 'store_id' | 'restaurant_name' => {
    const detail = unknownStoreDetails[key];
    if (detail?.type) return detail.type;
    // Heuristic: if it contains spaces, it's a name; otherwise it's a store_id
    return key.includes(' ') ? 'restaurant_name' : 'store_id';
  };

  const handleMappingChange = (storeId: string, value: string) => {
    setStoreIdMappings(prev => ({
      ...prev,
      [storeId]: value,
    }));
  };

  const applyMappings = async () => {
    if (!allMapped) return;

    setIsApplying(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const [storeId, restaurantId] of Object.entries(storeIdMappings)) {
        if (!restaurantId) continue;
        const unknownType = getUnknownType(storeId);

        if (restaurantId === "__create__") {
          // Create new restaurant with name from CSV
          const storeName = unknownStoreDetails[storeId]?.name || `Restaurant ${storeId.slice(0, 8)}`;
          
          // Use active chain first to avoid cross-brand creation
          let chainId = selectedChainId;
          if (!chainId) {
            const { data: chains } = await supabase.from("chains").select("id").limit(1);
            chainId = chains?.[0]?.id ?? null;
          }
          
          if (!chainId) {
            console.error("No chain found to create restaurant");
            errorCount++;
            continue;
          }
          
          const insertData: any = {
            name: storeName,
            is_active: true,
            chain_id: chainId,
          };

          // Only set uber_store_id if it's a real store_id
          if (unknownType === 'store_id') {
            insertData.uber_store_id = storeId;
          }

          const { data: newRestaurant, error: createError } = await supabase
            .from("restaurants")
            .insert([insertData])
            .select("id")
            .single();

          if (createError) {
            console.error("Error creating restaurant:", createError);
            errorCount++;
          } else if (newRestaurant) {
            if (unknownType === 'store_id') {
              // Also add to the multi-UUID mapping table
              await supabase.from("restaurant_uber_ids").insert([{
                restaurant_id: newRestaurant.id,
                uber_store_id: storeId,
                is_primary: true,
                label: "principal",
              }]);
            } else {
              // Save as name alias
              await supabase.from("restaurant_name_aliases").insert([{
                restaurant_id: newRestaurant.id,
                alias_name: storeId,
                normalized_name: normalizeForAlias(storeId),
                source: 'manual_import',
              }]);
            }
            successCount++;
          }
        } else {
          // Map to existing restaurant
          if (unknownType === 'store_id') {
            // Add new uber_store_id to the multi-UUID mapping table
            const { error } = await supabase.from("restaurant_uber_ids").insert([{
              restaurant_id: restaurantId,
              uber_store_id: storeId,
              is_primary: false,
              label: "ajouté via import",
            }]);

            if (error) {
              if (error.code === "23505") {
                console.log("UUID already mapped:", storeId);
                successCount++;
              } else {
                console.error("Error adding UUID mapping:", error);
                errorCount++;
              }
            } else {
              successCount++;
            }
          } else {
            // Save as name alias
            const { error } = await supabase.from("restaurant_name_aliases").insert([{
              restaurant_id: restaurantId,
              alias_name: storeId,
              normalized_name: normalizeForAlias(storeId),
              source: 'manual_import',
            }]);

            if (error) {
              if (error.code === "23505") {
                console.log("Name alias already exists:", storeId);
                successCount++;
              } else {
                console.error("Error adding name alias:", error);
                errorCount++;
              }
            } else {
              successCount++;
            }
          }
        }
      }

      // Refresh restaurants cache
      await queryClient.invalidateQueries({ queryKey: ["restaurants-for-import"] });
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });

      if (errorCount === 0) {
        toast({
          title: "Correspondances appliquées",
          description: `${successCount} restaurant(s) configuré(s) avec succès. Relancez l'import pour traiter les lignes ignorées.`,
        });
        onMappingComplete();
      } else {
        toast({
          title: "Erreur partielle",
          description: `${successCount} réussi(s), ${errorCount} en erreur`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error applying mappings:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'appliquer les correspondances",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  // If a restaurant is manually selected, skip this step
  if (selectedRestaurantId) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Identifiants non reconnus (non bloquant)</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            {unknownStoreIds.length} identifiant(s) trouvé(s) dans le fichier mais non configuré(s) :
          </p>
          <p className="mb-2 text-sm text-muted-foreground">
            Comme vous avez sélectionné un restaurant manuellement, l'import associera quand même toutes les lignes à ce restaurant.
          </p>
          <div className="flex flex-wrap gap-2">
            {unknownStoreIds.slice(0, 10).map((id) => (
              <Badge key={id} variant="outline" className="font-mono text-xs">
                {id}
              </Badge>
            ))}
            {unknownStoreIds.length > 10 && (
              <Badge variant="outline">+{unknownStoreIds.length - 10} autres</Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <Store className="h-4 w-4 text-destructive" />
      <AlertTitle className="text-destructive">
        {unknownStoreIds.length} restaurant(s) non reconnu(s)
      </AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ces identifiants ou noms de restaurants ne sont pas associés à un restaurant dans votre base. Choisissez un restaurant existant ou créez-en un nouveau.
        </p>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {unknownStoreIds.map((storeId) => {
            const csvName = unknownStoreDetails[storeId]?.name;
            const unknownType = getUnknownType(storeId);
            const isSelected = !!storeIdMappings[storeId];

            return (
              <div
                key={storeId}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? "bg-accent/50 border-accent"
                    : "bg-background border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <Badge variant="outline" className="text-xs shrink-0">
                      {unknownType === 'store_id' ? (
                        <><Hash className="h-3 w-3 mr-1" />Store ID</>
                      ) : (
                        <><Tag className="h-3 w-3 mr-1" />Nom CSV</>
                      )}
                    </Badge>
                  </div>
                  {unknownType === 'store_id' ? (
                    <>
                      <span className="font-mono text-xs text-muted-foreground break-all block mt-1" title={storeId}>
                        {storeId}
                      </span>
                      {csvName && csvName !== storeId && (
                        <p className="text-sm font-medium mt-1 break-words">{csvName}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm font-medium mt-1 break-words" title={storeId}>{storeId}</p>
                  )}
                </div>

                 <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={storeIdMappings[storeId] || ""}
                    onValueChange={(value) => handleMappingChange(storeId, value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Choisir un restaurant" />
                    </SelectTrigger>
                     <SelectContent className="max-h-72" viewportClassName="h-auto max-h-72">
                      <SelectItem value="__create__">
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Créer nouveau restaurant
                        </span>
                      </SelectItem>
                       {restaurants.length === 0 && (
                         <SelectItem value="__empty__" disabled>
                           Aucun restaurant disponible
                         </SelectItem>
                       )}
                      {restaurants.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}{r.city ? ` (${r.city})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-muted">
          <p className="text-sm text-muted-foreground">
            {mappedCount}/{unknownStoreIds.length} configuré(s)
          </p>
          <Button
            onClick={applyMappings}
            disabled={!allMapped || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Application...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Appliquer et revalider
              </>
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
