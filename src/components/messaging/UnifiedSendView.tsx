import { useState, useMemo, useRef } from "react";
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
  CheckCheck,
  Eye,
  Megaphone,
  MessageCircle,
  FileBarChart,
  SendHorizontal,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import WhatsAppStatusCard from "./WhatsAppStatusCard";

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

interface BatchGroup {
  id: string;
  batch_id: string | null;
  type: "campaign" | "report" | "individual";
  date: Date;
  content: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  recipients: string[];
}

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.02, duration: 0.2 }
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

export default function UnifiedSendView() {
  const queryClient = useQueryClient();
  
  // View mode: compose or history
  const [viewMode, setViewMode] = useState<"compose" | "pending" | "sent">("compose");
  
  // Selection state
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  
  // Message composition
  const [message, setMessage] = useState("");
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledSubject, setScheduledSubject] = useState("");
  
  // Media state
  const [scheduledMedia, setScheduledMedia] = useState<{ file: File; url: string; type: 'image' | 'document' } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const scheduledMediaInputRef = useRef<HTMLInputElement>(null);
  
  // Send state
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  
  // Edit scheduled message state
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editMessageContent, setEditMessageContent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch restaurants
  const { data: restaurants = [], isLoading: isLoadingRestaurants } = useQuery({
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

  // Fetch sent history
  const { data: sentHistory = [], isLoading: loadingSent } = useQuery({
    queryKey: ["outbound-sent-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_history")
        .select("*")
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
    enabled: viewMode === "sent",
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ["message-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_campaigns")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: viewMode === "sent",
  });

  // Pending count
  const pendingCount = scheduledMessages.filter(m => m.status === "pending").length;

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

  // Selected restaurants list
  const selectedRestaurantsList = useMemo(() => {
    return restaurantsWithWhatsApp.filter((r) => selectedRestaurants.has(r.id));
  }, [restaurantsWithWhatsApp, selectedRestaurants]);

  // Group sent messages
  const groupedHistory = useMemo(() => {
    const groups: BatchGroup[] = [];
    const processedBatches = new Set<string>();
    const processedCampaigns = new Set<string>();

    campaigns.forEach(campaign => {
      processedCampaigns.add(campaign.id);
      groups.push({
        id: `campaign-${campaign.id}`,
        batch_id: null,
        type: "campaign",
        date: new Date(campaign.sent_at),
        content: campaign.message_template,
        status: campaign.status,
        recipientCount: campaign.recipient_count,
        sentCount: campaign.sent_count,
        deliveredCount: campaign.delivered_count,
        readCount: campaign.read_count,
        failedCount: campaign.failed_count,
        recipients: [],
      });
    });

    sentHistory.forEach(msg => {
      if (msg.campaign_id && processedCampaigns.has(msg.campaign_id)) return;

      const msgType = msg.message_type === "report" ? "report" : 
                      msg.message_type === "campaign" ? "campaign" : "individual";

      if (msg.batch_id) {
        if (processedBatches.has(msg.batch_id)) {
          const group = groups.find(g => g.batch_id === msg.batch_id);
          if (group) {
            group.recipientCount++;
            if (msg.status === "sent") group.sentCount++;
            if (msg.status === "delivered") group.deliveredCount++;
            if (msg.status === "read") group.readCount++;
            if (msg.status === "failed") group.failedCount++;
            if (msg.restaurant_name) group.recipients.push(msg.restaurant_name);
          }
        } else {
          processedBatches.add(msg.batch_id);
          groups.push({
            id: `batch-${msg.batch_id}`,
            batch_id: msg.batch_id,
            type: msgType,
            date: new Date(msg.sent_at || msg.created_at),
            content: msg.message_content,
            status: msg.status,
            recipientCount: 1,
            sentCount: msg.status === "sent" ? 1 : 0,
            deliveredCount: msg.status === "delivered" ? 1 : 0,
            readCount: msg.status === "read" ? 1 : 0,
            failedCount: msg.status === "failed" ? 1 : 0,
            recipients: msg.restaurant_name ? [msg.restaurant_name] : [],
          });
        }
      } else {
        groups.push({
          id: msg.id,
          batch_id: null,
          type: msgType,
          date: new Date(msg.sent_at || msg.created_at),
          content: msg.message_content,
          status: msg.status,
          recipientCount: 1,
          sentCount: msg.status === "sent" ? 1 : 0,
          deliveredCount: msg.status === "delivered" ? 1 : 0,
          readCount: msg.status === "read" ? 1 : 0,
          failedCount: msg.status === "failed" ? 1 : 0,
          recipients: msg.restaurant_name ? [msg.restaurant_name] : [],
        });
      }
    });

    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    return groups;
  }, [sentHistory, campaigns]);

  // Toggle restaurant selection
  const toggleRestaurant = (id: string) => {
    const newSelected = new Set(selectedRestaurants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRestaurants(newSelected);
  };

  const selectAll = () => {
    setSelectedRestaurants(new Set(restaurantsWithWhatsApp.map((r) => r.id)));
  };

  const deselectAll = () => {
    setSelectedRestaurants(new Set());
  };

  // Get personalized message preview
  const getPersonalizedMessage = (restaurant: Restaurant) => {
    let personalizedMsg = message;
    personalizedMsg = personalizedMsg.replace(/{prenom}/g, restaurant.manager_first_name || "");
    personalizedMsg = personalizedMsg.replace(/{nom}/g, restaurant.manager_last_name || "");
    personalizedMsg = personalizedMsg.replace(/{restaurant}/g, restaurant.name);
    return personalizedMsg;
  };

  // Send messages immediately
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
      queryClient.invalidateQueries({ queryKey: ["outbound-sent-history"] });

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

  // Schedule messages
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

      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      
      if (scheduledMedia) {
        setIsUploadingMedia(true);
        const fileName = `scheduled-${Date.now()}-${scheduledMedia.file.name}`;
        const { error: uploadError } = await supabase.storage
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
      setViewMode("pending");
      
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });

    } catch (err) {
      console.error("Error scheduling message:", err);
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur lors de la programmation: ${errorMessage}`);
    } finally {
      setIsSending(false);
      setIsUploadingMedia(false);
    }
  };

  // Handle media selection
  const handleScheduledMediaSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 10MB)");
      return;
    }

    const url = URL.createObjectURL(file);
    setScheduledMedia({ file, url, type });
  };

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

  // Edit scheduled message
  const openEditDialog = (msg: ScheduledMessage) => {
    setEditingMessage(msg);
    setEditSubject(msg.subject || "");
    setEditMessageContent(msg.message);
    const date = new Date(msg.scheduled_at);
    setEditDate(date.toISOString().split("T")[0]);
    setEditTime(date.toTimeString().slice(0, 5));
  };

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

  const handleSend = () => {
    if (sendMode === "immediate") {
      sendMessagesNow();
    } else {
      scheduleMessages();
    }
  };

  // Badge helpers
  const getScheduledStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En cours</Badge>;
      case "sent":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20"><CheckCircle2 className="h-3 w-3 mr-1" />Envoyé</Badge>;
      case "partial":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><AlertCircle className="h-3 w-3 mr-1" />Partiel</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="h-3 w-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "campaign":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs"><Megaphone className="h-3 w-3 mr-1" />Campagne</Badge>;
      case "report":
        return <Badge className="bg-violet-500/10 text-violet-600 border-violet-200 text-xs"><FileBarChart className="h-3 w-3 mr-1" />Rapport</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs"><MessageCircle className="h-3 w-3 mr-1" />Message</Badge>;
    }
  };

  const getStatusBadge = (status: string, failedCount: number = 0, sentCount: number = 0) => {
    if (failedCount > 0 && sentCount > 0) {
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs"><AlertCircle className="h-2.5 w-2.5 mr-1" />Partiel</Badge>;
    }
    if (failedCount > 0 && sentCount === 0) {
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs"><AlertCircle className="h-2.5 w-2.5 mr-1" />Échec</Badge>;
    }
    
    switch (status) {
      case "sent":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs"><Send className="h-2.5 w-2.5 mr-1" />Envoyé</Badge>;
      case "delivered":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs"><CheckCheck className="h-2.5 w-2.5 mr-1" />Délivré</Badge>;
      case "read":
        return <Badge className="bg-primary/10 text-primary border-primary/20 text-xs"><Eye className="h-2.5 w-2.5 mr-1" />Lu</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header with view mode toggle */}
        <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)] backdrop-blur-xl bg-background/80">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-whatsapp/20 to-primary/20 flex items-center justify-center">
                  <SendHorizontal className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Envoyer</h3>
                  <p className="text-sm text-muted-foreground">
                    Composez et gérez vos envois
                  </p>
                </div>
              </div>

              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(val) => val && setViewMode(val as typeof viewMode)}
                className="bg-secondary/50 rounded-lg p-1"
              >
                <ToggleGroupItem 
                  value="compose"
                  className="text-sm px-4 py-2 data-[state=on]:bg-background data-[state=on]:shadow-sm gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Composer
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="pending"
                  className="text-sm px-4 py-2 data-[state=on]:bg-background data-[state=on]:shadow-sm gap-2"
                >
                  <Clock className="h-4 w-4" />
                  En attente
                  {pendingCount > 0 && (
                    <span className="ml-1 flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-amber-500 text-white">
                      {pendingCount}
                    </span>
                  )}
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="sent"
                  className="text-sm px-4 py-2 data-[state=on]:bg-background data-[state=on]:shadow-sm gap-2"
                >
                  <CheckCheck className="h-4 w-4" />
                  Envoyés
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </Card>

        {/* WhatsApp Status Card */}
        <WhatsAppStatusCard />

        <AnimatePresence mode="wait">
          {viewMode === "compose" && (
            <motion.div
              key="compose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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
                          {selectedRestaurants.size > 0 && (
                            <Badge className="ml-auto bg-whatsapp/10 text-whatsapp border-whatsapp/20">
                              {selectedRestaurants.size} sélectionné{selectedRestaurants.size > 1 ? "s" : ""}
                            </Badge>
                          )}
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
                        <ScrollArea className="h-[350px]">
                          {isLoadingRestaurants ? (
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
                                    
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium text-foreground truncate block">
                                        {restaurant.name}
                                      </span>
                                      <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                                        <span>{restaurant.city || "—"}</span>
                                        {restaurant.postal_code && (
                                          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                                            {restaurant.postal_code.trim().substring(0, 2)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-right hidden sm:block">
                                      {restaurant.manager_first_name && (
                                        <div className="text-sm font-medium text-foreground">
                                          {restaurant.manager_first_name}
                                        </div>
                                      )}
                                    </div>

                                    <div className="w-32 text-right hidden md:block">
                                      {hasWhatsApp ? (
                                        <div className="inline-flex items-center gap-1.5 text-xs font-mono bg-whatsapp/10 text-whatsapp px-2 py-1 rounded-lg">
                                          <Phone className="h-3 w-3" />
                                          <span className="truncate">{restaurant.manager_whatsapp}</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
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
                      {/* Message textarea */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                          Variables: {"{prenom}"}, {"{nom}"}, {"{restaurant}"}
                        </div>
                        <Textarea
                          placeholder="Bonjour {prenom}, ..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="min-h-[140px] resize-none rounded-xl border-border/50 bg-background/50 focus:bg-background transition-colors"
                        />
                        {message && selectedRestaurantsList.length > 0 && (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <button className="text-xs text-primary hover:underline">
                                Aperçu du message
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80" side="top">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Pour {selectedRestaurantsList[0].name} :
                                </p>
                                <p className="text-sm whitespace-pre-wrap">
                                  {getPersonalizedMessage(selectedRestaurantsList[0])}
                                </p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </div>

                      {/* Send mode toggle */}
                      <div className="space-y-3">
                        <ToggleGroup
                          type="single"
                          value={sendMode}
                          onValueChange={(val) => val && setSendMode(val as typeof sendMode)}
                          className="justify-start gap-2"
                        >
                          <ToggleGroupItem
                            value="immediate"
                            className="rounded-lg px-4 py-2 data-[state=on]:bg-whatsapp/10 data-[state=on]:text-whatsapp data-[state=on]:border-whatsapp/30"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Immédiat
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="scheduled"
                            className="rounded-lg px-4 py-2 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/30"
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Programmé
                          </ToggleGroupItem>
                        </ToggleGroup>

                        <AnimatePresence>
                          {sendMode === "scheduled" && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-3"
                            >
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                                  <Input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    className="rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-muted-foreground">Heure</label>
                                  <Input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="rounded-lg"
                                  />
                                </div>
                              </div>

                              {selectedRestaurantsList.length > 1 && (
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-muted-foreground">Objet (optionnel)</label>
                                  <Input
                                    value={scheduledSubject}
                                    onChange={(e) => setScheduledSubject(e.target.value)}
                                    placeholder="Ex: Rappel inventaire"
                                    className="rounded-lg"
                                  />
                                </div>
                              )}

                              {/* Media upload */}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Média (optionnel)</label>
                                
                                {scheduledMedia ? (
                                  <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                                    {scheduledMedia.type === 'image' ? (
                                      <img src={scheduledMedia.url} alt="Preview" className="h-12 w-12 object-cover rounded-lg" />
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
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Send button */}
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
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
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

                      {/* Progress */}
                      <AnimatePresence>
                        {isSending && sendMode === "immediate" && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Progress value={sendProgress} className="h-1.5 rounded-full" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>

                  {/* Selected summary */}
                  <AnimatePresence>
                    {selectedRestaurantsList.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium">Destinataires</span>
                              <Badge variant="secondary" className="rounded-full">{selectedRestaurantsList.length}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedRestaurantsList.slice(0, 6).map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => toggleRestaurant(r.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary hover:bg-destructive/10 hover:text-destructive transition-colors group"
                                >
                                  {r.name}
                                  <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                                </button>
                              ))}
                              {selectedRestaurantsList.length > 6 && (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                                  +{selectedRestaurantsList.length - 6}
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
          )}

          {viewMode === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {isLoadingScheduled ? (
                      <div className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Chargement...
                      </div>
                    ) : scheduledMessages.filter(m => m.status === "pending").length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="font-medium">Aucun message en attente</p>
                        <p className="text-sm mt-1">Les messages programmés apparaîtront ici</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => setViewMode("compose")}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Composer un message
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {scheduledMessages.filter(m => m.status === "pending").map((msg, index) => (
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
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    <Users className="h-3 w-3 mr-1" />
                                    {msg.recipients.length} destinataire{msg.recipients.length > 1 ? "s" : ""}
                                  </Badge>
                                  {msg.media_url && (
                                    <Badge variant="outline" className="text-xs">
                                      {msg.media_type === 'image' ? (
                                        <><ImageIcon className="h-3 w-3 mr-1" />Image</>
                                      ) : (
                                        <><FileText className="h-3 w-3 mr-1" />Document</>
                                      )}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                  onClick={() => openEditDialog(msg)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteScheduledMessage(msg.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {viewMode === "sent" && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {loadingSent ? (
                      <div className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Chargement...
                      </div>
                    ) : groupedHistory.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <Send className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="font-medium">Aucun message envoyé</p>
                        <p className="text-sm mt-1">L'historique de vos envois apparaîtra ici</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {groupedHistory.slice(0, 50).map((group, index) => (
                          <motion.div 
                            key={group.id} 
                            className="p-4 hover:bg-secondary/30 transition-colors"
                            custom={index}
                            variants={listItemVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <div className="flex items-start gap-4">
                              <div className="h-10 w-10 rounded-xl bg-whatsapp/10 flex items-center justify-center shrink-0">
                                <CheckCheck className="h-5 w-5 text-whatsapp" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getTypeBadge(group.type)}
                                  {getStatusBadge(group.status, group.failedCount, group.sentCount)}
                                  <span className="text-xs text-muted-foreground">
                                    {format(group.date, "d MMM yyyy à HH:mm", { locale: fr })}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground line-clamp-2">{group.content}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {group.recipientCount}
                                  </span>
                                  {group.deliveredCount > 0 && (
                                    <span className="flex items-center gap-1 text-whatsapp">
                                      <CheckCheck className="h-3 w-3" />
                                      {group.deliveredCount}
                                    </span>
                                  )}
                                  {group.readCount > 0 && (
                                    <span className="flex items-center gap-1 text-primary">
                                      <Eye className="h-3 w-3" />
                                      {group.readCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sendResults.every((r) => r.success) ? (
                <>
                  <div className="h-8 w-8 rounded-full bg-whatsapp/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-whatsapp" />
                  </div>
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
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    result.success ? "bg-whatsapp/5" : "bg-destructive/5"
                  )}
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
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowResultsDialog(false)} className="w-full rounded-xl">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
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

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={editMessageContent}
                onChange={(e) => setEditMessageContent(e.target.value)}
                className="min-h-[120px] resize-none rounded-lg"
              />
            </div>

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
            <Button variant="outline" onClick={() => setEditingMessage(null)} className="rounded-xl">
              Annuler
            </Button>
            <Button onClick={saveEditedMessage} disabled={isSavingEdit} className="rounded-xl">
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
    </>
  );
}
