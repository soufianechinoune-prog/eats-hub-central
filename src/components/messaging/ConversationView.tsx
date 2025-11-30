import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Normalize phone number for comparison
  const normalizePhone = (phone: string) => {
    return phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
  };

  // Group messages into conversations by phone number
  const conversations = useMemo(() => {
    const convMap = new Map<string, Conversation>();

    messages.forEach((msg) => {
      // Determine the conversation phone (the other party)
      const phone = msg.direction === "inbound" 
        ? msg.sender_phone || msg.recipient_phone
        : msg.recipient_phone;
      
      const normalizedPhone = normalizePhone(phone);

      if (!convMap.has(normalizedPhone)) {
        // Find associated restaurant
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
      
      // Update last message if this is more recent
      if (new Date(msg.created_at) > new Date(conv.lastMessageAt)) {
        conv.lastMessage = msg.message_content;
        conv.lastMessageAt = msg.created_at;
      }

      // Count unread incoming messages
      if (msg.direction === "inbound" && msg.status !== "read") {
        conv.unreadCount++;
      }
    });

    // Sort conversations by last message date (most recent first)
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
        return <Eye className="h-3 w-3 text-primary" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-green-500" />;
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "pending":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return null;
    }
  };

  // Send a reply message
  const sendReply = async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    setIsSending(true);

    try {
      // Find the restaurant for this conversation
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* Conversation List */}
      <Card className={cn("lg:col-span-1", selectedPhone && "hidden lg:block")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversations
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[480px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Chargement...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-4">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune conversation</p>
                <p className="text-sm">Envoyez un message pour commencer</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.phone}
                  className={cn(
                    "flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 border-b transition-colors",
                    selectedPhone && normalizePhone(conv.phone) === normalizePhone(selectedPhone) && "bg-muted"
                  )}
                  onClick={() => setSelectedPhone(conv.phone)}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {conv.restaurantName ? (
                      <Store className="h-5 w-5 text-primary" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {conv.restaurantName || conv.contactName || conv.phone}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatConversationDate(conv.lastMessageAt)}
                      </span>
                    </div>
                    {conv.restaurantName && conv.contactName && (
                      <div className="text-xs text-muted-foreground truncate">
                        {conv.contactName}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge className="ml-2 shrink-0 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message View */}
      <Card className={cn("lg:col-span-2", !selectedPhone && "hidden lg:flex lg:items-center lg:justify-center")}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <CardHeader className="border-b py-3 px-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSelectedPhone(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {selectedConversation.restaurantName ? (
                    <Store className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {selectedConversation.restaurantName || selectedConversation.contactName || selectedConversation.phone}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedConversation.phone}
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-[440px] p-4">
                <div className="space-y-4">
                  {selectedConversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.direction === "outbound" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-lg px-4 py-2",
                          msg.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.message_content}
                        </p>
                        <div
                          className={cn(
                            "flex items-center gap-1 mt-1 text-xs",
                            msg.direction === "outbound"
                              ? "text-primary-foreground/70 justify-end"
                              : "text-muted-foreground"
                          )}
                        >
                          <span>{formatMessageDate(msg.created_at)}</span>
                          {getStatusIcon(msg)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Écrire un message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSending}
                  className="flex-1"
                />
                <Button onClick={sendReply} disabled={!newMessage.trim() || isSending}>
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground p-8">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Sélectionnez une conversation</p>
            <p className="text-sm">Choisissez une conversation à gauche pour voir les messages</p>
          </div>
        )}
      </Card>
    </div>
  );
}
