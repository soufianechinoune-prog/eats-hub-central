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
} from "@/components/ui/dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  History,
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  Users,
  Loader2,
  ChevronRight,
  Phone,
  Sparkles,
  FileBarChart,
  Megaphone,
  MessageCircle,
  Bot,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Unified message type for the new structure
interface UnifiedMessage {
  id: string;
  type: "campaign" | "report" | "individual" | "chatbot";
  recipient_phone: string;
  recipient_name: string | null;
  restaurant_name: string | null;
  message_content: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  campaign_id: string | null;
  // Campaign-specific fields
  campaign?: {
    id: string;
    message_template: string;
    recipient_count: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    failed_count: number;
    status: string;
    sent_at: string;
  };
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
  created_at: string;
}

interface MessageDetail {
  id: string;
  recipient_phone: string;
  recipient_name: string | null;
  restaurant_name: string | null;
  message_content: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.2 }
  })
};

// Type filter configuration
const TYPE_FILTERS = [
  { value: "all", label: "Tous", icon: History },
  { value: "campaign", label: "Campagnes", icon: Megaphone, color: "text-whatsapp" },
  { value: "report", label: "Rapports", icon: FileBarChart, color: "text-violet-500" },
  { value: "individual", label: "Messages", icon: MessageCircle, color: "text-blue-500" },
];

