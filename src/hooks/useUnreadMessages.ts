import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages(chainId?: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      let query = supabase
        .from("message_history")
        .select(
          chainId ? "*, restaurants!inner(chain_id)" : "*",
          { count: "exact", head: true }
        )
        .eq("direction", "inbound")
        .is("read_at", null);

      if (chainId) {
        query = query.eq("restaurants.chain_id", chainId);
      }

      const { count, error } = await query;
      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };

    fetchUnreadCount();

    // Poll every 60 seconds instead of Realtime to reduce Cloud costs
    const interval = setInterval(fetchUnreadCount, 60_000);

    return () => {
      clearInterval(interval);
    };
  }, [chainId]);

  return unreadCount;
}
