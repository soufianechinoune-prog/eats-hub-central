import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BodaccAnnonce } from "@/components/restaurants/BodaccScanButton";

export function getAnnonceKey(a: BodaccAnnonce): string {
  return `${a.type}::${a.date || "nodate"}::${a.numeroBodacc || "nonum"}`;
}

interface DismissedRecord {
  annonce_key: string;
  dismissed_at: string;
}

export function useBodaccDismissals(restaurantId: string | null) {
  const [dismissed, setDismissed] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("bodacc_dismissed_alerts" as any)
      .select("annonce_key, dismissed_at")
      .eq("restaurant_id", restaurantId);
    const map = new Map<string, string>();
    if (data) {
      (data as unknown as DismissedRecord[]).forEach((d) => map.set(d.annonce_key, d.dismissed_at));
    }
    setDismissed(map);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const dismiss = useCallback(async (annonce: BodaccAnnonce, siren: string) => {
    if (!restaurantId) return;
    const key = getAnnonceKey(annonce);
    await supabase.from("bodacc_dismissed_alerts" as any).upsert({
      restaurant_id: restaurantId,
      siren,
      annonce_key: key,
    } as any);
    setDismissed((prev) => new Map(prev).set(key, new Date().toISOString()));
  }, [restaurantId]);

  const restore = useCallback(async (annonce: BodaccAnnonce) => {
    if (!restaurantId) return;
    const key = getAnnonceKey(annonce);
    await supabase
      .from("bodacc_dismissed_alerts" as any)
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("annonce_key", key);
    setDismissed((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, [restaurantId]);

  const isDismissed = useCallback((annonce: BodaccAnnonce) => {
    return dismissed.has(getAnnonceKey(annonce));
  }, [dismissed]);

  return { dismissed, loading, dismiss, restore, isDismissed, reload: load };
}

/** Load all dismissed alerts for multiple restaurants at once */
export async function loadAllDismissedKeys(restaurantIds: string[]): Promise<Map<string, Set<string>>> {
  if (restaurantIds.length === 0) return new Map();
  const { data } = await supabase
    .from("bodacc_dismissed_alerts" as any)
    .select("restaurant_id, annonce_key")
    .in("restaurant_id", restaurantIds);
  const map = new Map<string, Set<string>>();
  if (data) {
    (data as unknown as Array<{ restaurant_id: string; annonce_key: string }>).forEach((d) => {
      if (!map.has(d.restaurant_id)) map.set(d.restaurant_id, new Set());
      map.get(d.restaurant_id)!.add(d.annonce_key);
    });
  }
  return map;
}
