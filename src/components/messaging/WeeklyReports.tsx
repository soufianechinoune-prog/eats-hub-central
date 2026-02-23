import { useState, useMemo, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
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
  Sparkles,
  History,
  CheckCircle,
  XCircle,
  MessageSquare,
  CheckSquare,
  Square,
  PauseCircle,
} from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReportPdfExport } from "@/hooks/useReportPdfExport";
import { Progress } from "@/components/ui/progress";

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

// Report type options
type ReportType = "ai_global" | "errors" | "revenue" | "rating" | "operations" | "promotions" | "downtime";
type DetailLevel = "basic" | "detailed";

const REPORT_TYPE_OPTIONS: {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  color: string;
}[] = [
  {
    id: "ai_global",
    label: "Rapport IA",
    description: "Synthèse intelligente avec analyse contextuelle",
    icon: <Sparkles className="h-6 w-6" />,
    gradient: "from-violet-500/20 to-indigo-500/20",
    color: "text-violet-500",
  },
  {
    id: "errors",
    label: "Erreurs",
    description: "Taux d'erreur et produits problématiques",
    icon: <AlertTriangle className="h-6 w-6" />,
    gradient: "from-red-500/20 to-orange-500/20",
    color: "text-red-500",
  },
  {
    id: "revenue",
    label: "CA & Commandes",
    description: "Chiffre d'affaires, volume et panier moyen",
    icon: <ShoppingCart className="h-6 w-6" />,
    gradient: "from-blue-500/20 to-cyan-500/20",
    color: "text-blue-500",
  },
  {
    id: "rating",
    label: "Notes clients",
    description: "Avis, satisfaction et feedback",
    icon: <Star className="h-6 w-6" />,
    gradient: "from-yellow-500/20 to-amber-500/20",
    color: "text-yellow-500",
  },
  {
    id: "operations",
    label: "Temps opérationnels",
    description: "Préparation et attente coursier",
    icon: <Clock className="h-6 w-6" />,
    gradient: "from-purple-500/20 to-pink-500/20",
    color: "text-purple-500",
  },
  {
    id: "promotions",
    label: "Promotions",
    description: "Offres actives et leur impact",
    icon: <Zap className="h-6 w-6" />,
    gradient: "from-pink-500/20 to-rose-500/20",
    color: "text-pink-500",
  },
  {
    id: "downtime",
    label: "Temps d'inactivité",
    description: "Disponibilité et interruptions de service",
    icon: <PauseCircle className="h-6 w-6" />,
    gradient: "from-slate-500/20 to-gray-500/20",
    color: "text-slate-500",
  },
];

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

const getReportTypeLabel = (type: ReportType, level: DetailLevel): string => {
  const option = REPORT_TYPE_OPTIONS.find(o => o.id === type);
  if (!option) return "Rapport";
  if (type === "ai_global") return "Rapport IA";
  return `${option.label} (${level === "basic" ? "basique" : "détaillé"})`;
};

// Extract short name for display
const getShortName = (name: string) => {
  const cleaned = name.replace(/^CHICKEN STREET\s*/i, "");
  if (cleaned.length > 15) {
    return cleaned.split(/[-\s]/)[0];
  }
  return cleaned;
};