export default function CampaignHistory() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch all messages (unified)
  const { data: allMessages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["unified-message-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_history")
        .select("*")
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data;
    },
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
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
  });

  // Fetch messages for selected campaign
  const { data: campaignMessages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["campaign-messages", selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return [];
      const { data, error } = await supabase
        .from("message_history")
        .select("id, recipient_phone, recipient_name, restaurant_name, message_content, status, sent_at, delivered_at, read_at")
        .eq("campaign_id", selectedCampaign.id)
        .order("sent_at", { ascending: true });

      if (error) throw error;
      return data as MessageDetail[];
    },
    enabled: !!selectedCampaign?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("unified-history-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_history",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unified-message-history"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_campaigns",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["message-campaigns"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Determine message type based on content and flags
  const getMessageType = (msg: any): "campaign" | "report" | "individual" | "chatbot" => {
    // First check if we have explicit message_type from DB
    if (msg.message_type && msg.message_type !== "individual") {
      return msg.message_type;
    }
    // Fallback to content-based detection
    if (msg.message_content?.includes("📊") || msg.message_content?.toLowerCase().includes("rapport")) {
      return "report";
    }
    if (msg.campaign_id) {
      return "campaign";
    }
    if (msg.direction === "inbound") {
      return "chatbot";
    }
    return "individual";
  };

  // Grouped view: combine campaigns and individual messages
  const unifiedHistory = useMemo(() => {
    const items: Array<{
      id: string;
      type: "campaign" | "report" | "individual" | "chatbot";
      date: Date;
      content: string;
      status: string;
      recipientCount?: number;
      campaign?: Campaign;
      message?: typeof allMessages[0];
    }> = [];

    // Add campaigns
    campaigns.forEach(campaign => {
      items.push({
        id: `campaign-${campaign.id}`,
        type: "campaign",
        date: new Date(campaign.sent_at),
        content: campaign.message_template,
        status: campaign.status,
        recipientCount: campaign.recipient_count,
        campaign,
      });
    });

    // Add non-campaign messages (reports, individual)
    allMessages
      .filter(msg => !msg.campaign_id)
      .forEach(msg => {
        const msgType = getMessageType(msg);
        items.push({
          id: msg.id,
          type: msgType,
          date: new Date(msg.sent_at || msg.created_at),
          content: msg.message_content,
          status: msg.status,
          message: msg,
        });
      });

    // Sort by date
    items.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Apply filter
    if (typeFilter !== "all") {
      return items.filter(item => item.type === typeFilter);
    }

    return items;
  }, [campaigns, allMessages, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const totalReports = allMessages.filter(m => getMessageType(m) === "report" && !m.campaign_id).length;
    const totalIndividual = allMessages.filter(m => getMessageType(m) === "individual" && !m.campaign_id).length;
    const totalMessages = allMessages.length;
    return { totalCampaigns, totalReports, totalIndividual, totalMessages };
  }, [campaigns, allMessages]);

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
      case "chatbot":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs">
            <Bot className="h-3 w-3 mr-1" />
            Chatbot
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sending":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs"><Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />En cours</Badge>;
      case "sent":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs"><Send className="h-2.5 w-2.5 mr-1" />Envoyé</Badge>;
      case "delivered":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs"><CheckCheck className="h-2.5 w-2.5 mr-1" />Délivré</Badge>;
      case "read":
        return <Badge className="bg-primary/10 text-primary border-primary/20 text-xs"><Eye className="h-2.5 w-2.5 mr-1" />Lu</Badge>;
      case "partial":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs"><AlertCircle className="h-2.5 w-2.5 mr-1" />Partiel</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs"><AlertCircle className="h-2.5 w-2.5 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getMessageStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs"><Send className="h-2.5 w-2.5 mr-1" />Envoyé</Badge>;
      case "delivered":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs"><CheckCheck className="h-2.5 w-2.5 mr-1" />Délivré</Badge>;
      case "read":
        return <Badge className="bg-primary/10 text-primary border-primary/20 text-xs"><Eye className="h-2.5 w-2.5 mr-1" />Lu</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs"><AlertCircle className="h-2.5 w-2.5 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const openCampaignDetail = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowDetailDialog(true);
  };

  const getDeliveryProgress = (campaign: Campaign) => {
    if (campaign.recipient_count === 0) return 0;
    return Math.round((campaign.delivered_count / campaign.recipient_count) * 100);
  };

  const getReadProgress = (campaign: Campaign) => {
    if (campaign.recipient_count === 0) return 0;
    return Math.round((campaign.read_count / campaign.recipient_count) * 100);
  };

  const isLoading = loadingMessages || loadingCampaigns;

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)] backdrop-blur-xl bg-background/80">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Historique unifié</h3>
                <p className="text-sm text-muted-foreground">
                  {stats.totalCampaigns} campagne{stats.totalCampaigns > 1 ? "s" : ""} • 
                  {stats.totalReports} rapport{stats.totalReports > 1 ? "s" : ""} • 
                  {stats.totalMessages} messages
                </p>
              </div>
            </div>

            {/* Type filter toggle */}
            <ToggleGroup 
              type="single" 
              value={typeFilter} 
              onValueChange={(val) => val && setTypeFilter(val)}
              className="bg-secondary/50 rounded-lg p-1"
            >
              {TYPE_FILTERS.map(filter => (
                <ToggleGroupItem 
                  key={filter.value} 
                  value={filter.value}
                  className={cn(
                    "text-xs px-3 py-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm",
                    filter.color
                  )}
                >
                  <filter.icon className="h-3.5 w-3.5 mr-1.5" />
                  {filter.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Chargement...
              </div>
            ) : unifiedHistory.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Aucun historique</p>
                <p className="text-sm mt-1">Les messages envoyés apparaîtront ici</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {unifiedHistory.map((item, index) => (
                  <motion.div
                    key={item.id}
                    className={cn(
                      "p-5 hover:bg-secondary/30 transition-colors group",
                      item.type === "campaign" && "cursor-pointer"
                    )}
                    custom={index}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={() => item.campaign && openCampaignDetail(item.campaign)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon based on type */}
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                        item.type === "campaign" && "bg-whatsapp/10",
                        item.type === "report" && "bg-violet-500/10",
                        item.type === "individual" && "bg-blue-500/10",
                        item.type === "chatbot" && "bg-amber-500/10"
                      )}>
                        {item.type === "campaign" && <Megaphone className="h-5 w-5 text-whatsapp" />}
                        {item.type === "report" && <FileBarChart className="h-5 w-5 text-violet-500" />}
                        {item.type === "individual" && <MessageCircle className="h-5 w-5 text-blue-500" />}
                        {item.type === "chatbot" && <Bot className="h-5 w-5 text-amber-500" />}
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getTypeBadge(item.type)}
                          {getStatusBadge(item.status)}
                          <span className="text-sm font-medium text-foreground">
                            {format(item.date, "d MMMM yyyy à HH:mm", { locale: fr })}
                          </span>
                        </div>
                        
                        {/* Content preview */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.content.split(/(\{[^}]+\})/).map((part, i) => 
                            part.match(/^\{[^}]+\}$/) ? (
                              <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
                                {part}
                              </span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </p>
                        
                        {/* Campaign-specific KPIs */}
                        {item.campaign && (
                          <>
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {item.campaign.recipient_count} destinataire{item.campaign.recipient_count > 1 ? "s" : ""}
                              </Badge>
                              
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-whatsapp font-medium">
                                  ✓ {item.campaign.sent_count}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-whatsapp font-medium">
                                  ✓✓ {item.campaign.delivered_count}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-medium">
                                  👁 {item.campaign.read_count}
                                </span>
                                {item.campaign.failed_count > 0 && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-destructive font-medium">
                                      ⚠ {item.campaign.failed_count}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Progress bars */}
                            <div className="flex items-center gap-4 pt-1">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Délivré</span>
                                  <span>{getDeliveryProgress(item.campaign)}%</span>
                                </div>
                                <Progress value={getDeliveryProgress(item.campaign)} className="h-1.5" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Lu</span>
                                  <span>{getReadProgress(item.campaign)}%</span>
                                </div>
                                <Progress value={getReadProgress(item.campaign)} className="h-1.5 [&>div]:bg-primary" />
                              </div>
                            </div>
                          </>
                        )}

                        {/* Individual message info */}
                        {item.message && !item.campaign && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {item.message.restaurant_name && (
                              <span className="font-medium">{item.message.restaurant_name}</span>
                            )}
                            {item.message.recipient_name && (
                              <>
                                <span>•</span>
                                <span>{item.message.recipient_name}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {item.campaign && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Campaign Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-whatsapp/10 flex items-center justify-center">
                <Megaphone className="h-4 w-4 text-whatsapp" />
              </div>
              Détail de la campagne
            </DialogTitle>
          </DialogHeader>
          
          {selectedCampaign && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              {/* Campaign info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedCampaign.status)}
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(selectedCampaign.sent_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                  </span>
                </div>
                
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm">
                    {selectedCampaign.message_template.split(/(\{[^}]+\})/).map((part, i) => 
                      part.match(/^\{[^}]+\}$/) ? (
                        <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
                          {part}
                        </span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </p>
                </div>
                
                {/* KPIs summary */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-3 bg-whatsapp/5 rounded-lg">
                    <div className="text-xl font-bold text-whatsapp">{selectedCampaign.sent_count}</div>
                    <div className="text-xs text-muted-foreground">Envoyés</div>
                  </div>
                  <div className="text-center p-3 bg-whatsapp/5 rounded-lg">
                    <div className="text-xl font-bold text-whatsapp">{selectedCampaign.delivered_count}</div>
                    <div className="text-xs text-muted-foreground">Délivrés</div>
                  </div>
                  <div className="text-center p-3 bg-primary/5 rounded-lg">
                    <div className="text-xl font-bold text-primary">{selectedCampaign.read_count}</div>
                    <div className="text-xs text-muted-foreground">Lus</div>
                  </div>
                  <div className="text-center p-3 bg-destructive/5 rounded-lg">
                    <div className="text-xl font-bold text-destructive">{selectedCampaign.failed_count}</div>
                    <div className="text-xs text-muted-foreground">Échecs</div>
                  </div>
                </div>
              </div>
              
              {/* Recipients list */}
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-medium mb-2 text-foreground">
                  Destinataires ({selectedCampaign.recipient_count})
                </div>
                <ScrollArea className="h-[300px] border rounded-lg">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Chargement...
                    </div>
                  ) : campaignMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Aucun détail disponible
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {campaignMessages.map((msg) => (
                        <div key={msg.id} className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">
                                {msg.restaurant_name || msg.recipient_name || msg.recipient_phone}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {msg.recipient_phone}
                              </div>
                            </div>
                          </div>
                          {getMessageStatusBadge(msg.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}