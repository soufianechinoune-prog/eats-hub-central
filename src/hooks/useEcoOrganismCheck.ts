import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EcoOrganismResult {
  identifiant_societe: string;
  raison_sociale: string;
  filiere: string;
  raison_sociale_ecoorganisme: string;
  categorie_agrement: string;
  date_debutvalidite_inscription: string;
  date_finvalidite_inscription: string | null;
}

export interface EcoOrganismCheckResult {
  siret: string;
  count: number;
  results: EcoOrganismResult[];
}

export function useEcoOrganismCheck() {
  const [data, setData] = useState<Record<string, EcoOrganismCheckResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const checkSiret = useCallback(async (restaurantId: string, siret: string) => {
    if (!siret?.trim()) return;

    setLoading(prev => ({ ...prev, [restaurantId]: true }));
    setErrors(prev => ({ ...prev, [restaurantId]: "" }));

    try {
      const { data: result, error } = await supabase.functions.invoke("check-eco-organism", {
        body: { siret },
      });

      if (error) throw error;

      setData(prev => ({ ...prev, [restaurantId]: result as EcoOrganismCheckResult }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setErrors(prev => ({ ...prev, [restaurantId]: message }));
    } finally {
      setLoading(prev => ({ ...prev, [restaurantId]: false }));
    }
  }, []);

  const checkMultiple = useCallback(async (restaurants: { id: string; siret: string | null }[]) => {
    const withSiret = restaurants.filter(r => r.siret?.trim());
    await Promise.all(withSiret.map(r => checkSiret(r.id, r.siret!)));
  }, [checkSiret]);

  return { data, loading, errors, checkSiret, checkMultiple };
}
