import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  Users,
  Loader2,
  Clock,
  Calendar,
  Trash2,
  Pencil,
  FileBarChart,
  Megaphone,
  MessageCircle,
  CheckCircle2,
  SendHorizontal,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

interface Campaign {
  id: string;
  message_template: string;
  recipient_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  status: string;
  sent_at: string;
}

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.2 }
  })
};

interface OutboundMessagesProps {
  scheduledMessages: ScheduledMessage[];
  isLoadingScheduled: boolean;
  onDeleteScheduled: (id: string) => void;
  onEditScheduled: (msg: ScheduledMessage) => void;
}

export default function OutboundMessages({ 
  scheduledMessages, 
  isLoadingScheduled,
  onDeleteScheduled,
  onEditScheduled,
}: OutboundMessagesProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"pending" | "sent">("pending");
  const [selectedBatch, setSelectedBatch] = useState<BatchGroup | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Count pending messages
  const pendingCount = scheduledMessages.filter(m => m.status === "pending").length;

  // Fetch sent message history grouped by batch
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
      return data as Campaign[];
    },
    enabled: viewMode === "sent",
  });

  // Poll every 30 seconds instead of Realtime to reduce Cloud costs
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["outbound-sent-history"] });
      queryClient.invalidateQueries({ queryKey: ["message-campaigns"] });
    }, 30_000);

    return () => {
      clearInterval(interval);
    };
  }, [queryClient]);

  // Group sent messages by batch_id or campaign_id for compact display
  const groupedHistory = useMemo(() => {
    const groups: BatchGroup[] = [];
    const processedBatches = new Set<string>();
    const processedCampaigns = new Set<string>();

    // First add campaigns as groups
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

    // Then process messages
    sentHistory.forEach(msg => {
      // Skip if part of a campaign (already grouped)
      if (msg.campaign_id && processedCampaigns.has(msg.campaign_id)) return;

      // Determine type
      const msgType = msg.message_type === "report" ? "report" : 
                      msg.message_type === "campaign" ? "campaign" : "individual";

      // Group by batch_id if exists
      if (msg.batch_id) {
        if (processedBatches.has(msg.batch_id)) {
          // Add to existing group
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
          // Create new batch group
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
        // Individual message (no batch)
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

    // Sort by date descending
    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    return groups;
  }, [sentHistory, campaigns]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "campaign":
        return (
          <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs">
            <Megaphone className="h-3 w-3 mr-1" />
            Campagne
          </Badge>
        );
      case "report":
        return (
          <Badge className="bg-violet-500/10 text-violet-600 border-violet-200 text-xs">
            <FileBarChart className="h-3 w-3 mr-1" />
            Rapport
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs">
            <MessageCircle className="h-3 w-3 mr-1" />
            Message
          </Badge>
        );
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

  const getDeliveryProgress = (group: BatchGroup) => {
    if (group.recipientCount === 0) return 0;
    return Math.round((group.deliveredCount / group.recipientCount) * 100);
  };

  const isLoading = viewMode === "sent" ? loadingSent : isLoadingScheduled;

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)] backdrop-blur-xl bg-background/80">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-whatsapp/20 flex items-center justify-center">
                <SendHorizontal className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Envois</h3>
                <p className="text-sm text-muted-foreground">
                  {viewMode === "pending" 
                    ? `${pendingCount} message${pendingCount > 1 ? "s" : ""} en attente`
                    : `${groupedHistory.length} envoi${groupedHistory.length > 1 ? "s" : ""}`
                  }
                </p>
              </div>
            </div>

            {/* View mode toggle */}
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(val) => val && setViewMode(val as "pending" | "sent")}
              className="bg-secondary/50 rounded-lg p-1"
            >
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

        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Chargement...
                </div>
              ) : viewMode === "pending" ? (
                /* Pending scheduled messages */
                <motion.div
                  key="pending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {scheduledMessages.length === 0 ? (
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
                                          </div>
                                        </div>
                                      )}
                                    </HoverCardContent>
                                  </HoverCard>
                                )}
                              </div>
                            </div>
                            {msg.status === "pending" && (
                              <div className="flex items-center gap-1">
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onEditScheduled(msg)}
                                    className="h-9 w-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onDeleteScheduled(msg.id)}
                                    className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </motion.div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                /* Sent messages grouped by batch */
                <motion.div
                  key="sent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {groupedHistory.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Send className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">Aucun envoi</p>
                      <p className="text-sm mt-1">Les messages envoyés apparaîtront ici</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {groupedHistory.map((group, index) => (
                        <motion.div
                          key={group.id}
                          className="p-5 hover:bg-secondary/30 transition-colors cursor-pointer"
                          custom={index}
                          variants={listItemVariants}
                          initial="hidden"
                          animate="visible"
                          onClick={() => {
                            setSelectedBatch(group);
                            setShowDetailDialog(true);
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                              group.type === "campaign" && "bg-whatsapp/10",
                              group.type === "report" && "bg-violet-500/10",
                              group.type === "individual" && "bg-blue-500/10"
                            )}>
                              {group.type === "campaign" && <Megaphone className="h-5 w-5 text-whatsapp" />}
                              {group.type === "report" && <FileBarChart className="h-5 w-5 text-violet-500" />}
                              {group.type === "individual" && <MessageCircle className="h-5 w-5 text-blue-500" />}
                            </div>
                            
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getTypeBadge(group.type)}
                                {getStatusBadge(group.status, group.failedCount, group.sentCount)}
                                <span className="text-sm font-medium text-foreground">
                                  {format(group.date, "d MMMM yyyy à HH:mm", { locale: fr })}
                                </span>
                              </div>
                              
                              {/* Content preview */}
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {group.content.substring(0, 120)}...
                              </p>
                              
                              {/* Stats row */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  {group.recipientCount} destinataire{group.recipientCount > 1 ? "s" : ""}
                                </Badge>
                                
                                {group.recipientCount > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    {group.recipients.slice(0, 3).join(", ")}
                                    {group.recipients.length > 3 && `, +${group.recipients.length - 3}`}
                                  </span>
                                )}
                              </div>

                              {/* Progress bar for multi-recipient */}
                              {group.recipientCount > 1 && (
                                <div className="flex items-center gap-2 pt-1">
                                  <Progress value={getDeliveryProgress(group)} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground">
                                    {getDeliveryProgress(group)}% délivré
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedBatch && getTypeBadge(selectedBatch.type)}
              Détails de l'envoi
            </DialogTitle>
          </DialogHeader>
          
          {selectedBatch && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedBatch.recipientCount} destinataire{selectedBatch.recipientCount > 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(selectedBatch.date, "d MMMM yyyy à HH:mm", { locale: fr })}</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-whatsapp/5 rounded-lg text-center">
                  <p className="text-lg font-semibold text-whatsapp">{selectedBatch.sentCount}</p>
                  <p className="text-xs text-muted-foreground">Envoyés</p>
                </div>
                <div className="p-3 bg-whatsapp/5 rounded-lg text-center">
                  <p className="text-lg font-semibold text-whatsapp">{selectedBatch.deliveredCount}</p>
                  <p className="text-xs text-muted-foreground">Délivrés</p>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg text-center">
                  <p className="text-lg font-semibold text-primary">{selectedBatch.readCount}</p>
                  <p className="text-xs text-muted-foreground">Lus</p>
                </div>
                <div className="p-3 bg-destructive/5 rounded-lg text-center">
                  <p className="text-lg font-semibold text-destructive">{selectedBatch.failedCount}</p>
                  <p className="text-xs text-muted-foreground">Échecs</p>
                </div>
              </div>

              {/* Recipients list */}
              {selectedBatch.recipients.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Destinataires</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {selectedBatch.recipients.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Message preview */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Message</p>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedBatch.content}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowDetailDialog(false)} className="rounded-lg">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}