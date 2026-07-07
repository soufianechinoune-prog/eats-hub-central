import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const query = useQuery({
    queryKey: ["user-role", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc("get_user_role");
      if (error) return null;
      return data as string | null;
    },
    enabled: userId !== undefined,
    staleTime: 5 * 60 * 1000,
  });

  // Treat "session not yet resolved" as loading so gates don't flash content.
  return {
    ...query,
    isLoading: userId === undefined || query.isLoading,
  } as typeof query;
}

export function useCanImport() {
  const { data: role } = useUserRole();
  return role === "super_admin" || role === "importer";
}
