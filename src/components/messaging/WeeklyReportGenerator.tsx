import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Send,
  Loader2,
  ChevronDown,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  Zap,
  FileText,
  Check,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Restaurant {
  id: string;
  name: string;
  city: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_whatsapp: string | null;
  is_pinned: boolean | null;
}

interface DataBlocks {
  orders_revenue: boolean;
  rating: boolean;
  operations: boolean;
  errors: boolean;
}

interface Objectives {
  prep_time: number;
  courier_wait: number;
  rating: number;
  error_rate: number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  data_blocks: DataBlocks;
  intro_template: string;
  outro_template: string;
  objectives: Objectives;
}

interface WeeklyKPIs {
  restaurant_id: string;
  restaurant_name: string;
  manager_name: string;
  manager_whatsapp: string | null;
  order_count: number;
  revenue: number;
  average_basket: number;
  order_variation: number | null;
  revenue_variation: number | null;
  average_rating: number | null;
  review_count: number;
  new_customer_percent: number | null;
  avg_prep_time: number | null;
  avg_courier_wait: number | null;
  error_rate: number | null;
  error_count: number;
}

interface WeeklyReportGeneratorProps {
  onSent?: () => void;
}

// Icon mapping
const templateStyles: Record<string, { icon: React.ReactNode; gradient: string; color: string }> = {
  BarChart3: { 
    icon: <BarChart3 className="h-5 w-5" />, 
    gradient: "from-blue-500/20 to-cyan-500/20",
    color: "text-blue-500"
  },
  AlertTriangle: { 
    icon: <AlertTriangle className="h-5 w-5" />, 
    gradient: "from-orange-500/20 to-red-500/20",
    color: "text-orange-500"
  },
  Zap: { 
    icon: <Zap className="h-5 w-5" />, 
    gradient: "from-yellow-500/20 to-amber-500/20",
    color: "text-yellow-500"
  },
  FileText: { 
    icon: <FileText className="h-5 w-5" />, 
    gradient: "from-emerald-500/20 to-green-500/20",
    color: "text-emerald-500"
  },
};

// Helpers
const getStatusEmoji = (value: number | null, objective: number, isLowerBetter: boolean = false): string => {
  if (value === null) return "➖";
  if (isLowerBetter) {
    return value <= objective ? "✅" : "❌";
  }
  return value >= objective ? "✅" : "❌";
};

const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return "--";
  return `${Math.round(minutes)} min`;
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (value: number | null): string => {
  if (value === null) return "--";
  return `${value.toFixed(1)}%`;
};

