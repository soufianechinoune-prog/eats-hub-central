import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  UtensilsCrossed, 
  Search,
  Euro,
  Package,
  Calculator,
  ArrowUpDown,
} from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string | null;
  price: number;
  food_cost: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "Entrées",
  "Plats",
  "Burgers",
  "Pizzas",
  "Salades",
  "Desserts",
  "Boissons",
  "Accompagnements",
  "Menus",
  "Snacks",
  "Petit-déjeuner",
  "Autre",
];

export default function MenuItems() {
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    food_cost: "",
    is_active: true,
  });

  // Sort state
  const [sortField, setSortField] = useState<"name" | "category" | "price" | "food_cost">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchMenuItems();
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les restaurants",
        variant: "destructive",
      });
      return;
    }

    setRestaurants(data || []);
  };

  const fetchMenuItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", selectedRestaurant)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive",
      });
    } else {
      setMenuItems(data || []);
    }
    setLoading(false);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "",
      price: "",
      food_cost: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || "",
      price: item.price.toString(),
      food_cost: item.food_cost?.toString() || "",
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du produit est requis",
        variant: "destructive",
      });
      return;
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      toast({
        title: "Erreur",
        description: "Le prix doit être un nombre positif",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      restaurant_id: selectedRestaurant,
      name: formData.name.trim(),
      category: formData.category || null,
      price: parseFloat(formData.price),
      food_cost: formData.food_cost ? parseFloat(formData.food_cost) : null,
      is_active: formData.is_active,
    };

    if (editingItem) {
      // Update
      const { error } = await supabase
        .from("menu_items")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de modifier le produit",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succès",
        description: "Produit modifié avec succès",
      });
    } else {
      // Create
      const { error } = await supabase
        .from("menu_items")
        .insert(itemData);

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de créer le produit",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succès",
        description: "Produit ajouté avec succès",
      });
    }

    setIsDialogOpen(false);
    fetchMenuItems();
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", itemToDelete.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le produit",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Produit supprimé avec succès",
    });

    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
    fetchMenuItems();
  };

  const toggleItemActive = async (item: MenuItem) => {
    const { error } = await supabase
      .from("menu_items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut",
        variant: "destructive",
      });
      return;
    }

    fetchMenuItems();
  };

  // Filter and sort items
  const filteredItems = menuItems
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === "price" || sortField === "food_cost") {
        aVal = aVal || 0;
        bVal = bVal || 0;
      } else {
        aVal = (aVal || "").toLowerCase();
        bVal = (bVal || "").toLowerCase();
      }

      if (sortDirection === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  // Get unique categories from items
  const existingCategories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];

  // Stats
  const totalItems = menuItems.length;
  const activeItems = menuItems.filter(i => i.is_active).length;
  const avgPrice = menuItems.length > 0 
    ? menuItems.reduce((sum, i) => sum + i.price, 0) / menuItems.length 
    : 0;
  const itemsWithFoodCost = menuItems.filter(i => i.food_cost !== null).length;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const calculateMargin = (price: number, foodCost: number | null) => {
    if (!foodCost || foodCost === 0) return null;
    return ((price - foodCost) / price) * 100;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-8 w-8 text-primary" />
            Catalogue Produits
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les produits de vos restaurants pour le suivi des actions et le calcul du food cost
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
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalItems}</p>
                    <p className="text-xs text-muted-foreground">Produits total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Package className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeItems}</p>
                    <p className="text-xs text-muted-foreground">Produits actifs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Euro className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatPrice(avgPrice)}</p>
                    <p className="text-xs text-muted-foreground">Prix moyen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Calculator className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{itemsWithFoodCost}</p>
                    <p className="text-xs text-muted-foreground">Avec food cost</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un produit..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes catégories</SelectItem>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat!}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter un produit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Produits ({filteredItems.length})</CardTitle>
              <CardDescription>
                Liste des produits du restaurant sélectionné
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {menuItems.length === 0 
                    ? "Aucun produit enregistré pour ce restaurant"
                    : "Aucun produit ne correspond aux filtres"
                  }
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Nom
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("category")}
                        >
                          <div className="flex items-center gap-1">
                            Catégorie
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 text-right"
                          onClick={() => handleSort("price")}
                        >
                          <div className="flex items-center gap-1 justify-end">
                            Prix
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 text-right"
                          onClick={() => handleSort("food_cost")}
                        >
                          <div className="flex items-center gap-1 justify-end">
                            Food Cost
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Marge</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const margin = calculateMargin(item.price, item.food_cost);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              {item.category ? (
                                <Badge variant="secondary">{item.category}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatPrice(item.price)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.food_cost ? formatPrice(item.food_cost) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {margin !== null ? (
                                <Badge 
                                  variant={margin >= 70 ? "default" : margin >= 50 ? "secondary" : "destructive"}
                                  className={margin >= 70 ? "bg-emerald-500" : ""}
                                >
                                  {margin.toFixed(1)}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={item.is_active}
                                onCheckedChange={() => toggleItemActive(item)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setItemToDelete(item);
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Modifier le produit" : "Ajouter un produit"}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? "Modifiez les informations du produit"
                : "Renseignez les informations du nouveau produit"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom du produit *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Big Mac, Margherita..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Catégorie</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Prix de vente (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="food_cost">Food Cost (€)</Label>
                <Input
                  id="food_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.food_cost}
                  onChange={(e) => setFormData({ ...formData, food_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Produit actif</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {editingItem ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{itemToDelete?.name}" ? 
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
