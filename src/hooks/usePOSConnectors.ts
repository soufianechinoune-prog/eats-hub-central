import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export type POSConnectorField = {
  key: string;
  label: string;
  type: "text" | "email" | "password";
  required: boolean;
};

export type POSConnector = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  status: "available" | "coming_soon" | "deprecated";
  auth_type: "credentials" | "api_key" | "oauth2";
  required_fields: POSConnectorField[];
  display_order: number;
  website_url: string | null;
};

export type ChainPOSConnection = {
  id: string;
  chain_id: string;
  connector_id: string;
  is_active: boolean;
  account_label: string | null;
  credentials: Record<string, string>;
  connected_at: string;
  last_sync_at: string | null;
};

/** Catalogue de toutes les caisses disponibles dans la plateforme. */
export function usePOSConnectors() {
  return useQuery({
    queryKey: ["pos_connectors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_connectors")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as POSConnector[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Connexion POS active de la chaîne sélectionnée (ou null). */
export function useActiveChainPOSConnection() {
  const { selectedChainId } = useAnalyticsContext();

  return useQuery({
    queryKey: ["chain_pos_connection", selectedChainId],
    enabled: !!selectedChainId,
    queryFn: async () => {
      if (!selectedChainId) return null;
      const { data, error } = await supabase
        .from("chain_pos_connections")
        .select("*, connector:pos_connectors(*)")
        .eq("chain_id", selectedChainId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as
        | (ChainPOSConnection & { connector: POSConnector })
        | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Lance une synchronisation pour une connexion POS donnée. */
export function useSyncPOS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { connectionId: string; connectorId: string }) => {
      // Pour l'instant, seul Splash360 est supporté
      if (input.connectorId !== "splash360") {
        throw new Error(`Connecteur ${input.connectorId} non supporté pour la synchro`);
      }
      const { data, error } = await supabase.functions.invoke("sync-splash360", {
        body: {
          mode: "sync",
          granularity: "day",
          chain_connection_id: input.connectionId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { rows_upserted: number; errors_count: number; period: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chain_pos_connection"] });
      // Forcer le refresh de tout ce qui consomme la donnée caisse Splash360
      queryClient.invalidateQueries({ queryKey: ["network-cash-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["overview-sales"] });
      queryClient.invalidateQueries({ queryKey: ["overview-stats"] });
      queryClient.invalidateQueries({ queryKey: ["network-stats-restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["network-stats-sales-prev"] });
    },
  });
}

/**
 * Lance un backfill historique en orchestrant N appels `sync` ciblés (un par mois)
 * côté client, pour éviter le `CPU Time exceeded` de l'edge function.
 */
export function useBackfillPOS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      connectionId: string;
      connectorId: string;
      monthsBack?: number;
      onProgress?: (info: { done: number; total: number; period: string; inserted: number; error?: string }) => void;
    }) => {
      if (input.connectorId !== "splash360") {
        throw new Error(`Connecteur ${input.connectorId} non supporté pour le backfill`);
      }
      const monthsBack = Math.max(1, Math.min(48, input.monthsBack ?? 24));
      const now = new Date();
      const months: { year: number; month: number }[] = [];
      for (let i = 0; i < monthsBack; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
      }

      let totalRows = 0;
      const perMonth: { period: string; inserted: number; error?: string }[] = [];

      for (let i = 0; i < months.length; i++) {
        const { year, month } = months[i];
        const period = `${year}-${String(month).padStart(2, "0")}`;
        try {
          const { data, error } = await supabase.functions.invoke("sync-splash360", {
            body: {
              mode: "sync",
              granularity: "day",
              chain_connection_id: input.connectionId,
              year,
              month,
            },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          const inserted = Number(data?.rows_upserted ?? 0);
          totalRows += inserted;
          perMonth.push({ period, inserted });
          input.onProgress?.({ done: i + 1, total: months.length, period, inserted });
        } catch (e: any) {
          const errMsg = e?.message ?? String(e);
          perMonth.push({ period, inserted: 0, error: errMsg });
          input.onProgress?.({ done: i + 1, total: months.length, period, inserted: 0, error: errMsg });
        }
        // Petit délai entre les appels pour ménager l'API Splash360
        if (i < months.length - 1) await new Promise((r) => setTimeout(r, 200));
      }

      return { total_rows: totalRows, months_back: monthsBack, per_month: perMonth };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chain_pos_connection"] });
    },
  });
}

/** Connecter (ou reconnecter) une caisse à la chaîne active. */
export function useConnectPOS() {
  const queryClient = useQueryClient();
  const { selectedChainId } = useAnalyticsContext();

  return useMutation({
    mutationFn: async (input: {
      connectorId: string;
      accountLabel: string;
      credentials: Record<string, string>;
    }) => {
      if (!selectedChainId) throw new Error("Aucune chaîne sélectionnée");

      // Désactiver toute connexion existante pour cette chaîne
      await supabase
        .from("chain_pos_connections")
        .update({ is_active: false })
        .eq("chain_id", selectedChainId);

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("chain_pos_connections")
        .insert({
          chain_id: selectedChainId,
          connector_id: input.connectorId,
          is_active: true,
          account_label: input.accountLabel || null,
          credentials: input.credentials,
          connected_by: userData.user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chain_pos_connection"] });
    },
  });
}

/** Déconnecter la caisse active de la chaîne courante. */
export function useDisconnectPOS() {
  const queryClient = useQueryClient();
  const { selectedChainId } = useAnalyticsContext();

  return useMutation({
    mutationFn: async () => {
      if (!selectedChainId) throw new Error("Aucune chaîne sélectionnée");
      const { error } = await supabase
        .from("chain_pos_connections")
        .update({ is_active: false })
        .eq("chain_id", selectedChainId)
        .eq("is_active", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chain_pos_connection"] });
    },
  });
}
