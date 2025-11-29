import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowRight,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Restaurant {
  id: string;
  name: string;
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

interface RestaurantAction {
  id: string;
  restaurant_id: string;
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
}

const ACTION_TYPES: Record<string, string[]> = {
  visuals: ["Photo principale", "Photos produits", "Bannière", "Logo"],
  pricing: ["Hausse de prix", "Baisse de prix", "Nouveau tarif"],
  promotions: ["Remise %", "1 acheté = 1 offert", "Remise fixe", "Livraison offerte", "Menu promo"],
  marketing: ["Push notification", "Offre nationale", "Sponsoring", "Publicité"],
  menu: ["Nouveau produit", "Réorganisation menu", "Suppression produit", "Changement catégorie"],
  operational: ["Changement horaires", "Fermeture temporaire", "Nouveau livreur", "Formation équipe"],
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
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [actions, setActions] = useState<RestaurantAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<RestaurantAction | null>(null);
  const [actionToDelete, setActionToDelete] = useState<RestaurantAction | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    category: "",
    action_type: "",
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    impact_value: "",
    impact_unit: "",
    target_item_ids: [] as string[],
    platform: "all",
  });

  useEffect(() => {
    fetchRestaurants();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchActions();
      fetchMenuItems();
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setRestaurants(data);
    }
  };

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
      .eq("restaurant_id", selectedRestaurant)
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setMenuItems(data);
    }
  };

  const fetchActions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurant_actions")
      .select("*")
      .eq("restaurant_id", selectedRestaurant)
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
      category: "",
      action_type: "",
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      impact_value: "",
      impact_unit: "",
      target_item_ids: [],
      platform: "all",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (action: RestaurantAction) => {
    setEditingAction(action);
    setFormData({
      category: action.category,
      action_type: action.action_type,
      title: action.title,
      description: action.description || "",
      start_date: action.start_date,
      end_date: action.end_date || "",
      impact_value: action.impact_value?.toString() || "",
      impact_unit: action.impact_unit || "",
      target_item_ids: action.target_item_ids || [],
      platform: action.platform || "all",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.category || !formData.action_type || !formData.title || !formData.start_date) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    const actionData = {
      restaurant_id: selectedRestaurant,
      category: formData.category,
      action_type: formData.action_type,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      impact_value: formData.impact_value ? parseFloat(formData.impact_value) : null,
      impact_unit: formData.impact_unit || null,
      target_item_ids: formData.target_item_ids,
      platform: formData.platform,
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
        .insert(actionData);

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

  const filteredActions = categoryFilter === "all" 
    ? actions 
    : actions.filter(a => a.category === categoryFilter);

  const getCategoryLabel = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.label || categoryId;
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
  };

  // Stats
  const totalActions = actions.length;
  const activeActions = actions.filter(a => !a.end_date || new Date(a.end_date) >= new Date()).length;
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
            Suivez les actions marketing, changements de prix et événements pour analyser leur impact
          </p>
        </div>
      </div>

      {/* Restaurant Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Sélection du restaurant</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="w-full sm:w-[400px]">
              <SelectValue placeholder="Choisir un restaurant" />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedRestaurant && (
        <>
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
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {totalActions} actions
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-emerald-600">
                    {activeActions} en cours
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
                </div>
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nouvelle action
                </Button>
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
                    ? "Aucune action enregistrée pour ce restaurant"
                    : "Aucune action ne correspond au filtre"
                  }
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead>Impact</TableHead>
                        <TableHead>Produits</TableHead>
                        <TableHead>Plateforme</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActions.map((action) => {
                        const Icon = CATEGORY_ICONS[action.category] || Zap;
                        const isActive = !action.end_date || new Date(action.end_date) >= new Date();
                        const targetItems = menuItems.filter(item => action.target_item_ids?.includes(item.id));
                        
                        return (
                          <TableRow key={action.id}>
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
                              {targetItems.length > 0 ? (
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
                                <span className="text-muted-foreground text-sm">Tous</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {action.platform === "all" ? "Toutes" : action.platform}
                              </Badge>
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
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAction ? "Modifier l'action" : "Nouvelle action"}
            </DialogTitle>
            <DialogDescription>
              Enregistrez une action ou un événement pour suivre son impact sur les performances
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Category & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Catégorie *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value, action_type: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Type d'action *</Label>
                <Select 
                  value={formData.action_type} 
                  onValueChange={(value) => setFormData({ ...formData, action_type: value })}
                  disabled={!formData.category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir..." />
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

            {/* Title */}
            <div className="grid gap-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Promo été -20% sur les burgers"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails de l'action..."
                rows={2}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Impact */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valeur d'impact</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.impact_value}
                  onChange={(e) => setFormData({ ...formData, impact_value: e.target.value })}
                  placeholder="Ex: 20"
                />
              </div>
              <div className="grid gap-2">
                <Label>Unité</Label>
                <Select 
                  value={formData.impact_unit} 
                  onValueChange={(value) => setFormData({ ...formData, impact_unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="€">€</SelectItem>
                    <SelectItem value="produits">produits</SelectItem>
                    <SelectItem value="jours">jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Platform */}
            <div className="grid gap-2">
              <Label>Plateforme</Label>
              <Select 
                value={formData.platform} 
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les plateformes</SelectItem>
                  <SelectItem value="uber_eats">Uber Eats</SelectItem>
                  <SelectItem value="deliveroo">Deliveroo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Products */}
            {menuItems.length > 0 && (
              <div className="grid gap-2">
                <Label>Produits concernés</Label>
                <div className="border rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                  {menuItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.target_item_ids.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, target_item_ids: [...formData.target_item_ids, item.id] });
                          } else {
                            setFormData({ ...formData, target_item_ids: formData.target_item_ids.filter(id => id !== item.id) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{item.name}</span>
                      {item.category && (
                        <Badge variant="secondary" className="text-xs ml-auto">{item.category}</Badge>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.target_item_ids.length === 0 
                    ? "Aucun produit sélectionné = action globale"
                    : `${formData.target_item_ids.length} produit(s) sélectionné(s)`
                  }
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {editingAction ? "Enregistrer" : "Créer"}
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
