import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Search,
  Send,
  ArrowLeft,
  Phone,
  Store,
  Loader2,
  CheckCheck,
  Check,
  Clock,
  Eye,
  AlertCircle,
  User,
  Smile,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  direction: string;
  recipient_phone: string;
  sender_phone: string | null;
  message_content: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  restaurant_name: string | null;
  recipient_name: string | null;
}

interface Conversation {
  phone: string;
  restaurantName: string | null;
  contactName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
}

interface Restaurant {
  id: string;
  name: string;
  manager_whatsapp: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
}

export default function ConversationView() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["conversation-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_history")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500);

      if (error) throw error;
      return data as Message[];
    },
  });

  // Fetch restaurants for association
  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-for-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, manager_whatsapp, manager_first_name, manager_last_name")
        .not("manager_whatsapp", "is", null);

      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Normalize phone number for comparison
  const normalizePhone = (phone: string) => {
    return phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
  };

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_history",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!selectedPhone) return;

      const normalizedSelected = normalizePhone(selectedPhone);
      
      const unreadMessages = messages.filter((msg) => {
        const msgPhone = msg.direction === "inbound" 
          ? msg.sender_phone || msg.recipient_phone
          : msg.recipient_phone;
        return (
          normalizePhone(msgPhone) === normalizedSelected &&
          msg.direction === "inbound" &&
          msg.status !== "read"
        );
      });

      if (unreadMessages.length === 0) return;

      const messageIds = unreadMessages.map((m) => m.id);
      
      const { error } = await supabase
        .from("message_history")
        .update({ 
          status: "read", 
          read_at: new Date().toISOString() 
        })
        .in("id", messageIds);

      if (error) {
        console.error("Error marking messages as read:", error);
      } else {
        queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
        queryClient.invalidateQueries({ queryKey: ["message-history"] });
      }
    };

    markMessagesAsRead();
  }, [selectedPhone, messages, queryClient]);

  // Group messages into conversations by phone number
  const conversations = useMemo(() => {
    const convMap = new Map<string, Conversation>();

    messages.forEach((msg) => {
      const phone = msg.direction === "inbound" 
        ? msg.sender_phone || msg.recipient_phone
        : msg.recipient_phone;
      
      const normalizedPhone = normalizePhone(phone);

      if (!convMap.has(normalizedPhone)) {
        const restaurant = restaurants.find(
          (r) => r.manager_whatsapp && normalizePhone(r.manager_whatsapp) === normalizedPhone
        );

        convMap.set(normalizedPhone, {
          phone,
          restaurantName: msg.restaurant_name || restaurant?.name || null,
          contactName: msg.recipient_name || 
            (restaurant ? `${restaurant.manager_first_name || ""} ${restaurant.manager_last_name || ""}`.trim() : null),
          lastMessage: msg.message_content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
          messages: [],
        });
      }

      const conv = convMap.get(normalizedPhone)!;
      conv.messages.push(msg);
      
      if (new Date(msg.created_at) > new Date(conv.lastMessageAt)) {
        conv.lastMessage = msg.message_content;
        conv.lastMessageAt = msg.created_at;
      }

      if (msg.direction === "inbound" && msg.status !== "read") {
        conv.unreadCount++;
      }
    });

    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [messages, restaurants]);

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (conv) =>
        conv.phone.includes(query) ||
        conv.restaurantName?.toLowerCase().includes(query) ||
        conv.contactName?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Get selected conversation
  const selectedConversation = useMemo(() => {
    if (!selectedPhone) return null;
    return conversations.find((c) => normalizePhone(c.phone) === normalizePhone(selectedPhone));
  }, [selectedPhone, conversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConversation?.messages]);

  // Format message date
  const formatMessageDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, "HH:mm");
    if (isYesterday(d)) return `Hier ${format(d, "HH:mm")}`;
    return format(d, "d MMM HH:mm", { locale: fr });
  };

  // Format conversation date
  const formatConversationDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, "HH:mm");
    if (isYesterday(d)) return "Hier";
    return format(d, "d MMM", { locale: fr });
  };

  // Get status icon for outbound messages
  const getStatusIcon = (msg: Message) => {
    if (msg.direction === "inbound") return null;
    
    switch (msg.status) {
      case "read":
        return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
      case "delivered":
        return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/60" />;
      case "sent":
        return <Check className="h-3.5 w-3.5 text-muted-foreground/60" />;
      case "pending":
        return <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />;
      case "failed":
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return null;
    }
  };

  // Send a reply message
  const sendReply = async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    setIsSending(true);

    try {
      const restaurant = restaurants.find(
        (r) => r.manager_whatsapp && normalizePhone(r.manager_whatsapp) === normalizePhone(selectedConversation.phone)
      );

      const recipients = [{
        restaurant_id: restaurant?.id || null,
        phone: selectedConversation.phone,
        name: selectedConversation.contactName || "",
        restaurantName: selectedConversation.restaurantName || "",
      }];

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { recipients, message: newMessage },
      });

      if (error) throw new Error(error.message);

      if (data.sent > 0) {
        toast.success("Message envoyé");
        setNewMessage("");
        queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
      } else {
        toast.error("Échec de l'envoi");
      }
    } catch (err) {
      console.error("Error sending reply:", err);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setIsSending(false);
    }
  };

  // Handle enter key to send
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[650px] bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
      {/* Conversation List */}
      <div className={cn(
        "lg:col-span-1 border-r border-border/50 flex flex-col",
        selectedPhone && "hidden lg:flex"
      )}>
        {/* Header */}
        <div className="p-5 border-b border-border/50">
          <h3 className="text-lg font-semibold text-foreground mb-4">Messages</h3>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-secondary/50 border-0 focus:bg-secondary focus:ring-0 transition-colors"
            />
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Chargement...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-16 px-6 text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 opacity-40" />
              </div>
              <p className="font-medium">Aucune conversation</p>
              <p className="text-sm mt-1 opacity-70">Envoyez un message pour commencer</p>
            </div>
          ) : (
            <div>
              {filteredConversations.map((conv) => {
                const isSelected = selectedPhone && normalizePhone(conv.phone) === normalizePhone(selectedPhone);
                
                return (
                  <div
                    key={conv.phone}
                    className={cn(
                      "flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 border-l-2",
                      isSelected 
                        ? "bg-whatsapp/5 border-l-whatsapp" 
                        : "border-l-transparent hover:bg-secondary/50"
                    )}
                    onClick={() => setSelectedPhone(conv.phone)}
                  >
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      conv.restaurantName ? "bg-whatsapp/10" : "bg-secondary"
                    )}>
                      {conv.restaurantName ? (
                        <Store className="h-5 w-5 text-whatsapp" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={cn(
                          "font-medium truncate",
                          conv.unreadCount > 0 ? "text-foreground" : "text-foreground/90"
                        )}>
                          {conv.restaurantName || conv.contactName || conv.phone}
                        </span>
                        <span className={cn(
                          "text-xs shrink-0 ml-2",
                          conv.unreadCount > 0 ? "text-whatsapp font-medium" : "text-muted-foreground"
                        )}>
                          {formatConversationDate(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={cn(
                          "text-sm truncate",
                          conv.unreadCount > 0 ? "text-foreground/80" : "text-muted-foreground"
                        )}>
                          {conv.lastMessage}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-whatsapp text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message View */}
      <div className={cn(
        "lg:col-span-2 flex flex-col bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]",
        !selectedPhone && "hidden lg:flex lg:items-center lg:justify-center"
      )}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-card/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-9 w-9 rounded-full"
                  onClick={() => setSelectedPhone(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center",
                  selectedConversation.restaurantName ? "bg-whatsapp/10" : "bg-secondary"
                )}>
                  {selectedConversation.restaurantName ? (
                    <Store className="h-5 w-5 text-whatsapp" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {selectedConversation.restaurantName || selectedConversation.contactName || selectedConversation.phone}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {selectedConversation.phone}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-3xl mx-auto">
                {selectedConversation.messages.map((msg, index) => {
                  const isOutbound = msg.direction === "outbound";
                  const showDate = index === 0 || 
                    new Date(msg.created_at).toDateString() !== 
                    new Date(selectedConversation.messages[index - 1].created_at).toDateString();
                  
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 text-xs font-medium text-muted-foreground bg-card/80 rounded-full shadow-sm">
                            {isToday(new Date(msg.created_at)) 
                              ? "Aujourd'hui" 
                              : isYesterday(new Date(msg.created_at))
                                ? "Hier"
                                : format(new Date(msg.created_at), "d MMMM yyyy", { locale: fr })}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm relative",
                            isOutbound
                              ? "bg-whatsapp-bubble-out text-foreground rounded-br-md"
                              : "bg-card text-foreground rounded-bl-md"
                          )}
                        >
                          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                            {msg.message_content}
                          </p>
                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1 text-[11px]",
                              isOutbound ? "justify-end text-muted-foreground/70" : "text-muted-foreground/60"
                            )}
                          >
                            <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                            {getStatusIcon(msg)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-card/95 backdrop-blur-sm border-t border-border/50">
              <div className="flex items-end gap-3 max-w-3xl mx-auto">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Écrire un message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isSending}
                    className="h-11 pr-12 rounded-full bg-secondary/50 border-0 focus:bg-secondary focus:ring-0 transition-colors text-[15px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                    type="button"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </div>
                <Button
                  size="icon"
                  onClick={sendReply}
                  disabled={!newMessage.trim() || isSending}
                  className={cn(
                    "h-11 w-11 rounded-full shrink-0 transition-all",
                    newMessage.trim() 
                      ? "bg-whatsapp hover:bg-whatsapp/90" 
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground p-8">
            <div className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-10 w-10 opacity-40" />
            </div>
            <p className="font-medium text-lg text-foreground/80">Vos messages</p>
            <p className="text-sm mt-1 opacity-70">
              Sélectionnez une conversation pour commencer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
