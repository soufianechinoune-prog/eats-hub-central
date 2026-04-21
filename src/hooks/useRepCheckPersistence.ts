import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EcoOrganismCheckResult } from "@/hooks/useEcoOrganismCheck";

export type RepStatus = "inscrit" | "non_trouve" | "sans_siret";

export interface RepSnapshotIdu {
  identifiant_unique: string;
  filiere?: string | null;
}

export interface RepSnapshotEntryDetail {
  filiere: string;
  org: string;
  start: string;
  end: string | null;
  isActive: boolean;
  idu?: string;
}

export interface RepSnapshotEntry {
  restaurant_id: string;
  status: RepStatus;
  filiereCount: number;
  orgs: string[];
  idus: string[];
  iduEntries?: RepSnapshotIdu[];
  entries?: RepSnapshotEntryDetail[];
}

export interface RepSnapshot {
  id: string;
  checked_at: string;
  restaurant_count: number;
  inscrit_count: number;
  non_trouve_count: number;
  sans_siret_count: number;
  results: Record<string, RepSnapshotEntry>;
}

export interface RepChangeInfo {
  restaurant_id: string;
  changeType: "new_adherent" | "lost_adherent";
}

export function useRepCheckPersistence(restaurantIds: string[], chainId?: string | null) {
  const [snapshots, setSnapshots] = useState<RepSnapshot[]>([]);
  const [previousSnapshot, setPreviousSnapshot] = useState<RepSnapshot | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<RepSnapshot | null>(null);
  const [loadingCache, setLoadingCache] = useState(true);

  // Load all snapshots on mount or when chainId changes
  useEffect(() => {
    loadSnapshots();
  }, [chainId]);

  const loadSnapshots = async () => {
    setLoadingCache(true);
    try {
      let query = supabase
        .from("rep_check_snapshots")
        .select("*")
        .order("checked_at", { ascending: true });
      if (chainId) {
        query = query.eq("chain_id", chainId);
      } else {
        query = query.is("chain_id", null);
      }
      const { data, error } = await query;

      if (error) throw error;
      if (data && data.length > 0) {
        const parsed = data.map((d: any) => ({
          ...d,
          results: typeof d.results === "string" ? JSON.parse(d.results) : d.results,
        })) as RepSnapshot[];
        setSnapshots(parsed);
        setLatestSnapshot(parsed[parsed.length - 1]);
        if (parsed.length >= 2) {
          setPreviousSnapshot(parsed[parsed.length - 2]);
        }
      }
    } catch (err) {
      console.error("Failed to load REP snapshots:", err);
    } finally {
      setLoadingCache(false);
    }
  };

  // Save a new snapshot after a check
  const saveSnapshot = useCallback(async (
    repData: Record<string, EcoOrganismCheckResult>,
    restaurantSirets: { id: string; siret: string | null }[],
  ) => {
    const results: Record<string, RepSnapshotEntry> = {};
    let inscrit = 0, nonTrouve = 0, sansSiret = 0;

    for (const r of restaurantSirets) {
      const result = repData[r.id];
      if (!r.siret?.trim()) {
        sansSiret++;
        results[r.id] = { restaurant_id: r.id, status: "sans_siret", filiereCount: 0, orgs: [], idus: [] };
        continue;
      }
      if (!result) {
        nonTrouve++;
        results[r.id] = { restaurant_id: r.id, status: "non_trouve", filiereCount: 0, orgs: [], idus: [] };
        continue;
      }
      if (result.count > 0 || (result.idu_results || []).length > 0) {
        inscrit++;
        results[r.id] = {
          restaurant_id: r.id,
          status: "inscrit",
          filiereCount: result.count || (result.idu_results || []).length,
          orgs: [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))],
          idus: (result.idu_results || []).map(i => i.identifiant_unique),
        };
      } else {
        nonTrouve++;
        results[r.id] = { restaurant_id: r.id, status: "non_trouve", filiereCount: 0, orgs: [], idus: [] };
      }
    }

    const snapshot = {
      restaurant_count: restaurantSirets.length,
      inscrit_count: inscrit,
      non_trouve_count: nonTrouve,
      sans_siret_count: sansSiret,
      results,
      chain_id: chainId || null,
    };

    try {
      const { data, error } = await supabase
        .from("rep_check_snapshots")
        .insert([snapshot as any])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const newSnapshot = {
          ...data,
          results: typeof data.results === "string" ? JSON.parse(data.results as string) : data.results,
        } as RepSnapshot;

        setSnapshots(prev => [...prev, newSnapshot]);
        setPreviousSnapshot(latestSnapshot);
        setLatestSnapshot(newSnapshot);
      }
    } catch (err) {
      console.error("Failed to save REP snapshot:", err);
    }
  }, [latestSnapshot]);

  // Detect changes between latest and previous snapshots
  const changes = useMemo<RepChangeInfo[]>(() => {
    if (!previousSnapshot || !latestSnapshot) return [];
    const prev = previousSnapshot.results;
    const curr = latestSnapshot.results;
    const changeList: RepChangeInfo[] = [];

    for (const id of restaurantIds) {
      const prevStatus = prev[id]?.status;
      const currStatus = curr[id]?.status;
      if (!prevStatus || !currStatus) continue;

      if (prevStatus !== "inscrit" && currStatus === "inscrit") {
        changeList.push({ restaurant_id: id, changeType: "new_adherent" });
      } else if (prevStatus === "inscrit" && currStatus !== "inscrit") {
        changeList.push({ restaurant_id: id, changeType: "lost_adherent" });
      }
    }

    return changeList;
  }, [previousSnapshot, latestSnapshot, restaurantIds]);

  // Chart data: evolution over time
  const evolutionData = useMemo(() => {
    return snapshots.map(s => ({
      date: new Date(s.checked_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      fullDate: s.checked_at,
      inscrits: s.inscrit_count,
      nonTrouves: s.non_trouve_count,
      sansSiret: s.sans_siret_count,
      total: s.restaurant_count,
    }));
  }, [snapshots]);

  return {
    snapshots,
    latestSnapshot,
    previousSnapshot,
    changes,
    evolutionData,
    loadingCache,
    saveSnapshot,
  };
}
