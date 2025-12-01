import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Zap, 
  Camera,
  Euro,
  Gift,
  Megaphone,
  UtensilsCrossed,
  Settings,
  Calendar,
  CalendarIcon,
  ArrowRight,
  Filter,
  Clock,
  Store,
  Package,
  X,
  Search,
  Check,
  ChevronsUpDown,
  MapPin,
  List,
  LayoutGrid,
  Globe,
  Layers,
} from "lucide-react";
import { ActionsCalendar } from "@/components/actions/ActionsCalendar";
import { UberEatsIcon, DeliverooIcon, UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ScopeFilter = "all" | "national" | "local";

interface ActionCategory {
  id: string;
  label: string;
  icon: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
}

interface RestaurantAction {
  id: string;
  restaurant_id: string | null;
  restaurant_ids: string[] | null;
  category: string;
  action_type: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  impact_value: number | null;
  impact_unit: string | null;
  target_item_ids: string[];
  platform: string;
  created_at: string;
  change_context: any;
}

interface Restaurant {
  id: string;
  name: string;
  postal_code: string | null;
  account_manager_name: string | null;
}

const ACTION_TYPES: Record<string, string[]> = {
  visuals: ["Photo principale", "Photos produits", "Bannière", "Logo", "Autre"],
  pricing: ["Hausse de prix", "Baisse de prix", "Nouveau tarif", "Autre"],
  promotions: ["Remise %", "1 acheté = 1 offert", "Remise fixe", "Livraison offerte", "Menu promo", "Autre"],
  marketing: ["Push notification", "Offre nationale", "Sponsoring", "Publicité", "Reportage TV", "Autre"],
  menu: ["Nouveau produit", "Réorganisation menu", "Suppression produit", "Changement catégorie", "Autre"],
  operational: ["Changement horaires", "Fermeture temporaire", "Nouveau livreur", "Formation équipe", "Autre"],
};

// Configuration contextuelle pour chaque type d'action
interface ActionTypeConfig {
  dateType: "single" | "range" | "datetime";
  hasImpact: boolean;
  impactLabel?: string;
  impactUnits?: string[];
  hasProducts: boolean;
  productsRequired?: boolean;
  productsLabel?: string;
}

const ACTION_CONFIG: Record<string, ActionTypeConfig> = {
  // VISUALS
  "Photo principale": { dateType: "single", hasImpact: false, hasProducts: false },
  "Photos produits": { dateType: "single", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits photographiés" },
  "Bannière": { dateType: "range", hasImpact: false, hasProducts: false },
  "Logo": { dateType: "single", hasImpact: false, hasProducts: false },
  
  // PRICING
  "Hausse de prix": { dateType: "single", hasImpact: true, impactLabel: "Augmentation", impactUnits: ["%", "€"], hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  "Baisse de prix": { dateType: "single", hasImpact: true, impactLabel: "Réduction", impactUnits: ["%", "€"], hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  "Nouveau tarif": { dateType: "single", hasImpact: true, impactLabel: "Nouveau prix", impactUnits: ["€"], hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  
  // PROMOTIONS
  "Remise %": { dateType: "range", hasImpact: true, impactLabel: "Remise", impactUnits: ["%"], hasProducts: true, productsRequired: false, productsLabel: "Produits en promo" },
  "1 acheté = 1 offert": { dateType: "range", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  "Remise fixe": { dateType: "range", hasImpact: true, impactLabel: "Montant remise", impactUnits: ["€"], hasProducts: true, productsRequired: false, productsLabel: "Produits en promo" },
  "Livraison offerte": { dateType: "range", hasImpact: false, hasProducts: false },
  "Menu promo": { dateType: "range", hasImpact: true, impactLabel: "Prix menu", impactUnits: ["€"], hasProducts: true, productsRequired: true, productsLabel: "Produits du menu" },
  
  // MARKETING
  "Push notification": { dateType: "datetime", hasImpact: false, hasProducts: true, productsRequired: false, productsLabel: "Produits mis en avant" },
  "Offre nationale": { dateType: "range", hasImpact: true, impactLabel: "Valeur offre", impactUnits: ["%", "€"], hasProducts: false },
  "Sponsoring": { dateType: "range", hasImpact: true, impactLabel: "Budget", impactUnits: ["€"], hasProducts: false },
  "Publicité": { dateType: "range", hasImpact: true, impactLabel: "Budget", impactUnits: ["€"], hasProducts: true, productsRequired: false, productsLabel: "Produits sponsorisés" },
  "Reportage TV": { dateType: "single", hasImpact: false, hasProducts: false },
  
  // MENU
  "Nouveau produit": { dateType: "single", hasImpact: true, impactLabel: "Prix", impactUnits: ["€"], hasProducts: false },
  "Réorganisation menu": { dateType: "single", hasImpact: false, hasProducts: false },
  "Suppression produit": { dateType: "single", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits supprimés" },
  "Changement catégorie": { dateType: "single", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits déplacés" },
  
  // OPERATIONAL
  "Changement horaires": { dateType: "single", hasImpact: false, hasProducts: false },
  "Fermeture temporaire": { dateType: "range", hasImpact: true, impactLabel: "Durée", impactUnits: ["jours"], hasProducts: false },
  "Nouveau livreur": { dateType: "single", hasImpact: false, hasProducts: false },
  "Formation équipe": { dateType: "single", hasImpact: false, hasProducts: false },
  
  // Défaut pour "Autre" et types inconnus - tout affiché
  "Autre": { dateType: "range", hasImpact: true, impactUnits: ["%", "€", "produits", "jours"], hasProducts: true, productsRequired: false },
};

// Helper pour récupérer la config d'un type d'action
const getActionConfig = (actionType: string): ActionTypeConfig => {
  return ACTION_CONFIG[actionType] || ACTION_CONFIG["Autre"];
};

const CATEGORY_ICONS: Record<string, any> = {
  visuals: Camera,
  pricing: Euro,
  promotions: Gift,
  marketing: Megaphone,
  menu: UtensilsCrossed,
  operational: Settings,
};

const CATEGORY_COLORS: Record<string, string> = {
  visuals: "bg-purple-500/10 text-purple-500",
  pricing: "bg-amber-500/10 text-amber-500",
  promotions: "bg-pink-500/10 text-pink-500",
  marketing: "bg-blue-500/10 text-blue-500",
  menu: "bg-emerald-500/10 text-emerald-500",
  operational: "bg-slate-500/10 text-slate-500",
};

export default function RestaurantActions() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedActionId = searchParams.get("highlight");
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  
  // View mode: list or calendar
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  
  // Page-level scope filter
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [scopeRestaurantFilters, setScopeRestaurantFilters] = useState<string[]>([]);
  const [isScopeRestaurantPopoverOpen, setIsScopeRestaurantPopoverOpen] = useState(false);
  const [scopeRestaurantSearch, setScopeRestaurantSearch] = useState("");
  const [scopeRestaurantFilterType, setScopeRestaurantFilterType] = useState<"all" | "department" | "manager">("all");
  const [scopeSelectedDepartment, setScopeSelectedDepartment] = useState<string>("");
  const [scopeSelectedManager, setScopeSelectedManager] = useState<string>("");
  
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [actions, setActions] = useState<RestaurantAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [platformFilters, setPlatformFilters] = useState<string[]>([]);
  const [restaurantFilters, setRestaurantFilters] = useState<string[]>([]);
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<Date | undefined>(undefined);
  // Restaurant list filter states
  const [listRestaurantSearch, setListRestaurantSearch] = useState("");
  const [listRestaurantFilterType, setListRestaurantFilterType] = useState<"all" | "department" | "manager">("all");
  const [listSelectedDepartment, setListSelectedDepartment] = useState<string>("");
  const [listSelectedManager, setListSelectedManager] = useState<string>("");
  const [isListRestaurantPopoverOpen, setIsListRestaurantPopoverOpen] = useState(false);
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>(undefined);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<RestaurantAction | null>(null);
  const [actionToDelete, setActionToDelete] = useState<RestaurantAction | null>(null);
  
  // Drag & drop confirmation state
  const [pendingDrop, setPendingDrop] = useState<{
    actionId: string;
    actionTitle: string;
    originalDate: Date;
    originalEndDate: Date | null;
    newStartDate: Date;
    newEndDate: Date | null;
  } | null>(null);
  
  // Undo state for drag & drop
  const [lastCompletedDrop, setLastCompletedDrop] = useState<{
    actionId: string;
    actionTitle: string;
    originalStartDate: Date;
    originalEndDate: Date | null;
    newStartDate: Date;
    newEndDate: Date | null;
  } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    restaurant_ids: [] as string[],
    category: "",
    action_type: "",
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    impact_value: "",
    impact_unit: "",
    target_item_ids: [] as string[],
    platform: "",
  });
  const [customActionType, setCustomActionType] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [productScope, setProductScope] = useState<"all" | "specific">("all");
  const [productSearch, setProductSearch] = useState("");
  // BOGO (1 acheté = 1 offert) specific state
  const [bogoPurchasedItem, setBogoPurchasedItem] = useState<string>("");
  const [bogoFreeItem, setBogoFreeItem] = useState<string>("");
  // Restaurant search with filters
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [isRestaurantPopoverOpen, setIsRestaurantPopoverOpen] = useState(false);
  const [restaurantFilterType, setRestaurantFilterType] = useState<"all" | "department" | "manager">("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedManager, setSelectedManager] = useState<string>("");

  useEffect(() => {
    fetchCategories();
    fetchMenuItems();
    fetchRestaurants();
    fetchActions();
  }, []);

  // Handle scrolling to highlighted action when coming from analytics
  useEffect(() => {
    if (highlightedActionId && actions.length > 0 && highlightedRowRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "center" 
        });
      }, 100);

      // Clear the highlight param after 3 seconds
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [highlightedActionId, actions, setSearchParams]);

  // Ctrl+Z to undo last drag & drop
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && lastCompletedDrop) {
        e.preventDefault();
        
        const updateData: any = {
          start_date: format(lastCompletedDrop.originalStartDate, "yyyy-MM-dd"),
        };
        if (lastCompletedDrop.originalEndDate) {
          updateData.end_date = format(lastCompletedDrop.originalEndDate, "yyyy-MM-dd");
        }
        
        const { error } = await supabase
          .from("restaurant_actions")
          .update(updateData)
          .eq("id", lastCompletedDrop.actionId);
        
        if (error) {
          toast({ 
            title: "Erreur", 
            description: "Impossible d'annuler le déplacement", 
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Déplacement annulé", 
            description: `"${lastCompletedDrop.actionTitle}" restauré au ${format(lastCompletedDrop.originalStartDate, "d MMMM yyyy", { locale: fr })}` 
          });
          setLastCompletedDrop(null);
          fetchActions();
        }
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lastCompletedDrop, toast]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("action_categories")
      .select("*")
      .order("id");

    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setMenuItems(data);
    }
  };

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, postal_code, account_manager_name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setRestaurants(data);
    }
  };

  const fetchActions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurant_actions")
      .select("*")
      .order("start_date", { ascending: false });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les actions",
        variant: "destructive",
      });
    } else {
      setActions(data || []);
    }
    setLoading(false);
  };

  const openCreateDialog = (initialDates?: { start_date?: string; end_date?: string }) => {
    setEditingAction(null);
    setFormData({
      restaurant_ids: [],
      category: "",
      action_type: "",
      title: "",
      description: "",
      start_date: initialDates?.start_date || "",
      end_date: initialDates?.end_date || "",
      impact_value: "",
      impact_unit: "",
      target_item_ids: [],
      platform: "",
    });
    setCustomActionType("");
    setNewProductName("");
    setProductScope("all");
    setProductSearch("");
    setBogoPurchasedItem("");
    setBogoFreeItem("");
    setRestaurantFilterType("all");
    setSelectedDepartment("");
    setSelectedManager("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (action: RestaurantAction) => {
    setEditingAction(action);
    const categoryTypes = ACTION_TYPES[action.category] || [];
    const isCustomType = !categoryTypes.includes(action.action_type);
    const changeContext = action.change_context as any;
    
    // Pour les datetime, restaurer l'heure depuis change_context
    const actionConfig = getActionConfig(isCustomType ? "Autre" : action.action_type);
    const timeValue = actionConfig.dateType === "datetime" && changeContext?.time 
      ? changeContext.time 
      : (action.end_date || "");
    
    // Utiliser restaurant_ids si disponible, sinon fallback sur restaurant_id
    const restaurantIds = action.restaurant_ids && action.restaurant_ids.length > 0 
      ? action.restaurant_ids 
      : (action.restaurant_id ? [action.restaurant_id] : []);
    
    setFormData({
      restaurant_ids: restaurantIds,
      category: action.category,
      action_type: isCustomType ? "Autre" : action.action_type,
      title: action.title,
      description: action.description || "",
      start_date: action.start_date,
      end_date: timeValue,
      impact_value: action.impact_value?.toString() || "",
      impact_unit: action.impact_unit || "",
      target_item_ids: action.target_item_ids || [],
      platform: action.platform,
    });
    setCustomActionType(isCustomType ? action.action_type : "");
    // Récupérer le nom du nouveau produit et la portée depuis change_context
    setNewProductName(changeContext?.new_product_name || "");
    // Déterminer la portée: si target_item_ids vide et scope pas défini, c'est "all"
    const savedScope = changeContext?.scope;
    if (savedScope) {
      setProductScope(savedScope);
    } else {
      // Fallback: si des produits sont sélectionnés, c'est "specific"
      setProductScope(action.target_item_ids && action.target_item_ids.length > 0 ? "specific" : "all");
    }
    setProductSearch("");
    // BOGO specific
    setBogoPurchasedItem(changeContext?.bogo_purchased_item || "");
    setBogoFreeItem(changeContext?.bogo_free_item || "");
    setRestaurantFilterType("all");
    setSelectedDepartment("");
    setSelectedManager("");
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const finalActionType = formData.action_type === "Autre" ? customActionType.trim() : formData.action_type;
    const config = getActionConfig(formData.action_type);
    
    // Validation de base
    if (!formData.category || !finalActionType || !formData.title || !formData.start_date || !formData.platform) {
      toast({
        title: "Erreur",
        description: formData.action_type === "Autre" && !customActionType.trim()
          ? "Veuillez préciser le type d'action personnalisé"
          : "Veuillez remplir tous les champs obligatoires (catégorie, type, titre, date, plateforme)",
        variant: "destructive",
      });
      return;
    }
    
    // Validation: date de fin >= date de début
    if (formData.end_date && config.dateType === "range" && formData.end_date < formData.start_date) {
      toast({
        title: "Erreur",
        description: "La date de fin ne peut pas être antérieure à la date de début",
        variant: "destructive",
      });
      return;
    }
    
    // Validation contextuelle: produits obligatoires (uniquement si scope = specific)
    if (config.productsRequired && productScope === "specific" && formData.target_item_ids.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un produit pour ce type d'action",
        variant: "destructive",
      });
      return;
    }
    
    // Validation contextuelle: heure pour datetime
    if (config.dateType === "datetime" && !formData.end_date) {
      toast({
        title: "Erreur",
        description: "Veuillez indiquer l'heure",
        variant: "destructive",
      });
      return;
    }
    
    // Validation contextuelle: nom du nouveau produit
    if (formData.action_type === "Nouveau produit" && !newProductName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez indiquer le nom du nouveau produit",
        variant: "destructive",
      });
      return;
    }
    
    // Validation contextuelle: BOGO (1 acheté = 1 offert)
    if (formData.action_type === "1 acheté = 1 offert" && (!bogoPurchasedItem || !bogoFreeItem)) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner le produit acheté et le produit offert",
        variant: "destructive",
      });
      return;
    }

    // Construire le change_context avec scope et autres données
    const changeContext: any = {};
    if (formData.action_type === "Nouveau produit" && newProductName.trim()) {
      changeContext.new_product_name = newProductName.trim();
    }
    if (formData.action_type === "1 acheté = 1 offert") {
      changeContext.bogo_purchased_item = bogoPurchasedItem;
      changeContext.bogo_free_item = bogoFreeItem;
    } else if (config.hasProducts) {
      changeContext.scope = productScope;
    }
    // Pour les datetime, stocker l'heure dans change_context
    if (config.dateType === "datetime" && formData.end_date) {
      changeContext.time = formData.end_date;
    }
    
    // Préparer les données de l'action - une seule entrée avec restaurant_ids[]
    const actionData = {
      restaurant_id: formData.restaurant_ids.length === 1 ? formData.restaurant_ids[0] : null,
      restaurant_ids: formData.restaurant_ids.length > 0 ? formData.restaurant_ids : [],
      category: formData.category,
      action_type: finalActionType,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      start_date: formData.start_date,
      end_date: config.dateType === "datetime" ? null : (formData.end_date || null),
      impact_value: formData.impact_value ? parseFloat(formData.impact_value) : null,
      impact_unit: formData.impact_unit || null,
      target_item_ids: productScope === "all" ? [] : formData.target_item_ids,
      platform: formData.platform,
      change_context: Object.keys(changeContext).length > 0 ? changeContext : null,
    };

    if (editingAction) {
      const { error } = await supabase
        .from("restaurant_actions")
        .update(actionData)
        .eq("id", editingAction.id);

      if (error) {
        toast({ title: "Erreur", description: "Impossible de modifier l'action", variant: "destructive" });
        return;
      }
      toast({ title: "Succès", description: "Action modifiée" });
    } else {
      const { error } = await supabase
        .from("restaurant_actions")
        .insert([actionData]);

      if (error) {
        toast({ title: "Erreur", description: "Impossible de créer l'action", variant: "destructive" });
        return;
      }
      toast({ title: "Succès", description: "Action créée" });
    }

    setIsDialogOpen(false);
    fetchActions();
  };

  const handleDelete = async () => {
    if (!actionToDelete) return;

    const { error } = await supabase
      .from("restaurant_actions")
      .delete()
      .eq("id", actionToDelete.id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer l'action", variant: "destructive" });
      return;
    }

    toast({ title: "Succès", description: "Action supprimée" });
    setIsDeleteDialogOpen(false);
    setActionToDelete(null);
    fetchActions();
  };

  // Helper pour déterminer le statut d'une action
  const getActionStatus = (action: RestaurantAction): "en_cours" | "programmee" | "terminee" => {
    const now = new Date();
    const startDate = new Date(action.start_date);
    
    if (startDate > now) {
      return "programmee";
    }
    
    if (action.end_date) {
      const endDate = new Date(action.end_date);
      if (endDate < now) {
        return "terminee";
      }
    }
    
    return "en_cours";
  };

  // Helper to check if an action is national
  const isNational = (action: RestaurantAction): boolean => {
    return !action.restaurant_ids?.length && !action.restaurant_id;
  };
  
  // Scope-filtered actions (applied first, affects everything)
  const scopedActions = actions.filter(a => {
    if (scopeFilter === "all") return true;
    if (scopeFilter === "national") return isNational(a);
    // local scope
    if (scopeRestaurantFilters.length === 0) return !isNational(a);
    const actionRestaurantIds = a.restaurant_ids && a.restaurant_ids.length > 0 
      ? a.restaurant_ids 
      : (a.restaurant_id ? [a.restaurant_id] : []);
    return scopeRestaurantFilters.some(id => actionRestaurantIds.includes(id));
  });
  
  // Stats based on scoped actions
  const nationalCount = actions.filter(a => isNational(a)).length;
  const localCount = actions.filter(a => !isNational(a)).length;
  
  const filteredActions = scopedActions
    .filter(a => categoryFilters.length === 0 || categoryFilters.includes(a.category))
    .filter(a => platformFilters.length === 0 || platformFilters.includes(a.platform))
    .filter(a => {
      if (restaurantFilters.length === 0) return true;
      // Check restaurant_ids array first, then fallback to restaurant_id
      const actionRestaurantIds = a.restaurant_ids && a.restaurant_ids.length > 0 
        ? a.restaurant_ids 
        : (a.restaurant_id ? [a.restaurant_id] : []);
      return restaurantFilters.some(filterId => actionRestaurantIds.includes(filterId));
    })
    .filter(a => actionTypeFilter === "all" || a.action_type === actionTypeFilter)
    .filter(a => {
      if (statusFilter === "all") return true;
      return getActionStatus(a) === statusFilter;
    })
    .filter(a => {
      if (!startDateFilter) return true;
      const actionDate = new Date(a.start_date);
      return actionDate >= startDateFilter;
    })
    .filter(a => {
      if (!endDateFilter) return true;
      const actionDate = new Date(a.start_date);
      return actionDate <= endDateFilter;
    });
  
  // Récupérer tous les types d'action uniques
  const uniqueActionTypes = [...new Set(scopedActions.map(a => a.action_type))].sort();

  const clearDateFilters = () => {
    setStartDateFilter(undefined);
    setEndDateFilter(undefined);
  };

  const getCategoryLabel = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.label || categoryId;
  };

  const getRestaurantName = (restaurantId: string | null) => {
    if (!restaurantId) return null;
    return restaurants.find(r => r.id === restaurantId)?.name || null;
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
  };

  // Cross-filtered action sets for dynamic counters
  // Actions filtered by category only (for platform counters)
  const actionsFilteredByCategory = scopedActions.filter(a => 
    categoryFilters.length === 0 || categoryFilters.includes(a.category)
  );
  
  // Actions filtered by platform only (for category counters)
  const actionsFilteredByPlatform = scopedActions.filter(a => 
    platformFilters.length === 0 || platformFilters.includes(a.platform)
  );
  
  // Actions filtered by both (for general counters)
  const actionsFilteredByBoth = scopedActions.filter(a => 
    (categoryFilters.length === 0 || categoryFilters.includes(a.category)) &&
    (platformFilters.length === 0 || platformFilters.includes(a.platform))
  );

  // Stats with cross-filtering
  const totalActionsRaw = actionsFilteredByBoth.length;
  const activeActionsRaw = actionsFilteredByBoth.filter(a => !a.end_date || new Date(a.end_date) >= new Date()).length;
  const uberActionsRaw = actionsFilteredByCategory.filter(a => a.platform === "uber_eats").length;
  const deliverooActionsRaw = actionsFilteredByCategory.filter(a => a.platform === "deliveroo").length;
  
  // Animated counters
  const totalActions = useAnimatedCounter(totalActionsRaw, 600);
  const activeActions = useAnimatedCounter(activeActionsRaw, 600);
  const uberActions = useAnimatedCounter(uberActionsRaw, 600);
  const deliverooActions = useAnimatedCounter(deliverooActionsRaw, 600);
  
  // Category counters filtered by selected platforms
  const actionsByCategory = categories.map(cat => ({
    ...cat,
    count: actionsFilteredByPlatform.filter(a => a.category === cat.id).length
  }));

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            Actions & Événements
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivez les actions par plateforme pour analyser leur impact sur les performances
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Liste</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setViewMode("calendar")}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Calendrier</span>
            </Button>
          </div>
          <Button onClick={() => openCreateDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle action
          </Button>
        </div>
      </div>

      {/* Page-Level Scope Filter */}
      <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Portée :</span>
              <div className="flex items-center bg-background rounded-lg p-0.5 border shadow-sm">
                <Button
                  variant={scopeFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-sm transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md",
                    scopeFilter === "all" && "animate-[subtle-pulse_2s_ease-in-out_infinite]"
                  )}
                  onClick={() => {
                    setScopeFilter("all");
                    setScopeRestaurantFilters([]);
                  }}
                >
                  <Layers className="h-4 w-4" />
                  Toutes
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs overflow-hidden">
                    <motion.span
                      key={actions.length}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      {actions.length}
                    </motion.span>
                  </Badge>
                </Button>
                <Button
                  variant={scopeFilter === "national" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-sm transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md",
                    scopeFilter === "national" && "animate-[subtle-pulse_2s_ease-in-out_infinite]"
                  )}
                  onClick={() => {
                    setScopeFilter("national");
                    setScopeRestaurantFilters([]);
                  }}
                >
                  <Globe className="h-4 w-4" />
                  Nationales
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-blue-500/10 text-blue-600 overflow-hidden">
                    <motion.span
                      key={nationalCount}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      {nationalCount}
                    </motion.span>
                  </Badge>
                </Button>
                <Button
                  variant={scopeFilter === "local" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-sm transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md",
                    scopeFilter === "local" && "animate-[subtle-pulse_2s_ease-in-out_infinite]"
                  )}
                  onClick={() => setScopeFilter("local")}
                >
                  <Store className="h-4 w-4" />
                  Par restaurant
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-emerald-500/10 text-emerald-600 overflow-hidden">
                    <motion.span
                      key={localCount}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      {localCount}
                    </motion.span>
                  </Badge>
                </Button>
              </div>
            </div>
            
            {/* Restaurant Selector for Local Scope */}
            <AnimatePresence>
              {scopeFilter === "local" && (
                <motion.div
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex items-center gap-2 flex-1"
                >
                  <Popover open={isScopeRestaurantPopoverOpen} onOpenChange={setIsScopeRestaurantPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isScopeRestaurantPopoverOpen}
                      className="w-[280px] justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                        {scopeRestaurantFilters.length === 0
                          ? "Tous les restaurants locaux"
                          : scopeRestaurantFilters.length === 1
                          ? restaurants.find(r => r.id === scopeRestaurantFilters[0])?.name
                          : `${scopeRestaurantFilters.length} restaurants sélectionnés`}
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="p-3 border-b space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher..."
                          value={scopeRestaurantSearch}
                          onChange={(e) => setScopeRestaurantSearch(e.target.value)}
                          className="pl-9 h-9"
                        />
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant={scopeRestaurantFilterType === "all" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setScopeRestaurantFilterType("all")}
                        >
                          Tous
                        </Button>
                        <Button
                          variant={scopeRestaurantFilterType === "department" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setScopeRestaurantFilterType("department")}
                        >
                          <MapPin className="h-3 w-3" />
                          Département
                        </Button>
                        <Button
                          variant={scopeRestaurantFilterType === "manager" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setScopeRestaurantFilterType("manager")}
                        >
                          Manager
                        </Button>
                      </div>
                      
                      {scopeRestaurantFilterType === "department" && (
                        <Select value={scopeSelectedDepartment} onValueChange={setScopeSelectedDepartment}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Choisir un département" />
                          </SelectTrigger>
                          <SelectContent>
                            {[...new Set(restaurants.filter(r => r.postal_code).map(r => r.postal_code!.substring(0, 2)))].sort().map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept} ({restaurants.filter(r => r.postal_code?.startsWith(dept)).length})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {scopeRestaurantFilterType === "manager" && (
                        <Select value={scopeSelectedManager} onValueChange={setScopeSelectedManager}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Choisir un account manager" />
                          </SelectTrigger>
                          <SelectContent>
                            {[...new Set(restaurants.filter(r => r.account_manager_name).map(r => r.account_manager_name!))].sort().map((manager) => (
                              <SelectItem key={manager} value={manager}>
                                {manager} ({restaurants.filter(r => r.account_manager_name === manager).length})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    
                    <div className="max-h-[250px] overflow-y-auto p-2">
                      {(() => {
                        let filtered = restaurants;
                        
                        if (scopeRestaurantSearch) {
                          const search = scopeRestaurantSearch.toLowerCase();
                          filtered = filtered.filter(r => 
                            r.name.toLowerCase().includes(search) ||
                            r.postal_code?.toLowerCase().includes(search) ||
                            r.account_manager_name?.toLowerCase().includes(search)
                          );
                        }
                        
                        if (scopeRestaurantFilterType === "department" && scopeSelectedDepartment) {
                          filtered = filtered.filter(r => r.postal_code?.startsWith(scopeSelectedDepartment));
                        }
                        
                        if (scopeRestaurantFilterType === "manager" && scopeSelectedManager) {
                          filtered = filtered.filter(r => r.account_manager_name === scopeSelectedManager);
                        }
                        
                        if (filtered.length === 0) {
                          return <p className="text-sm text-muted-foreground text-center py-4">Aucun restaurant trouvé</p>;
                        }
                        
                        return (
                          <>
                            <div className="flex justify-between mb-2 px-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setScopeRestaurantFilters([...new Set([...scopeRestaurantFilters, ...filtered.map(r => r.id)])])}
                              >
                                Tout sélectionner
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-muted-foreground"
                                onClick={() => setScopeRestaurantFilters(scopeRestaurantFilters.filter(id => !filtered.find(r => r.id === id)))}
                              >
                                Désélectionner
                              </Button>
                            </div>
                            {filtered.map((restaurant) => (
                              <div
                                key={restaurant.id}
                                className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                                onClick={() => {
                                  const isSelected = scopeRestaurantFilters.includes(restaurant.id);
                                  if (isSelected) {
                                    setScopeRestaurantFilters(scopeRestaurantFilters.filter(id => id !== restaurant.id));
                                  } else {
                                    setScopeRestaurantFilters([...scopeRestaurantFilters, restaurant.id]);
                                  }
                                }}
                              >
                                <Checkbox checked={scopeRestaurantFilters.includes(restaurant.id)} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">{restaurant.name}</p>
                                  {(restaurant.postal_code || restaurant.account_manager_name) && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {restaurant.postal_code?.substring(0, 2)}
                                      {restaurant.postal_code && restaurant.account_manager_name && " • "}
                                      {restaurant.account_manager_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                    
                    <div className="p-2 border-t flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {scopeRestaurantFilters.length} / {restaurants.length} sélectionné(s)
                      </span>
                      {scopeRestaurantFilters.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setScopeRestaurantFilters([])}
                        >
                          Effacer
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Display selected restaurants as badges */}
                {scopeRestaurantFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <AnimatePresence mode="popLayout">
                      {scopeRestaurantFilters.slice(0, 3).map((id, index) => {
                        const r = restaurants.find(r => r.id === id);
                        return r ? (
                          <motion.div
                            key={id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15, delay: index * 0.05 }}
                          >
                            <Badge 
                              variant="secondary" 
                              className="gap-1 cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => setScopeRestaurantFilters(scopeRestaurantFilters.filter(rid => rid !== id))}
                            >
                              {r.name}
                              <X className="h-3 w-3" />
                            </Badge>
                          </motion.div>
                        ) : null;
                      })}
                      {scopeRestaurantFilters.length > 3 && (
                        <motion.div
                          key="more"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15, delay: 0.15 }}
                        >
                          <Badge variant="outline">+{scopeRestaurantFilters.length - 3}</Badge>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalActions}</p>
                <p className="text-xs text-muted-foreground">Actions total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeActions}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <motion.div
          className="h-full"
          animate={{ 
            scale: platformFilters.includes("uber_eats") ? 1.03 : 1 
          }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          whileHover={uberActionsRaw > 0 ? { scale: 1.02 } : undefined}
          whileTap={uberActionsRaw > 0 ? { scale: 0.98 } : undefined}
        >
          <Card 
            className={cn(
              "cursor-pointer transition-shadow duration-200 hover:shadow-md relative overflow-hidden h-full",
              "bg-[#06C167]/10",
              platformFilters.includes("uber_eats") && "ring-2 ring-[#06C167] shadow-md",
              uberActionsRaw === 0 && "opacity-40 pointer-events-none"
            )}
            onClick={() => setPlatformFilters(prev => 
              prev.includes("uber_eats") 
                ? prev.filter(p => p !== "uber_eats") 
                : [...prev, "uber_eats"]
            )}
          >
            <CardContent className="pt-6 h-full flex items-center justify-center">
              <UberEatsLogo size={56} />
              <div className="absolute top-2 right-2 bg-[#06C167] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {uberActions}
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          className="h-full"
          animate={{ 
            scale: platformFilters.includes("deliveroo") ? 1.03 : 1 
          }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          whileHover={deliverooActionsRaw > 0 ? { scale: 1.02 } : undefined}
          whileTap={deliverooActionsRaw > 0 ? { scale: 0.98 } : undefined}
        >
          <Card 
            className={cn(
              "cursor-pointer transition-shadow duration-200 hover:shadow-md relative overflow-hidden h-full",
              "bg-[#00CCBC]/10",
              platformFilters.includes("deliveroo") && "ring-2 ring-[#00CCBC] shadow-md",
              deliverooActionsRaw === 0 && "opacity-40 pointer-events-none"
            )}
            onClick={() => setPlatformFilters(prev => 
              prev.includes("deliveroo") 
                ? prev.filter(p => p !== "deliveroo") 
                : [...prev, "deliveroo"]
            )}
          >
            <CardContent className="pt-6 h-full flex items-center justify-center">
              <DeliverooLogo size={56} />
              <div className="absolute top-2 right-2 bg-[#00CCBC] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {deliverooActions}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {actionsByCategory.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Zap;
          return (
            <motion.div
              key={cat.id}
              animate={{ 
                scale: categoryFilters.includes(cat.id) ? 1.03 : 1 
              }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              whileHover={cat.count > 0 ? { scale: 1.02 } : undefined}
              whileTap={cat.count > 0 ? { scale: 0.98 } : undefined}
            >
              <Card 
                className={cn(
                  "cursor-pointer transition-shadow duration-200 hover:shadow-md",
                  categoryFilters.includes(cat.id) && "ring-2 ring-primary shadow-md",
                  cat.count === 0 && "opacity-40 pointer-events-none"
                )}
                onClick={() => setCategoryFilters(prev => 
                  prev.includes(cat.id) 
                    ? prev.filter(c => c !== cat.id) 
                    : [...prev, cat.id]
                )}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${CATEGORY_COLORS[cat.id]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        <AnimatedNumber value={cat.count} duration={600} />
                      </p>
                      <p className="text-xs text-muted-foreground">{cat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Actions Header */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <Calendar className="h-3 w-3" />
                {filteredActions.length} actions
              </Badge>
              {categoryFilters.map(catId => (
                <Badge 
                  key={catId}
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setCategoryFilters(prev => prev.filter(c => c !== catId))}
                >
                  <Filter className="h-3 w-3" />
                  {getCategoryLabel(catId)}
                  <span className="ml-1">×</span>
                </Badge>
              ))}
              {platformFilters.map(platform => (
                <Badge 
                  key={platform}
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setPlatformFilters(prev => prev.filter(p => p !== platform))}
                >
                  {platform === "uber_eats" ? <UberEatsIcon className="h-3 w-3" /> : <DeliverooIcon className="h-3 w-3" />}
                  {platform === "uber_eats" ? "Uber Eats" : "Deliveroo"}
                  <span className="ml-1">×</span>
                </Badge>
              ))}
              {restaurantFilters.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setRestaurantFilters([])}
                >
                  <Store className="h-3 w-3" />
                  {restaurantFilters.length === 1 
                    ? restaurants.find(r => r.id === restaurantFilters[0])?.name 
                    : `${restaurantFilters.length} restaurants`}
                  <span className="ml-1">×</span>
                </Badge>
              )}
              {actionTypeFilter !== "all" && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setActionTypeFilter("all")}
                >
                  <Zap className="h-3 w-3" />
                  {actionTypeFilter}
                  <span className="ml-1">×</span>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setStatusFilter("all")}
                >
                  <Clock className="h-3 w-3" />
                  {statusFilter === "en_cours" ? "En cours" : statusFilter === "programmee" ? "Programmée" : "Terminée"}
                  <span className="ml-1">×</span>
                </Badge>
              )}
              {(startDateFilter || endDateFilter) && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={clearDateFilters}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {startDateFilter && format(startDateFilter, "dd/MM/yy", { locale: fr })}
                  {startDateFilter && endDateFilter && " → "}
                  {endDateFilter && format(endDateFilter, "dd/MM/yy", { locale: fr })}
                  <span className="ml-1">×</span>
                </Badge>
              )}
              {(categoryFilters.length > 0 || platformFilters.length > 0 || restaurantFilters.length > 0 || actionTypeFilter !== "all" || statusFilter !== "all" || startDateFilter || endDateFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setCategoryFilters([]);
                    setPlatformFilters([]);
                    setRestaurantFilters([]);
                    setActionTypeFilter("all");
                    setStatusFilter("all");
                    setStartDateFilter(undefined);
                    setEndDateFilter(undefined);
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Réinitialiser
                </Button>
              )}
            </div>
            
            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Platform Filter */}
              <Select 
                value={platformFilters.length === 0 ? "all" : platformFilters.length === 1 ? platformFilters[0] : "multiple"} 
                onValueChange={(val) => {
                  if (val === "all") setPlatformFilters([]);
                  else if (val === "uber_eats" || val === "deliveroo") {
                    setPlatformFilters(prev => 
                      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
                    );
                  }
                }}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Plateforme">
                    {platformFilters.length === 0 ? "Toutes" : 
                     platformFilters.length === 2 ? "Toutes" :
                     platformFilters[0] === "uber_eats" ? "Uber Eats" : "Deliveroo"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="uber_eats">
                    <div className="flex items-center gap-2">
                      <UberEatsIcon className="h-4 w-4" />
                      Uber Eats
                    </div>
                  </SelectItem>
                  <SelectItem value="deliveroo">
                    <div className="flex items-center gap-2">
                      <DeliverooIcon className="h-4 w-4" />
                      Deliveroo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Action Type Filter */}
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Type d'action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {uniqueActionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="en_cours">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      En cours
                    </div>
                  </SelectItem>
                  <SelectItem value="programmee">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      Programmée
                    </div>
                  </SelectItem>
                  <SelectItem value="terminee">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      Terminée
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Restaurant Filter - Advanced */}
              <Popover open={isListRestaurantPopoverOpen} onOpenChange={setIsListRestaurantPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isListRestaurantPopoverOpen}
                    className="w-[200px] h-9 justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                      {restaurantFilters.length === 0
                        ? "Tous les..."
                        : restaurantFilters.length === 1
                        ? restaurants.find(r => r.id === restaurantFilters[0])?.name
                        : `${restaurantFilters.length} restaurants`}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <div className="p-3 border-b space-y-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={listRestaurantSearch}
                        onChange={(e) => setListRestaurantSearch(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    
                    {/* Filter Type Tabs */}
                    <div className="flex gap-1">
                      <Button
                        variant={listRestaurantFilterType === "all" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setListRestaurantFilterType("all")}
                      >
                        Tous
                      </Button>
                      <Button
                        variant={listRestaurantFilterType === "department" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setListRestaurantFilterType("department")}
                      >
                        <MapPin className="h-3 w-3" />
                        Département
                      </Button>
                      <Button
                        variant={listRestaurantFilterType === "manager" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setListRestaurantFilterType("manager")}
                      >
                        Manager
                      </Button>
                    </div>
                    
                    {/* Department/Manager Select */}
                    {listRestaurantFilterType === "department" && (
                      <Select value={listSelectedDepartment} onValueChange={setListSelectedDepartment}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Choisir un département" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set(restaurants.filter(r => r.postal_code).map(r => r.postal_code!.substring(0, 2)))].sort().map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept} ({restaurants.filter(r => r.postal_code?.startsWith(dept)).length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {listRestaurantFilterType === "manager" && (
                      <Select value={listSelectedManager} onValueChange={setListSelectedManager}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Choisir un account manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set(restaurants.filter(r => r.account_manager_name).map(r => r.account_manager_name!))].sort().map((manager) => (
                            <SelectItem key={manager} value={manager}>
                              {manager} ({restaurants.filter(r => r.account_manager_name === manager).length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  {/* Restaurant List */}
                  <div className="max-h-[200px] overflow-y-auto p-2">
                    {(() => {
                      let filtered = restaurants;
                      
                      // Apply search
                      if (listRestaurantSearch) {
                        const search = listRestaurantSearch.toLowerCase();
                        filtered = filtered.filter(r => 
                          r.name.toLowerCase().includes(search) ||
                          r.postal_code?.toLowerCase().includes(search) ||
                          r.account_manager_name?.toLowerCase().includes(search)
                        );
                      }
                      
                      // Apply department filter
                      if (listRestaurantFilterType === "department" && listSelectedDepartment) {
                        filtered = filtered.filter(r => r.postal_code?.startsWith(listSelectedDepartment));
                      }
                      
                      // Apply manager filter
                      if (listRestaurantFilterType === "manager" && listSelectedManager) {
                        filtered = filtered.filter(r => r.account_manager_name === listSelectedManager);
                      }
                      
                      if (filtered.length === 0) {
                        return <p className="text-sm text-muted-foreground text-center py-4">Aucun restaurant trouvé</p>;
                      }
                      
                      return (
                        <>
                          <div className="flex justify-between mb-2 px-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setRestaurantFilters([...new Set([...restaurantFilters, ...filtered.map(r => r.id)])])}
                            >
                              Tout sélectionner
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground"
                              onClick={() => setRestaurantFilters(restaurantFilters.filter(id => !filtered.find(r => r.id === id)))}
                            >
                              Désélectionner
                            </Button>
                          </div>
                          {filtered.map((restaurant) => (
                            <div
                              key={restaurant.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                              onClick={() => {
                                const isSelected = restaurantFilters.includes(restaurant.id);
                                if (isSelected) {
                                  setRestaurantFilters(restaurantFilters.filter(id => id !== restaurant.id));
                                } else {
                                  setRestaurantFilters([...restaurantFilters, restaurant.id]);
                                }
                              }}
                            >
                              <Checkbox checked={restaurantFilters.includes(restaurant.id)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{restaurant.name}</p>
                                {(restaurant.postal_code || restaurant.account_manager_name) && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {restaurant.postal_code?.substring(0, 2)}
                                    {restaurant.postal_code && restaurant.account_manager_name && " • "}
                                    {restaurant.account_manager_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Footer */}
                  <div className="p-2 border-t flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {restaurantFilters.length} / {restaurants.length} sélectionné(s)
                    </span>
                    {restaurantFilters.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setRestaurantFilters([])}
                      >
                        Effacer
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Date Range Filters */}
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 w-[130px] justify-start text-left font-normal",
                        !startDateFilter && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDateFilter ? format(startDateFilter, "dd MMM yyyy", { locale: fr }) : "Début"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDateFilter}
                      onSelect={setStartDateFilter}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 w-[130px] justify-start text-left font-normal",
                        !endDateFilter && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDateFilter ? format(endDateFilter, "dd MMM yyyy", { locale: fr }) : "Fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDateFilter}
                      onSelect={setEndDateFilter}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                {(startDateFilter || endDateFilter) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={clearDateFilters}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <ActionsCalendar
          actions={filteredActions}
          restaurants={restaurants}
          onActionClick={(action) => openEditDialog(action)}
          onActionDelete={(action) => {
            setActionToDelete(action);
            setIsDeleteDialogOpen(true);
          }}
          onDateClick={(date) => {
            openCreateDialog({
              start_date: date.toISOString().split("T")[0]
            });
          }}
          onDateRangeSelect={(startDate, endDate) => {
            openCreateDialog({
              start_date: startDate.toISOString().split("T")[0],
              end_date: endDate.toISOString().split("T")[0]
            });
          }}
          onActionDrop={(actionId, newStartDate, newEndDate) => {
            // Find the action to get its title and original date
            const action = actions.find(a => a.id === actionId);
            if (!action) return;
            
            // Show confirmation dialog
            setPendingDrop({
              actionId,
              actionTitle: action.title,
              originalDate: new Date(action.start_date),
              originalEndDate: action.end_date ? new Date(action.end_date) : null,
              newStartDate,
              newEndDate,
            });
          }}
        />
      )}

      {/* Actions List */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des actions</CardTitle>
            <CardDescription>
              Actions triées par date de début (plus récentes en premier)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {actions.length === 0 
                ? "Aucune action enregistrée"
                : "Aucune action ne correspond aux filtres"
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Plateforme</TableHead>
                    <TableHead className="w-[100px]">Catégorie</TableHead>
                    <TableHead className="min-w-[200px]">Action</TableHead>
                    <TableHead className="w-[160px]">Période</TableHead>
                    <TableHead className="w-[80px]">Impact</TableHead>
                    <TableHead className="w-[120px]">Produits</TableHead>
                    <TableHead className="w-[140px]">Restaurant</TableHead>
                    <TableHead className="text-right w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActions.map((action, index) => {
                    const Icon = CATEGORY_ICONS[action.category] || Zap;
                    const status = getActionStatus(action);
                    const targetItems = menuItems.filter(item => action.target_item_ids?.includes(item.id));
                    const isHighlighted = action.id === highlightedActionId;
                    
                    return (
                      <motion.tr 
                        key={action.id}
                        ref={isHighlighted ? highlightedRowRef : undefined}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          duration: 0.3,
                          delay: Math.min(index * 0.05, 1),
                          ease: "easeOut"
                        }}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                          isHighlighted && "bg-primary/10 animate-pulse ring-2 ring-primary ring-inset"
                        )}
                      >
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${
                            action.platform === "uber_eats" 
                              ? "bg-[#06C167]/10" 
                              : "bg-[#00CCBC]/10"
                          }`}>
                            {action.platform === "uber_eats" ? (
                              <UberEatsIcon className="h-4 w-4" />
                            ) : (
                              <DeliverooIcon className="h-4 w-4" />
                            )}
                            <span className="text-xs font-medium">
                              {action.platform === "uber_eats" ? "Uber" : "Deliveroo"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${CATEGORY_COLORS[action.category]}`}>
                            <Icon className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{getCategoryLabel(action.category)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{action.title}</p>
                            <p className="text-xs text-muted-foreground">{action.action_type}</p>
                            {action.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{action.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 text-sm">
                              <span>{formatDate(action.start_date)}</span>
                              {action.end_date && (
                                <>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span>{formatDate(action.end_date)}</span>
                                </>
                              )}
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-5 whitespace-nowrap shrink-0",
                                status === "en_cours" && "text-emerald-600 border-emerald-200 bg-emerald-50",
                                status === "programmee" && "text-blue-600 border-blue-200 bg-blue-50",
                                status === "terminee" && "text-muted-foreground border-muted bg-muted/30"
                              )}
                            >
                              {status === "en_cours" && "Actif"}
                              {status === "programmee" && "Prévu"}
                              {status === "terminee" && "Fini"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {action.impact_value ? (
                            (() => {
                              const config = getActionConfig(action.action_type);
                              const unit = action.impact_unit || "";
                              const isPercent = unit === "%";
                              const isEuro = unit === "€";
                              const isDays = unit === "jours";
                              
                              // Determine color based on action type
                              const colorClass = 
                                ["Remise %", "Remise fixe", "Baisse de prix"].includes(action.action_type)
                                  ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                : ["Sponsoring", "Publicité"].includes(action.action_type)
                                  ? "text-blue-600 bg-blue-50 border-blue-200"
                                : ["Hausse de prix", "Nouveau tarif", "Nouveau produit", "Menu promo"].includes(action.action_type)
                                  ? "text-amber-600 bg-amber-50 border-amber-200"
                                : "text-muted-foreground bg-muted/50 border-muted";
                              
                              return (
                                <Badge variant="outline" className={cn("font-mono text-xs px-2 py-0.5", colorClass)}>
                                  {isPercent && <span className="mr-0.5 opacity-70">-</span>}
                                  {action.impact_value}
                                  {unit && <span className="ml-0.5 opacity-70">{unit}</span>}
                                </Badge>
                              );
                            })()
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {action.action_type === "Nouveau produit" && action.change_context?.new_product_name ? (
                            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">
                              🆕 {action.change_context.new_product_name}
                            </Badge>
                          ) : action.action_type === "1 acheté = 1 offert" && action.change_context?.bogo_purchased_item ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs">
                                <Badge variant="secondary" className="text-xs">
                                  {menuItems.find(i => i.id === action.change_context.bogo_purchased_item)?.name || "?"}
                                </Badge>
                                <span className="text-muted-foreground">=</span>
                                <Badge variant="secondary" className="text-xs bg-pink-500/10 text-pink-600 border-pink-200">
                                  🎁 {menuItems.find(i => i.id === action.change_context.bogo_free_item)?.name || "?"}
                                </Badge>
                              </div>
                            </div>
                          ) : action.change_context?.scope === "all" ? (
                            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary whitespace-nowrap">
                              <UtensilsCrossed className="h-3 w-3 mr-1" />
                              Carte
                            </Badge>
                          ) : targetItems.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {targetItems.slice(0, 2).map(item => (
                                <Badge key={item.id} variant="secondary" className="text-xs">
                                  {item.name}
                                </Badge>
                              ))}
                              {targetItems.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{targetItems.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            // Get all restaurant ids for this action
                            const actionRestaurantIds = action.restaurant_ids && action.restaurant_ids.length > 0 
                              ? action.restaurant_ids 
                              : (action.restaurant_id ? [action.restaurant_id] : []);
                            
                            if (actionRestaurantIds.length === 0) {
                              return <span className="text-muted-foreground text-xs">Tous</span>;
                            }
                            
                            if (actionRestaurantIds.length === 1) {
                              const name = getRestaurantName(actionRestaurantIds[0]);
                              return (
                                <span className="text-xs truncate max-w-[130px] block">
                                  {name || "Restaurant inconnu"}
                                </span>
                              );
                            }
                            
                            // Multiple restaurants - show count with popover
                            const restaurantNames = actionRestaurantIds
                              .map(id => restaurants.find(r => r.id === id)?.name)
                              .filter(Boolean);
                            
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge 
                                    variant="secondary" 
                                    className="cursor-pointer text-xs hover:bg-secondary/80"
                                  >
                                    <Store className="h-3 w-3 mr-1" />
                                    {actionRestaurantIds.length} restaurants
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0" align="start">
                                  <div className="p-3 border-b">
                                    <p className="text-sm font-medium">
                                      {actionRestaurantIds.length} restaurants associés
                                    </p>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto p-2">
                                    {restaurantNames.map((name, idx) => (
                                      <div key={idx} className="flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted/50 rounded">
                                        <Store className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="truncate">{name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(action)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setActionToDelete(action);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-hidden p-0 gap-0">
          {/* Header */}
          <DialogHeader className="px-8 pt-6 pb-5 border-b bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {editingAction ? "Modifier l'action" : "Nouvelle action"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Enregistrez une action pour suivre son impact sur les performances
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="px-8 py-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Platform Selection - Visual Toggle Buttons */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                Plateforme *
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, platform: "uber_eats" })}
                  className={`flex items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all ${
                    formData.platform === "uber_eats"
                      ? "border-[#06C167] bg-[#06C167]/10 shadow-md shadow-[#06C167]/10"
                      : "border-border hover:border-[#06C167]/50 hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${formData.platform === "uber_eats" ? "bg-[#06C167]/20" : "bg-muted"}`}>
                    <UberEatsLogo size={32} />
                  </div>
                  <span className={`font-semibold text-base ${formData.platform === "uber_eats" ? "text-[#06C167]" : ""}`}>
                    Uber Eats
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, platform: "deliveroo" })}
                  className={`flex items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all ${
                    formData.platform === "deliveroo"
                      ? "border-[#00CCBC] bg-[#00CCBC]/10 shadow-md shadow-[#00CCBC]/10"
                      : "border-border hover:border-[#00CCBC]/50 hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${formData.platform === "deliveroo" ? "bg-[#00CCBC]/20" : "bg-muted"}`}>
                    <DeliverooLogo size={32} />
                  </div>
                  <span className={`font-semibold text-base ${formData.platform === "deliveroo" ? "text-[#00CCBC]" : ""}`}>
                    Deliveroo
                  </span>
                </button>
              </div>
            </div>

            <Separator className="my-2" />

            {/* Category & Type */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                Type d'action
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Catégorie *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, category: value, action_type: "" });
                      setCustomActionType("");
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => {
                        const Icon = CATEGORY_ICONS[cat.id] || Zap;
                        return (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Type *</Label>
                  <Select 
                    value={formData.action_type} 
                    onValueChange={(value) => {
                      const newConfig = getActionConfig(value);
                      const updates: any = { action_type: value };
                      if (!newConfig.hasImpact) {
                        updates.impact_value = "";
                        updates.impact_unit = "";
                      }
                      if (!newConfig.hasProducts) {
                        updates.target_item_ids = [];
                      }
                      if (newConfig.dateType === "single") {
                        updates.end_date = "";
                      }
                      setFormData({ ...formData, ...updates });
                      if (value !== "Autre") setCustomActionType("");
                    }}
                    disabled={!formData.category}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(ACTION_TYPES[formData.category] || []).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom action type input */}
              {formData.action_type === "Autre" && (
                <Input
                  value={customActionType}
                  onChange={(e) => setCustomActionType(e.target.value)}
                  placeholder="Précisez le type d'action..."
                  className={`h-11 ${!customActionType.trim() ? "border-destructive/50" : ""}`}
                />
              )}
            </div>

            <Separator />

            {/* Title & Description */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titre de l'action *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Promo été -20% sur les burgers"
                  className="h-11"
                />
              </div>

              {/* New Product Name */}
              {formData.action_type === "Nouveau produit" && (
                <div className="space-y-2">
                  <Label>Nom du nouveau produit *</Label>
                  <Input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Ex: Double Cheese Bacon"
                    className={`h-11 ${!newProductName.trim() ? "border-destructive/50" : ""}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ce produit sera ajouté au catalogue après son lancement
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground">Description (optionnel)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détails supplémentaires..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            <Separator className="my-2" />

            {/* Dates & Impact */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                Période & Impact
              </div>
              
              {/* Dates - contextual */}
              {(() => {
                const config = getActionConfig(formData.action_type);
                
                if (config.dateType === "datetime") {
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Date *</Label>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Heure *</Label>
                        <Input
                          type="time"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          className="h-11"
                        />
                      </div>
                    </div>
                  );
                } else if (config.dateType === "single") {
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Date *</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value, end_date: "" })}
                        className="h-11"
                      />
                    </div>
                  );
                } else {
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Date de début *</Label>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => {
                            const newStartDate = e.target.value;
                            // Si la date de fin est antérieure à la nouvelle date de début, la réinitialiser
                            const updates: any = { start_date: newStartDate };
                            if (formData.end_date && formData.end_date < newStartDate) {
                              updates.end_date = "";
                            }
                            setFormData({ ...formData, ...updates });
                          }}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Date de fin</Label>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          min={formData.start_date}
                          className="h-11"
                        />
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Impact - contextual */}
              {(() => {
                const config = getActionConfig(formData.action_type);
                if (!config.hasImpact) return null;
                
                const units = config.impactUnits || ["%", "€", "produits", "jours"];
                
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{config.impactLabel || "Valeur"}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.impact_value}
                        onChange={(e) => setFormData({ ...formData, impact_value: e.target.value })}
                        placeholder="Ex: 20"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Unité</Label>
                      <Select 
                        value={formData.impact_unit} 
                        onValueChange={(value) => setFormData({ ...formData, impact_unit: value })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })()}
            </div>

            <Separator className="my-2" />

            {/* Restaurant & Products */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Store className="h-4 w-4 text-blue-600" />
                </div>
                Cible
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Restaurants</Label>
                  {editingAction && formData.restaurant_ids.length > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Pencil className="h-3 w-3" />
                      Cliquez pour modifier
                    </span>
                  )}
                </div>
                
                {/* Selected restaurants display */}
                {formData.restaurant_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/30 border">
                    {formData.restaurant_ids.map(id => {
                      const restaurant = restaurants.find(r => r.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          <span className="truncate max-w-[150px]">{restaurant?.name}</span>
                          <button
                            type="button"
                            onClick={() => setFormData({ 
                              ...formData, 
                              restaurant_ids: formData.restaurant_ids.filter(rid => rid !== id) 
                            })}
                            className="ml-0.5 hover:bg-muted rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    {formData.restaurant_ids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, restaurant_ids: [] })}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Tout effacer
                      </button>
                    )}
                  </div>
                )}

                <Popover open={isRestaurantPopoverOpen} onOpenChange={setIsRestaurantPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isRestaurantPopoverOpen}
                      className="h-11 w-full justify-between font-normal"
                    >
                      {formData.restaurant_ids.length === 0 ? (
                        <span className="text-muted-foreground">Tous les restaurants (global)</span>
                      ) : (
                        <span>{formData.restaurant_ids.length} restaurant(s) sélectionné(s)</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <div className="flex flex-col">
                      {/* Filter tabs */}
                      <div className="flex border-b bg-muted/30">
                        <button
                          type="button"
                          onClick={() => {
                            setRestaurantFilterType("all");
                            setSelectedDepartment("");
                            setSelectedManager("");
                          }}
                          className={cn(
                            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                            restaurantFilterType === "all" 
                              ? "bg-background border-b-2 border-primary text-primary" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Tous
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRestaurantFilterType("department");
                            setSelectedManager("");
                          }}
                          className={cn(
                            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                            restaurantFilterType === "department" 
                              ? "bg-background border-b-2 border-primary text-primary" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Par département
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRestaurantFilterType("manager");
                            setSelectedDepartment("");
                          }}
                          className={cn(
                            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                            restaurantFilterType === "manager" 
                              ? "bg-background border-b-2 border-primary text-primary" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Par account manager
                        </button>
                      </div>

                      {/* Department selector */}
                      {restaurantFilterType === "department" && (
                        <div className="p-3 border-b bg-muted/20">
                          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Choisir un département..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const departments = [...new Set(
                                  restaurants
                                    .filter(r => r.postal_code)
                                    .map(r => r.postal_code!.substring(0, 2))
                                )].sort();
                                return departments.map(dept => {
                                  const count = restaurants.filter(r => r.postal_code?.startsWith(dept)).length;
                                  return (
                                    <SelectItem key={dept} value={dept}>
                                      Département {dept} ({count})
                                    </SelectItem>
                                  );
                                });
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Manager selector */}
                      {restaurantFilterType === "manager" && (
                        <div className="p-3 border-b bg-muted/20">
                          <Select value={selectedManager} onValueChange={setSelectedManager}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Choisir un account manager..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const managers = [...new Set(
                                  restaurants
                                    .filter(r => r.account_manager_name)
                                    .map(r => r.account_manager_name!)
                                )].sort();
                                return managers.map(manager => {
                                  const count = restaurants.filter(r => r.account_manager_name === manager).length;
                                  return (
                                    <SelectItem key={manager} value={manager}>
                                      {manager} ({count})
                                    </SelectItem>
                                  );
                                });
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Search input */}
                      <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                          placeholder="Rechercher un restaurant..."
                          value={restaurantSearch}
                          onChange={(e) => setRestaurantSearch(e.target.value)}
                          className="flex h-9 w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                        />
                        {restaurantSearch && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setRestaurantSearch("")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Restaurant list */}
                      <ScrollArea className="h-[280px]">
                        <div className="pr-3">
                        {(() => {
                          let filtered = restaurants.filter(r =>
                            r.name.toLowerCase().includes(restaurantSearch.toLowerCase())
                          );
                          
                          // Apply department filter
                          if (restaurantFilterType === "department" && selectedDepartment) {
                            filtered = filtered.filter(r => r.postal_code?.startsWith(selectedDepartment));
                          }
                          
                          // Apply manager filter
                          if (restaurantFilterType === "manager" && selectedManager) {
                            filtered = filtered.filter(r => r.account_manager_name === selectedManager);
                          }
                          
                          if (filtered.length === 0) {
                            return (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                Aucun restaurant trouvé
                              </div>
                            );
                          }

                          // Select all button for filtered results
                          const allFilteredSelected = filtered.every(r => formData.restaurant_ids.includes(r.id));
                          
                          return (
                            <>
                              {/* Select all filtered */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (allFilteredSelected) {
                                    setFormData({
                                      ...formData,
                                      restaurant_ids: formData.restaurant_ids.filter(id => !filtered.some(r => r.id === id))
                                    });
                                  } else {
                                    const newIds = [...new Set([...formData.restaurant_ids, ...filtered.map(r => r.id)])];
                                    setFormData({ ...formData, restaurant_ids: newIds });
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors border-b",
                                  allFilteredSelected && "bg-primary/5"
                                )}
                              >
                                <Checkbox checked={allFilteredSelected} className="h-4 w-4" />
                                <span className="font-medium">
                                  {allFilteredSelected ? "Tout désélectionner" : `Tout sélectionner (${filtered.length})`}
                                </span>
                              </button>
                              
                              {filtered.map((restaurant) => {
                                const isSelected = formData.restaurant_ids.includes(restaurant.id);
                                const dept = restaurant.postal_code?.substring(0, 2);
                                return (
                                  <button
                                    key={restaurant.id}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setFormData({
                                          ...formData,
                                          restaurant_ids: formData.restaurant_ids.filter(id => id !== restaurant.id)
                                        });
                                      } else {
                                        setFormData({
                                          ...formData,
                                          restaurant_ids: [...formData.restaurant_ids, restaurant.id]
                                        });
                                      }
                                    }}
                                    className={cn(
                                      "flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors",
                                      isSelected && "bg-primary/5"
                                    )}
                                  >
                                    <Checkbox checked={isSelected} className="h-4 w-4" />
                                    <div className="flex flex-col items-start flex-1 min-w-0">
                                      <span className="truncate w-full text-left">{restaurant.name}</span>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {dept && <span>Dép. {dept}</span>}
                                        {restaurant.account_manager_name && (
                                          <>
                                            {dept && <span>•</span>}
                                            <span className="truncate">{restaurant.account_manager_name}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </>
                          );
                        })()}
                        </div>
                      </ScrollArea>
                      
                      {/* Footer with count */}
                      <div className="border-t px-3 py-2 text-xs text-muted-foreground bg-muted/30 flex justify-between">
                        <span>
                          {formData.restaurant_ids.length} sélectionné(s)
                        </span>
                        <span>
                          {restaurants.length} restaurants au total
                        </span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* BOGO specific - 1 acheté = 1 offert */}
              {formData.action_type === "1 acheté = 1 offert" && menuItems.length > 0 && (
                <div className="space-y-4 p-4 rounded-xl bg-pink-500/5 border border-pink-500/10">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className="p-1.5 rounded-lg bg-pink-500/10">
                      <Gift className="h-4 w-4 text-pink-600" />
                    </div>
                    Produits de l'offre
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Produit acheté */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Produit acheté *
                      </Label>
                      <Select 
                        value={bogoPurchasedItem} 
                        onValueChange={setBogoPurchasedItem}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {menuItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                {item.category && (
                                  <span className="text-xs text-muted-foreground">({item.category})</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Produit offert */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Produit offert *
                      </Label>
                      <Select 
                        value={bogoFreeItem} 
                        onValueChange={setBogoFreeItem}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {menuItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                {item.category && (
                                  <span className="text-xs text-muted-foreground">({item.category})</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {bogoPurchasedItem && bogoFreeItem && (
                    <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                      <p className="text-sm text-center">
                        <span className="font-medium">{menuItems.find(i => i.id === bogoPurchasedItem)?.name}</span>
                        <span className="text-muted-foreground mx-2">acheté =</span>
                        <span className="font-medium text-pink-600">{menuItems.find(i => i.id === bogoFreeItem)?.name}</span>
                        <span className="text-muted-foreground ml-2">offert</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Target Products - contextual with scope selection (not for BOGO) */}
              {(() => {
                const config = getActionConfig(formData.action_type);
                // Skip for BOGO which has its own UI
                if (formData.action_type === "1 acheté = 1 offert") return null;
                if (!config.hasProducts || menuItems.length === 0) return null;
                
                // Group menu items by category
                const groupedItems = menuItems.reduce((acc, item) => {
                  const cat = item.category || "Sans catégorie";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {} as Record<string, MenuItem[]>);
                
                // Filter items by search
                const filteredItems = productSearch.trim() 
                  ? menuItems.filter(item => 
                      item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                      (item.category && item.category.toLowerCase().includes(productSearch.toLowerCase()))
                    )
                  : null;
                
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <Package className="h-4 w-4 text-emerald-600" />
                      </div>
                      Portée de l'action
                    </div>
                    
                    {/* Scope Toggle Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setProductScope("all");
                          setFormData({ ...formData, target_item_ids: [] });
                        }}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          productScope === "all"
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <UtensilsCrossed className={`h-5 w-5 ${productScope === "all" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`font-medium text-sm ${productScope === "all" ? "text-primary" : ""}`}>
                          Toute la carte
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductScope("specific")}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          productScope === "specific"
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <Package className={`h-5 w-5 ${productScope === "specific" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`font-medium text-sm ${productScope === "specific" ? "text-primary" : ""}`}>
                          Certains produits
                        </span>
                      </button>
                    </div>
                    
                    {/* Product Selection - only shown when scope is "specific" */}
                    {productScope === "specific" && (
                      <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            {config.productsLabel || "Produits concernés"}
                            {config.productsRequired && <span className="text-destructive">*</span>}
                          </Label>
                          {formData.target_item_ids.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {formData.target_item_ids.length} sélectionné(s)
                            </Badge>
                          )}
                        </div>
                        
                        {/* Search bar */}
                        <Input
                          type="text"
                          placeholder="Rechercher un produit..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="h-9"
                        />
                        
                        <div className="border rounded-lg max-h-[180px] overflow-y-auto bg-muted/30">
                          {filteredItems ? (
                            // Flat list when searching
                            <div className="p-2 space-y-1">
                              {filteredItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Aucun produit trouvé</p>
                              ) : (
                                filteredItems.map((item) => (
                                  <label 
                                    key={item.id} 
                                    className={`flex items-center gap-3 cursor-pointer p-2 rounded-md transition-colors ${
                                      formData.target_item_ids.includes(item.id) 
                                        ? "bg-primary/10" 
                                        : "hover:bg-muted"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={formData.target_item_ids.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setFormData({ ...formData, target_item_ids: [...formData.target_item_ids, item.id] });
                                        } else {
                                          setFormData({ ...formData, target_item_ids: formData.target_item_ids.filter(id => id !== item.id) });
                                        }
                                      }}
                                    />
                                    <span className="text-sm flex-1">{item.name}</span>
                                    {item.category && (
                                      <Badge variant="outline" className="text-xs font-normal">{item.category}</Badge>
                                    )}
                                  </label>
                                ))
                              )}
                            </div>
                          ) : (
                            // Grouped by category when not searching
                            <div className="divide-y divide-border">
                              {Object.entries(groupedItems).map(([category, items]) => (
                                <div key={category} className="p-2">
                                  <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                                    {category}
                                  </div>
                                  <div className="space-y-1">
                                    {items.map((item) => (
                                      <label 
                                        key={item.id} 
                                        className={`flex items-center gap-3 cursor-pointer p-2 rounded-md transition-colors ${
                                          formData.target_item_ids.includes(item.id) 
                                            ? "bg-primary/10" 
                                            : "hover:bg-muted"
                                        }`}
                                      >
                                        <Checkbox
                                          checked={formData.target_item_ids.includes(item.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setFormData({ ...formData, target_item_ids: [...formData.target_item_ids, item.id] });
                                            } else {
                                              setFormData({ ...formData, target_item_ids: formData.target_item_ids.filter(id => id !== item.id) });
                                            }
                                          }}
                                        />
                                        <span className="text-sm flex-1">{item.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter className="px-8 py-5 border-t bg-muted/20 flex-shrink-0">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="px-6">
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.platform || !formData.category || !formData.action_type}
              className="gap-2 px-6"
              size="lg"
            >
              {editingAction ? (
                <>
                  <Pencil className="h-4 w-4" />
                  Enregistrer les modifications
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Créer l'action
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette action ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{actionToDelete?.title}" ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drag & Drop Confirmation */}
      <AlertDialog open={!!pendingDrop} onOpenChange={(open) => !open && setPendingDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déplacer cette action ?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Voulez-vous déplacer l'action "{pendingDrop?.actionTitle}" ?</p>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">De</p>
                  <p className="font-medium">
                    {pendingDrop && format(pendingDrop.originalDate, "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">À</p>
                  <p className="font-medium text-primary">
                    {pendingDrop && format(pendingDrop.newStartDate, "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (!pendingDrop) return;
                
                // Store for undo before updating
                const undoData = {
                  actionId: pendingDrop.actionId,
                  actionTitle: pendingDrop.actionTitle,
                  originalStartDate: pendingDrop.originalDate,
                  originalEndDate: pendingDrop.originalEndDate,
                  newStartDate: pendingDrop.newStartDate,
                  newEndDate: pendingDrop.newEndDate,
                };
                
                const updateData: any = {
                  start_date: format(pendingDrop.newStartDate, "yyyy-MM-dd"),
                };
                if (pendingDrop.newEndDate) {
                  updateData.end_date = format(pendingDrop.newEndDate, "yyyy-MM-dd");
                }
                
                const { error } = await supabase
                  .from("restaurant_actions")
                  .update(updateData)
                  .eq("id", pendingDrop.actionId);
                
                if (error) {
                  toast({ 
                    title: "Erreur", 
                    description: "Impossible de déplacer l'action", 
                    variant: "destructive" 
                  });
                } else {
                  // Store for undo
                  setLastCompletedDrop(undoData);
                  
                  toast({ 
                    title: "Action déplacée", 
                    description: (
                      <div className="flex items-center justify-between gap-4">
                        <span>Ctrl+Z pour annuler</span>
                      </div>
                    ),
                  });
                  fetchActions();
                }
                setPendingDrop(null);
              }}
            >
              Déplacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
