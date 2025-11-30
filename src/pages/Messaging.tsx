import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ConversationView from "@/components/messaging/ConversationView";

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
          // Refresh history when any change occurs
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

      // Refresh history
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
        return <Badge variant="outline" className="text-amber-500 border-amber-500"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "processing":
        return <Badge variant="outline" className="text-blue-500 border-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En cours</Badge>;
      case "sent":
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Envoyé</Badge>;
      case "partial":
        return <Badge variant="outline" className="text-amber-500 border-amber-500"><AlertCircle className="h-3 w-3 mr-1" />Partiel</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-destructive border-destructive"><AlertCircle className="h-3 w-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get status badge for message history
  const getHistoryStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-amber-500 border-amber-500"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "sent":
        return <Badge variant="outline" className="text-blue-500 border-blue-500"><Send className="h-3 w-3 mr-1" />Envoyé</Badge>;
      case "delivered":
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCheck className="h-3 w-3 mr-1" />Délivré</Badge>;
      case "read":
        return <Badge variant="outline" className="text-primary border-primary"><Eye className="h-3 w-3 mr-1" />Lu</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-destructive border-destructive"><AlertCircle className="h-3 w-3 mr-1" />Échec</Badge>;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messagerie</h1>
          <p className="text-muted-foreground">
            Envoyez des messages WhatsApp aux gérants de vos restaurants
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <MessageSquare className="h-5 w-5 mr-2" />
          {selectedRestaurants.size} sélectionné{selectedRestaurants.size > 1 ? "s" : ""}
        </Badge>
      </div>

      <Tabs defaultValue="conversations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversations
            {unreadCount > 0 && (
              <Badge className="ml-1 bg-primary text-primary-foreground">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Composer
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Programmés
            {scheduledMessages.filter(m => m.status === "pending").length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {scheduledMessages.filter(m => m.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique
            {historyStats.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {historyStats.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          <ConversationView />
        </TabsContent>

        <TabsContent value="compose">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Restaurant Selection */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Sélection des restaurants
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher par nom, ville, gérant..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Département" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les départements</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            Département {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selection actions */}
                  <div className="flex items-center gap-2 text-sm">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Tout sélectionner ({restaurantsWithWhatsApp.length})
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>
                      Tout désélectionner
                    </Button>
                    <span className="text-muted-foreground ml-auto">
                      {filteredRestaurants.length - restaurantsWithWhatsApp.length} sans WhatsApp
                    </span>
                  </div>

                  {/* Restaurant list */}
                  <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Restaurant</TableHead>
                          <TableHead>Gérant</TableHead>
                          <TableHead>WhatsApp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Chargement...
                            </TableCell>
                          </TableRow>
                        ) : filteredRestaurants.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Aucun restaurant trouvé
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRestaurants.map((restaurant) => {
                            const hasWhatsApp = !!restaurant.manager_whatsapp;
                            return (
                              <TableRow
                                key={restaurant.id}
                                className={!hasWhatsApp ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}
                                onClick={() => hasWhatsApp && toggleRestaurant(restaurant.id)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedRestaurants.has(restaurant.id)}
                                    disabled={!hasWhatsApp}
                                    onCheckedChange={() => toggleRestaurant(restaurant.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{restaurant.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {restaurant.city} {restaurant.postal_code && `(${restaurant.postal_code.trim().substring(0, 2)})`}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {restaurant.manager_first_name || restaurant.manager_last_name ? (
                                    <span>
                                      {restaurant.manager_first_name} {restaurant.manager_last_name}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {hasWhatsApp ? (
                                    <Badge variant="secondary" className="font-mono text-xs">
                                      <Phone className="h-3 w-3 mr-1" />
                                      {restaurant.manager_whatsapp}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">Non renseigné</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right: Message Composition */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Textarea
                      placeholder="Rédigez votre message ici...

Variables disponibles :
{prenom} - Prénom du gérant
{nom} - Nom du gérant
{restaurant} - Nom du restaurant"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[180px] resize-none"
                    />
                  </div>

                  {/* Variables help */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setMessage((m) => m + "{prenom}")}>
                        {"{prenom}"}
                      </Badge>
                      <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setMessage((m) => m + "{nom}")}>
                        {"{nom}"}
                      </Badge>
                      <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setMessage((m) => m + "{restaurant}")}>
                        {"{restaurant}"}
                      </Badge>
                    </div>
                  </div>

                  {/* Preview */}
                  {message && selectedRestaurantsList.length > 0 && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Aperçu pour {selectedRestaurantsList[0].name} :</p>
                      <p className="whitespace-pre-wrap">{getPersonalizedMessage(selectedRestaurantsList[0])}</p>
                    </div>
                  )}

                  {/* Send mode selection */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex gap-2">
                      <Button
                        variant={sendMode === "immediate" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setSendMode("immediate")}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Immédiat
                      </Button>
                      <Button
                        variant={sendMode === "scheduled" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setSendMode("scheduled")}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Programmé
                      </Button>
                    </div>

                    {/* Scheduling inputs */}
                    {sendMode === "scheduled" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                          <Input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Heure</label>
                          <Input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Send button */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSend}
                    disabled={selectedRestaurants.size === 0 || !message.trim() || isSending}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {sendMode === "immediate" ? "Envoi en cours..." : "Programmation..."}
                      </>
                    ) : sendMode === "immediate" ? (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Envoyer à {selectedRestaurants.size} restaurant{selectedRestaurants.size > 1 ? "s" : ""}
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" />
                        Programmer l'envoi
                      </>
                    )}
                  </Button>

                  {/* Progress indicator */}
                  {isSending && sendMode === "immediate" && (
                    <Progress value={sendProgress} className="h-2" />
                  )}
                </CardContent>
              </Card>

              {/* Selected restaurants summary */}
              {selectedRestaurantsList.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Destinataires ({selectedRestaurantsList.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {selectedRestaurantsList.slice(0, 10).map((r) => (
                        <Badge
                          key={r.id}
                          variant="secondary"
                          className="text-xs cursor-pointer"
                          onClick={() => toggleRestaurant(r.id)}
                        >
                          {r.name}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                      {selectedRestaurantsList.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{selectedRestaurantsList.length - 10} autres
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Messages programmés
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingScheduled ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : scheduledMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun message programmé</p>
                  <p className="text-sm">Les messages que vous programmez apparaîtront ici</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date programmée</TableHead>
                        <TableHead>Destinataires</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledMessages.map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell>
                            <div className="font-medium">
                              {format(new Date(msg.scheduled_at), "d MMM yyyy", { locale: fr })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(msg.scheduled_at), "HH:mm", { locale: fr })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {msg.recipients.slice(0, 3).map((r, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {r.restaurantName}
                                </Badge>
                              ))}
                              {msg.recipients.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{msg.recipients.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm truncate max-w-[300px]">{msg.message}</p>
                          </TableCell>
                          <TableCell>
                            {getScheduledStatusBadge(msg.status)}
                            {msg.status !== "pending" && msg.sent_count !== undefined && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {msg.sent_count} / {msg.recipients.length}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {msg.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteScheduledMessage(msg.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historique des messages
                </CardTitle>
                <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous ({historyStats.total})</SelectItem>
                    <SelectItem value="sent">Envoyés ({historyStats.sent})</SelectItem>
                    <SelectItem value="delivered">Délivrés ({historyStats.delivered})</SelectItem>
                    <SelectItem value="read">Lus ({historyStats.read})</SelectItem>
                    <SelectItem value="failed">Échecs ({historyStats.failed})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stats summary */}
              {historyStats.total > 0 && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-500">{historyStats.sent}</div>
                    <div className="text-xs text-muted-foreground">Envoyés</div>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-500">{historyStats.delivered}</div>
                    <div className="text-xs text-muted-foreground">Délivrés</div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">{historyStats.read}</div>
                    <div className="text-xs text-muted-foreground">Lus</div>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-destructive">{historyStats.failed}</div>
                    <div className="text-xs text-muted-foreground">Échecs</div>
                  </div>
                </div>
              )}

              {isLoadingHistory ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun message dans l'historique</p>
                  <p className="text-sm">Les messages envoyés apparaîtront ici</p>
                </div>
              ) : (
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Restaurant</TableHead>
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell>
                            <div className="font-medium text-sm">
                              {msg.sent_at ? format(new Date(msg.sent_at), "d MMM", { locale: fr }) : "-"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {msg.sent_at ? format(new Date(msg.sent_at), "HH:mm", { locale: fr }) : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{msg.restaurant_name || "-"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{msg.recipient_name || "-"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{msg.recipient_phone}</div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm truncate max-w-[250px]" title={msg.message_content}>
                              {msg.message_content}
                            </p>
                          </TableCell>
                          <TableCell>
                            {getHistoryStatusBadge(msg.status)}
                            {msg.status === "delivered" && msg.delivered_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(msg.delivered_at), "HH:mm", { locale: fr })}
                              </div>
                            )}
                            {msg.status === "read" && msg.read_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(msg.read_at), "HH:mm", { locale: fr })}
                              </div>
                            )}
                            {msg.status === "failed" && msg.error_message && (
                              <div className="text-xs text-destructive mt-1 truncate max-w-[100px]" title={msg.error_message}>
                                {msg.error_message}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Résultats de l'envoi
            </DialogTitle>
            <DialogDescription>
              {sendResults.filter(r => r.success).length} envoyé{sendResults.filter(r => r.success).length > 1 ? "s" : ""} sur {sendResults.length}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {sendResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    result.success ? "bg-green-500/10" : "bg-destructive/10"
                  }`}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{result.name || result.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.success ? `ID: ${result.messageId}` : result.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setShowResultsDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
