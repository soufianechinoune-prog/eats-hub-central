import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import MessageTemplateEditor from "./MessageTemplateEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Eye,
  RefreshCw,
  ChevronDown,
  Star,
  Clock,
  AlertTriangle,
  ShoppingCart,
  BarChart3,
  Zap,
  FileText,
  Calendar,
  Check,
  Edit3,
  PlayCircle,
  CalendarDays,
  Repeat,
  Bell,
  BellOff,
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
  schedule_frequency: string;
  schedule_day: number | null;
  schedule_day_of_month: number | null;
  schedule_time: string | null;
  requires_validation: boolean;
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

// Icon mapping with gradient colors
const templateStyles: Record<string, { icon: React.ReactNode; gradient: string; color: string }> = {
  BarChart3: { 
    icon: <BarChart3 className="h-6 w-6" />, 
    gradient: "from-blue-500/20 to-cyan-500/20",
    color: "text-blue-500"
  },
  AlertTriangle: { 
    icon: <AlertTriangle className="h-6 w-6" />, 
    gradient: "from-orange-500/20 to-red-500/20",
    color: "text-orange-500"
  },
  Zap: { 
    icon: <Zap className="h-6 w-6" />, 
    gradient: "from-yellow-500/20 to-amber-500/20",
    color: "text-yellow-500"
  },
  FileText: { 
    icon: <FileText className="h-6 w-6" />, 
    gradient: "from-emerald-500/20 to-green-500/20",
    color: "text-emerald-500"
  },
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

const FREQUENCIES = [
  { value: "weekly", label: "Hebdomadaire", icon: CalendarDays, desc: "Chaque semaine" },
  { value: "bimonthly", label: "Bi-mensuel", icon: Repeat, desc: "1er et 15 du mois" },
  { value: "monthly", label: "Mensuel", icon: Calendar, desc: "Une fois par mois" },
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

const getFrequencyLabel = (frequency: string, day: number | null, dayOfMonth: number | null): string => {
  switch (frequency) {
    case "weekly":
      return DAYS_OF_WEEK.find(d => d.value === day)?.label || "Dimanche";
    case "bimonthly":
      return "1er et 15";
    case "monthly":
      return `Le ${dayOfMonth || 1}`;
    default:
      return "";
  }
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
        schedule_frequency: t.schedule_frequency || "weekly",
        requires_validation: t.requires_validation ?? true,
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
      const payload = {
        name: template.name,
        description: template.description,
        icon: template.icon,
        data_blocks: JSON.parse(JSON.stringify(template.data_blocks)),
        intro_template: template.intro_template,
        outro_template: template.outro_template,
        objectives: JSON.parse(JSON.stringify(template.objectives)),
        is_scheduled: template.is_scheduled,
        schedule_frequency: template.schedule_frequency || "weekly",
        schedule_day: template.schedule_day,
        schedule_day_of_month: template.schedule_day_of_month,
        schedule_time: template.schedule_time,
        requires_validation: template.requires_validation ?? true,
      };

      if (template.id) {
        const { error } = await supabase
          .from("report_templates")
          .update(payload)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("report_templates")
          .insert([{
            ...payload,
            name: template.name!,
            icon: template.icon || "FileText",
            data_blocks: JSON.parse(JSON.stringify(template.data_blocks || DEFAULT_DATA_BLOCKS)),
            objectives: JSON.parse(JSON.stringify(template.objectives || DEFAULT_OBJECTIVES)),
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
        queryClient.invalidateQueries({ queryKey: ["report-history"] });
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
      schedule_frequency: "weekly",
      schedule_day: 0,
      schedule_day_of_month: 1,
      schedule_time: "09:00",
      requires_validation: true,
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
      {/* Premium Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Rapports WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Semaine du {format(lastWeek.start, "d MMMM", { locale: fr })} au {format(lastWeek.end, "d MMMM yyyy", { locale: fr })}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "templates" | "send")}>
        <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-secondary/50 backdrop-blur-sm">
          <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="send" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" disabled={generatedKPIs.length === 0}>
            <Send className="h-4 w-4" />
            Envoi ({generatedKPIs.length})
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          {/* Template Grid - Premium Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const style = templateStyles[template.icon] || templateStyles.FileText;
              const isSelected = selectedTemplate?.id === template.id;
              
              return (
                <motion.div
                  key={template.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={cn(
                      "cursor-pointer transition-all duration-300 backdrop-blur-xl border-2 overflow-hidden",
                      "bg-gradient-to-br",
                      style.gradient,
                      isSelected 
                        ? "ring-2 ring-primary border-primary/50 shadow-lg shadow-primary/10" 
                        : "border-border/50 hover:border-primary/30 hover:shadow-md"
                    )}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                            "bg-background/80 backdrop-blur-sm",
                            style.color
                          )}>
                            {style.icon}
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {template.name}
                              {template.is_default && (
                                <Badge variant="secondary" className="text-xs font-normal">Défaut</Badge>
                              )}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Data blocks badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {template.data_blocks.orders_revenue && (
                          <Badge variant="outline" className="text-xs gap-1 bg-background/50">
                            <ShoppingCart className="h-3 w-3" /> CA
                          </Badge>
                        )}
                        {template.data_blocks.rating && (
                          <Badge variant="outline" className="text-xs gap-1 bg-background/50">
                            <Star className="h-3 w-3" /> Note
                          </Badge>
                        )}
                        {template.data_blocks.operations && (
                          <Badge variant="outline" className="text-xs gap-1 bg-background/50">
                            <Clock className="h-3 w-3" /> Temps
                          </Badge>
                        )}
                        {template.data_blocks.errors && (
                          <Badge variant="outline" className="text-xs gap-1 bg-background/50">
                            <AlertTriangle className="h-3 w-3" /> Erreurs
                          </Badge>
                        )}
                      </div>

                      {/* Schedule info */}
                      {template.is_scheduled && (
                        <div className="flex items-center gap-2">
                          <Badge className={cn(
                            "text-xs gap-1.5",
                            template.requires_validation 
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/30" 
                              : "bg-green-500/10 text-green-600 border-green-500/30"
                          )}>
                            {template.requires_validation ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                            {FREQUENCIES.find(f => f.value === template.schedule_frequency)?.label}
                            {" • "}
                            {getFrequencyLabel(template.schedule_frequency, template.schedule_day, template.schedule_day_of_month)}
                            {" à "}
                            {template.schedule_time?.slice(0, 5)}
                          </Badge>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
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
                            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                </motion.div>
              );
            })}

            {/* Add new template card */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="cursor-pointer border-2 border-dashed transition-all hover:border-primary hover:bg-primary/5 min-h-[200px] flex items-center justify-center"
                onClick={openNewTemplate}
              >
                <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Plus className="h-7 w-7 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">Créer un template</p>
                  <p className="text-xs mt-1">Personnalisez vos rapports</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Generate button - Premium style */}
          <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
            <CardContent className="py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{restaurants.length} restaurant(s) épinglé(s)</p>
                  <p className="text-sm text-muted-foreground">
                    {restaurants.filter(r => r.manager_whatsapp).length} avec WhatsApp configuré
                  </p>
                </div>
              </div>
              <Button
                onClick={generateReports}
                disabled={isGenerating || loadingRestaurants || restaurants.length === 0 || !selectedTemplate}
                size="lg"
                className="gap-2 shadow-lg"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Générer les rapports
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send" className="space-y-4 mt-6">
          {generatedKPIs.length > 0 && (
            <>
              {/* Action bar */}
              <Card className="bg-gradient-to-r from-[#25D366]/5 via-[#25D366]/10 to-[#25D366]/5 border-[#25D366]/20">
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
                    <span className="font-medium">
                      {selectedReports.size} / {generatedKPIs.filter(k => k.manager_whatsapp).length} sélectionné(s)
                    </span>
                  </div>
                  <Button
                    onClick={sendReports}
                    disabled={isSending || selectedReports.size === 0}
                    className="gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white shadow-lg"
                    size="lg"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Envoyer via WhatsApp
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
                        selectedReports.has(kpi.restaurant_id) && "ring-2 ring-primary/30 bg-primary/5",
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
                                </div>
                              </div>

                              {/* Editable message with visual editor */}
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
                                <MessageTemplateEditor
                                  value={editedMessages[kpi.restaurant_id] || (selectedTemplate ? generateMessage(kpi, selectedTemplate) : "")}
                                  onChange={(msg) => updateMessage(kpi.restaurant_id, msg)}
                                  disabled={!kpi.manager_whatsapp}
                                  previewData={{
                                    prenom: kpi.manager_name.split(" ")[0] || "",
                                    restaurant: kpi.restaurant_name,
                                    date_debut: format(lastWeek.start, "d MMMM", { locale: fr }),
                                    date_fin: format(lastWeek.end, "d MMMM", { locale: fr }),
                                    commandes: String(kpi.order_count),
                                    ca: formatCurrency(kpi.revenue),
                                    panier_moyen: formatCurrency(kpi.average_basket),
                                    variation_cmd: kpi.order_variation !== null ? `${kpi.order_variation >= 0 ? "+" : ""}${kpi.order_variation.toFixed(0)}%` : "--",
                                    variation_ca: kpi.revenue_variation !== null ? `${kpi.revenue_variation >= 0 ? "+" : ""}${kpi.revenue_variation.toFixed(0)}%` : "--",
                                    note: kpi.average_rating?.toFixed(1) || "--",
                                    nb_avis: String(kpi.review_count),
                                    emoji_note: getStatusEmoji(kpi.average_rating, selectedTemplate?.objectives.rating || 4.4),
                                    temps_prep: formatDuration(kpi.avg_prep_time),
                                    temps_coursier: formatDuration(kpi.avg_courier_wait),
                                    emoji_temps: getStatusEmoji(kpi.avg_prep_time, selectedTemplate?.objectives.prep_time || 20, true),
                                    taux_erreur: formatPercent(kpi.error_rate),
                                    nb_erreurs: String(kpi.error_count),
                                    emoji_erreur: getStatusEmoji(kpi.error_rate, selectedTemplate?.objectives.error_rate || 3, true),
                                  }}
                                  minHeight="150px"
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
            <Tabs defaultValue="general" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="content">Contenu</TabsTrigger>
                <TabsTrigger value="objectives">Objectifs</TabsTrigger>
                <TabsTrigger value="schedule">Programmation</TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Aperçu
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
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

                <div className="space-y-2">
                  <Label>Message d'introduction</Label>
                  <MessageTemplateEditor
                    value={editingTemplate.intro_template || ""}
                    onChange={(value) => setEditingTemplate(prev => ({ ...prev!, intro_template: value }))}
                    previewData={{
                      prenom: "Jean",
                      restaurant: "Chicken Street Antony",
                      date_debut: format(lastWeek.start, "d MMMM", { locale: fr }),
                      date_fin: format(lastWeek.end, "d MMMM", { locale: fr }),
                      commandes: "142",
                      ca: "2 847 €",
                      panier_moyen: "20,05 €",
                      variation_ca: "+8,5%",
                      note: "4.6",
                      nb_avis: "23",
                      emoji_note: "✅",
                      temps_prep: "12 min",
                      temps_coursier: "4 min",
                      emoji_temps: "✅",
                      taux_erreur: "2.1%",
                      nb_erreurs: "3",
                      emoji_erreur: "✅"
                    }}
                    minHeight="120px"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message de conclusion</Label>
                  <MessageTemplateEditor
                    value={editingTemplate.outro_template || ""}
                    onChange={(value) => setEditingTemplate(prev => ({ ...prev!, outro_template: value }))}
                    previewData={{
                      prenom: "Jean",
                      restaurant: "Chicken Street Antony"
                    }}
                    minHeight="80px"
                  />
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <Label>Sections à inclure</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-blue-500" />
                        </div>
                        <span className="font-medium">Commandes & CA</span>
                      </div>
                      <Switch
                        checked={editingTemplate.data_blocks?.orders_revenue ?? true}
                        onCheckedChange={(checked) => setEditingTemplate(prev => ({
                          ...prev!,
                          data_blocks: { ...prev!.data_blocks!, orders_revenue: checked }
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <Star className="h-4 w-4 text-yellow-500" />
                        </div>
                        <span className="font-medium">Note moyenne</span>
                      </div>
                      <Switch
                        checked={editingTemplate.data_blocks?.rating ?? true}
                        onCheckedChange={(checked) => setEditingTemplate(prev => ({
                          ...prev!,
                          data_blocks: { ...prev!.data_blocks!, rating: checked }
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-purple-500" />
                        </div>
                        <span className="font-medium">Temps opérationnels</span>
                      </div>
                      <Switch
                        checked={editingTemplate.data_blocks?.operations ?? true}
                        onCheckedChange={(checked) => setEditingTemplate(prev => ({
                          ...prev!,
                          data_blocks: { ...prev!.data_blocks!, operations: checked }
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        </div>
                        <span className="font-medium">Taux d'erreur</span>
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
              </TabsContent>

              <TabsContent value="objectives" className="space-y-4 mt-4">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Temps de préparation max</span>
                      <Badge variant="secondary" className="text-sm">{editingTemplate.objectives?.prep_time || 20} min</Badge>
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
                      <span className="font-medium">Temps d'attente coursier max</span>
                      <Badge variant="secondary" className="text-sm">{editingTemplate.objectives?.courier_wait || 5} min</Badge>
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
                      <span className="font-medium">Note moyenne minimum</span>
                      <Badge variant="secondary" className="text-sm">{(editingTemplate.objectives?.rating || 4.4).toFixed(1)}</Badge>
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
                      <span className="font-medium">Taux d'erreur maximum</span>
                      <Badge variant="secondary" className="text-sm">{editingTemplate.objectives?.error_rate || 3}%</Badge>
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
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div>
                    <Label className="text-base">Programmation automatique</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Envoyer automatiquement selon la fréquence choisie
                    </p>
                  </div>
                  <Switch
                    checked={editingTemplate.is_scheduled || false}
                    onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev!, is_scheduled: checked }))}
                  />
                </div>

                {editingTemplate.is_scheduled && (
                  <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
                    {/* Frequency selection */}
                    <div className="space-y-3">
                      <Label>Fréquence d'envoi</Label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {FREQUENCIES.map((freq) => (
                          <div
                            key={freq.value}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                              editingTemplate.schedule_frequency === freq.value
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            )}
                            onClick={() => setEditingTemplate(prev => ({ ...prev!, schedule_frequency: freq.value }))}
                          >
                            <freq.icon className={cn(
                              "h-5 w-5",
                              editingTemplate.schedule_frequency === freq.value ? "text-primary" : "text-muted-foreground"
                            )} />
                            <div>
                              <p className="font-medium text-sm">{freq.label}</p>
                              <p className="text-xs text-muted-foreground">{freq.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Day selection based on frequency */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {editingTemplate.schedule_frequency === "weekly" && (
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
                      )}

                      {editingTemplate.schedule_frequency === "monthly" && (
                        <div className="space-y-2">
                          <Label>Jour du mois</Label>
                          <Select
                            value={String(editingTemplate.schedule_day_of_month ?? 1)}
                            onValueChange={(v) => setEditingTemplate(prev => ({ ...prev!, schedule_day_of_month: parseInt(v) }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                <SelectItem key={day} value={String(day)}>
                                  Le {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Heure d'envoi</Label>
                        <Input
                          type="time"
                          value={editingTemplate.schedule_time || "09:00"}
                          onChange={(e) => setEditingTemplate(prev => ({ ...prev!, schedule_time: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Validation toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        {editingTemplate.requires_validation ? (
                          <Bell className="h-5 w-5 text-amber-500" />
                        ) : (
                          <BellOff className="h-5 w-5 text-green-500" />
                        )}
                        <div>
                          <Label className="text-base">Validation requise</Label>
                          <p className="text-sm text-muted-foreground">
                            {editingTemplate.requires_validation 
                              ? "Vous recevrez une notification pour valider avant envoi"
                              : "Les rapports seront envoyés automatiquement"
                            }
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={editingTemplate.requires_validation ?? true}
                        onCheckedChange={(checked) => setEditingTemplate(prev => ({ ...prev!, requires_validation: checked }))}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                {/* Full message preview */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>Aperçu du message complet tel qu'il sera envoyé</span>
                  </div>
                  
                  {/* WhatsApp-style full preview */}
                  <div className="rounded-xl bg-[#0b141a] overflow-hidden border border-border/30">
                    {/* Chat header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34] border-b border-white/5">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-base">
                        J
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">Jean Dupont</div>
                        <div className="text-[11px] text-white/50">Manager • Chicken Street Antony</div>
                      </div>
                    </div>
                    
                    {/* Message bubble with full generated content */}
                    <div className="p-4 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]">
                      <div className="max-w-[90%] ml-auto">
                        <div className="bg-[#005c4b] rounded-xl rounded-tr-sm p-4 shadow-lg">
                          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                            {(() => {
                              // Generate full preview message
                              const dateStart = format(lastWeek.start, "d MMMM", { locale: fr });
                              const dateEnd = format(lastWeek.end, "d MMMM", { locale: fr });
                              const objectives = editingTemplate?.objectives || DEFAULT_OBJECTIVES;
                              const blocks = editingTemplate?.data_blocks || DEFAULT_DATA_BLOCKS;
                              
                              let intro = (editingTemplate?.intro_template || "")
                                .replace(/{prenom}/g, "Jean")
                                .replace(/{restaurant}/g, "Chicken Street Antony")
                                .replace(/{date_debut}/g, dateStart)
                                .replace(/{date_fin}/g, dateEnd);
                              
                              const lines: string[] = [];
                              
                              if (blocks.orders_revenue) {
                                lines.push("📦 *COMMANDES & CA*");
                                lines.push("• Commandes : 142 (+12%)");
                                lines.push("• Chiffre d'affaires : 2 847 € (+8%)");
                                lines.push("• Panier moyen : 20,05 €");
                                lines.push("");
                              }
                              
                              if (blocks.rating) {
                                lines.push("⭐ *NOTE MOYENNE*");
                                lines.push(`• Moyenne : 4.6 ✅ (23 avis)`);
                                lines.push(`   ↳ Objectif : ${objectives.rating}`);
                                lines.push("");
                              }
                              
                              if (blocks.operations) {
                                lines.push("⏱️ *TEMPS OPÉRATIONNELS*");
                                lines.push(`• Temps de préparation : 12 min ✅`);
                                lines.push(`   ↳ Objectif : -${objectives.prep_time} min`);
                                lines.push(`• Temps d'attente coursier : 4 min ✅`);
                                lines.push(`   ↳ Objectif : -${objectives.courier_wait} min`);
                                lines.push("");
                              }
                              
                              if (blocks.errors) {
                                lines.push("❌ *TAUX D'ERREUR*");
                                lines.push(`• Pourcentage d'erreurs : 2.1% ✅ (3 erreurs)`);
                                lines.push(`   ↳ Objectif : -${objectives.error_rate}%`);
                              }
                              
                              return intro + lines.join("\n") + (editingTemplate?.outro_template || "");
                            })()}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-3 text-[10px] text-white/60">
                            <span>Dimanche 12:00</span>
                            <Check className="h-3.5 w-3.5 text-white/40" />
                            <Check className="h-3.5 w-3.5 text-sky-400 -ml-2" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Les valeurs affichées sont des exemples. Le message réel utilisera les données de chaque restaurant.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-6">
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