export default function WeeklyReports() {
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState<"templates" | "send" | "history">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<ReportTemplate> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // Unified report selection state
  const [reportType, setReportType] = useState<ReportType>("ai_global");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("basic");
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<Set<string>>(new Set());
  
  // Send state
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generatedKPIs, setGeneratedKPIs] = useState<WeeklyKPIs[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [attachPdf, setAttachPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  
  // PDF export hook
  const { generateReportPdf } = useReportPdfExport();
  
  // History state
  const [expandedHistoryMessages, setExpandedHistoryMessages] = useState<Set<string>>(new Set());

  // Period selection state (replaces fixed lastWeek)
  const [periodStart, setPeriodStart] = useState<Date>(() => {
    const now = new Date();
    return startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  });
  const [periodEnd, setPeriodEnd] = useState<Date>(() => {
    const now = new Date();
    return endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  });
  const [periodPopoverOpen, setPeriodPopoverOpen] = useState(false);

  // LocalStorage persistence keys
  const STORAGE_KEYS = {
    kpis: 'pending-reports-kpis',
    messages: 'pending-reports-messages',
    selectedReports: 'pending-reports-selected',
  };

  // Load persisted reports on mount
  useEffect(() => {
    try {
      const savedKPIs = localStorage.getItem(STORAGE_KEYS.kpis);
      const savedMessages = localStorage.getItem(STORAGE_KEYS.messages);
      const savedSelected = localStorage.getItem(STORAGE_KEYS.selectedReports);
      
      if (savedKPIs) {
        const parsed = JSON.parse(savedKPIs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGeneratedKPIs(parsed);
        }
      }
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          setEditedMessages(parsed);
        }
      }
      if (savedSelected) {
        const parsed = JSON.parse(savedSelected);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedReports(new Set(parsed));
        }
      }
    } catch (e) {
      console.error('Error loading persisted reports:', e);
    }
  }, []);

  // Persist reports when they change
  useEffect(() => {
    if (generatedKPIs.length > 0) {
      localStorage.setItem(STORAGE_KEYS.kpis, JSON.stringify(generatedKPIs));
      localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(editedMessages));
      localStorage.setItem(STORAGE_KEYS.selectedReports, JSON.stringify(Array.from(selectedReports)));
    }
  }, [generatedKPIs, editedMessages, selectedReports]);

  // Clear persisted data after successful send
  const clearPersistedReports = () => {
    localStorage.removeItem(STORAGE_KEYS.kpis);
    localStorage.removeItem(STORAGE_KEYS.messages);
    localStorage.removeItem(STORAGE_KEYS.selectedReports);
  };

  // Week navigation helpers
  const navigateWeek = (offset: number) => {
    setPeriodStart(prev => startOfWeek(addWeeks(prev, offset), { weekStartsOn: 1 }));
    setPeriodEnd(prev => endOfWeek(addWeeks(prev, offset), { weekStartsOn: 1 }));
  };

  const setWeekOffset = (weeksBack: number) => {
    const targetWeek = subWeeks(new Date(), Math.abs(weeksBack));
    setPeriodStart(startOfWeek(targetWeek, { weekStartsOn: 1 }));
    setPeriodEnd(endOfWeek(targetWeek, { weekStartsOn: 1 }));
    setPeriodPopoverOpen(false);
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setPeriodStart(range.from);
    }
    if (range?.to) {
      setPeriodEnd(range.to);
      // Only close if from and to are different (complete range selection)
      if (range.from && range.to && range.from.getTime() !== range.to.getTime()) {
        setPeriodPopoverOpen(false);
      }
    }
  };

  // Fetch templates (for legacy template editor)
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

  // Auto-select all restaurants with WhatsApp on load
  useEffect(() => {
    if (restaurants.length > 0 && selectedRestaurantIds.size === 0) {
      const withWhatsApp = restaurants.filter(r => r.manager_whatsapp).map(r => r.id);
      setSelectedRestaurantIds(new Set(withWhatsApp));
    }
  }, [restaurants]);

  // Fetch report history
  const { data: reportHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["report-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_history")
        .select("*")
        .eq("direction", "outbound")
        .eq("message_type", "report")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
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

  // Generate message based on template (for legacy mode)
  const generateMessage = (kpi: WeeklyKPIs, template: ReportTemplate): string => {
    const dateStart = format(periodStart, "d MMMM", { locale: fr });
    const dateEnd = format(periodEnd, "d MMMM", { locale: fr });
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
      lines.push(`• Moyenne : ${kpi.average_rating !== null ? kpi.average_rating.toFixed(2) : "--"} ${getStatusEmoji(kpi.average_rating, objectives.rating)} (${kpi.review_count} avis)`);
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

  // Unified generate reports function
  const generateUnifiedReports = async () => {
    const restaurantIds = Array.from(selectedRestaurantIds);
    
    if (restaurantIds.length === 0) {
      toast.error("Sélectionnez au moins un restaurant");
      return;
    }

    setIsGenerating(true);

    try {
      if (reportType === "ai_global") {
        // Use generate-ai-report for AI global
        const { data, error } = await supabase.functions.invoke("generate-ai-report", {
          body: {
            restaurant_ids: restaurantIds,
            start_date: format(periodStart, "yyyy-MM-dd"),
            end_date: format(periodEnd, "yyyy-MM-dd"),
            template_context: {
              tone: "standard",
              include_recommendations: true,
              include_error_analysis: true,
            },
          },
        });

        if (error) throw error;

        const reports = data.reports || [];
        const kpis: WeeklyKPIs[] = reports.map((r: any) => r.kpis);
        setGeneratedKPIs(kpis);
        
        const newSelected = new Set<string>();
        const newMessages: Record<string, string> = {};
        
        reports.forEach((report: any) => {
          if (report.manager_whatsapp) {
            newSelected.add(report.restaurant_id);
            newMessages[report.restaurant_id] = report.generated_message;
          }
        });
        
        setSelectedReports(newSelected);
        setEditedMessages(newMessages);
        setActiveTab("send");
        
        toast.success(`${reports.length} rapport(s) IA générés`);
      } else {
        // Use generate-stat-report for specific templates
        const newMessages: Record<string, string> = {};
        const kpis: WeeklyKPIs[] = [];
        const newSelected = new Set<string>();
        let successCount = 0;

        for (const restaurantId of restaurantIds) {
          const restaurant = restaurants.find(r => r.id === restaurantId);
          if (!restaurant?.manager_whatsapp) continue;

          try {
            const { data, error } = await supabase.functions.invoke("generate-stat-report", {
              body: {
                restaurant_id: restaurantId,
                start_date: format(periodStart, "yyyy-MM-dd"),
                end_date: format(periodEnd, "yyyy-MM-dd"),
                template_type: reportType,
                detail_level: detailLevel,
              },
            });

            if (error) throw error;
            if (!data?.report?.generated_message) continue;

            newMessages[restaurantId] = data.report.generated_message;
            newSelected.add(restaurantId);
            
            // Create a minimal KPI object for display
            kpis.push({
              restaurant_id: restaurantId,
              restaurant_name: restaurant.name,
              manager_name: `${restaurant.manager_first_name || ""} ${restaurant.manager_last_name || ""}`.trim() || "Manager",
              manager_whatsapp: restaurant.manager_whatsapp,
              order_count: 0,
              revenue: 0,
              average_basket: 0,
              order_variation: null,
              revenue_variation: null,
              average_rating: null,
              review_count: 0,
              new_customer_percent: null,
              avg_prep_time: null,
              avg_courier_wait: null,
              error_rate: null,
              error_count: 0,
            });

            successCount++;
          } catch (err) {
            console.error(`Error generating report for ${restaurant.name}:`, err);
          }
        }

        setGeneratedKPIs(kpis);
        setSelectedReports(newSelected);
        setEditedMessages(newMessages);
        setActiveTab("send");
        
        toast.success(`${successCount} rapport(s) "${getReportTypeLabel(reportType, detailLevel)}" générés`);
      }
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
        const message = editedMessages[kpi.restaurant_id] || "";
        
        if (!message) {
          failedCount++;
          continue;
        }

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
            report_start_date: format(periodStart, "yyyy-MM-dd"),
            report_end_date: format(periodEnd, "yyyy-MM-dd"),
          },
        });

        if (error) {
          failedCount++;
        } else {
          sentCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Send PDFs if toggle is on
      if (attachPdf && sentCount > 0) {
        const pdfTargets = toSend.filter(k => editedMessages[k.restaurant_id]);
        setPdfProgress({ current: 0, total: pdfTargets.length });
        
        for (let i = 0; i < pdfTargets.length; i++) {
          const kpi = pdfTargets[i];
          setPdfProgress({ current: i + 1, total: pdfTargets.length });
          
          try {
            // Generate PDF blob (async for downtime data fetching)
            const pdfBlob = await generateReportPdf(kpi, {
              periodStart: format(periodStart, "yyyy-MM-dd"),
              periodEnd: format(periodEnd, "yyyy-MM-dd"),
              reportType: reportType as any,
              restaurant_id: kpi.restaurant_id,
            });

            // Upload to whatsapp-media bucket
            const safeName = kpi.restaurant_name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
            const fileName = `report-${safeName}-${format(periodStart, "yyyyMMdd")}.pdf`;
            const filePath = `reports/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from("whatsapp-media")
              .upload(filePath, pdfBlob, {
                contentType: "application/pdf",
                upsert: true,
              });

            if (uploadError) {
              console.error(`PDF upload error for ${kpi.restaurant_name}:`, uploadError);
              continue;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from("whatsapp-media")
              .getPublicUrl(filePath);

            // Send via WhatsApp media
            await supabase.functions.invoke("send-whatsapp-media", {
              body: {
                phone: kpi.manager_whatsapp,
                mediaUrl: urlData.publicUrl,
                mediaType: "document",
                filename: `Rapport_${safeName}.pdf`,
                caption: `📊 Rapport de synthèse - ${kpi.restaurant_name}`,
                restaurant_id: kpi.restaurant_id,
                recipient_name: kpi.manager_name,
                restaurant_name: kpi.restaurant_name,
              },
            });
          } catch (pdfErr) {
            console.error(`PDF send error for ${kpi.restaurant_name}:`, pdfErr);
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        setPdfProgress(null);
      }

      if (failedCount === 0) {
        toast.success(`${sentCount} rapport(s) envoyé(s) avec succès${attachPdf ? " + PDFs" : ""}`);
        setGeneratedKPIs([]);
        setSelectedReports(new Set());
        setEditedMessages({});
        clearPersistedReports();
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
      setPdfProgress(null);
    }
  };

  // Restaurant selection handlers
  const toggleRestaurantSelection = (id: string) => {
    setSelectedRestaurantIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllRestaurants = () => {
    const withWhatsApp = restaurants.filter(r => r.manager_whatsapp).map(r => r.id);
    setSelectedRestaurantIds(new Set(withWhatsApp));
  };

  const deselectAllRestaurants = () => {
    setSelectedRestaurantIds(new Set());
  };

  // Handlers for legacy template editor
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

  // Count restaurants with WhatsApp
  const restaurantsWithWhatsApp = restaurants.filter(r => r.manager_whatsapp);
  const selectedCount = Array.from(selectedRestaurantIds).filter(id => 
    restaurantsWithWhatsApp.some(r => r.id === id)
  ).length;

  return (
    <div className="space-y-6">
      {/* Premium Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Rapports WhatsApp
          </h2>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateWeek(-1)}
            className="h-9 w-9"
            title="Semaine précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover open={periodPopoverOpen} onOpenChange={setPeriodPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(periodStart, "d MMM", { locale: fr })} - {format(periodEnd, "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              {/* Quick selection buttons with clear labels */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[1, 2, 3, 4].map((offset) => {
                  const weekStart = startOfWeek(subWeeks(new Date(), offset), { weekStartsOn: 1 });
                  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                  const isSelected = periodStart.getTime() === weekStart.getTime() && periodEnd.getTime() === weekEnd.getTime();
                  
                  return (
                    <Button
                      key={offset}
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => setWeekOffset(offset)}
                      className="text-xs flex-col h-auto py-2 min-w-[70px]"
                    >
                      <span className="font-medium">Sem. -{offset}</span>
                      <span className={cn("text-[10px]", isSelected ? "opacity-80" : "opacity-60")}>
                        {format(weekStart, "d", { locale: fr })}-{format(weekEnd, "d MMM", { locale: fr })}
                      </span>
                    </Button>
                  );
                })}
              </div>
              
              {/* Calendar for custom range */}
              <CalendarComponent
                mode="range"
                selected={{ from: periodStart, to: periodEnd }}
                onSelect={handleDateRangeSelect}
                locale={fr}
                numberOfMonths={1}
                disabled={{ after: new Date() }}
                className="pointer-events-auto"
              />
              
              {/* Validation button */}
              <div className="flex justify-end mt-3 pt-3 border-t">
                <Button
                  size="sm"
                  onClick={() => setPeriodPopoverOpen(false)}
                  className="text-xs"
                >
                  Valider la période
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateWeek(1)}
            className="h-9 w-9"
            title="Semaine suivante"
            disabled={periodEnd >= new Date()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "templates" | "send" | "history")}>
        <TabsList className="grid w-full max-w-lg grid-cols-3 p-1 bg-secondary/50 backdrop-blur-sm">
          <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />
            Rapports
          </TabsTrigger>
          <TabsTrigger value="send" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" disabled={generatedKPIs.length === 0}>
            <Send className="h-4 w-4" />
            Envoi ({generatedKPIs.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab - Unified Report Selection */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          {/* Step 1: Report Type Selection */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">1</span>
                Choisir le type de rapport
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Report type grid */}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {REPORT_TYPE_OPTIONS.map((option) => {
                  const isSelected = reportType === option.id;
                  
                  return (
                    <motion.div
                      key={option.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className={cn(
                          "cursor-pointer transition-all duration-300 backdrop-blur-xl border-2 overflow-hidden",
                          "bg-gradient-to-br",
                          option.gradient,
                          isSelected 
                            ? "ring-2 ring-primary border-primary/50 shadow-lg shadow-primary/10" 
                            : "border-border/50 hover:border-primary/30 hover:shadow-md"
                        )}
                        onClick={() => setReportType(option.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "h-12 w-12 rounded-xl flex items-center justify-center transition-colors shrink-0",
                              "bg-background/80 backdrop-blur-sm",
                              option.color
                            )}>
                              {option.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm">{option.label}</h3>
                                {isSelected && (
                                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {option.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Detail level toggle (only for non-AI reports) */}
              {reportType !== "ai_global" && (
                <div className="flex items-center gap-4 pt-2">
                  <Label className="text-sm text-muted-foreground">Niveau de détail :</Label>
                  <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-1">
                    <Button
                      variant={detailLevel === "basic" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDetailLevel("basic")}
                      className="h-8 px-4"
                    >
                      Basique
                    </Button>
                    <Button
                      variant={detailLevel === "detailed" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDetailLevel("detailed")}
                      className="h-8 px-4"
                    >
                      Détaillé
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Restaurant Selection */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">2</span>
                  Sélectionner les restaurants
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllRestaurants}
                    className="h-8 text-xs gap-1"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Tout sélectionner
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllRestaurants}
                    className="h-8 text-xs gap-1"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Tout désélectionner
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedCount} restaurant{selectedCount > 1 ? "s" : ""} sélectionné{selectedCount > 1 ? "s" : ""} sur {restaurantsWithWhatsApp.length}
              </p>
            </CardHeader>
            <CardContent>
              {loadingRestaurants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : restaurantsWithWhatsApp.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun restaurant épinglé avec WhatsApp configuré</p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {restaurants.map((restaurant) => {
                    const hasWhatsApp = !!restaurant.manager_whatsapp;
                    const isSelected = selectedRestaurantIds.has(restaurant.id);
                    
                    return (
                      <div
                        key={restaurant.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                          !hasWhatsApp && "opacity-50 cursor-not-allowed",
                          isSelected 
                            ? "bg-primary/5 border-primary/30" 
                            : "hover:bg-secondary/50 border-border"
                        )}
                        onClick={() => hasWhatsApp && toggleRestaurantSelection(restaurant.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={!hasWhatsApp}
                          onCheckedChange={() => hasWhatsApp && toggleRestaurantSelection(restaurant.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {getShortName(restaurant.name)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {restaurant.manager_first_name} {restaurant.manager_last_name}
                            {!hasWhatsApp && " (pas de WhatsApp)"}
                          </p>
                        </div>
                        {hasWhatsApp && (
                          <Badge variant="outline" className="shrink-0 text-xs bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Generate Button */}
          <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Prêt à générer</h3>
                  <p className="text-sm text-muted-foreground">
                    {getReportTypeLabel(reportType, detailLevel)} pour {selectedCount} restaurant{selectedCount > 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  onClick={generateUnifiedReports}
                  disabled={isGenerating || selectedCount === 0}
                  size="lg"
                  className={cn(
                    "gap-2 shadow-lg",
                    reportType === "ai_global" 
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                      : ""
                  )}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : reportType === "ai_global" ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  Générer les rapports
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Legacy Template Management (collapsed) */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Gérer les templates personnalisés
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => {
                  const style = templateStyles[template.icon] || templateStyles.FileText;
                  
                  return (
                    <Card key={template.id} className="border-dashed">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-secondary/50", style.color)}>
                            {style.icon}
                          </div>
                          <div>
                            <CardTitle className="text-sm">{template.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openEditTemplate(template)}
                          >
                            <Edit3 className="h-3 w-3 mr-1" />
                            Modifier
                          </Button>
                          {!template.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Supprimer ce template ?")) {
                                  deleteTemplateMutation.mutate(template.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <Card 
                  className="border-dashed cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={openNewTemplate}
                >
                  <CardContent className="flex items-center justify-center h-full py-8">
                    <div className="text-center text-muted-foreground">
                      <Plus className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Nouveau template</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="attach-pdf"
                        checked={attachPdf}
                        onCheckedChange={setAttachPdf}
                      />
                      <Label htmlFor="attach-pdf" className="text-sm cursor-pointer flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        Joindre le PDF de synthèse
                      </Label>
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
                  </div>
                </CardContent>
                {/* PDF progress indicator */}
                {pdfProgress && (
                  <div className="px-6 pb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Envoi PDF {pdfProgress.current}/{pdfProgress.total}...
                      </span>
                      <span>{Math.round((pdfProgress.current / pdfProgress.total) * 100)}%</span>
                    </div>
                    <Progress value={(pdfProgress.current / pdfProgress.total) * 100} className="h-2" />
                  </div>
                )}
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
                              
                              {/* Editable message */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Message à envoyer</Label>
                                </div>
                                <Textarea
                                  value={editedMessages[kpi.restaurant_id] || ""}
                                  onChange={(e) => updateMessage(kpi.restaurant_id, e.target.value)}
                                  disabled={!kpi.manager_whatsapp}
                                  className="min-h-[200px] font-mono text-sm"
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

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-6">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reportHistory.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">Aucun historique</h3>
                <p className="text-muted-foreground text-sm">
                  Les rapports envoyés apparaîtront ici
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Group by date */}
              {Object.entries(
                reportHistory.reduce((acc, msg) => {
                  const date = format(new Date(msg.created_at), "yyyy-MM-dd");
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(msg);
                  return acc;
                }, {} as Record<string, typeof reportHistory>)
              ).map(([date, messages]) => (
                <Collapsible key={date} defaultOpen={date === format(new Date(), "yyyy-MM-dd")}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between mb-2">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })}
                        <Badge variant="secondary" className="ml-2">{messages.length}</Badge>
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2">
                    {messages.map((msg) => (
                      <Card key={msg.id} className="border-l-4 border-l-[#25D366]">
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {msg.restaurant_name || msg.recipient_name || "Restaurant"}
                                </span>
                                <Badge 
                                  variant={msg.status === "delivered" || msg.status === "read" ? "outline" : "secondary"}
                                  className={cn(
                                    "text-xs",
                                    msg.status === "delivered" && "border-green-500/30 text-green-600",
                                    msg.status === "read" && "border-blue-500/30 text-blue-600",
                                    msg.status === "failed" && "border-red-500/30 text-red-600"
                                  )}
                                >
                                  {msg.status === "delivered" && <CheckCircle className="h-3 w-3 mr-1" />}
                                  {msg.status === "read" && <Eye className="h-3 w-3 mr-1" />}
                                  {msg.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                                  {msg.status === "delivered" ? "Délivré" : 
                                   msg.status === "read" ? "Lu" : 
                                   msg.status === "failed" ? "Échec" : msg.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(msg.created_at), "HH:mm", { locale: fr })}
                                {msg.recipient_phone && ` • ${msg.recipient_phone}`}
                              </p>
                              
                              {/* Expandable message content */}
                              <Collapsible 
                                open={expandedHistoryMessages.has(msg.id)}
                                onOpenChange={(open) => {
                                  setExpandedHistoryMessages(prev => {
                                    const newSet = new Set(prev);
                                    if (open) {
                                      newSet.add(msg.id);
                                    } else {
                                      newSet.delete(msg.id);
                                    }
                                    return newSet;
                                  });
                                }}
                              >
                                <CollapsibleTrigger asChild>
                                  <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-1">
                                    {expandedHistoryMessages.has(msg.id) ? "Masquer" : "Voir le message"}
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <pre className="mt-2 p-3 bg-secondary/50 rounded-lg text-xs whitespace-pre-wrap font-mono max-h-60 overflow-auto">
                                    {msg.message_content}
                                  </pre>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="content">Contenu</TabsTrigger>
                <TabsTrigger value="objectives">Objectifs</TabsTrigger>
                <TabsTrigger value="schedule">Programmation</TabsTrigger>
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
                  <Textarea
                    value={editingTemplate.intro_template || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev!, intro_template: e.target.value }))}
                    placeholder="📊 Bonjour {prenom}..."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables disponibles : {"{prenom}"}, {"{date_debut}"}, {"{date_fin}"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Message de conclusion</Label>
                  <Textarea
                    value={editingTemplate.outro_template || ""}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev!, outro_template: e.target.value }))}
                    placeholder="💪 Bonne continuation !"
                    className="min-h-[80px]"
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
                              ? "Vous devrez valider avant l'envoi" 
                              : "Envoi automatique sans validation"}
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
            </Tabs>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowTemplateEditor(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => editingTemplate && saveTemplateMutation.mutate(editingTemplate)}
              disabled={!editingTemplate?.name || saveTemplateMutation.isPending}
            >
              {saveTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
