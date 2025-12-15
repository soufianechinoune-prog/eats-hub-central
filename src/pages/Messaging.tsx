import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Inbox, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ConversationView from "@/components/messaging/ConversationView";
import NewMessageComposer from "@/components/messaging/NewMessageComposer";
import { cn } from "@/lib/utils";

// Animation variants
const tabContentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
  }
};

export default function Messaging() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("inbox");

  // Fetch message history (for unread count)
  const { data: messageHistory = [] } = useQuery({
    queryKey: ["message-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_history")
        .select("id, direction, status, read_at")
        .eq("direction", "inbound")
        .is("read_at", null)
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  // Subscribe to realtime updates for message_history
  useEffect(() => {
    const channel = supabase
      .channel("message-history-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_history",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["message-history"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Unread incoming messages count
  const unreadCount = useMemo(() => {
    return messageHistory.length;
  }, [messageHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Messagerie</h1>
          <p className="text-muted-foreground mt-1">
            Communiquez avec vos restaurants via WhatsApp
          </p>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/50 p-1.5 rounded-xl h-auto">
          <TabsTrigger 
            value="inbox" 
            className={cn(
              "flex items-center gap-2.5 px-6 py-3 rounded-lg transition-all",
              "data-[state=active]:bg-card data-[state=active]:shadow-md"
            )}
          >
            <Inbox className="h-5 w-5" />
            <span className="font-medium">Inbox</span>
            {unreadCount > 0 && (
              <motion.span 
                className="ml-1 flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-whatsapp text-white"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                {unreadCount}
              </motion.span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="new" 
            className={cn(
              "flex items-center gap-2.5 px-6 py-3 rounded-lg transition-all",
              "data-[state=active]:bg-card data-[state=active]:shadow-md"
            )}
          >
            <PlusCircle className="h-5 w-5" />
            <span className="font-medium">Nouveau message</span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="inbox" className="mt-6 h-[calc(100vh-200px)] min-h-[500px]" asChild>
            <motion.div
              key="inbox"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="h-full"
            >
              <ConversationView />
            </motion.div>
          </TabsContent>

          <TabsContent value="new" className="mt-6" asChild>
            <motion.div
              key="new"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <NewMessageComposer onMessageSent={() => setActiveTab("inbox")} />
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
