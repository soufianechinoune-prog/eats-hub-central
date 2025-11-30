import { useState, useMemo, useEffect } from "react";
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
  CheckCheck,
  Eye,
  Users,
  Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ConversationView from "@/components/messaging/ConversationView";
import { cn } from "@/lib/utils";

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
}

interface MessageHistoryItem {
  id: string;
  restaurant_id: string | null;
  recipient_phone: string;
  recipient_name: string | null;
  restaurant_name: string | null;
  message_content: string;
  ultramsg_message_id: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  direction: string;
}

export default function Messaging() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  
  // Scheduling state
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  
  // Send state
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  // History filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");

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

  // Fetch message history
  const { data: messageHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["message-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_history")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as MessageHistoryItem[];
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

  // Filtered message history
  const filteredHistory = useMemo(() => {
    if (historyStatusFilter === "all") return messageHistory;
    return messageHistory.filter((m) => m.status === historyStatusFilter);
  }, [messageHistory, historyStatusFilter]);

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

      const { error } = await supabase
        .from("scheduled_messages")
        .insert({
          scheduled_at: scheduledAt.toISOString(),
          message,
          recipients,
          status: "pending",
        });

      if (error) throw error;

      toast.success(`Message programmé pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
      
      setSelectedRestaurants(new Set());
      setMessage("");
      setScheduledDate("");
      setScheduledTime("");
      setSendMode("immediate");
      
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });

    } catch (err) {
      console.error("Error scheduling message:", err);
      toast.error("Erreur lors de la programmation du message");
    } finally {
      setIsSending(false);
    }
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

  // Get status badge for message history
  const getHistoryStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "sent":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200"><Send className="h-3 w-3 mr-1" />Envoyé</Badge>;
      case "delivered":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20"><CheckCheck className="h-3 w-3 mr-1" />Délivré</Badge>;
      case "read":
        return <Badge className="bg-primary/10 text-primary border-primary/20"><Eye className="h-3 w-3 mr-1" />Lu</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="h-3 w-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // History stats
  const historyStats = useMemo(() => {
    const sent = messageHistory.filter((m) => m.status === "sent").length;
    const delivered = messageHistory.filter((m) => m.status === "delivered").length;
    const read = messageHistory.filter((m) => m.status === "read").length;
    const failed = messageHistory.filter((m) => m.status === "failed").length;
    return { sent, delivered, read, failed, total: messageHistory.length };
  }, [messageHistory]);

  // Unread incoming messages count
  const unreadCount = useMemo(() => {
    return messageHistory.filter(
      (m) => m.direction === "inbound" && m.status !== "read"
    ).length;
  }, [messageHistory]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Messagerie</h1>
          <p className="text-muted-foreground mt-1">
            Communiquez avec vos restaurants via WhatsApp
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300",
          selectedRestaurants.size > 0 
            ? "bg-whatsapp/10 text-whatsapp" 
            : "bg-secondary text-muted-foreground"
        )}>
          <Users className="h-5 w-5" />
          <span className="text-lg font-medium">
            {selectedRestaurants.size} sélectionné{selectedRestaurants.size > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <Tabs defaultValue="conversations" className="space-y-6">
        <TabsList className="bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger 
            value="conversations" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Conversations</span>
            {unreadCount > 0 && (
              <span className="ml-1 flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-whatsapp text-white">
                {unreadCount}
              </span>
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

        <TabsContent value="conversations" className="mt-6">
          <ConversationView />
        </TabsContent>

        <TabsContent value="compose" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Restaurant Selection */}
            <div className="lg:col-span-3 space-y-4">
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
                        {filteredRestaurants.map((restaurant) => {
                          const hasWhatsApp = !!restaurant.manager_whatsapp;
                          const isSelected = selectedRestaurants.has(restaurant.id);
                          
                          return (
                            <div
                              key={restaurant.id}
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
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
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => setMessage((m) => m + v.key)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <Sparkles className="h-3 w-3" />
                          {v.key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  {message && selectedRestaurantsList.length > 0 && (
                    <div className="p-4 bg-whatsapp-bubble-out rounded-2xl rounded-tr-sm space-y-1">
                      <p className="text-xs font-medium text-whatsapp/70">
                        Aperçu • {selectedRestaurantsList[0].name}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {getPersonalizedMessage(selectedRestaurantsList[0])}
                      </p>
                    </div>
                  )}

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
                    {sendMode === "scheduled" && (
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
                    )}
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

                  {/* Progress indicator */}
                  {isSending && sendMode === "immediate" && (
                    <Progress value={sendProgress} className="h-1.5 rounded-full" />
                  )}
                </CardContent>
              </Card>

              {/* Selected restaurants summary */}
              {selectedRestaurantsList.length > 0 && (
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
                        <button
                          key={r.id}
                          onClick={() => toggleRestaurant(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary hover:bg-destructive/10 hover:text-destructive transition-colors group"
                        >
                          {r.name}
                          <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                        </button>
                      ))}
                      {selectedRestaurantsList.length > 8 && (
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                          +{selectedRestaurantsList.length - 8}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
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
                  {scheduledMessages.map((msg) => (
                    <div key={msg.id} className="p-5 hover:bg-secondary/30 transition-colors">
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
                          <p className="text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {msg.recipients.length} destinataire{msg.recipients.length > 1 ? "s" : ""}
                            </Badge>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteScheduledMessage(msg.id)}
                            className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Historique des messages</h3>
                    <p className="text-sm text-muted-foreground">{historyStats.total} messages envoyés</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Stats badges */}
                  <div className="hidden md:flex items-center gap-2">
                    <Badge className="bg-whatsapp/10 text-whatsapp border-0">
                      <CheckCheck className="h-3 w-3 mr-1" />
                      {historyStats.delivered}
                    </Badge>
                    <Badge className="bg-primary/10 text-primary border-0">
                      <Eye className="h-3 w-3 mr-1" />
                      {historyStats.read}
                    </Badge>
                    {historyStats.failed > 0 && (
                      <Badge className="bg-destructive/10 text-destructive border-0">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {historyStats.failed}
                      </Badge>
                    )}
                  </div>
                  <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9 rounded-lg">
                      <SelectValue placeholder="Filtrer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="sent">Envoyés</SelectItem>
                      <SelectItem value="delivered">Délivrés</SelectItem>
                      <SelectItem value="read">Lus</SelectItem>
                      <SelectItem value="failed">Échecs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Chargement...
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">Aucun message</p>
                    <p className="text-sm mt-1">L'historique de vos messages apparaîtra ici</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredHistory.map((msg) => (
                      <div key={msg.id} className="p-5 hover:bg-secondary/30 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                            msg.direction === "inbound" ? "bg-blue-500/10" : "bg-whatsapp/10"
                          )}>
                            {msg.direction === "inbound" ? (
                              <MessageSquare className="h-5 w-5 text-blue-500" />
                            ) : (
                              <Send className="h-5 w-5 text-whatsapp" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground truncate">
                                {msg.restaurant_name || msg.recipient_name || msg.recipient_phone}
                              </span>
                              {getHistoryStatusBadge(msg.status)}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{msg.message_content}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {msg.recipient_phone}
                              </span>
                              {msg.sent_at && (
                                <span>
                                  {format(new Date(msg.sent_at), "d MMM HH:mm", { locale: fr })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
