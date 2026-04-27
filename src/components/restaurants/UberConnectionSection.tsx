import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UberEatsIcon } from "@/components/icons/PlatformIcons";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { validateUberStoreId } from "@/services/uberService";

interface UberConnectionSectionProps {
  restaurantId: string;
}

export const UberConnectionSection = ({ restaurantId }: UberConnectionSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant-uber-store", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_store_id")
        .eq("id", restaurantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const result = await validateUberStoreId(trimmed);
      if (!result.valid) {
        toast({ title: "UUID refusé", description: result.error, variant: "destructive" });
        return;
      }
      const { error } = await supabase
        .from("restaurants")
        .update({ uber_store_id: trimmed })
        .eq("id", restaurantId);
      if (error) throw error;
      toast({
        title: "Connecté à Uber Eats",
        description: result.name ? `Store: ${result.name}` : "Store UUID enregistré.",
      });
      setEditing(false);
      setValue("");
      queryClient.invalidateQueries({ queryKey: ["restaurant-uber-store", restaurantId] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UberEatsIcon className="h-5 w-5" />
          Connexion Uber Eats
        </CardTitle>
        <CardDescription>
          Enregistrez le Store UUID Uber de ce restaurant pour synchroniser automatiquement les rapports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : restaurant?.uber_store_id && !editing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Connecté
              </Badge>
              <p className="font-mono text-xs text-muted-foreground break-all">
                Store UUID : {restaurant.uber_store_id}
              </p>
            </div>
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => { setValue(restaurant.uber_store_id ?? ""); setEditing(true); }}>
                <Pencil className="mr-2 h-3 w-3" />
                Modifier
              </Button>
            )}
          </div>
        ) : isSuperAdmin ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Trouvez l'UUID dans l'URL Uber Eats Manager :{" "}
              <code>https://merchants.ubereats.com/.../store/&lt;UUID&gt;/...</code>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!value.trim() || saving}>
                  {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Tester &amp; connecter
                </Button>
                {editing && (
                  <Button variant="ghost" onClick={() => { setEditing(false); setValue(""); }}>
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune connexion Uber active. Contactez un super-administrateur pour enregistrer le Store UUID.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
