import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/** Déclaration éco-contribution envoyée à Uber, confirmée par l'utilisateur dans Mijotek. */
export interface EcoUberDeclaration {
  id: string;
  restaurant_id: string;
  declared_at: string;
  declared_by_name: string | null;
}

type Result<T> = PromiseLike<{ data: T | null; error: Error | null }>;
// Table ajoutée par la migration 20261117120000 (pas encore dans les types générés).
// On garde les appels sur l'objet client : extraire ses méthodes leur fait perdre leur contexte.
type Table = {
  select: (c: string) => { in: (k: string, v: string[]) => { is: (k: string, v: null) => Result<EcoUberDeclaration[]> } };
  insert: (row: { restaurant_id: string }) => { select: (c: string) => { single: () => Result<EcoUberDeclaration> } };
  update: (row: { cancelled_at: string }) => { eq: (k: string, v: string) => Result<null> };
};
const table = () => (supabase as unknown as { from: (t: string) => Table }).from("eco_uber_declarations");
const COLS = "id, restaurant_id, declared_at, declared_by_name";

export function useEcoUberDeclarations(restaurantIds: string[]) {
  const qc = useQueryClient();
  const key = ["eco-uber-declarations", [...restaurantIds].sort().join(",")];

  const query = useQuery({
    queryKey: key,
    enabled: restaurantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await table().select(COLS).in("restaurant_id", restaurantIds).is("cancelled_at", null);
      if (error) throw error;
      return new Map((data ?? []).map((d) => [d.restaurant_id, d]));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["eco-uber-declarations"] });

  const declare = useMutation({
    mutationFn: async (restaurantId: string) => {
      const { error } = await table().insert({ restaurant_id: restaurantId }).select(COLS).single();
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: "Déclaration enregistrée", description: "La date, l'heure et votre nom sont conservés." }); },
    onError: (e: Error) => toast({ title: "La déclaration n'a pas été enregistrée", description: e.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: async (declarationId: string) => {
      const { error } = await table().update({ cancelled_at: new Date().toISOString() }).eq("id", declarationId);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: "Déclaration annulée", description: "La trace de l'annulation est conservée." }); },
    onError: (e: Error) => toast({ title: "L'annulation n'a pas été enregistrée", description: e.message, variant: "destructive" }),
  });

  return {
    byRestaurant: query.data ?? new Map<string, EcoUberDeclaration>(),
    declare: (restaurantId: string) => declare.mutate(restaurantId),
    cancel: (declarationId: string) => cancel.mutate(declarationId),
    pending: declare.isPending || cancel.isPending,
  };
}
