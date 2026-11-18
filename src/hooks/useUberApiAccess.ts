import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { cancelUberApiAccessRequest, fetchUberApiAccess, recordUberApiAccessRequest, type UberApiAccess } from "@/lib/uberApiAccess";

/** Accès API Uber constaté pour chaque restaurant de l'enseigne affichée, et suivi des demandes d'accès. */
export function useUberApiAccess(chainId?: string | null) {
  const qc = useQueryClient();
  const key = ["uber-api-access", chainId ?? "all"];

  const query = useQuery<UberApiAccess[]>({
    queryKey: key,
    queryFn: () => fetchUberApiAccess(chainId),
    staleTime: 5 * 60_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["uber-api-access"] });

  const request = useMutation({
    mutationFn: (restaurantId: string) => recordUberApiAccessRequest(restaurantId),
    onSuccess: () => { refresh(); toast({ title: "Demande d'accès notée", description: "Le badge vous rappellera depuis combien de jours elle attend." }); },
    onError: (e: Error) => toast({ title: "La demande n'a pas été notée", description: e.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: (requestId: string) => cancelUberApiAccessRequest(requestId),
    onSuccess: () => { refresh(); toast({ title: "Demande retirée" }); },
    onError: (e: Error) => toast({ title: "La demande n'a pas été retirée", description: e.message, variant: "destructive" }),
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const byRestaurant = useMemo(() => new Map(rows.map((r) => [r.restaurant_id, r])), [rows]);
  return {
    rows,
    byRestaurant,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    request: (restaurantId: string) => request.mutate(restaurantId),
    cancel: (requestId: string) => cancel.mutate(requestId),
    pending: request.isPending || cancel.isPending,
  };
}
