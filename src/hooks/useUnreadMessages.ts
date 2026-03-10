import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true })
        .eq("direction", "inbound")
        .is("read_at", null);

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
  }, []);

  return unreadCount;
}
