import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon, UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [actions, setActions] = useState<RestaurantAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [restaurantFilter, setRestaurantFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<Date | undefined>(undefined);
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>(undefined);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<RestaurantAction | null>(null);
  const [actionToDelete, setActionToDelete] = useState<RestaurantAction | null>(null);
  
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

  const openCreateDialog = () => {
    setEditingAction(null);
    setFormData({
      restaurant_ids: [],
      category: "",
      action_type: "",
      title: "",
      description: "",
      start_date: "",
      end_date: "",
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
    
    setFormData({
      restaurant_ids: action.restaurant_id ? [action.restaurant_id] : [],
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
    
    // Si aucun restaurant sélectionné, on crée une seule action avec restaurant_id = null
    // Sinon on crée une action par restaurant sélectionné
    const restaurantIdsToUse = formData.restaurant_ids.length > 0 ? formData.restaurant_ids : [null];

    if (editingAction) {
      // En édition, on met à jour seulement l'action existante avec le premier restaurant
      const actionData = {
        restaurant_id: formData.restaurant_ids.length > 0 ? formData.restaurant_ids[0] : null,
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
      // En création, on crée une action par restaurant sélectionné
      const actionsToInsert = restaurantIdsToUse.map(restaurantId => ({
        restaurant_id: restaurantId,
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
      }));

      const { error } = await supabase
        .from("restaurant_actions")
        .insert(actionsToInsert);

      if (error) {
        toast({ title: "Erreur", description: "Impossible de créer l'action", variant: "destructive" });
        return;
      }
      toast({ 
        title: "Succès", 
        description: actionsToInsert.length > 1 
          ? `${actionsToInsert.length} actions créées` 
          : "Action créée" 
      });
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

  const filteredActions = actions
    .filter(a => categoryFilter === "all" || a.category === categoryFilter)
    .filter(a => platformFilter === "all" || a.platform === platformFilter)
    .filter(a => restaurantFilter === "all" || a.restaurant_id === restaurantFilter)
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

  // Stats
  const totalActions = actions.length;
  const activeActions = actions.filter(a => !a.end_date || new Date(a.end_date) >= new Date()).length;
  const uberActions = actions.filter(a => a.platform === "uber_eats").length;
  const deliverooActions = actions.filter(a => a.platform === "deliveroo").length;
  
  const actionsByCategory = categories.map(cat => ({
    ...cat,
    count: actions.filter(a => a.category === cat.id).length
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
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle action
        </Button>
      </div>

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
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${platformFilter === "uber_eats" ? 'ring-2 ring-[#06C167]' : ''}`}
          onClick={() => setPlatformFilter(platformFilter === "uber_eats" ? "all" : "uber_eats")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#06C167]/10 rounded-lg">
                <UberEatsIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uberActions}</p>
                <p className="text-xs text-muted-foreground">Uber Eats</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${platformFilter === "deliveroo" ? 'ring-2 ring-[#00CCBC]' : ''}`}
          onClick={() => setPlatformFilter(platformFilter === "deliveroo" ? "all" : "deliveroo")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00CCBC]/10 rounded-lg">
                <DeliverooIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{deliverooActions}</p>
                <p className="text-xs text-muted-foreground">Deliveroo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {actionsByCategory.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Zap;
          return (
            <Card 
              key={cat.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${categoryFilter === cat.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === cat.id ? "all" : cat.id)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${CATEGORY_COLORS[cat.id]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{cat.count}</p>
                    <p className="text-xs text-muted-foreground">{cat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
              {categoryFilter !== "all" && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setCategoryFilter("all")}
                >
                  <Filter className="h-3 w-3" />
                  {getCategoryLabel(categoryFilter)}
                  <span className="ml-1">×</span>
                </Badge>
              )}
              {platformFilter !== "all" && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setPlatformFilter("all")}
                >
                  {platformFilter === "uber_eats" ? <UberEatsIcon className="h-3 w-3" /> : <DeliverooIcon className="h-3 w-3" />}
                  {platformFilter === "uber_eats" ? "Uber Eats" : "Deliveroo"}
                  <span className="ml-1">×</span>
                </Badge>
              )}
              {restaurantFilter !== "all" && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => setRestaurantFilter("all")}
                >
                  <Store className="h-3 w-3" />
                  {restaurants.find(r => r.id === restaurantFilter)?.name || "Restaurant"}
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
            </div>
            
            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Restaurant Filter */}
              <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <Store className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Restaurant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les restaurants</SelectItem>
                  {restaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
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

      {/* Actions List */}
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
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActions.map((action) => {
                    const Icon = CATEGORY_ICONS[action.category] || Zap;
                    const isActive = !action.end_date || new Date(action.end_date) >= new Date();
                    const targetItems = menuItems.filter(item => action.target_item_ids?.includes(item.id));
                    const restaurantName = getRestaurantName(action.restaurant_id);
                    
                    return (
                      <TableRow key={action.id}>
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
                          <div className="flex items-center gap-1 text-sm">
                            <span>{formatDate(action.start_date)}</span>
                            {action.end_date && (
                              <>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span>{formatDate(action.end_date)}</span>
                              </>
                            )}
                          </div>
                          {isActive && (
                            <Badge variant="outline" className="mt-1 text-xs text-emerald-600 border-emerald-200">
                              En cours
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {action.impact_value ? (
                            <span className="font-mono">
                              {action.impact_value}{action.impact_unit || ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
                            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                              <UtensilsCrossed className="h-3 w-3 mr-1" />
                              Toute la carte
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
                          {restaurantName ? (
                            <Badge variant="outline" className="text-xs">
                              {restaurantName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Tous</span>
                          )}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                <Label className="text-xs text-muted-foreground">Restaurants</Label>
                
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
                      <div className="max-h-[280px] overflow-y-auto">
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
    </div>
  );
}
