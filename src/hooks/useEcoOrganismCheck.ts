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

export interface IduResult {
  identifiant_unique: string;
  immatriculation: string;
  filiere: string;
  identifiant_societe: string;
  raison_sociale: string;
  categories_agrement: string;
  pays: string;
}

export interface EcoOrganismCheckResult {
  siret: string;
  count: number;
  results: EcoOrganismResult[];
  idu_count: number;
  idu_results: IduResult[];
}

export function useEcoOrganismCheck() {
  const [data, setData] = useState<Record<string, EcoOrganismCheckResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

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

  const checkMultiple = useCallback(async (
    restaurants: { id: string; siret: string | null }[],
    onScanningId?: (id: string | null) => void,
  ) => {
    const withSiret = restaurants.filter(r => r.siret?.trim());
    setProgress({ done: 0, total: withSiret.length });
    for (let i = 0; i < withSiret.length; i++) {
      const r = withSiret[i];
      onScanningId?.(r.id);
      await checkSiret(r.id, r.siret!);
      setProgress({ done: i + 1, total: withSiret.length });
      if (i < withSiret.length - 1) {
        await new Promise(res => setTimeout(res, 200));
      }
    }
    onScanningId?.(null);
    setProgress(null);
  }, [checkSiret]);

  return { data, loading, errors, progress, checkSiret, checkMultiple };
}
