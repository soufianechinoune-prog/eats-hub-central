import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const { data, error } = await supabase.rpc("is_super_admin");
      if (error) {
        console.error("is_super_admin error:", error);
        return false;
      }
      return !!data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
