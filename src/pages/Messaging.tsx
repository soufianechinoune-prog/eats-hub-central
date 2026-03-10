import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Search,
  Send,
  CheckCircle2,
  X,
  Phone,
  Store,
  Loader2,
  AlertCircle,
  Clock,
  Calendar,
  Trash2,
  Users,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Pencil,
  FileBarChart,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ConversationView from "@/components/messaging/ConversationView";
import UnifiedSendView from "@/components/messaging/UnifiedSendView";
import WeeklyReports from "@/components/messaging/WeeklyReports";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Restaurant {
  id: string;
  name: string;
  city: string | null;
  postal_code: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_whatsapp: string | null;
  is_active: boolean | null;
}

interface SendResult {
  phone: string;
  name: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

interface ScheduledMessage {
  id: string;
  scheduled_at: string;
  message: string;
  recipients: Array<{
    restaurant_id: string;
    phone: string;
    name: string;
    restaurantName: string;
  }>;
  status: string;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  subject: string | null;
}

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

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.2 }
  })
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  }
};

export default function Messaging() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("conversations");
  
  // Scheduling state
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  
  // Media state for scheduled messages
  const [scheduledMedia, setScheduledMedia] = useState<{ file: File; url: string; type: 'image' | 'document' } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const scheduledMediaInputRef = useRef<HTMLInputElement>(null);
  
  // Subject for multi-recipient scheduled messages
  const [scheduledSubject, setScheduledSubject] = useState("");
  
  // Edit scheduled message state
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editMessageContent, setEditMessageContent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Send state
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);


  // Fetch restaurants
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["restaurants-messaging"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, postal_code, manager_first_name, manager_last_name, manager_whatsapp, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Fetch scheduled messages
  const { data: scheduledMessages = [], isLoading: isLoadingScheduled } = useQuery({
    queryKey: ["scheduled-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((msg) => ({
        ...msg,
        recipients: msg.recipients as unknown as ScheduledMessage["recipients"],
      })) as ScheduledMessage[];
    },
  });

  // Fetch message history (for unread count in conversations)
  const { data: messageHistory = [] } = useQuery({
    queryKey: ["message-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_history")
        .select("id, direction, status")
        .order("sent_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as { id: string; direction: string; status: string }[];
    },
  });

  // Poll every 30 seconds instead of Realtime to reduce Cloud costs
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["message-history"] });
    }, 30_000);

    return () => {
      clearInterval(interval);
    };
  }, [queryClient]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    restaurants.forEach((r) => {
      if (r.postal_code) {
        depts.add(r.postal_code.trim().substring(0, 2));
      }
    });
    return Array.from(depts).sort();
  }, [restaurants]);

  // Filter restaurants
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchLower) ||
        r.city?.toLowerCase().includes(searchLower) ||
        `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.toLowerCase().includes(searchLower);

      const matchesDepartment =
        departmentFilter === "all" ||
        (r.postal_code && r.postal_code.trim().startsWith(departmentFilter));

      return matchesSearch && matchesDepartment;
    });
  }, [restaurants, searchQuery, departmentFilter]);

  // Restaurants with WhatsApp
  const restaurantsWithWhatsApp = useMemo(() => {
    return filteredRestaurants.filter((r) => r.manager_whatsapp);
  }, [filteredRestaurants]);

  // Selected restaurants list for sending
  const selectedRestaurantsList = useMemo(() => {
    return restaurantsWithWhatsApp.filter((r) => selectedRestaurants.has(r.id));
  }, [restaurantsWithWhatsApp, selectedRestaurants]);


  // Toggle selection
  const toggleRestaurant = (id: string) => {
    const newSelected = new Set(selectedRestaurants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRestaurants(newSelected);
  };

  // Select all with WhatsApp
  const selectAll = () => {
    const allIds = restaurantsWithWhatsApp.map((r) => r.id);
    setSelectedRestaurants(new Set(allIds));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedRestaurants(new Set());
  };

  // Generate personalized message preview
  const getPersonalizedMessage = (restaurant: Restaurant) => {
    let personalizedMsg = message;
    personalizedMsg = personalizedMsg.replace(/{prenom}/g, restaurant.manager_first_name || "");
    personalizedMsg = personalizedMsg.replace(/{nom}/g, restaurant.manager_last_name || "");
    personalizedMsg = personalizedMsg.replace(/{restaurant}/g, restaurant.name);
    return personalizedMsg;
  };

  // Send messages immediately via Ultramsg API
  const sendMessagesNow = async () => {
    if (selectedRestaurantsList.length === 0 || !message.trim()) return;
    
    setIsSending(true);
    setSendProgress(0);
    setSendResults([]);

    try {
      // Build recipients: primary manager + co-managers
      const baseRecipients = selectedRestaurantsList.map((r) => ({
        restaurant_id: r.id,
        phone: r.manager_whatsapp || "",
        name: `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.trim(),
        restaurantName: r.name,
      }));

      // Fetch co-managers for selected restaurants
      const restaurantIds = selectedRestaurantsList.map((r) => r.id);
      const { data: coManagerLinks } = await supabase
        .from("manager_restaurants")
        .select("restaurant_id, managers!inner(first_name, last_name, phone)")
        .in("restaurant_id", restaurantIds)
        .eq("role", "co-dirigeant");

      const coRecipients = (coManagerLinks || []).map((link: any) => {
        const rest = selectedRestaurantsList.find((r) => r.id === link.restaurant_id);
        return {
          restaurant_id: link.restaurant_id,
          phone: link.managers.phone || "",
          name: `${link.managers.first_name || ""} ${link.managers.last_name || ""}`.trim(),
          restaurantName: rest?.name || "",
        };
      }).filter((r: any) => r.phone);

      const recipients = [...baseRecipients, ...coRecipients];

      toast.loading(`Envoi en cours... 0/${recipients.length}`, { id: "send-progress" });

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { recipients, message },
      });

      if (error) throw new Error(error.message);

      setSendProgress(100);
      setSendResults(data.results || []);
      
      toast.dismiss("send-progress");
      
      if (data.sent > 0 && data.failed === 0) {
        toast.success(`${data.sent} message${data.sent > 1 ? "s" : ""} envoyé${data.sent > 1 ? "s" : ""} avec succès`);
      } else if (data.sent > 0 && data.failed > 0) {
        toast.warning(`${data.sent} envoyé${data.sent > 1 ? "s" : ""}, ${data.failed} échec${data.failed > 1 ? "s" : ""}`);
      } else {
        toast.error(`Échec de l'envoi (${data.failed} erreur${data.failed > 1 ? "s" : ""})`);
      }

      setShowResultsDialog(true);
      queryClient.invalidateQueries({ queryKey: ["message-history"] });

      if (data.failed === 0) {
        setSelectedRestaurants(new Set());
        setMessage("");
      }

    } catch (err) {
      console.error("Error sending messages:", err);
      toast.dismiss("send-progress");
      toast.error("Erreur lors de l'envoi des messages");
    } finally {
      setIsSending(false);
    }
  };

  // Schedule messages for later
  const scheduleMessages = async () => {
    if (selectedRestaurantsList.length === 0 || !message.trim()) return;
    if (!scheduledDate || !scheduledTime) {
      toast.error("Veuillez sélectionner une date et une heure");
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledAt <= new Date()) {
      toast.error("La date programmée doit être dans le futur");
      return;
    }

    setIsSending(true);

    try {
      const baseRecipients = selectedRestaurantsList.map((r) => ({
        restaurant_id: r.id,
        phone: r.manager_whatsapp || "",
        name: `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.trim(),
        restaurantName: r.name,
      }));

      // Fetch co-managers for selected restaurants
      const restaurantIds = selectedRestaurantsList.map((r) => r.id);
      const { data: coManagerLinks } = await supabase
        .from("manager_restaurants")
        .select("restaurant_id, managers!inner(first_name, last_name, phone)")
        .in("restaurant_id", restaurantIds)
        .eq("role", "co-dirigeant");

      const coRecipients = (coManagerLinks || []).map((link: any) => {
        const rest = selectedRestaurantsList.find((r) => r.id === link.restaurant_id);
        return {
          restaurant_id: link.restaurant_id,
          phone: link.managers.phone || "",
          name: `${link.managers.first_name || ""} ${link.managers.last_name || ""}`.trim(),
          restaurantName: rest?.name || "",
        };
      }).filter((r: any) => r.phone);

      const recipients = [...baseRecipients, ...coRecipients];

      // Upload media if present
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      
      if (scheduledMedia) {
        setIsUploadingMedia(true);
        const fileName = `scheduled-${Date.now()}-${scheduledMedia.file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, scheduledMedia.file);

        if (uploadError) {
          throw new Error('Erreur lors de l\'upload du média');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl;
        mediaType = scheduledMedia.type;
        setIsUploadingMedia(false);
      }

      const { error } = await supabase
        .from("scheduled_messages")
        .insert({
          scheduled_at: scheduledAt.toISOString(),
          message,
          recipients,
          status: "pending",
          media_url: mediaUrl,
          media_type: mediaType,
          subject: selectedRestaurantsList.length > 1 && scheduledSubject.trim() ? scheduledSubject.trim() : null,
        });

      if (error) throw error;

      toast.success(`Message programmé pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
      
      setSelectedRestaurants(new Set());
      setMessage("");
      setScheduledDate("");
      setScheduledTime("");
      setSendMode("immediate");
      setScheduledSubject("");
      clearScheduledMedia();
      
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });

    } catch (err) {
      console.error("Error scheduling message:", err);
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      if (errorMessage.includes("upload")) {
        toast.error("Erreur lors de l'upload du média. Vérifiez la taille du fichier.");
      } else {
        toast.error(`Erreur lors de la programmation: ${errorMessage}`);
      }
    } finally {
      setIsSending(false);
      setIsUploadingMedia(false);
    }
  };

  // Handle scheduled media file selection
  const handleScheduledMediaSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 10MB)");
      return;
    }

    const url = URL.createObjectURL(file);
    setScheduledMedia({ file, url, type });
    
    if (scheduledMediaInputRef.current) {
      scheduledMediaInputRef.current.value = '';
    }
  };

  // Clear scheduled media
  const clearScheduledMedia = () => {
    if (scheduledMedia) {
      URL.revokeObjectURL(scheduledMedia.url);
    }
    setScheduledMedia(null);
  };

  // Delete scheduled message
  const deleteScheduledMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from("scheduled_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Message programmé supprimé");
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
    } catch (err) {
      console.error("Error deleting scheduled message:", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Open edit dialog for scheduled message
  const openEditDialog = (msg: ScheduledMessage) => {
    setEditingMessage(msg);
    setEditSubject(msg.subject || "");
    setEditMessageContent(msg.message);
    const date = new Date(msg.scheduled_at);
    setEditDate(date.toISOString().split("T")[0]);
    setEditTime(date.toTimeString().slice(0, 5));
  };

  // Save edited scheduled message
  const saveEditedMessage = async () => {
    if (!editingMessage) return;
    if (!editMessageContent.trim()) {
      toast.error("Le message ne peut pas être vide");
      return;
    }
    if (!editDate || !editTime) {
      toast.error("Veuillez sélectionner une date et une heure");
      return;
    }

    const scheduledAt = new Date(`${editDate}T${editTime}`);
    if (scheduledAt <= new Date()) {
      toast.error("La date programmée doit être dans le futur");
      return;
    }

    setIsSavingEdit(true);

    try {
      const { error } = await supabase
        .from("scheduled_messages")
        .update({
          message: editMessageContent,
          subject: editSubject.trim() || null,
          scheduled_at: scheduledAt.toISOString(),
        })
        .eq("id", editingMessage.id);

      if (error) throw error;

      toast.success("Message programmé modifié");
      setEditingMessage(null);
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
    } catch (err) {
      console.error("Error updating scheduled message:", err);
      toast.error("Erreur lors de la modification");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle send button click
  const handleSend = () => {
    if (sendMode === "immediate") {
      sendMessagesNow();
    } else {
      scheduleMessages();
    }
  };

  // Get status badge for scheduled messages
  const getScheduledStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En cours</Badge>;
      case "sent":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 hover:bg-whatsapp/20"><CheckCircle2 className="h-3 w-3 mr-1" />Envoyé</Badge>;
      case "partial":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20"><AlertCircle className="h-3 w-3 mr-1" />Partiel</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"><AlertCircle className="h-3 w-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Unread incoming messages count
  const unreadCount = useMemo(() => {
    return messageHistory.filter(
      (m) => m.direction === "inbound" && m.status !== "read"
    ).length;
  }, [messageHistory]);

  return (
    <div className="space-y-8">
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
        <motion.div 
          className={cn(
            "flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300",
            selectedRestaurants.size > 0 
              ? "bg-whatsapp/10 text-whatsapp" 
              : "bg-secondary text-muted-foreground"
          )}
          animate={{ scale: selectedRestaurants.size > 0 ? [1, 1.02, 1] : 1 }}
          transition={{ duration: 0.2 }}
        >
          <Users className="h-5 w-5" />
          <span className="text-lg font-medium">
            {selectedRestaurants.size} sélectionné{selectedRestaurants.size > 1 ? "s" : ""}
          </span>
        </motion.div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger 
            value="conversations" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Conversations</span>
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
            value="send" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <Send className="h-4 w-4" />
            <span>Envoyer</span>
            {scheduledMessages.filter(m => m.status === "pending").length > 0 && (
              <span className="ml-1 flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-amber-500 text-white">
                {scheduledMessages.filter(m => m.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="reports" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <FileBarChart className="h-4 w-4" />
            <span>Rapports</span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="conversations" className="mt-6 h-[calc(100vh-200px)] min-h-[500px]" asChild>
            <motion.div
              key="conversations"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="h-full"
            >
              <ConversationView />
            </motion.div>
          </TabsContent>

          <TabsContent value="send" className="mt-6" asChild>
            <motion.div
              key="send"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <UnifiedSendView />
            </motion.div>
          </TabsContent>

          <TabsContent value="reports" className="mt-6" asChild>
            <motion.div
              key="weekly-reports"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <WeeklyReports />
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sendResults.every((r) => r.success) ? (
                <>
                  <motion.div 
                    className="h-8 w-8 rounded-full bg-whatsapp/10 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-whatsapp" />
                  </motion.div>
                  Envoi réussi
                </>
              ) : sendResults.some((r) => r.success) ? (
                <>
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  </div>
                  Envoi partiel
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  Échec de l'envoi
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {sendResults.filter((r) => r.success).length} message(s) envoyé(s) sur {sendResults.length}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto">
            <div className="space-y-2">
              {sendResults.map((result, index) => (
                <motion.div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    result.success ? "bg-whatsapp/5" : "bg-destructive/5"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-whatsapp shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.name || result.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.phone}</p>
                    {result.error && (
                      <p className="text-xs text-destructive mt-1">{result.error}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowResultsDialog(false)}
              className="w-full rounded-xl"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Scheduled Message Dialog */}
      <Dialog open={!!editingMessage} onOpenChange={(open) => !open && setEditingMessage(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Pencil className="h-4 w-4 text-primary" />
              </div>
              Modifier le message programmé
            </DialogTitle>
            <DialogDescription>
              Modifiez le contenu et la date d'envoi du message.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Subject */}
            {editingMessage && editingMessage.recipients.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Objet (optionnel)</label>
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Ex: Rappel inventaire, Promotion weekend..."
                  className="rounded-lg"
                />
              </div>
            )}

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={editMessageContent}
                onChange={(e) => setEditMessageContent(e.target.value)}
                className="min-h-[120px] resize-none rounded-lg"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Heure</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Recipients (read-only) */}
            {editingMessage && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Destinataires ({editingMessage.recipients.length})
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-secondary/30 rounded-lg max-h-24 overflow-y-auto">
                  {editingMessage.recipients.slice(0, 10).map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {r.restaurantName}
                    </Badge>
                  ))}
                  {editingMessage.recipients.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{editingMessage.recipients.length - 10}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setEditingMessage(null)}
              className="rounded-lg"
            >
              Annuler
            </Button>
            <Button 
              onClick={saveEditedMessage}
              disabled={isSavingEdit}
              className="rounded-lg"
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
