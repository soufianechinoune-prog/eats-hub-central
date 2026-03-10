import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface BodaccAnnonce {
  date: string | null;
  type: string;
  typeLabel: string;
  description: string;
  tribunal: string | null;
  lienBodacc: string | null;
  numeroBodacc: string | null;
}

export type BodaccResults = Map<string, BodaccAnnonce[]>;

/** Status of the last scan for a given restaurant id */
export type ScanStatus = "scanning" | "ok" | "alert" | "error";

const CACHE_KEY = "bodacc-scan-results";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

interface CachedData {
  timestamp: number;
  results: Record<string, BodaccAnnonce[]>;
}

export function loadCachedBodaccResults(): BodaccResults {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const cached: CachedData = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return new Map();
    }
    return new Map(Object.entries(cached.results));
  } catch {
    return new Map();
  }
}

function saveBodaccResults(results: BodaccResults) {
  const obj: Record<string, BodaccAnnonce[]> = {};
  results.forEach((v, k) => { obj[k] = v; });
  const cached: CachedData = { timestamp: Date.now(), results: obj };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
}

interface Props {
  restaurants: Array<{ id: string; siret?: string | null }>;
  onResults: (results: BodaccResults) => void;
  /** Called during scan with the id of the restaurant currently being scanned, or null when done */
  onScanningId?: (id: string | null) => void;
  /** Called with per-restaurant scan statuses (accumulates as scan progresses) */
  onScanStatuses?: (statuses: Map<string, ScanStatus>) => void;
}

export function BodaccScanButton({ restaurants, onResults, onScanningId, onScanStatuses }: Props) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const { toast } = useToast();

  const scan = useCallback(async () => {
    const withSiren = restaurants
      .map((r) => ({
        id: r.id,
        siren: r.siret ? r.siret.replace(/\s/g, "").substring(0, 9) : "",
      }))
      .filter((r) => /^\d{9}$/.test(r.siren));

    if (withSiren.length === 0) {
      toast({ title: "Aucun restaurant avec un SIREN valide" });
      return;
    }

    setScanning(true);
    setProgress({ done: 0, total: withSiren.length });

    const results: BodaccResults = new Map();
    const statuses = new Map<string, ScanStatus>();
    let alertCount = 0;

    for (let i = 0; i < withSiren.length; i++) {
      const r = withSiren[i];

      // Signal which restaurant is being scanned
      statuses.set(r.id, "scanning");
      onScanningId?.(r.id);
      onScanStatuses?.(new Map(statuses));

      try {
        const { data, error } = await supabase.functions.invoke("fetch-bodacc", {
          body: { siren: r.siren },
        });
        if (!error && data?.annonces?.length > 0) {
          results.set(r.id, data.annonces);
          alertCount += data.annonces.length;
          statuses.set(r.id, "alert");
        } else {
          statuses.set(r.id, "ok");
        }
      } catch {
        statuses.set(r.id, "error");
      }

      // Update results progressively so the UI shows dots appearing
      onResults(new Map(results));
      onScanStatuses?.(new Map(statuses));
      setProgress({ done: i + 1, total: withSiren.length });

      if (i < withSiren.length - 1) {
        await new Promise((res) => setTimeout(res, 300));
      }
    }

    saveBodaccResults(results);
    onResults(results);
    onScanningId?.(null);
    setScanning(false);

    toast({
      title: "Scan BODACC terminé",
      description: alertCount > 0
        ? `${alertCount} annonce${alertCount > 1 ? "s" : ""} détectée${alertCount > 1 ? "s" : ""} sur ${results.size} restaurant${results.size > 1 ? "s" : ""}`
        : "Aucune annonce détectée",
    });
  }, [restaurants, onResults, onScanningId, onScanStatuses, toast]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={scan}
      disabled={scanning}
      className="gap-1.5"
    >
      {scanning ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress.done}/{progress.total}
        </>
      ) : (
        <>
          <ShieldAlert className="h-4 w-4" />
          BODACC
        </>
      )}
    </Button>
  );
}
