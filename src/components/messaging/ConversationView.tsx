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
  ExternalLink,
  MoreVertical,
  Filter,
  Archive,
  MailOpen,
  Inbox,
  ChevronUp,
  ChevronDown,
  RefreshCw,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  duration: number | null;
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
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [archivedPhones, setArchivedPhones] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('archivedConversations');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const searchResultRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Common emojis for quick selection
  const commonEmojis = [
    "😀", "😊", "😂", "🤣", "😍", "🥰", "😘", "😎",
    "👍", "👋", "🙏", "💪", "🎉", "🔥", "❤️", "💯",
    "✅", "⭐", "🍔", "🍕", "🍗", "🥗", "🍟", "🥤",
    "📱", "📞", "📍", "🏠", "🚗", "⏰", "📅", "💬",
  ];

  // Voice recorder hook
  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioDuration,
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

  // Filter conversations by search and filter type
  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    // Handle archived filter differently
    if (conversationFilter === 'archived') {
      filtered = filtered.filter(conv => archivedPhones.has(normalizePhone(conv.phone)));
    } else {
      // Filter out archived conversations for all/unread views
      filtered = filtered.filter(conv => !archivedPhones.has(normalizePhone(conv.phone)));
      
      // Apply unread filter
      if (conversationFilter === 'unread') {
        filtered = filtered.filter(conv => conv.unreadCount > 0);
      }
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (conv) =>
          conv.phone.includes(query) ||
          conv.restaurantName?.toLowerCase().includes(query) ||
          conv.contactName?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [conversations, searchQuery, conversationFilter, archivedPhones]);

  // Count unread conversations
  const unreadConversationsCount = useMemo(() => {
    return conversations.filter(
      conv => !archivedPhones.has(normalizePhone(conv.phone)) && conv.unreadCount > 0
    ).length;
  }, [conversations, archivedPhones]);

  // Count archived conversations
  const archivedConversationsCount = useMemo(() => {
    return conversations.filter(
      conv => archivedPhones.has(normalizePhone(conv.phone))
    ).length;
  }, [conversations, archivedPhones]);

  // Get selected conversation with filtered messages
  const selectedConversation = useMemo(() => {
    if (!selectedPhone) return null;
    const conv = conversations.find((c) => normalizePhone(c.phone) === normalizePhone(selectedPhone));
    if (!conv) return null;
    
    // Don't filter messages, we need them all for navigation
    return conv;
  }, [selectedPhone, conversations]);

  // Count search results in conversation
  const searchResultsCount = useMemo(() => {
    if (!selectedConversation || !messageSearchQuery.trim()) return 0;
    const query = messageSearchQuery.toLowerCase();
    return selectedConversation.messages.filter(msg => 
      msg.message_content.toLowerCase().includes(query)
    ).length;
  }, [selectedConversation, messageSearchQuery]);

  // Reset search index when search query changes
  useEffect(() => {
    setCurrentSearchIndex(0);
    searchResultRefs.current.clear();
  }, [messageSearchQuery]);

  // Navigate to next search result
  const goToNextResult = () => {
    if (searchResultsCount === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResultsCount;
    setCurrentSearchIndex(nextIndex);
  };

  // Navigate to previous search result
  const goToPrevResult = () => {
    if (searchResultsCount === 0) return;
    const prevIndex = currentSearchIndex === 0 ? searchResultsCount - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
  };

  // Scroll to active search result
  useEffect(() => {
    if (searchResultsCount > 0) {
      const activeElement = searchResultRefs.current.get(currentSearchIndex);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSearchIndex, searchResultsCount]);

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

  // Archive a conversation
  const archiveConversation = (phone: string) => {
    const normalized = normalizePhone(phone);
    const newArchived = new Set(archivedPhones);
    newArchived.add(normalized);
    setArchivedPhones(newArchived);
    localStorage.setItem('archivedConversations', JSON.stringify([...newArchived]));
    if (selectedPhone && normalizePhone(selectedPhone) === normalized) {
      setSelectedPhone(null);
    }
    toast.success("Conversation archivée");
  };

  // Unarchive a conversation
  const unarchiveConversation = (phone: string) => {
    const normalized = normalizePhone(phone);
    const newArchived = new Set(archivedPhones);
    newArchived.delete(normalized);
    setArchivedPhones(newArchived);
    localStorage.setItem('archivedConversations', JSON.stringify([...newArchived]));
    toast.success("Conversation désarchivée");
  };

  // Mark conversation as unread
  const markConversationAsUnread = async (conv: Conversation) => {
    // Find the last inbound message to mark as unread
    const lastInbound = [...conv.messages].reverse().find(m => m.direction === 'inbound');
    if (lastInbound) {
      const { error } = await supabase
        .from("message_history")
        .update({ status: "delivered", read_at: null })
        .eq("id", lastInbound.id);
      
      if (error) {
        toast.error("Erreur lors du marquage");
      } else {
        queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
        toast.success("Marqué comme non lu");
      }
    } else {
      toast.info("Aucun message entrant à marquer");
    }
  };

  // Delete entire conversation
  const deleteConversation = async (conv: Conversation) => {
    const messageIds = conv.messages.map(m => m.id);
    
    const { error } = await supabase
      .from("message_history")
      .delete()
      .in("id", messageIds);
    
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
      if (selectedPhone && normalizePhone(selectedPhone) === normalizePhone(conv.phone)) {
        setSelectedPhone(null);
      }
      toast.success("Conversation supprimée");
    }
    setConversationToDelete(null);
  };

  // Add emoji to message
  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
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
        return (
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-destructive text-[10px]">Échec</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Retry failed voice message
  const retryFailedMessage = async (msg: Message) => {
    if (!msg.media_url || msg.media_type !== 'audio') return;

    try {
      const restaurant = restaurants.find(
        (r) => r.manager_whatsapp && normalizePhone(r.manager_whatsapp) === normalizePhone(msg.recipient_phone)
      );

      // Send via edge function with duration
      const { data, error } = await supabase.functions.invoke("send-whatsapp-media", {
        body: {
          phone: msg.recipient_phone,
          mediaUrl: msg.media_url,
          mediaType: 'audio',
          restaurant_id: restaurant?.id,
          recipient_name: msg.recipient_name,
          restaurant_name: msg.restaurant_name,
          duration: msg.duration,
        },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        toast.success("Message vocal renvoyé");
        // Delete the failed message
        await supabase
          .from("message_history")
          .delete()
          .eq("id", msg.id);
        
        queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
      } else {
        toast.error(data.error || "Échec du renvoi");
      }
    } catch (err) {
      console.error("Error retrying voice message:", err);
      toast.error("Erreur lors du renvoi du message vocal");
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

      // Determine file extension based on blob type
      const fileExtension = audioBlob.type.includes('ogg') ? 'ogg' : 
                           audioBlob.type.includes('webm') ? 'webm' : 
                           'ogg';
      const fileName = `voice-${Date.now()}.${fileExtension}`;
      const file = new File([audioBlob], fileName, { type: audioBlob.type });

      console.log('Uploading voice message:', fileName, 'type:', audioBlob.type, 'size:', audioBlob.size);

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

      // Send via edge function with duration
      const { data, error } = await supabase.functions.invoke("send-whatsapp-media", {
        body: {
          phone: selectedConversation.phone,
          mediaUrl: publicUrl,
          mediaType: 'audio',
          restaurant_id: restaurant?.id,
          recipient_name: selectedConversation.contactName,
          restaurant_name: selectedConversation.restaurantName,
          duration: audioDuration,
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

  // Delete message from history (with confirmation)
  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    
    try {
      const { error } = await supabase
        .from("message_history")
        .delete()
        .eq("id", messageToDelete.id);

      if (error) throw error;

      toast.success("Message supprimé de l'historique");
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
    } catch (err) {
      console.error("Error deleting message:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setMessageToDelete(null);
    }
  };

  // Highlight search terms in text
  const highlightSearchTerms = (text: string, isActiveResult: boolean = false) => {
    if (!messageSearchQuery.trim()) return text;
    
    const query = messageSearchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark 
              key={index} 
              className={cn(
                "text-foreground rounded px-0.5 transition-colors",
                isActiveResult 
                  ? "bg-orange-400 dark:bg-orange-500 font-medium" 
                  : "bg-amber-200/80 dark:bg-amber-500/30"
              )}
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    );
  };

  // Render message content (detect media messages)
  const renderMessageContent = (msg: Message, isActiveResult: boolean = false) => {
    const content = msg.message_content;
    
    // Audio message with URL - show audio player
    if (msg.media_type === 'audio' && msg.media_url) {
      return (
        <div className="min-w-[200px]">
          <AudioPlayer src={msg.media_url} storedDuration={msg.duration || undefined} />
        </div>
      );
    }
    
    // Image message
    if (content.startsWith('📷 Image')) {
      if (msg.media_url) {
        const caption = content.replace('📷 Image', '').replace(': ', '');
        return (
          <div className="space-y-2">
            <img 
              src={msg.media_url} 
              alt="Image" 
              className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(msg.media_url!, '_blank')}
            />
            {caption && (
              <p className="text-sm">{highlightSearchTerms(caption, isActiveResult)}</p>
            )}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-whatsapp" />
          <span>{highlightSearchTerms(content.replace('📷 ', ''), isActiveResult)}</span>
        </div>
      );
    }
    
    // Document message
    if (content.startsWith('📄 Document')) {
      // Try to extract filename and reconstruct URL if media_url is missing
      let documentUrl = msg.media_url;
      if (!documentUrl && content.includes(': ')) {
        const filename = content.replace('📄 Document: ', '').trim();
        // Search for a likely filename pattern in storage
        documentUrl = `https://akcicojkrzeirffefdet.supabase.co/storage/v1/object/public/whatsapp-media/${encodeURIComponent(filename)}`;
      }
      
      const filename = content.replace('📄 Document: ', '').trim();
      
      return (
        <div 
          className={cn(
            "flex items-center gap-3 p-3 bg-secondary/50 rounded-lg",
            documentUrl && "cursor-pointer hover:bg-secondary/70 transition-colors"
          )}
          onClick={() => documentUrl && window.open(documentUrl, '_blank')}
        >
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{filename}</p>
            <p className="text-xs text-muted-foreground">Document</p>
          </div>
          {documentUrl && (
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
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
    
    return <span className="whitespace-pre-wrap break-words">{highlightSearchTerms(content, isActiveResult)}</span>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)]" style={{ height: 'calc(100vh - 240px)', minHeight: '450px' }}>
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
      )} style={{ height: '100%' }}>
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
          
          {/* Filter tabs */}
          <div className="flex gap-2 mb-3">
            <Button
              variant={conversationFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setConversationFilter('all')}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-medium transition-all",
                conversationFilter === 'all' 
                  ? "bg-whatsapp hover:bg-whatsapp/90" 
                  : "hover:bg-secondary"
              )}
            >
              <Inbox className="h-3.5 w-3.5 mr-1.5" />
              Toutes
            </Button>
            <Button
              variant={conversationFilter === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setConversationFilter('unread')}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-medium transition-all",
                conversationFilter === 'unread' 
                  ? "bg-whatsapp hover:bg-whatsapp/90" 
                  : "hover:bg-secondary"
              )}
            >
              <MailOpen className="h-3.5 w-3.5 mr-1.5" />
              Non lues
              {unreadConversationsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">
                  {unreadConversationsCount}
                </span>
              )}
            </Button>
            <Button
              variant={conversationFilter === 'archived' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setConversationFilter('archived')}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-medium transition-all",
                conversationFilter === 'archived' 
                  ? "bg-muted-foreground hover:bg-muted-foreground/90" 
                  : "hover:bg-secondary"
              )}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archivées
              {archivedConversationsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">
                  {archivedConversationsCount}
                </span>
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
        <div className="flex-1 min-h-0 overflow-y-auto messaging-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Chargement...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-16 px-6 text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                {conversationFilter === 'archived' ? (
                  <Archive className="h-8 w-8 opacity-40" />
                ) : (
                  <MessageSquare className="h-8 w-8 opacity-40" />
                )}
              </div>
              <p className="font-medium">
                {conversationFilter === 'archived' 
                  ? "Aucune conversation archivée" 
                  : conversationFilter === 'unread'
                    ? "Aucun message non lu"
                    : "Aucune conversation"}
              </p>
              <p className="text-sm mt-1 opacity-70">
                {conversationFilter === 'archived' 
                  ? "Les conversations archivées apparaîtront ici" 
                  : conversationFilter === 'unread'
                    ? "Vous êtes à jour !"
                    : "Envoyez un message pour commencer"}
              </p>
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
                      "flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 border-l-2 group",
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
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "text-xs shrink-0",
                            conv.unreadCount > 0 ? "text-whatsapp font-medium" : "text-muted-foreground"
                          )}>
                            {formatConversationDate(conv.lastMessageAt)}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markConversationAsUnread(conv);
                                }}
                              >
                                <MailOpen className="h-4 w-4 mr-2" />
                                Marquer non lu
                              </DropdownMenuItem>
                              {conversationFilter === 'archived' ? (
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    unarchiveConversation(conv.phone);
                                  }}
                                >
                                  <Inbox className="h-4 w-4 mr-2" />
                                  Désarchiver
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archiveConversation(conv.phone);
                                  }}
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archiver
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConversationToDelete(conv);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
                              key={`unread-${conv.phone}`}
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
        </div>
      </div>

      {/* Message View */}
      <div className={cn(
        "lg:col-span-2 flex flex-col overflow-hidden bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]",
        !selectedPhone && "hidden lg:flex lg:items-center lg:justify-center"
      )}>
        <AnimatePresence mode="wait">
          {selectedConversation ? (
            <motion.div 
              className="flex flex-col h-full overflow-hidden"
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="p-4 border-b border-border/50 bg-card/95 backdrop-blur-sm space-y-3">
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className="text-foreground/60 hover:text-foreground h-9 w-9 rounded-full"
                    >
                      {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedPhone(null)}
                      className="hidden lg:flex text-foreground/60 hover:text-foreground h-9 w-9 rounded-full"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                {/* Search in conversation */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={messageSearchQuery}
                    onChange={(e) => setMessageSearchQuery(e.target.value)}
                    placeholder="Rechercher dans la conversation..."
                    className={cn(
                      "pl-9 h-9 rounded-xl bg-secondary/50 border-0 focus:bg-secondary focus:ring-0 transition-colors",
                      searchResultsCount > 0 ? "pr-32" : "pr-9"
                    )}
                  />
                  {messageSearchQuery && searchResultsCount > 0 && (
                    <div className="absolute right-20 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        {currentSearchIndex + 1}/{searchResultsCount}
                      </span>
                      <div className="flex items-center border-l border-border/50 pl-1 ml-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={goToPrevResult}
                          className="h-6 w-6 hover:bg-secondary"
                          title="Résultat précédent"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={goToNextResult}
                          className="h-6 w-6 hover:bg-secondary"
                          title="Résultat suivant"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {messageSearchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setMessageSearchQuery("");
                        setCurrentSearchIndex(0);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 messaging-scrollbar">
                <div className="space-y-3 max-w-3xl mx-auto">
                  {(() => {
                    // Build search results index map
                    let searchResultIndex = 0;
                    const searchQuery = messageSearchQuery.trim().toLowerCase();
                    const hasSearch = searchQuery.length > 0;
                    
                    return selectedConversation.messages.map((msg, index) => {
                      const isOutbound = msg.direction === "outbound";
                      const showDate = index === 0 || 
                        new Date(msg.created_at).toDateString() !== 
                        new Date(selectedConversation.messages[index - 1].created_at).toDateString();
                      
                      // Check if this message matches search
                      const isSearchResult = hasSearch && msg.message_content.toLowerCase().includes(searchQuery);
                      const currentResultIndex = isSearchResult ? searchResultIndex : -1;
                      const isActiveResult = isSearchResult && currentResultIndex === currentSearchIndex;
                      
                      // Increment search result index for next message
                      if (isSearchResult) {
                        searchResultIndex++;
                      }
                      
                      return (
                        <div 
                          key={msg.id}
                          ref={(el) => {
                            if (el && isSearchResult) {
                              searchResultRefs.current.set(currentResultIndex, el);
                            }
                          }}
                        >
                          <AnimatePresence>
                            {showDate && (
                              <motion.div 
                                key={`date-${msg.id}`}
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
                            className={cn("flex group", isOutbound ? "justify-end" : "justify-start")}
                            variants={messageVariants}
                            initial="hidden"
                            animate="visible"
                            layout
                          >
                            <div className={cn(
                              "flex items-center gap-1",
                              isOutbound ? "flex-row" : "flex-row-reverse"
                            )}>
                              {/* Delete dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isOutbound ? "end" : "start"} className="w-48">
                                  {/* Retry option for failed voice messages */}
                                  {msg.status === 'failed' && msg.media_type === 'audio' && (
                                    <DropdownMenuItem
                                      className="text-primary focus:text-primary"
                                      onClick={() => retryFailedMessage(msg)}
                                    >
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Réessayer l'envoi
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setMessageToDelete(msg)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer de l'historique
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

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
                                  {renderMessageContent(msg, isActiveResult)}
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
                            </div>
                          </motion.div>
                        </div>
                      );
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Media Preview */}
              <AnimatePresence>
                {mediaPreview && (
                  <motion.div
                    key="media-preview"
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
                        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                              type="button"
                            >
                              <Smile className="h-5 w-5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-64 p-2" 
                            side="top" 
                            align="end"
                            sideOffset={8}
                          >
                            <div className="grid grid-cols-8 gap-1">
                              {commonEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => addEmoji(emoji)}
                                  className="h-8 w-8 flex items-center justify-center text-lg hover:bg-secondary rounded-md transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le message sera supprimé de votre historique local uniquement. Il restera visible pour le destinataire sur WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {messageToDelete && (
            <div className="p-3 bg-secondary/50 rounded-lg my-2">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {messageToDelete.message_content}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Conversation Dialog */}
      <AlertDialog open={!!conversationToDelete} onOpenChange={(open) => !open && setConversationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les messages de cette conversation seront supprimés de votre historique. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {conversationToDelete && (
            <div className="p-3 bg-secondary/50 rounded-lg my-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-whatsapp/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-whatsapp" />
                </div>
                <div>
                  <p className="font-medium">
                    {conversationToDelete.restaurantName || conversationToDelete.contactName || conversationToDelete.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {conversationToDelete.messages.length} message{conversationToDelete.messages.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conversationToDelete && deleteConversation(conversationToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
