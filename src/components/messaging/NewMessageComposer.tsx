import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Search,
  Send,
  Phone,
  Store,
  Loader2,
  Clock,
  Calendar,
  Users,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  FileBarChart,
  MessageSquare,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import WeeklyReportGenerator from "./WeeklyReportGenerator";

interface Restaurant {
  id: string;
  name: string;
  city: string | null;
  postal_code: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_whatsapp: string | null;
  is_active: boolean | null;
  is_pinned: boolean | null;
}

interface NewMessageComposerProps {
  onMessageSent?: () => void;
}

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.02, duration: 0.2 }
  })
};

export default function NewMessageComposer({ onMessageSent }: NewMessageComposerProps) {
  const queryClient = useQueryClient();
  
  // Mode: message, scheduled, or report
  const [mode, setMode] = useState<"message" | "scheduled" | "report">("message");
  
  // Selection state
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  
  // Message state
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  
  // Scheduling state
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  
  // Media state
  const [media, setMedia] = useState<{ file: File; url: string; type: 'image' | 'document' } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  
  // Send state
  const [isSending, setIsSending] = useState(false);

  // Fetch restaurants
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["restaurants-messaging"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, postal_code, manager_first_name, manager_last_name, manager_whatsapp, is_active, is_pinned")
        .eq("is_active", true)
        .order("is_pinned", { ascending: false })
        .order("name");

      if (error) throw error;
      return data as Restaurant[];
    },
  });

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

  // Select pinned only
  const selectPinned = () => {
    const pinnedIds = restaurants.filter(r => r.is_pinned && r.manager_whatsapp).map(r => r.id);
    setSelectedRestaurants(new Set(pinnedIds));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedRestaurants(new Set());
  };

  // Generate personalized message
  const getPersonalizedMessage = (restaurant: Restaurant) => {
    let personalizedMsg = message;
    personalizedMsg = personalizedMsg.replace(/{prenom}/g, restaurant.manager_first_name || "");
    personalizedMsg = personalizedMsg.replace(/{nom}/g, restaurant.manager_last_name || "");
    personalizedMsg = personalizedMsg.replace(/{restaurant}/g, restaurant.name);
    return personalizedMsg;
  };

  // Handle media file selection
  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 10MB)");
      return;
    }

    const url = URL.createObjectURL(file);
    setMedia({ file, url, type });
    
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  };

  // Clear media
  const clearMedia = () => {
    if (media) {
      URL.revokeObjectURL(media.url);
    }
    setMedia(null);
  };

  // Send messages immediately
  const sendMessagesNow = async () => {
    if (selectedRestaurantsList.length === 0 || !message.trim()) return;
    
    setIsSending(true);

    try {
      const recipients = selectedRestaurantsList.map((r) => ({
        restaurant_id: r.id,
        phone: r.manager_whatsapp || "",
        name: `${r.manager_first_name || ""} ${r.manager_last_name || ""}`.trim(),
        restaurantName: r.name,
      }));

      toast.loading(`Envoi en cours...`, { id: "send-progress" });

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { recipients, message },
      });

      if (error) throw new Error(error.message);

      toast.dismiss("send-progress");
      
      if (data.sent > 0 && data.failed === 0) {
        toast.success(`${data.sent} message${data.sent > 1 ? "s" : ""} envoyé${data.sent > 1 ? "s" : ""} avec succès`);
        resetForm();
        onMessageSent?.();
      } else if (data.sent > 0 && data.failed > 0) {
        toast.warning(`${data.sent} envoyé${data.sent > 1 ? "s" : ""}, ${data.failed} échec${data.failed > 1 ? "s" : ""}`);
      } else {
        toast.error(`Échec de l'envoi (${data.failed} erreur${data.failed > 1 ? "s" : ""})`);
      }

      queryClient.invalidateQueries({ queryKey: ["message-history"] });

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

      // Upload media if present
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      
      if (media) {
        setIsUploadingMedia(true);
        const fileName = `scheduled-${Date.now()}-${media.file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, media.file);

        if (uploadError) {
          throw new Error('Erreur lors de l\'upload du média');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl;
        mediaType = media.type;
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
          subject: selectedRestaurantsList.length > 1 && subject.trim() ? subject.trim() : null,
        });

      if (error) throw error;

      toast.success(`Message programmé pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
      resetForm();
      
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });

    } catch (err) {
      console.error("Error scheduling message:", err);
      toast.error("Erreur lors de la programmation");
    } finally {
      setIsSending(false);
      setIsUploadingMedia(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedRestaurants(new Set());
    setMessage("");
    setSubject("");
    setScheduledDate("");
    setScheduledTime("");
    clearMedia();
  };

  // Handle send
  const handleSend = () => {
    if (mode === "scheduled") {
      scheduleMessages();
    } else {
      sendMessagesNow();
    }
  };

  // For reports mode, render the report generator
  if (mode === "report") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setMode("message")}
            className="gap-2"
          >
            ← Retour
          </Button>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
            <FileBarChart className="h-3 w-3 mr-1" />
            Mode Rapports
          </Badge>
        </div>
        <WeeklyReportGenerator onSent={onMessageSent} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex items-center gap-3">
        <Button
          variant={mode === "message" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("message")}
          className={cn(
            "gap-2 rounded-lg",
            mode === "message" && "bg-whatsapp hover:bg-whatsapp/90"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Envoyer maintenant
        </Button>
        <Button
          variant={mode === "scheduled" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("scheduled")}
          className={cn(
            "gap-2 rounded-lg",
            mode === "scheduled" && "bg-amber-500 hover:bg-amber-500/90"
          )}
        >
          <Timer className="h-4 w-4" />
          Programmer
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMode("report")}
          className="gap-2 rounded-lg"
        >
          <FileBarChart className="h-4 w-4" />
          Rapports Hebdo
        </Button>
        
        <div className="ml-auto">
          <motion.div 
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
              selectedRestaurants.size > 0 
                ? "bg-whatsapp/10 text-whatsapp" 
                : "bg-secondary text-muted-foreground"
            )}
            animate={{ scale: selectedRestaurants.size > 0 ? [1, 1.02, 1] : 1 }}
          >
            <Users className="h-4 w-4" />
            <span className="font-medium">
              {selectedRestaurants.size} sélectionné{selectedRestaurants.size > 1 ? "s" : ""}
            </span>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Restaurant Selection */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="p-5 border-b border-border/50 bg-gradient-to-b from-card to-card/95">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-whatsapp/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-whatsapp" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Destinataires</h3>
                  <p className="text-sm text-muted-foreground">Choisissez les restaurants</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 rounded-lg"
                    />
                  </div>
                </div>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[140px] h-10 rounded-lg">
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
              <div className="flex items-center gap-2 p-3 bg-secondary/30 border-b border-border/50">
                <Button variant="outline" size="sm" onClick={selectPinned} className="rounded-lg text-xs h-8">
                  ⭐ Épinglés
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll} className="rounded-lg text-xs h-8">
                  Tout ({restaurantsWithWhatsApp.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="rounded-lg text-xs h-8">
                  Aucun
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredRestaurants.length - restaurantsWithWhatsApp.length} sans WhatsApp
                </span>
              </div>

              {/* Restaurant list */}
              <ScrollArea className="h-[380px]">
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
                            "flex items-center gap-3 p-3 transition-all",
                            !hasWhatsApp ? "opacity-40" : "cursor-pointer hover:bg-secondary/50",
                            isSelected && "bg-whatsapp/5"
                          )}
                          onClick={() => hasWhatsApp && toggleRestaurant(restaurant.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={!hasWhatsApp}
                            onCheckedChange={() => hasWhatsApp && toggleRestaurant(restaurant.id)}
                            className="data-[state=checked]:bg-whatsapp data-[state=checked]:border-whatsapp"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{restaurant.name}</p>
                              {restaurant.is_pinned && <span className="text-xs">⭐</span>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {restaurant.city} • {restaurant.manager_first_name} {restaurant.manager_last_name}
                            </p>
                          </div>
                          
                          {hasWhatsApp && (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Phone className="h-4 w-4 text-whatsapp shrink-0" />
                              </HoverCardTrigger>
                              <HoverCardContent side="left" className="w-auto">
                                <p className="text-sm font-mono">{restaurant.manager_whatsapp}</p>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: Message Composer */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg h-full">
            <div className="p-5 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center",
                  mode === "scheduled" ? "bg-amber-500/10" : "bg-whatsapp/10"
                )}>
                  {mode === "scheduled" ? (
                    <Clock className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Send className="h-5 w-5 text-whatsapp" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {mode === "scheduled" ? "Programmer l'envoi" : "Composer le message"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedRestaurantsList.length > 0 
                      ? `${selectedRestaurantsList.length} destinataire${selectedRestaurantsList.length > 1 ? "s" : ""}`
                      : "Aucun destinataire sélectionné"}
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="p-5 space-y-4">
              {/* Subject for multi-recipient */}
              {selectedRestaurantsList.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sujet (optionnel)</label>
                  <Input
                    placeholder="Ex: Information importante"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-10 rounded-lg"
                  />
                </div>
              )}

              {/* Scheduling inputs */}
              {mode === "scheduled" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date
                    </label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Heure
                    </label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Message textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Message</label>
                  <div className="flex items-center gap-1">
                    {["{prenom}", "{restaurant}"].map((tag) => (
                      <Button
                        key={tag}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs rounded"
                        onClick={() => setMessage(message + tag)}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  placeholder="Tapez votre message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[140px] resize-none rounded-lg"
                />
              </div>

              {/* Media preview */}
              {media && (
                <div className="relative">
                  <div className="p-3 bg-secondary/50 rounded-lg flex items-center gap-3">
                    {media.type === 'image' ? (
                      <img src={media.url} alt="Preview" className="h-12 w-12 object-cover rounded" />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    )}
                    <span className="text-sm truncate flex-1">{media.file.name}</span>
                    <Button variant="ghost" size="icon" onClick={clearMedia} className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Media buttons */}
              <div className="flex items-center gap-2">
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleMediaSelect(e, 'image')}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (mediaInputRef.current) {
                      mediaInputRef.current.accept = "image/*";
                      mediaInputRef.current.click();
                    }
                  }}
                  disabled={!!media}
                  className="gap-2 rounded-lg"
                >
                  <ImageIcon className="h-4 w-4" />
                  Image
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (mediaInputRef.current) {
                      mediaInputRef.current.accept = ".pdf,.doc,.docx,.xls,.xlsx";
                      mediaInputRef.current.click();
                    }
                  }}
                  disabled={!!media}
                  className="gap-2 rounded-lg"
                >
                  <Paperclip className="h-4 w-4" />
                  Document
                </Button>
              </div>

              {/* Preview for first selected */}
              {selectedRestaurantsList.length > 0 && message && (
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Aperçu ({selectedRestaurantsList[0].name})</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {getPersonalizedMessage(selectedRestaurantsList[0])}
                  </p>
                </div>
              )}

              {/* Send button */}
              <Button
                onClick={handleSend}
                disabled={isSending || selectedRestaurantsList.length === 0 || !message.trim() || (mode === "scheduled" && (!scheduledDate || !scheduledTime))}
                className={cn(
                  "w-full h-11 rounded-lg gap-2",
                  mode === "scheduled" 
                    ? "bg-amber-500 hover:bg-amber-500/90" 
                    : "bg-whatsapp hover:bg-whatsapp/90"
                )}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isUploadingMedia ? "Upload en cours..." : "Envoi..."}
                  </>
                ) : mode === "scheduled" ? (
                  <>
                    <Clock className="h-4 w-4" />
                    Programmer l'envoi
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Envoyer {selectedRestaurantsList.length > 1 ? `(${selectedRestaurantsList.length})` : ""}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
