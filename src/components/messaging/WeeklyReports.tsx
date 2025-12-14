import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Plus,
  Trash2,
  Settings,
  Eye,
  RefreshCw,
  ChevronDown,
  Star,
  Clock,
  AlertTriangle,
  ShoppingCart,
  Target,
  BarChart3,
  Zap,
  FileText,
  Calendar,
  Check,
  Copy,
  Edit3,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Types
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
  is_scheduled: boolean;
  schedule_day: number | null;
  schedule_time: string | null;
  last_sent_at: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  BarChart3: <BarChart3 className="h-5 w-5" />,
  AlertTriangle: <AlertTriangle className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
};

// Helpers
const DEFAULT_OBJECTIVES: Objectives = {
  prep_time: 20,
  courier_wait: 5,
  rating: 4.4,
  error_rate: 3,
};

const DEFAULT_DATA_BLOCKS: DataBlocks = {
  orders_revenue: true,
  rating: true,
  operations: true,
  errors: true,
};

const DAYS_OF_WEEK = [
  { value: 0, label: "Dimanche" },
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
];

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

export default function WeeklyReports() {
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState<"templates" | "send">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<ReportTemplate> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // Send state
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
  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
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

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: Partial<ReportTemplate>) => {
      if (template.id) {
        const { error } = await supabase
          .from("report_templates")
          .update({
            name: template.name,
            description: template.description,
            icon: template.icon,
            data_blocks: JSON.parse(JSON.stringify(template.data_blocks)),
            intro_template: template.intro_template,
            outro_template: template.outro_template,
            objectives: JSON.parse(JSON.stringify(template.objectives)),
            is_scheduled: template.is_scheduled,
            schedule_day: template.schedule_day,
            schedule_time: template.schedule_time,
          })
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("report_templates")
          .insert([{
            name: template.name!,
            description: template.description,
            icon: template.icon || "FileText",
            data_blocks: JSON.parse(JSON.stringify(template.data_blocks || DEFAULT_DATA_BLOCKS)),
            intro_template: template.intro_template,
            outro_template: template.outro_template,
            objectives: JSON.parse(JSON.stringify(template.objectives || DEFAULT_OBJECTIVES)),
            is_scheduled: template.is_scheduled || false,
            schedule_day: template.schedule_day,
            schedule_time: template.schedule_time,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      setShowTemplateEditor(false);
      setEditingTemplate(null);
      setIsCreatingNew(false);
      toast.success("Template sauvegardé");
    },
    onError: (err) => {
      console.error("Error saving template:", err);
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("report_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template supprimé");
    },
    onError: (err) => {
      console.error("Error deleting template:", err);
      toast.error("Erreur lors de la suppression");
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

    // Commandes & CA
    if (blocks.orders_revenue) {
      lines.push("📦 *COMMANDES & CA*");
      lines.push(`• Commandes : ${kpi.order_count}${kpi.order_variation !== null ? ` (${kpi.order_variation >= 0 ? "+" : ""}${kpi.order_variation.toFixed(0)}%)` : ""}`);
      lines.push(`• Chiffre d'affaires : ${formatCurrency(kpi.revenue)}${kpi.revenue_variation !== null ? ` (${kpi.revenue_variation >= 0 ? "+" : ""}${kpi.revenue_variation.toFixed(0)}%)` : ""}`);
      lines.push(`• Panier moyen : ${formatCurrency(kpi.average_basket)}`);
      lines.push("");
    }

    // Note moyenne
    if (blocks.rating) {
      lines.push("⭐ *NOTE MOYENNE*");
      lines.push(`• Moyenne : ${kpi.average_rating !== null ? kpi.average_rating.toFixed(1) : "--"} ${getStatusEmoji(kpi.average_rating, objectives.rating)} (${kpi.review_count} avis)`);
      lines.push(`   ↳ Objectif : ${objectives.rating}`);
      lines.push("");
    }

    // Temps opérationnels
    if (blocks.operations) {
      lines.push("⏱️ *TEMPS OPÉRATIONNELS*");
      lines.push(`• Temps de préparation : ${formatDuration(kpi.avg_prep_time)} ${getStatusEmoji(kpi.avg_prep_time, objectives.prep_time, true)}`);
      lines.push(`   ↳ Objectif : -${objectives.prep_time} min`);
      lines.push(`• Temps d'attente coursier : ${formatDuration(kpi.avg_courier_wait)} ${getStatusEmoji(kpi.avg_courier_wait, objectives.courier_wait, true)}`);
      lines.push(`   ↳ Objectif : -${objectives.courier_wait} min`);
      lines.push("");
    }

    // Taux d'erreur
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
      
      // Pre-select all with WhatsApp and generate messages
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
      setActiveTab("send");
      
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
            skip_campaign: false,
          },
        });

        if (error) {
          failedCount++;
          console.error(`Failed to send to ${kpi.restaurant_name}:`, error);
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
        setActiveTab("templates");
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

  // Handlers
  const openNewTemplate = () => {
    setIsCreatingNew(true);
    setEditingTemplate({
      name: "",
      description: "",
      icon: "FileText",
      data_blocks: { ...DEFAULT_DATA_BLOCKS },
      intro_template: "📊 Bonjour {prenom}, voici le rapport de la semaine du {date_debut} au {date_fin} :\n\n",
      outro_template: "\n\n💪 Bonne continuation !",
      objectives: { ...DEFAULT_OBJECTIVES },
      is_scheduled: false,
      schedule_day: 0,
      schedule_time: "09:00",
    });
    setShowTemplateEditor(true);
  };

  const openEditTemplate = (template: ReportTemplate) => {
    setIsCreatingNew(false);
    setEditingTemplate({ ...template });
    setShowTemplateEditor(true);
  };

  const toggleCard = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const toggleReport = (id: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedReports(newSelected);
  };

  const updateMessage = (restaurantId: string, message: string) => {
    setEditedMessages(prev => ({ ...prev, [restaurantId]: message }));
  };

  const regenerateMessage = (kpi: WeeklyKPIs) => {
    if (!selectedTemplate) return;
    const message = generateMessage(kpi, selectedTemplate);
    setEditedMessages(prev => ({ ...prev, [kpi.restaurant_id]: message }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Rapports Hebdomadaires</h2>
          <p className="text-sm text-muted-foreground">
            Semaine du {format(lastWeek.start, "d MMMM", { locale: fr })} au {format(lastWeek.end, "d MMMM yyyy", { locale: fr })}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "templates" | "send")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="send" className="gap-2" disabled={generatedKPIs.length === 0}>
            <Send className="h-4 w-4" />
            Envoi ({generatedKPIs.length})
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          {/* Template Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card
                key={template.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedTemplate?.id === template.id && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {iconMap[template.icon] || <FileText className="h-5 w-5" />}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {template.name}
                          {template.is_default && (
                            <Badge variant="secondary" className="text-xs">Par défaut</Badge>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{template.description}</p>
                      </div>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Data blocks badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {template.data_blocks.orders_revenue && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <ShoppingCart className="h-3 w-3" /> CA
                      </Badge>
                    )}
                    {template.data_blocks.rating && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Star className="h-3 w-3" /> Note
                      </Badge>
                    )}
                    {template.data_blocks.operations && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Clock className="h-3 w-3" /> Temps
                      </Badge>
                    )}
                    {template.data_blocks.errors && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" /> Erreurs
                      </Badge>
                    )}
                  </div>

                  {/* Schedule badge */}
                  {template.is_scheduled && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Calendar className="h-3 w-3" />
                      {DAYS_OF_WEEK.find(d => d.value === template.schedule_day)?.label} à {template.schedule_time?.slice(0, 5)}
                    </Badge>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditTemplate(template);
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Modifier
                    </Button>
                    {!template.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Supprimer ce template ?")) {
                            deleteTemplateMutation.mutate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add new template card */}
            <Card
              className="cursor-pointer border-dashed transition-all hover:border-primary hover:bg-primary/5"
              onClick={openNewTemplate}
            >
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Créer un template</p>
                <p className="text-xs">Personnalisez vos rapports</p>
              </CardContent>
            </Card>
          </div>

          {/* Generate button */}
          <Card className="bg-secondary/30">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-medium">{restaurants.length} restaurant(s) épinglé(s)</span>
                  <span className="text-muted-foreground ml-2">
                    • {restaurants.filter(r => r.manager_whatsapp).length} avec WhatsApp
                  </span>
                </div>
              </div>
              <Button
                onClick={generateReports}
                disabled={isGenerating || loadingRestaurants || restaurants.length === 0 || !selectedTemplate}
                className="gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Générer avec "{selectedTemplate?.name || "..."}"
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send" className="space-y-4 mt-4">
          {generatedKPIs.length > 0 && (
            <>
              {/* Action bar */}
              <Card className="bg-secondary/30">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedReports.size === generatedKPIs.filter(k => k.manager_whatsapp).length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedReports(new Set(generatedKPIs.filter(k => k.manager_whatsapp).map(k => k.restaurant_id)));
                        } else {
                          setSelectedReports(new Set());
                        }
                      }}
                    />
                    <span className="text-sm font-medium">
                      {selectedReports.size} / {generatedKPIs.filter(k => k.manager_whatsapp).length} sélectionné(s)
                    </span>
                  </div>
                  <Button
                    onClick={sendReports}
                    disabled={isSending || selectedReports.size === 0}
                    className="gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Envoyer {selectedReports.size > 0 ? `(${selectedReports.size})` : ""}
                  </Button>
                </CardContent>
              </Card>

              {/* Report cards */}
              <div className="grid gap-4">
                <AnimatePresence>
                  {generatedKPIs.map((kpi, index) => (
                    <motion.div
                      key={kpi.restaurant_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={cn(
                        "transition-all",
                        selectedReports.has(kpi.restaurant_id) && "ring-2 ring-primary/30",
                        !kpi.manager_whatsapp && "opacity-50"
                      )}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedReports.has(kpi.restaurant_id)}
                                onCheckedChange={() => toggleReport(kpi.restaurant_id)}
                                disabled={!kpi.manager_whatsapp}
                              />
                              <div>
                                <CardTitle className="text-base">{kpi.restaurant_name}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  {kpi.manager_name} {!kpi.manager_whatsapp && "(pas de WhatsApp)"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="gap-1">
                                <ShoppingCart className="h-3 w-3" />
                                {kpi.order_count}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                <Star className="h-3 w-3" />
                                {kpi.average_rating?.toFixed(1) || "--"}
                              </Badge>
                              {kpi.error_rate !== null && kpi.error_rate > (selectedTemplate?.objectives.error_rate || 3) && (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {kpi.error_rate.toFixed(1)}%
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCard(kpi.restaurant_id)}
                                className="gap-1"
                              >
                                <Eye className="h-4 w-4" />
                                <ChevronDown className={cn(
                                  "h-4 w-4 transition-transform",
                                  expandedCards.has(kpi.restaurant_id) && "rotate-180"
                                )} />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <Collapsible open={expandedCards.has(kpi.restaurant_id)}>
                          <CollapsibleContent>
                            <CardContent className="pt-0">
                              <Separator className="mb-4" />
                              
                              {/* KPI Summary Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-secondary/50">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <ShoppingCart className="h-3 w-3" />
                                    Commandes
                                  </div>
                                  <div className="font-semibold">{kpi.order_count}</div>
                                  {kpi.order_variation !== null && (
                                    <div className={cn("text-xs", kpi.order_variation >= 0 ? "text-green-600" : "text-red-600")}>
                                      {kpi.order_variation >= 0 ? "+" : ""}{kpi.order_variation.toFixed(0)}%
                                    </div>
                                  )}
                                </div>
                                <div className="p-3 rounded-lg bg-secondary/50">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Star className="h-3 w-3" />
                                    Note moyenne
                                  </div>
                                  <div className="font-semibold flex items-center gap-1">
                                    {kpi.average_rating?.toFixed(1) || "--"}
                                    <span className="text-xs">{getStatusEmoji(kpi.average_rating, selectedTemplate?.objectives.rating || 4.4)}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">{kpi.review_count} avis</div>
                                </div>
                                <div className="p-3 rounded-lg bg-secondary/50">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Clock className="h-3 w-3" />
                                    Temps prep
                                  </div>
                                  <div className="font-semibold flex items-center gap-1">
                                    {formatDuration(kpi.avg_prep_time)}
                                    <span className="text-xs">{getStatusEmoji(kpi.avg_prep_time, selectedTemplate?.objectives.prep_time || 20, true)}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">Obj: -{selectedTemplate?.objectives.prep_time || 20}min</div>
                                </div>
                                <div className="p-3 rounded-lg bg-secondary/50">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Erreurs
                                  </div>
                                  <div className="font-semibold flex items-center gap-1">
                                    {formatPercent(kpi.error_rate)}
                                    <span className="text-xs">{getStatusEmoji(kpi.error_rate, selectedTemplate?.objectives.error_rate || 3, true)}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">{kpi.error_count} erreurs</div>
                                </div>
                              </div>

                              {/* Editable message */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Message à envoyer</Label>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => regenerateMessage(kpi)}
                                    className="h-7 text-xs gap-1"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    Régénérer
                                  </Button>
                                </div>
                                <Textarea
                                  value={editedMessages[kpi.restaurant_id] || (selectedTemplate ? generateMessage(kpi, selectedTemplate) : "")}
                                  onChange={(e) => updateMessage(kpi.restaurant_id, e.target.value)}
                                  className="min-h-[200px] font-mono text-xs"
                                  disabled={!kpi.manager_whatsapp}
                                />
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreatingNew ? <Plus className="h-5 w-5" /> : <Edit3 className="h-5 w-5" />}
              {isCreatingNew ? "Nouveau template" : "Modifier le template"}
            </DialogTitle>
            <DialogDescription>
              Personnalisez les sections et messages de votre rapport
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-6 py-4">
              {/* Basic info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom du template</Label>
                  <Input
                    value={editingTemplate.name || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev!, name: e.target.value }))}
                    placeholder="Ex: Rapport hebdo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icône</Label>
                  <Select
                    value={editingTemplate.icon || "FileText"}
                    onValueChange={(v) => setEditingTemplate(prev => ({ ...prev!, icon: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FileText">📄 Document</SelectItem>
                      <SelectItem value="BarChart3">📊 Graphique</SelectItem>
                      <SelectItem value="AlertTriangle">⚠️ Alerte</SelectItem>
                      <SelectItem value="Zap">⚡ Express</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingTemplate.description || ""}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev!, description: e.target.value }))}
                  placeholder="Courte description du template"
                />
              </div>

              <Separator />

              {/* Data blocks */}
              <div className="space-y-3">
                <Label>Sections à inclure</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Commandes & CA</span>
                    </div>
                    <Switch
                      checked={editingTemplate.data_blocks?.orders_revenue ?? true}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({
                        ...prev!,
                        data_blocks: { ...prev!.data_blocks!, orders_revenue: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Note moyenne</span>
                    </div>
                    <Switch
                      checked={editingTemplate.data_blocks?.rating ?? true}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({
                        ...prev!,
                        data_blocks: { ...prev!.data_blocks!, rating: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Temps opérationnels</span>
                    </div>
                    <Switch
                      checked={editingTemplate.data_blocks?.operations ?? true}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({
                        ...prev!,
                        data_blocks: { ...prev!.data_blocks!, operations: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Taux d'erreur</span>
                    </div>
                    <Switch
                      checked={editingTemplate.data_blocks?.errors ?? true}
                      onCheckedChange={(checked) => setEditingTemplate(prev => ({
                        ...prev!,
                        data_blocks: { ...prev!.data_blocks!, errors: checked }
                      }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Objectives */}
              <div className="space-y-4">
                <Label>Objectifs</Label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Temps de préparation max</span>
                    <Badge variant="secondary">{editingTemplate.objectives?.prep_time || 20} min</Badge>
                  </div>
                  <Slider
                    value={[editingTemplate.objectives?.prep_time || 20]}
                    onValueChange={([v]) => setEditingTemplate(prev => ({
                      ...prev!,
                      objectives: { ...prev!.objectives!, prep_time: v }
                    }))}
                    min={10}
                    max={30}
                    step={1}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Temps d'attente coursier max</span>
                    <Badge variant="secondary">{editingTemplate.objectives?.courier_wait || 5} min</Badge>
                  </div>
                  <Slider
                    value={[editingTemplate.objectives?.courier_wait || 5]}
                    onValueChange={([v]) => setEditingTemplate(prev => ({
                      ...prev!,
                      objectives: { ...prev!.objectives!, courier_wait: v }
                    }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Note moyenne minimum</span>
                    <Badge variant="secondary">{(editingTemplate.objectives?.rating || 4.4).toFixed(1)}</Badge>
                  </div>
                  <Slider
                    value={[(editingTemplate.objectives?.rating || 4.4) * 10]}
                    onValueChange={([v]) => setEditingTemplate(prev => ({
                      ...prev!,
                      objectives: { ...prev!.objectives!, rating: v / 10 }
                    }))}
                    min={35}
                    max={50}
                    step={1}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Taux d'erreur maximum</span>
                    <Badge variant="secondary">{editingTemplate.objectives?.error_rate || 3}%</Badge>
                  </div>
                  <Slider
                    value={[editingTemplate.objectives?.error_rate || 3]}
                    onValueChange={([v]) => setEditingTemplate(prev => ({
                      ...prev!,
                      objectives: { ...prev!.objectives!, error_rate: v }
                    }))}
                    min={1}
                    max={10}
                    step={0.5}
                  />
                </div>
              </div>

              <Separator />

              {/* Messages */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Message d'introduction</Label>
                  <Textarea
                    value={editingTemplate.intro_template || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev!, intro_template: e.target.value }))}
                    placeholder="Variables: {prenom}, {date_debut}, {date_fin}"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{prenom}"}, {"{date_debut}"}, {"{date_fin}"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Message de conclusion</Label>
                  <Textarea
                    value={editingTemplate.outro_template || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev!, outro_template: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Scheduling */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Programmation automatique</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Envoyer automatiquement chaque semaine
                    </p>
                  </div>
                  <Switch
                    checked={editingTemplate.is_scheduled || false}
                    onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev!, is_scheduled: checked }))}
                  />
                </div>

                {editingTemplate.is_scheduled && (
                  <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-secondary/30">
                    <div className="space-y-2">
                      <Label>Jour d'envoi</Label>
                      <Select
                        value={String(editingTemplate.schedule_day ?? 0)}
                        onValueChange={(v) => setEditingTemplate(prev => ({ ...prev!, schedule_day: parseInt(v) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(day => (
                            <SelectItem key={day.value} value={String(day.value)}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Heure d'envoi</Label>
                      <Input
                        type="time"
                        value={editingTemplate.schedule_time || "09:00"}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev!, schedule_time: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateEditor(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => editingTemplate && saveTemplateMutation.mutate(editingTemplate)}
              disabled={saveTemplateMutation.isPending || !editingTemplate?.name}
            >
              {saveTemplateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
