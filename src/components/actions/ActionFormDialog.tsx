import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { 
  Zap, 
  Camera,
  Euro,
  Gift,
  Megaphone,
  UtensilsCrossed,
  Settings,
  CalendarIcon,
  Store,
  Search,
  Check,
  ChevronsUpDown,
  MapPin,
  Moon,
} from "lucide-react";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ActionFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  initialRestaurantIds?: string[];
  onSuccess?: () => void;
}

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
  events: ["Ramadan", "Aïd el-Fitr", "Aïd el-Adha", "Noël", "Nouvel An", "Autre"],
};

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
  "Photo principale": { dateType: "single", hasImpact: false, hasProducts: false },
  "Photos produits": { dateType: "single", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits photographiés" },
  "Bannière": { dateType: "range", hasImpact: false, hasProducts: false },
  "Logo": { dateType: "single", hasImpact: false, hasProducts: false },
  "Hausse de prix": { dateType: "single", hasImpact: true, impactLabel: "Augmentation", impactUnits: ["%", "€"], hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  "Baisse de prix": { dateType: "single", hasImpact: true, impactLabel: "Réduction", impactUnits: ["%", "€"], hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  "Nouveau tarif": { dateType: "single", hasImpact: true, impactLabel: "Nouveau prix", impactUnits: ["€"], hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  "Remise %": { dateType: "range", hasImpact: true, impactLabel: "Remise", impactUnits: ["%"], hasProducts: true, productsRequired: false, productsLabel: "Produits en promo" },
  "1 acheté = 1 offert": { dateType: "range", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits concernés" },
  "Remise fixe": { dateType: "range", hasImpact: true, impactLabel: "Montant remise", impactUnits: ["€"], hasProducts: true, productsRequired: false, productsLabel: "Produits en promo" },
  "Livraison offerte": { dateType: "range", hasImpact: false, hasProducts: false },
  "Menu promo": { dateType: "range", hasImpact: true, impactLabel: "Prix menu", impactUnits: ["€"], hasProducts: true, productsRequired: true, productsLabel: "Produits du menu" },
  "Push notification": { dateType: "datetime", hasImpact: false, hasProducts: true, productsRequired: false, productsLabel: "Produits mis en avant" },
  "Offre nationale": { dateType: "range", hasImpact: true, impactLabel: "Valeur offre", impactUnits: ["%", "€"], hasProducts: false },
  "Sponsoring": { dateType: "range", hasImpact: true, impactLabel: "Budget", impactUnits: ["€"], hasProducts: false },
  "Publicité": { dateType: "range", hasImpact: true, impactLabel: "Budget", impactUnits: ["€"], hasProducts: true, productsRequired: false, productsLabel: "Produits sponsorisés" },
  "Reportage TV": { dateType: "single", hasImpact: false, hasProducts: false },
  "Nouveau produit": { dateType: "single", hasImpact: true, impactLabel: "Prix", impactUnits: ["€"], hasProducts: false },
  "Réorganisation menu": { dateType: "single", hasImpact: false, hasProducts: false },
  "Suppression produit": { dateType: "single", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits supprimés" },
  "Changement catégorie": { dateType: "single", hasImpact: false, hasProducts: true, productsRequired: true, productsLabel: "Produits déplacés" },
  "Changement horaires": { dateType: "single", hasImpact: false, hasProducts: false },
  "Fermeture temporaire": { dateType: "range", hasImpact: true, impactLabel: "Durée", impactUnits: ["jours"], hasProducts: false },
  "Nouveau livreur": { dateType: "single", hasImpact: false, hasProducts: false },
  "Formation équipe": { dateType: "single", hasImpact: false, hasProducts: false },
  "Ramadan": { dateType: "range", hasImpact: false, hasProducts: false },
  "Aïd el-Fitr": { dateType: "range", hasImpact: false, hasProducts: false },
  "Aïd el-Adha": { dateType: "range", hasImpact: false, hasProducts: false },
  "Noël": { dateType: "range", hasImpact: false, hasProducts: false },
  "Nouvel An": { dateType: "single", hasImpact: false, hasProducts: false },
  "Autre": { dateType: "range", hasImpact: true, impactUnits: ["%", "€", "produits", "jours"], hasProducts: true, productsRequired: false },
};

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
  events: Moon,
};

export function ActionFormDialog({ 
  isOpen, 
  onOpenChange, 
  initialDate, 
  initialRestaurantIds = [],
  onSuccess 
}: ActionFormDialogProps) {
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  
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
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [isRestaurantPopoverOpen, setIsRestaurantPopoverOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchMenuItems();
      fetchRestaurants();
      // Reset form with initial values
      setFormData({
        restaurant_ids: initialRestaurantIds,
        category: "",
        action_type: "",
        title: "",
        description: "",
        start_date: initialDate ? format(initialDate, "yyyy-MM-dd") : "",
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
    }
  }, [isOpen, initialDate, initialRestaurantIds]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("action_categories")
      .select("*")
      .order("id");
    if (data) setCategories(data);
  };

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name");
    if (data) setMenuItems(data);
  };

  const fetchRestaurants = async () => {
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, postal_code, account_manager_name")
      .eq("is_active", true)
      .order("name");
    if (data) setRestaurants(data);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const finalActionType = formData.action_type === "Autre" ? customActionType.trim() : formData.action_type;
    const config = getActionConfig(formData.action_type);
    
    if (!formData.category || !finalActionType || !formData.title || !formData.start_date || !formData.platform) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    const changeContext: any = {};
    if (formData.action_type === "Nouveau produit" && newProductName.trim()) {
      changeContext.new_product_name = newProductName.trim();
    }
    if (config.hasProducts) {
      changeContext.scope = productScope;
    }
    
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

    const { error } = await supabase.from("restaurant_actions").insert([actionData]);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de créer l'action", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Action créée" });
      onOpenChange(false);
      onSuccess?.();
    }
    setLoading(false);
  };

  const config = getActionConfig(formData.action_type);
  const filteredMenuItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(productSearch.toLowerCase())
  );
  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(restaurantSearch.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Nouvelle action</DialogTitle>
              <DialogDescription className="mt-0.5 text-sm">
                {initialDate && `Pour le ${format(initialDate, "d MMMM yyyy", { locale: fr })}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="px-6 py-5 max-h-[calc(85vh-160px)]">
          <div className="space-y-5">
            {/* Platform Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Plateforme *</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, platform: "uber_eats" })}
                  className={cn(
                    "relative flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    formData.platform === "uber_eats"
                      ? "border-[#06C167] bg-[#06C167]/15"
                      : "border-border/50 bg-card hover:border-[#06C167]/50"
                  )}
                >
                  {formData.platform === "uber_eats" && (
                    <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[#06C167] flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  <UberEatsLogo size={24} />
                  <span className="font-medium text-sm">Uber Eats</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, platform: "deliveroo" })}
                  className={cn(
                    "relative flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    formData.platform === "deliveroo"
                      ? "border-[#00CCBC] bg-[#00CCBC]/15"
                      : "border-border/50 bg-card hover:border-[#00CCBC]/50"
                  )}
                >
                  {formData.platform === "deliveroo" && (
                    <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[#00CCBC] flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  <DeliverooLogo size={24} />
                  <span className="font-medium text-sm">Deliveroo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, platform: "all" })}
                  className={cn(
                    "relative flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    formData.platform === "all"
                      ? "border-primary bg-primary/15"
                      : "border-border/50 bg-card hover:border-primary/50"
                  )}
                >
                  {formData.platform === "all" && (
                    <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <UberEatsLogo size={18} />
                    <span className="text-muted-foreground text-xs">+</span>
                    <DeliverooLogo size={18} />
                  </div>
                  <span className="font-medium text-sm">Les deux</span>
                </button>
              </div>
            </div>

            <Separator />

            {/* Category & Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Catégorie *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, category: value, action_type: "" });
                    setCustomActionType("");
                  }}
                >
                  <SelectTrigger className="h-10">
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type *</Label>
                <Select 
                  value={formData.action_type} 
                  onValueChange={(value) => setFormData({ ...formData, action_type: value })}
                  disabled={!formData.category}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(ACTION_TYPES[formData.category] || []).map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.action_type === "Autre" && (
              <Input
                value={customActionType}
                onChange={(e) => setCustomActionType(e.target.value)}
                placeholder="Précisez le type d'action..."
                className="h-10"
              />
            )}

            <Separator />

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Titre de l'action *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Promo été -20% sur les burgers"
                className="h-10"
              />
            </div>

            {/* New Product Name */}
            {formData.action_type === "Nouveau produit" && (
              <div className="space-y-1.5">
                <Label>Nom du nouveau produit *</Label>
                <Input
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Ex: Burger végétarien"
                  className="h-10"
                />
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {config.dateType === "single" ? "Date *" : "Date de début *"}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-10 font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.start_date ? format(new Date(formData.start_date), "d MMMM yyyy", { locale: fr }) : "Sélectionner..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.start_date ? new Date(formData.start_date) : undefined}
                      onSelect={(date) => date && setFormData({ ...formData, start_date: format(date, "yyyy-MM-dd") })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {config.dateType === "range" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date de fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start h-10 font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.end_date ? format(new Date(formData.end_date), "d MMMM yyyy", { locale: fr }) : "Optionnel"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.end_date ? new Date(formData.end_date) : undefined}
                        onSelect={(date) => date && setFormData({ ...formData, end_date: format(date, "yyyy-MM-dd") })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Impact Value */}
            {config.hasImpact && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{config.impactLabel || "Valeur"}</Label>
                  <Input
                    type="number"
                    value={formData.impact_value}
                    onChange={(e) => setFormData({ ...formData, impact_value: e.target.value })}
                    placeholder="Ex: 20"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Unité</Label>
                  <Select value={formData.impact_unit} onValueChange={(v) => setFormData({ ...formData, impact_unit: v })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Unité" />
                    </SelectTrigger>
                    <SelectContent>
                      {(config.impactUnits || ["%", "€"]).map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Restaurant Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Restaurants (optionnel - laisser vide pour tous)</Label>
              <Popover open={isRestaurantPopoverOpen} onOpenChange={setIsRestaurantPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-10">
                    <div className="flex items-center gap-2 truncate">
                      <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                      {formData.restaurant_ids.length === 0
                        ? "Tous les restaurants"
                        : formData.restaurant_ids.length === 1
                        ? restaurants.find(r => r.id === formData.restaurant_ids[0])?.name
                        : `${formData.restaurant_ids.length} restaurants`}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={restaurantSearch}
                        onChange={(e) => setRestaurantSearch(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-2">
                    {filteredRestaurants.map((restaurant) => (
                      <div
                        key={restaurant.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                        onClick={() => {
                          const isSelected = formData.restaurant_ids.includes(restaurant.id);
                          if (isSelected) {
                            setFormData({ ...formData, restaurant_ids: formData.restaurant_ids.filter(id => id !== restaurant.id) });
                          } else {
                            setFormData({ ...formData, restaurant_ids: [...formData.restaurant_ids, restaurant.id] });
                          }
                        }}
                      >
                        <Checkbox checked={formData.restaurant_ids.includes(restaurant.id)} />
                        <span className="text-sm truncate">{restaurant.name}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description (optionnel)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails supplémentaires..."
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : "Créer l'action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
