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
  History,
  Users,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ConversationView from "@/components/messaging/ConversationView";
import CampaignHistory from "@/components/messaging/CampaignHistory";
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
      const recipients = selectedRestaurantsList.map((r) => ({
        restaurant_id: r.id,
        phone: r.manager_whatsapp || "",
        name: `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.trim(),
        restaurantName: r.name,
      }));

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
      const recipients = selectedRestaurantsList.map((r) => ({
        restaurant_id: r.id,
        phone: r.manager_whatsapp || "",
        name: `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.trim(),
        restaurantName: r.name,
      }));

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
      toast.error("Erreur lors de la programmation du message");
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
            value="compose" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <Send className="h-4 w-4" />
            <span>Composer</span>
          </TabsTrigger>
          <TabsTrigger 
            value="scheduled" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <Clock className="h-4 w-4" />
            <span>Programmés</span>
            {scheduledMessages.filter(m => m.status === "pending").length > 0 && (
              <span className="ml-1 flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-amber-500 text-white">
                {scheduledMessages.filter(m => m.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <History className="h-4 w-4" />
            <span>Historique</span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="conversations" className="mt-6" asChild>
            <motion.div
              key="conversations"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <ConversationView />
            </motion.div>
          </TabsContent>

          <TabsContent value="compose" className="mt-6" asChild>
            <motion.div
              key="compose"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Restaurant Selection */}
                <div className="lg:col-span-3 space-y-4">
                  <motion.div variants={cardVariants}>
                    <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
                      <div className="p-6 border-b border-border/50 bg-gradient-to-b from-card to-card/95">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-xl bg-whatsapp/10 flex items-center justify-center">
                            <Store className="h-5 w-5 text-whatsapp" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">Sélection des restaurants</h3>
                            <p className="text-sm text-muted-foreground">Choisissez les destinataires</p>
                          </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-3">
                          <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Rechercher par nom, ville, gérant..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-colors"
                              />
                            </div>
                          </div>
                          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger className="w-[160px] h-11 rounded-xl border-border/50">
                              <SelectValue placeholder="Département" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tous</SelectItem>
                              {departments.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  Dpt {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <CardContent className="p-0">
                        {/* Selection actions */}
                        <div className="flex items-center gap-3 p-4 bg-secondary/30 border-b border-border/50">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={selectAll}
                            className="rounded-lg text-xs h-8 hover:bg-whatsapp/10 hover:text-whatsapp hover:border-whatsapp/30 transition-colors"
                          >
                            Tout sélectionner ({restaurantsWithWhatsApp.length})
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={deselectAll}
                            className="rounded-lg text-xs h-8"
                          >
                            Désélectionner
                          </Button>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {filteredRestaurants.length - restaurantsWithWhatsApp.length} sans WhatsApp
                          </span>
                        </div>

                        {/* Restaurant list */}
                        <ScrollArea className="h-[420px]">
                          {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin mr-2" />
                              Chargement...
                            </div>
                          ) : filteredRestaurants.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
                              <p>Aucun restaurant trouvé</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-border/50">
                              {filteredRestaurants.map((restaurant, index) => {
                                const hasWhatsApp = !!restaurant.manager_whatsapp;
                                const isSelected = selectedRestaurants.has(restaurant.id);
                                
                                return (
                                  <motion.div
                                    key={restaurant.id}
                                    custom={index}
                                    variants={listItemVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className={cn(
                                      "flex items-center gap-4 p-4 transition-all duration-200",
                                      !hasWhatsApp 
                                        ? "opacity-40" 
                                        : "cursor-pointer hover:bg-secondary/50",
                                      isSelected && "bg-whatsapp/5"
                                    )}
                                    onClick={() => hasWhatsApp && toggleRestaurant(restaurant.id)}
                                    whileTap={hasWhatsApp ? { scale: 0.995 } : undefined}
                                  >
                                    <motion.div
                                      animate={isSelected ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        disabled={!hasWhatsApp}
                                        onCheckedChange={() => toggleRestaurant(restaurant.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn(
                                          "h-5 w-5 rounded-md transition-all",
                                          isSelected && "border-whatsapp bg-whatsapp data-[state=checked]:bg-whatsapp"
                                        )}
                                      />
                                    </motion.div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground truncate">
                                          {restaurant.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                                        <span>{restaurant.city || "—"}</span>
                                        {restaurant.postal_code && (
                                          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                                            {restaurant.postal_code.trim().substring(0, 2)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      {restaurant.manager_first_name || restaurant.manager_last_name ? (
                                        <div className="text-sm font-medium text-foreground">
                                          {restaurant.manager_first_name} {restaurant.manager_last_name}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-muted-foreground">—</div>
                                      )}
                                    </div>

                                    <div className="w-36 text-right">
                                      {hasWhatsApp ? (
                                        <div className="inline-flex items-center gap-1.5 text-sm font-mono bg-whatsapp/10 text-whatsapp px-2.5 py-1 rounded-lg">
                                          <Phone className="h-3.5 w-3.5" />
                                          <span className="truncate">{restaurant.manager_whatsapp}</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">Non renseigné</span>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Right: Message Composition */}
                <div className="lg:col-span-2 space-y-4">
                  <motion.div variants={cardVariants}>
                    <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
                      <div className="p-6 border-b border-border/50 bg-gradient-to-b from-card to-card/95">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">Message</h3>
                            <p className="text-sm text-muted-foreground">Rédigez votre message</p>
                          </div>
                        </div>
                      </div>

                      <CardContent className="p-6 space-y-5">
                        <div>
                          <Textarea
                            placeholder="Rédigez votre message ici..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="min-h-[160px] resize-none rounded-xl border-border/50 bg-secondary/30 focus:bg-card transition-colors text-sm"
                          />
                        </div>

                        {/* Variables help */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Variables disponibles</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { key: "{prenom}", label: "Prénom" },
                              { key: "{nom}", label: "Nom" },
                              { key: "{restaurant}", label: "Restaurant" },
                            ].map((v) => (
                              <motion.button
                                key={v.key}
                                type="button"
                                onClick={() => setMessage((m) => m + v.key)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <Sparkles className="h-3 w-3" />
                                {v.key}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Preview */}
                        <AnimatePresence>
                          {message && selectedRestaurantsList.length > 0 && (
                            <motion.div 
                              className="p-4 bg-whatsapp-bubble-out rounded-2xl rounded-tr-sm space-y-1"
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                            >
                              <p className="text-xs font-medium text-whatsapp/70">
                                Aperçu • {selectedRestaurantsList[0].name}
                              </p>
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                {getPersonalizedMessage(selectedRestaurantsList[0])}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Send mode selection */}
                        <div className="space-y-4 pt-4 border-t border-border/50">
                          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/50 rounded-xl">
                            <Button
                              variant={sendMode === "immediate" ? "default" : "ghost"}
                              size="sm"
                              className={cn(
                                "rounded-lg h-10 transition-all",
                                sendMode === "immediate" 
                                  ? "bg-whatsapp hover:bg-whatsapp/90 text-white shadow-sm" 
                                  : "hover:bg-secondary"
                              )}
                              onClick={() => setSendMode("immediate")}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Immédiat
                            </Button>
                            <Button
                              variant={sendMode === "scheduled" ? "default" : "ghost"}
                              size="sm"
                              className={cn(
                                "rounded-lg h-10 transition-all",
                                sendMode === "scheduled" 
                                  ? "bg-primary hover:bg-primary/90 text-white shadow-sm" 
                                  : "hover:bg-secondary"
                              )}
                              onClick={() => setSendMode("scheduled")}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Programmé
                            </Button>
                          </div>

                          {/* Scheduling inputs */}
                          <AnimatePresence>
                            {sendMode === "scheduled" && (
                              <motion.div 
                                className="space-y-3"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Date</label>
                                    <Input
                                      type="date"
                                      value={scheduledDate}
                                      onChange={(e) => setScheduledDate(e.target.value)}
                                      min={new Date().toISOString().split("T")[0]}
                                      className="h-10 rounded-lg"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Heure</label>
                                    <Input
                                      type="time"
                                      value={scheduledTime}
                                      onChange={(e) => setScheduledTime(e.target.value)}
                                      className="h-10 rounded-lg"
                                    />
                                  </div>
                                </div>
                                
                                {/* Subject field for multi-recipient scheduled messages */}
                                {selectedRestaurants.size > 1 && (
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">
                                      Objet du message (optionnel)
                                    </label>
                                    <Input
                                      value={scheduledSubject}
                                      onChange={(e) => setScheduledSubject(e.target.value)}
                                      placeholder="Ex: Rappel inventaire, Promotion weekend..."
                                      className="h-10 rounded-lg"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      L'objet vous aidera à identifier ce message dans l'historique
                                    </p>
                                  </div>
                                )}
                                
                                {/* Media attachment for scheduled */}
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-muted-foreground">Média (optionnel)</label>
                                  
                                  {scheduledMedia ? (
                                    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                                      {scheduledMedia.type === 'image' ? (
                                        <img
                                          src={scheduledMedia.url}
                                          alt="Preview"
                                          className="h-12 w-12 object-cover rounded-lg"
                                        />
                                      ) : (
                                        <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                          <FileText className="h-6 w-6 text-blue-500" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{scheduledMedia.file.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {(scheduledMedia.file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={clearScheduledMedia}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="outline" size="sm" className="rounded-lg">
                                            <Paperclip className="h-4 w-4 mr-2" />
                                            Ajouter un média
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                          <DropdownMenuItem onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = (e) => handleScheduledMediaSelect(e as any, 'image');
                                            input.click();
                                          }}>
                                            <ImageIcon className="h-4 w-4 mr-2 text-green-500" />
                                            Image
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = '.pdf,.doc,.docx';
                                            input.onchange = (e) => handleScheduledMediaSelect(e as any, 'document');
                                            input.click();
                                          }}>
                                            <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                            Document
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Send button */}
                        <motion.div whileTap={{ scale: 0.98 }}>
                          <Button
                            className={cn(
                              "w-full h-12 rounded-xl text-base font-medium transition-all",
                              sendMode === "immediate" 
                                ? "bg-whatsapp hover:bg-whatsapp/90" 
                                : "bg-primary hover:bg-primary/90"
                            )}
                            onClick={handleSend}
                            disabled={selectedRestaurants.size === 0 || !message.trim() || isSending}
                          >
                            {isSending ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <Loader2 className="h-5 w-5 mr-2" />
                                </motion.div>
                                {sendMode === "immediate" ? "Envoi en cours..." : "Programmation..."}
                              </>
                            ) : sendMode === "immediate" ? (
                              <>
                                <Send className="h-5 w-5 mr-2" />
                                Envoyer à {selectedRestaurants.size} restaurant{selectedRestaurants.size > 1 ? "s" : ""}
                              </>
                            ) : (
                              <>
                                <Calendar className="h-5 w-5 mr-2" />
                                Programmer l'envoi
                              </>
                            )}
                          </Button>
                        </motion.div>

                        {/* Progress indicator */}
                        <AnimatePresence>
                          {isSending && sendMode === "immediate" && (
                            <motion.div
                              initial={{ opacity: 0, scaleX: 0 }}
                              animate={{ opacity: 1, scaleX: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Progress value={sendProgress} className="h-1.5 rounded-full" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Selected restaurants summary */}
                  <AnimatePresence>
                    {selectedRestaurantsList.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-foreground">
                                Destinataires
                              </span>
                              <Badge variant="secondary" className="rounded-full">
                                {selectedRestaurantsList.length}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedRestaurantsList.slice(0, 8).map((r) => (
                                <motion.button
                                  key={r.id}
                                  onClick={() => toggleRestaurant(r.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary hover:bg-destructive/10 hover:text-destructive transition-colors group"
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  layout
                                >
                                  {r.name}
                                  <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                                </motion.button>
                              ))}
                              {selectedRestaurantsList.length > 8 && (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                                  +{selectedRestaurantsList.length - 8}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-6" asChild>
            <motion.div
              key="scheduled"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
                <div className="p-6 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Messages programmés</h3>
                      <p className="text-sm text-muted-foreground">
                        {scheduledMessages.filter(m => m.status === "pending").length} message(s) en attente
                      </p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-0">
                  {isLoadingScheduled ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Chargement...
                    </div>
                  ) : scheduledMessages.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">Aucun message programmé</p>
                      <p className="text-sm mt-1">Les messages programmés apparaîtront ici</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {scheduledMessages.map((msg, index) => (
                        <motion.div 
                          key={msg.id} 
                          className="p-5 hover:bg-secondary/30 transition-colors"
                          custom={index}
                          variants={listItemVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                              <Calendar className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3">
                                {getScheduledStatusBadge(msg.status)}
                                <span className="text-sm font-medium text-foreground">
                                  {format(new Date(msg.scheduled_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                                </span>
                              </div>
                              {msg.subject && (
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                  <span className="text-muted-foreground">📌</span>
                                  {msg.subject}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  {msg.recipients.length} destinataire{msg.recipients.length > 1 ? "s" : ""}
                                </Badge>
                                {msg.media_url && (
                                  <HoverCard>
                                    <HoverCardTrigger asChild>
                                      <Badge variant="outline" className="text-xs cursor-pointer">
                                        {msg.media_type === 'image' ? (
                                          <><ImageIcon className="h-3 w-3 mr-1" />Image</>
                                        ) : (
                                          <><FileText className="h-3 w-3 mr-1" />Document</>
                                        )}
                                      </Badge>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-64 p-2" side="top">
                                      {msg.media_type === 'image' ? (
                                        <img 
                                          src={msg.media_url} 
                                          alt="Média joint" 
                                          className="w-full h-auto rounded-lg object-cover max-h-48"
                                        />
                                      ) : (
                                        <div className="flex items-center gap-3 p-2">
                                          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-muted-foreground" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">Document joint</p>
                                            <p className="text-xs text-muted-foreground truncate">{msg.media_url.split('/').pop()}</p>
                                          </div>
                                        </div>
                                      )}
                                    </HoverCardContent>
                                  </HoverCard>
                                )}
                                {msg.sent_count > 0 && (
                                  <span className="text-xs text-whatsapp">
                                    {msg.sent_count} envoyé{msg.sent_count > 1 ? "s" : ""}
                                  </span>
                                )}
                                {msg.failed_count > 0 && (
                                  <span className="text-xs text-destructive">
                                    {msg.failed_count} échec{msg.failed_count > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            {msg.status === "pending" && (
                              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteScheduledMessage(msg.id)}
                                  className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="history" className="mt-6" asChild>
            <motion.div
              key="history"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <CampaignHistory />
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
    </div>
  );
}
