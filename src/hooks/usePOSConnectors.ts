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
  const { selectedChainId } = useAnalytics();

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
      return data as
        | (ChainPOSConnection & { connector: POSConnector })
        | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Connecter (ou reconnecter) une caisse à la chaîne active. */
export function useConnectPOS() {
  const queryClient = useQueryClient();
  const { selectedChainId } = useAnalytics();

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
  const { selectedChainId } = useAnalytics();

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
