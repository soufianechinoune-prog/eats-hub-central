import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  return useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_role");
      if (error) return null;
      return data as string | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanImport() {
  const { data: role } = useUserRole();
  return role === "super_admin" || role === "importer";
}
