import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  Mic,
  Square,
  Trash2,
  Bell,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVoiceRecorder, formatRecordingTime } from "@/hooks/useVoiceRecorder";
import { AudioPlayer } from "@/components/messaging/AudioPlayer";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";

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
  media_url: string | null;
  media_type: string | null;
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

interface MediaPreview {
  file: File;
  url: string;
  type: 'image' | 'document';
}

// Animation variants
const messageVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
  }
};

const conversationItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.2 }
  })
};

export default function ConversationView() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Voice recorder hook
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  } = useVoiceRecorder();

  // Notification hook
  const { notify } = useMessageNotifications({
    enabled: notificationsEnabled,
    soundEnabled: true,
    toastEnabled: true,
  });

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

  // Track initial message IDs to avoid notifications on first load
  useEffect(() => {
    if (messages.length > 0 && isInitialLoadRef.current) {
      messages.forEach((msg) => seenMessageIdsRef.current.add(msg.id));
      isInitialLoadRef.current = false;
    }
  }, [messages]);

  // Subscribe to realtime updates with notifications
  useEffect(() => {
    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_history",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // Only notify for inbound messages we haven't seen
          if (
            newMsg.direction === "inbound" && 
            !seenMessageIdsRef.current.has(newMsg.id) &&
            !isInitialLoadRef.current
          ) {
            seenMessageIdsRef.current.add(newMsg.id);
            
            // Get sender info
            const senderName = newMsg.recipient_name || newMsg.restaurant_name || null;
            const messagePreview = newMsg.media_type === "audio" 
              ? "🎤 Message vocal" 
              : newMsg.message_content || "Nouveau message";
            
            // Trigger notification
            notify(senderName, messagePreview, () => {
              // Click handler: select the conversation
              const phone = newMsg.sender_phone || newMsg.recipient_phone;
              setSelectedPhone(phone);
            });
          }
          
          queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
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

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 10MB)");
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setMediaPreview({ file, url, type });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clear media preview
  const clearMediaPreview = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview.url);
    }
    setMediaPreview(null);
  };

  // Send media message
  const sendMedia = async () => {
    if (!selectedConversation || !mediaPreview) return;

    setIsUploadingMedia(true);

    try {
      const restaurant = restaurants.find(
        (r) => r.manager_whatsapp && normalizePhone(r.manager_whatsapp) === normalizePhone(selectedConversation.phone)
      );

      // Upload file to Supabase storage
      const fileName = `${Date.now()}-${mediaPreview.file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, mediaPreview.file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Erreur lors de l\'upload du fichier');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);

      console.log('Media uploaded, public URL:', publicUrl);

      // Send media via edge function
      const { data, error } = await supabase.functions.invoke("send-whatsapp-media", {
        body: {
          phone: selectedConversation.phone,
          mediaUrl: publicUrl,
          mediaType: mediaPreview.type,
          caption: newMessage.trim() || undefined,
          filename: mediaPreview.file.name,
          restaurant_id: restaurant?.id,
          recipient_name: selectedConversation.contactName,
          restaurant_name: selectedConversation.restaurantName,
        },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        toast.success(mediaPreview.type === 'image' ? "Image envoyée" : "Document envoyé");
        clearMediaPreview();
        setNewMessage("");
        queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
      } else {
        toast.error(data.error || "Échec de l'envoi");
      }
    } catch (err) {
      console.error("Error sending media:", err);
      toast.error("Erreur lors de l'envoi du média");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Send a reply message
  const sendReply = async () => {
    // If there's media, send media instead
    if (mediaPreview) {
      await sendMedia();
      return;
    }

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

  // Send voice message
  const sendVoiceMessage = async () => {
    if (!selectedConversation || !audioBlob) return;

    setIsSendingVoice(true);

    try {
      const restaurant = restaurants.find(
        (r) => r.manager_whatsapp && normalizePhone(r.manager_whatsapp) === normalizePhone(selectedConversation.phone)
      );

      // Create file from blob
      const fileName = `voice-${Date.now()}.ogg`;
      const file = new File([audioBlob], fileName, { type: audioBlob.type });

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Erreur lors de l\'upload du message vocal');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);

      console.log('Voice uploaded, public URL:', publicUrl);

      // Send via edge function
      const { data, error } = await supabase.functions.invoke("send-whatsapp-media", {
        body: {
          phone: selectedConversation.phone,
          mediaUrl: publicUrl,
          mediaType: 'audio',
          restaurant_id: restaurant?.id,
          recipient_name: selectedConversation.contactName,
          restaurant_name: selectedConversation.restaurantName,
        },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        toast.success("Message vocal envoyé");
        clearRecording();
        queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
      } else {
        toast.error(data.error || "Échec de l'envoi");
      }
    } catch (err) {
      console.error("Error sending voice message:", err);
      toast.error("Erreur lors de l'envoi du message vocal");
    } finally {
      setIsSendingVoice(false);
    }
  };

  // Handle enter key to send
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  // Render message content (detect media messages)
  const renderMessageContent = (msg: Message) => {
    const content = msg.message_content;
    
    // Audio message with URL - show audio player
    if (msg.media_type === 'audio' && msg.media_url) {
      return (
        <div className="min-w-[200px]">
          <AudioPlayer src={msg.media_url} />
        </div>
      );
    }
    
    // Image message
    if (content.startsWith('📷 Image')) {
      if (msg.media_url) {
        return (
          <div className="space-y-2">
            <img 
              src={msg.media_url} 
              alt="Image" 
              className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(msg.media_url!, '_blank')}
            />
            {content.replace('📷 Image', '').replace(': ', '') && (
              <p className="text-sm">{content.replace('📷 Image', '').replace(': ', '')}</p>
            )}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-whatsapp" />
          <span>{content.replace('📷 ', '')}</span>
        </div>
      );
    }
    
    // Document message
    if (content.startsWith('📄 Document')) {
      return (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <span>{content.replace('📄 ', '')}</span>
          {msg.media_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => window.open(msg.media_url!, '_blank')}
            >
              Ouvrir
            </Button>
          )}
        </div>
      );
    }
    
    // Voice message without URL (fallback)
    if (content.startsWith('🎤 Message vocal')) {
      return (
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-orange-500" />
          <span>Message vocal</span>
        </div>
      );
    }
    
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[650px] bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'image')}
        accept="image/*"
      />

      {/* Conversation List */}
      <div className={cn(
        "lg:col-span-1 border-r border-border/50 flex flex-col",
        selectedPhone && "hidden lg:flex"
      )}>
        {/* Header */}
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Messages</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={cn(
                "h-8 w-8 p-0 rounded-lg transition-colors",
                notificationsEnabled 
                  ? "text-whatsapp hover:bg-whatsapp/10" 
                  : "text-muted-foreground hover:bg-secondary"
              )}
              title={notificationsEnabled ? "Désactiver les notifications" : "Activer les notifications"}
            >
              {notificationsEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
          </div>
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
              {filteredConversations.map((conv, index) => {
                const isSelected = selectedPhone && normalizePhone(conv.phone) === normalizePhone(selectedPhone);
                
                return (
                  <motion.div
                    key={conv.phone}
                    custom={index}
                    variants={conversationItemVariants}
                    initial="hidden"
                    animate="visible"
                    className={cn(
                      "flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 border-l-2",
                      isSelected 
                        ? "bg-whatsapp/5 border-l-whatsapp" 
                        : "border-l-transparent hover:bg-secondary/50"
                    )}
                    onClick={() => setSelectedPhone(conv.phone)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <motion.div 
                      className={cn(
                        "h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-colors",
                        conv.restaurantName ? "bg-whatsapp/10" : "bg-secondary"
                      )}
                      whileHover={{ scale: 1.05 }}
                    >
                      {conv.restaurantName ? (
                        <Store className="h-5 w-5 text-whatsapp" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </motion.div>
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
                        <AnimatePresence>
                          {conv.unreadCount > 0 && (
                            <motion.span 
                              className="ml-2 flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-whatsapp text-white"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            >
                              {conv.unreadCount}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
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
        <AnimatePresence mode="wait">
          {selectedConversation ? (
            <motion.div 
              className="flex flex-col h-full"
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
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
                  <motion.div 
                    className={cn(
                      "h-11 w-11 rounded-full flex items-center justify-center",
                      selectedConversation.restaurantName ? "bg-whatsapp/10" : "bg-secondary"
                    )}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    {selectedConversation.restaurantName ? (
                      <Store className="h-5 w-5 text-whatsapp" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </motion.div>
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
                        <AnimatePresence>
                          {showDate && (
                            <motion.div 
                              className="flex justify-center my-4"
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <span className="px-3 py-1 text-xs font-medium text-muted-foreground bg-card/80 rounded-full shadow-sm">
                                {isToday(new Date(msg.created_at)) 
                                  ? "Aujourd'hui" 
                                  : isYesterday(new Date(msg.created_at))
                                    ? "Hier"
                                    : format(new Date(msg.created_at), "d MMMM yyyy", { locale: fr })}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <motion.div 
                          className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
                          variants={messageVariants}
                          initial="hidden"
                          animate="visible"
                          layout
                        >
                          <motion.div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm relative",
                              isOutbound
                                ? "bg-whatsapp-bubble-out text-foreground rounded-br-md"
                                : "bg-card text-foreground rounded-bl-md"
                            )}
                            whileHover={{ scale: 1.01 }}
                            transition={{ duration: 0.1 }}
                          >
                            <p className="text-[15px] leading-relaxed">
                              {renderMessageContent(msg)}
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
                          </motion.div>
                        </motion.div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Media Preview */}
              <AnimatePresence>
                {mediaPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="px-4 py-3 bg-card/95 backdrop-blur-sm border-t border-border/50"
                  >
                    <div className="flex items-start gap-3 max-w-3xl mx-auto">
                      <div className="relative">
                        {mediaPreview.type === 'image' ? (
                          <img
                            src={mediaPreview.url}
                            alt="Preview"
                            className="h-20 w-20 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-secondary flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          onClick={clearMediaPreview}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {mediaPreview.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(mediaPreview.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {mediaPreview.type === 'image' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ajoutez une légende ci-dessous (optionnel)
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input */}
              <div className="p-4 bg-card/95 backdrop-blur-sm border-t border-border/50">
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    /* Recording UI */
                    <motion.div
                      key="recording"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center gap-3 max-w-3xl mx-auto"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={cancelRecording}
                        className="h-11 w-11 rounded-full shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      
                      <div className="flex-1 flex items-center gap-3 px-4 h-11 rounded-full bg-secondary/50">
                        <motion.div
                          className="h-3 w-3 rounded-full bg-destructive"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        <span className="font-medium text-sm text-foreground">
                          {formatRecordingTime(recordingTime)}
                        </span>
                        <div className="flex-1 flex items-center gap-0.5 justify-center">
                          {[...Array(20)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-1 bg-foreground/30 rounded-full"
                              animate={{
                                height: [4, Math.random() * 16 + 4, 4],
                              }}
                              transition={{
                                duration: 0.5,
                                repeat: Infinity,
                                delay: i * 0.05,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <motion.div whileTap={{ scale: 0.9 }}>
                        <Button
                          size="icon"
                          onClick={stopRecording}
                          className="h-11 w-11 rounded-full shrink-0 bg-destructive hover:bg-destructive/90"
                        >
                          <Square className="h-4 w-4 fill-current" />
                        </Button>
                      </motion.div>
                    </motion.div>
                  ) : audioBlob ? (
                    /* Audio Preview UI */
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center gap-3 max-w-3xl mx-auto"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearRecording}
                        className="h-11 w-11 rounded-full shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      
                      <div className="flex-1 flex items-center gap-3 px-4 h-11 rounded-full bg-secondary/50">
                        <Mic className="h-4 w-4 text-orange-500" />
                        <span className="text-sm text-foreground">
                          Message vocal ({formatRecordingTime(recordingTime)})
                        </span>
                      </div>
                      
                      <motion.div whileTap={{ scale: 0.9 }}>
                        <Button
                          size="icon"
                          onClick={sendVoiceMessage}
                          disabled={isSendingVoice}
                          className="h-11 w-11 rounded-full shrink-0 bg-whatsapp hover:bg-whatsapp/90"
                        >
                          {isSendingVoice ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <Loader2 className="h-5 w-5" />
                            </motion.div>
                          ) : (
                            <Send className="h-5 w-5" />
                          )}
                        </Button>
                      </motion.div>
                    </motion.div>
                  ) : (
                    /* Normal Input UI */
                    <motion.div
                      key="input"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-end gap-2 max-w-3xl mx-auto"
                    >
                      {/* Attachment Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-full shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          >
                            <Paperclip className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => handleFileSelect(e as any, 'image');
                              input.click();
                            }}
                            className="gap-3 cursor-pointer"
                          >
                            <div className="h-8 w-8 rounded-full bg-whatsapp/10 flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-whatsapp" />
                            </div>
                            <span>Image</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.pdf,.doc,.docx';
                              input.onchange = (e) => handleFileSelect(e as any, 'document');
                              input.click();
                            }}
                            className="gap-3 cursor-pointer"
                          >
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-blue-500" />
                            </div>
                            <span>Document</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="flex-1 relative">
                        <Input
                          placeholder={mediaPreview ? "Ajouter une légende..." : "Écrire un message..."}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          disabled={isSending || isUploadingMedia}
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
                      
                      <motion.div whileTap={{ scale: 0.9 }}>
                        {(newMessage.trim() || mediaPreview) ? (
                          <Button
                            size="icon"
                            onClick={sendReply}
                            disabled={isSending || isUploadingMedia}
                            className="h-11 w-11 rounded-full shrink-0 bg-whatsapp hover:bg-whatsapp/90"
                          >
                            {(isSending || isUploadingMedia) ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <Loader2 className="h-5 w-5" />
                              </motion.div>
                            ) : (
                              <Send className="h-5 w-5" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            onClick={async () => {
                              try {
                                await startRecording();
                              } catch (err) {
                                toast.error("Impossible d'accéder au microphone");
                              }
                            }}
                            className="h-11 w-11 rounded-full shrink-0 bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                          >
                            <Mic className="h-5 w-5" />
                          </Button>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              className="text-center text-muted-foreground p-8"
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div 
                className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <MessageSquare className="h-10 w-10 opacity-40" />
              </motion.div>
              <p className="font-medium text-lg text-foreground/80">Vos messages</p>
              <p className="text-sm mt-1 opacity-70">
                Sélectionnez une conversation pour commencer
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
