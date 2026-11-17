import { useQuery } from "@tanstack/react-query";
import { fetchCiteoAccounts, type CiteoAccount } from "@/lib/citeoStatus";

/** Sociétés CITEO de l'enseigne affichée (ou de toutes les enseignes accessibles si aucune n'est choisie). */
export function useCiteoAccounts(chainId?: string | null) {
  const query = useQuery<CiteoAccount[]>({
    queryKey: ["citeo-accounts", chainId ?? "all"],
    queryFn: () => fetchCiteoAccounts(chainId),
    staleTime: 5 * 60_000,
  });
  return { accounts: query.data ?? [], isLoading: query.isLoading, error: query.error as Error | null };
}
