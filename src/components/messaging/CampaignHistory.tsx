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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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

export default function CampaignHistory() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
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
      .channel("campaign-changes")
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

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    if (statusFilter === "all") return campaigns;
    return campaigns.filter((c) => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalSent = campaigns.reduce((acc, c) => acc + c.sent_count, 0);
    const totalDelivered = campaigns.reduce((acc, c) => acc + c.delivered_count, 0);
    const totalRead = campaigns.reduce((acc, c) => acc + c.read_count, 0);
    const totalFailed = campaigns.reduce((acc, c) => acc + c.failed_count, 0);
    return { totalSent, totalDelivered, totalRead, totalFailed, count: campaigns.length };
  }, [campaigns]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sending":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En cours</Badge>;
      case "sent":
        return <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20"><Send className="h-3 w-3 mr-1" />Envoyé</Badge>;
      case "partial":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><AlertCircle className="h-3 w-3 mr-1" />Partiel</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="h-3 w-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Historique des campagnes</h3>
                <p className="text-sm text-muted-foreground">{stats.count} campagne{stats.count > 1 ? "s" : ""} • {stats.totalSent} messages</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Stats badges */}
              <div className="hidden md:flex items-center gap-2">
                <Badge className="bg-whatsapp/10 text-whatsapp border-0">
                  <CheckCheck className="h-3 w-3 mr-1" />
                  {stats.totalDelivered}
                </Badge>
                <Badge className="bg-primary/10 text-primary border-0">
                  <Eye className="h-3 w-3 mr-1" />
                  {stats.totalRead}
                </Badge>
                {stats.totalFailed > 0 && (
                  <Badge className="bg-destructive/10 text-destructive border-0">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {stats.totalFailed}
                  </Badge>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 rounded-lg">
                  <SelectValue placeholder="Filtrer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="sent">Envoyés</SelectItem>
                  <SelectItem value="partial">Partiels</SelectItem>
                  <SelectItem value="failed">Échecs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Chargement...
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Aucune campagne</p>
                <p className="text-sm mt-1">Les envois groupés apparaîtront ici</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredCampaigns.map((campaign, index) => (
                  <motion.div
                    key={campaign.id}
                    className="p-5 hover:bg-secondary/30 transition-colors cursor-pointer group"
                    custom={index}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={() => openCampaignDetail(campaign)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-xl bg-whatsapp/10 flex items-center justify-center shrink-0">
                        <Send className="h-5 w-5 text-whatsapp" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(campaign.status)}
                          <span className="text-sm font-medium text-foreground">
                            {format(new Date(campaign.sent_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                          </span>
                        </div>
                        
                        {/* Message template preview with variables highlighted */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {campaign.message_template.split(/(\{[^}]+\})/).map((part, i) => 
                            part.match(/^\{[^}]+\}$/) ? (
                              <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
                                {part}
                              </span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </p>
                        
                        {/* KPIs row */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {campaign.recipient_count} destinataire{campaign.recipient_count > 1 ? "s" : ""}
                          </Badge>
                          
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-whatsapp font-medium">
                              ✓ {campaign.sent_count}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-whatsapp font-medium">
                              ✓✓ {campaign.delivered_count}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-primary font-medium">
                              👁 {campaign.read_count}
                            </span>
                            {campaign.failed_count > 0 && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-destructive font-medium">
                                  ⚠ {campaign.failed_count}
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
                              <span>{getDeliveryProgress(campaign)}%</span>
                            </div>
                            <Progress value={getDeliveryProgress(campaign)} className="h-1.5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Lu</span>
                              <span>{getReadProgress(campaign)}%</span>
                            </div>
                            <Progress value={getReadProgress(campaign)} className="h-1.5 [&>div]:bg-primary" />
                          </div>
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
                <Send className="h-4 w-4 text-whatsapp" />
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
                  ) : (
                    <div className="divide-y divide-border/50">
                      {campaignMessages.map((msg) => (
                        <div key={msg.id} className="p-3 hover:bg-secondary/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <span className="text-xs font-medium">
                                  {(msg.recipient_name || msg.restaurant_name || "?").charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {msg.restaurant_name || msg.recipient_name || msg.recipient_phone}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {msg.recipient_phone}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getMessageStatusBadge(msg.status)}
                              {msg.read_at && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(msg.read_at), "HH:mm", { locale: fr })}
                                </span>
                              )}
                            </div>
                          </div>
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