export default function WeeklyReportGenerator({ onSent }: WeeklyReportGeneratorProps) {
  const queryClient = useQueryClient();
  
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generatedKPIs, setGeneratedKPIs] = useState<WeeklyKPIs[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Get last week's date range
  const lastWeek = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    return { start, end };
  }, []);

  // Fetch templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data.map(t => ({
        ...t,
        data_blocks: t.data_blocks as unknown as DataBlocks,
        objectives: t.objectives as unknown as Objectives,
      })) as ReportTemplate[];
    },
  });

  // Fetch pinned restaurants
  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-weekly-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, manager_first_name, manager_last_name, manager_whatsapp, is_pinned")
        .eq("is_active", true)
        .eq("is_pinned", true)
        .order("name");

      if (error) throw error;
      return data as Restaurant[];
    },
  });

  // Generate message based on template
  const generateMessage = (kpi: WeeklyKPIs, template: ReportTemplate): string => {
    const dateStart = format(lastWeek.start, "d MMMM", { locale: fr });
    const dateEnd = format(lastWeek.end, "d MMMM", { locale: fr });
    const objectives = template.objectives;
    const blocks = template.data_blocks;

    let intro = template.intro_template
      .replace(/{prenom}/g, kpi.manager_name.split(" ")[0] || "")
      .replace(/{date_debut}/g, dateStart)
      .replace(/{date_fin}/g, dateEnd);

    const lines: string[] = [];

    if (blocks.orders_revenue) {
      lines.push("📦 *COMMANDES & CA*");
      lines.push(`• Commandes : ${kpi.order_count}${kpi.order_variation !== null ? ` (${kpi.order_variation >= 0 ? "+" : ""}${kpi.order_variation.toFixed(0)}%)` : ""}`);
      lines.push(`• Chiffre d'affaires : ${formatCurrency(kpi.revenue)}${kpi.revenue_variation !== null ? ` (${kpi.revenue_variation >= 0 ? "+" : ""}${kpi.revenue_variation.toFixed(0)}%)` : ""}`);
      lines.push(`• Panier moyen : ${formatCurrency(kpi.average_basket)}`);
      lines.push("");
    }

    if (blocks.rating) {
      lines.push("⭐ *NOTE MOYENNE*");
      lines.push(`• Moyenne : ${kpi.average_rating !== null ? kpi.average_rating.toFixed(1) : "--"} ${getStatusEmoji(kpi.average_rating, objectives.rating)} (${kpi.review_count} avis)`);
      lines.push(`   ↳ Objectif : ${objectives.rating}`);
      lines.push("");
    }

    if (blocks.operations) {
      lines.push("⏱️ *TEMPS OPÉRATIONNELS*");
      lines.push(`• Temps de préparation : ${formatDuration(kpi.avg_prep_time)} ${getStatusEmoji(kpi.avg_prep_time, objectives.prep_time, true)}`);
      lines.push(`   ↳ Objectif : -${objectives.prep_time} min`);
      lines.push(`• Temps d'attente coursier : ${formatDuration(kpi.avg_courier_wait)} ${getStatusEmoji(kpi.avg_courier_wait, objectives.courier_wait, true)}`);
      lines.push(`   ↳ Objectif : -${objectives.courier_wait} min`);
      lines.push("");
    }

    if (blocks.errors) {
      lines.push("❌ *TAUX D'ERREUR*");
      lines.push(`• Pourcentage d'erreurs : ${formatPercent(kpi.error_rate)} ${getStatusEmoji(kpi.error_rate, objectives.error_rate, true)} (${kpi.error_count} erreurs)`);
      lines.push(`   ↳ Objectif : -${objectives.error_rate}%`);
    }

    return intro + lines.join("\n") + template.outro_template;
  };

  // Generate KPIs for all restaurants
  const generateReports = async () => {
    if (!selectedTemplate) {
      toast.error("Sélectionnez un template d'abord");
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-report", {
        body: {
          restaurant_ids: restaurants.map(r => r.id),
          start_date: format(lastWeek.start, "yyyy-MM-dd"),
          end_date: format(lastWeek.end, "yyyy-MM-dd"),
        },
      });

      if (error) throw error;

      const kpis: WeeklyKPIs[] = data.reports || [];
      setGeneratedKPIs(kpis);
      
      const newSelected = new Set<string>();
      const newMessages: Record<string, string> = {};
      
      kpis.forEach(kpi => {
        if (kpi.manager_whatsapp) {
          newSelected.add(kpi.restaurant_id);
          newMessages[kpi.restaurant_id] = generateMessage(kpi, selectedTemplate);
        }
      });
      
      setSelectedReports(newSelected);
      setEditedMessages(newMessages);
      
      toast.success(`${kpis.length} rapport(s) générés`);
    } catch (err) {
      console.error("Error generating reports:", err);
      toast.error("Erreur lors de la génération des rapports");
    } finally {
      setIsGenerating(false);
    }
  };

  // Send all selected reports
  const sendReports = async () => {
    const toSend = generatedKPIs.filter(k => selectedReports.has(k.restaurant_id) && k.manager_whatsapp);
    
    if (toSend.length === 0) {
      toast.error("Aucun rapport sélectionné");
      return;
    }

    setIsSending(true);

    try {
      let sentCount = 0;
      let failedCount = 0;

      for (const kpi of toSend) {
        const message = editedMessages[kpi.restaurant_id] || generateMessage(kpi, selectedTemplate!);
        
        const { error } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            recipients: [{
              restaurant_id: kpi.restaurant_id,
              phone: kpi.manager_whatsapp,
              name: kpi.manager_name,
              restaurantName: kpi.restaurant_name,
            }],
            message,
            message_type: 'report',
          },
        });

        if (error) {
          failedCount++;
        } else {
          sentCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (failedCount === 0) {
        toast.success(`${sentCount} rapport(s) envoyé(s) avec succès`);
        setGeneratedKPIs([]);
        setSelectedReports(new Set());
        setEditedMessages({});
        queryClient.invalidateQueries({ queryKey: ["message-history"] });
        onSent?.();
      } else {
        toast.warning(`${sentCount} envoyé(s), ${failedCount} échec(s)`);
      }
    } catch (err) {
      console.error("Error sending reports:", err);
      toast.error("Erreur lors de l'envoi des rapports");
    } finally {
      setIsSending(false);
    }
  };

  // Toggle card expansion
  const toggleCard = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  // Toggle report selection
  const toggleReport = (id: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedReports(newSelected);
  };

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Rapports hebdomadaires
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Période : {format(lastWeek.start, "d MMMM", { locale: fr })} - {format(lastWeek.end, "d MMMM yyyy", { locale: fr })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Template de rapport</label>
            <Select
              value={selectedTemplate?.id || ""}
              onValueChange={(value) => {
                const template = templates.find(t => t.id === value);
                setSelectedTemplate(template || null);
              }}
            >
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue placeholder="Choisir un template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => {
                  const style = templateStyles[template.icon] || templateStyles.FileText;
                  return (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <span className={style.color}>{style.icon}</span>
                        <span>{template.name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Restaurants info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="h-4 w-4" />
            <span>{restaurants.length} restaurant(s) épinglé(s)</span>
          </div>

          {/* Generate button */}
          <Button
            onClick={generateReports}
            disabled={!selectedTemplate || isGenerating || restaurants.length === 0}
            className="w-full h-11 rounded-lg gap-2 bg-blue-500 hover:bg-blue-500/90"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Générer les rapports
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Reports */}
      {generatedKPIs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Rapports générés ({selectedReports.size}/{generatedKPIs.length} sélectionnés)
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReports(new Set(generatedKPIs.filter(k => k.manager_whatsapp).map(k => k.restaurant_id)))}
                className="rounded-lg"
              >
                Tout sélectionner
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReports(new Set())}
                className="rounded-lg"
              >
                Aucun
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              <AnimatePresence>
                {generatedKPIs.map((kpi) => {
                  const isSelected = selectedReports.has(kpi.restaurant_id);
                  const isExpanded = expandedCards.has(kpi.restaurant_id);
                  const hasWhatsApp = !!kpi.manager_whatsapp;

                  return (
                    <motion.div
                      key={kpi.restaurant_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Card className={cn(
                        "transition-all",
                        !hasWhatsApp && "opacity-50",
                        isSelected && "ring-2 ring-blue-500/30"
                      )}>
                        <div 
                          className="p-4 flex items-center gap-3 cursor-pointer"
                          onClick={() => hasWhatsApp && toggleReport(kpi.restaurant_id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={!hasWhatsApp}
                            onCheckedChange={() => hasWhatsApp && toggleReport(kpi.restaurant_id)}
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{kpi.restaurant_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {kpi.manager_name} • {formatCurrency(kpi.revenue)} CA
                            </p>
                          </div>

                          {!hasWhatsApp && (
                            <Badge variant="outline" className="text-destructive border-destructive/30">
                              Pas de WhatsApp
                            </Badge>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCard(kpi.restaurant_id);
                            }}
                            className="h-8 w-8"
                          >
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-180"
                            )} />
                          </Button>
                        </div>

                        <Collapsible open={isExpanded}>
                          <CollapsibleContent>
                            <div className="px-4 pb-4 border-t pt-4">
                              <Textarea
                                value={editedMessages[kpi.restaurant_id] || ""}
                                onChange={(e) => setEditedMessages(prev => ({
                                  ...prev,
                                  [kpi.restaurant_id]: e.target.value
                                }))}
                                className="min-h-[200px] font-mono text-sm"
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Send button */}
          <Button
            onClick={sendReports}
            disabled={isSending || selectedReports.size === 0}
            className="w-full h-12 rounded-lg gap-2 bg-whatsapp hover:bg-whatsapp/90"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Envoyer {selectedReports.size} rapport{selectedReports.size > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
