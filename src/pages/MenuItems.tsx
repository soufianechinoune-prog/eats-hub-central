import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  TrendingUp,
  Info,
  Filter,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "Menu enfant",
  "Menus Naans",
  "Menus Fried Chicken",
  "Menus Wraps",
  "Menus Burgers",
  "Menus Burgers Naan",
  "Menu Xtra",
  "Fried Chicken",
  "Bowls Street",
  "Burgers",
  "Chicken Cheese",
  "Sandwichs Naans",
  "Burger Naan",
  "Sandwichs Wraps",
  "À partager",
  "Desserts",
  "À la carte",
  "Salades",
  "Boissons",
  "Sauces",
  "Autre",
];

export default function MenuItems() {
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    price_uber: "",
    price_deliveroo: "",
    food_cost: "",
    is_active: true,
  });

  // Sort state
  const [sortField, setSortField] = useState<"name" | "category" | "price_uber" | "price_deliveroo" | "food_cost">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
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
      description: "",
      price_uber: "",
      price_deliveroo: "",
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
      description: item.description || "",
      price_uber: item.price_uber?.toString() || "",
      price_deliveroo: item.price_deliveroo?.toString() || "",
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

    if (!formData.price_uber && !formData.price_deliveroo) {
      toast({
        title: "Erreur",
        description: "Au moins un prix (Uber ou Deliveroo) doit être renseigné",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      name: formData.name.trim(),
      category: formData.category || null,
      description: formData.description.trim() || null,
      price_uber: formData.price_uber ? parseFloat(formData.price_uber) : null,
      price_deliveroo: formData.price_deliveroo ? parseFloat(formData.price_deliveroo) : null,
      food_cost: formData.food_cost ? parseFloat(formData.food_cost) : null,
      is_active: formData.is_active,
    };

    if (editingItem) {
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

  // Filter items
  const filteredItems = menuItems
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(item.category || "");
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === "price_uber" || sortField === "price_deliveroo" || sortField === "food_cost") {
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

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.category || "Sans catégorie";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Sort categories based on CATEGORIES order
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const indexA = CATEGORIES.indexOf(a);
    const indexB = CATEGORIES.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleAllCategories = (expand: boolean) => {
    if (expand) {
      setExpandedCategories(new Set(sortedCategories));
    } else {
      setExpandedCategories(new Set());
    }
  };

  const toggleCategoryFilter = (category: string) => {
    setCategoryFilters(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Get unique categories from items
  const existingCategories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];

  // Stats
  const totalItems = menuItems.length;
  const activeItems = menuItems.filter(i => i.is_active).length;
  
  const itemsWithUberPrice = menuItems.filter(i => i.price_uber !== null);
  const itemsWithDeliverooPrice = menuItems.filter(i => i.price_deliveroo !== null);
  
  const avgPriceUber = itemsWithUberPrice.length > 0 
    ? itemsWithUberPrice.reduce((sum, i) => sum + (i.price_uber || 0), 0) / itemsWithUberPrice.length 
    : 0;
  const avgPriceDeliveroo = itemsWithDeliverooPrice.length > 0 
    ? itemsWithDeliverooPrice.reduce((sum, i) => sum + (i.price_deliveroo || 0), 0) / itemsWithDeliverooPrice.length 
    : 0;
  
  const priceDifference = avgPriceDeliveroo > 0 && avgPriceUber > 0 
    ? ((avgPriceDeliveroo - avgPriceUber) / avgPriceUber) * 100 
    : null;

  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const calculateMargin = (price: number | null, foodCost: number | null) => {
    if (!price || !foodCost || foodCost === 0) return null;
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
            Gérez le catalogue de produits commun avec les prix par plateforme
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <div className="p-2 bg-[#06C167]/10 rounded-lg">
                <UberEatsIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatPrice(avgPriceUber)}</p>
                <p className="text-xs text-muted-foreground">Prix moyen Uber</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00CCBC]/10 rounded-lg">
                <DeliverooIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatPrice(avgPriceDeliveroo)}</p>
                <p className="text-xs text-muted-foreground">Prix moyen Deliveroo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {priceDifference !== null ? `${priceDifference > 0 ? "+" : ""}${priceDifference.toFixed(1)}%` : "-"}
                </p>
                <p className="text-xs text-muted-foreground">Écart prix</p>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      {categoryFilters.length === 0 
                        ? "Toutes catégories" 
                        : `${categoryFilters.length} catégorie${categoryFilters.length > 1 ? 's' : ''}`
                      }
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 bg-popover" align="start">
                  <div className="p-2 border-b">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Filtrer par catégorie</span>
                      {categoryFilters.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs"
                          onClick={() => setCategoryFilters([])}
                        >
                          Effacer
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                    {existingCategories.map((cat) => (
                      <div 
                        key={cat} 
                        className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer"
                        onClick={() => toggleCategoryFilter(cat!)}
                      >
                        <Checkbox 
                          checked={categoryFilters.includes(cat!)}
                          onCheckedChange={() => toggleCategoryFilter(cat!)}
                        />
                        <span className="text-sm flex-1">{cat}</span>
                        <Badge variant="secondary" className="text-xs">
                          {menuItems.filter(i => i.category === cat).length}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {categoryFilters.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {categoryFilters.map(cat => (
                    <Badge key={cat} variant="secondary" className="gap-1">
                      {cat}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => toggleCategoryFilter(cat)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Produits ({filteredItems.length})</CardTitle>
          <CardDescription>
            Catalogue partagé avec prix différenciés par plateforme
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
                ? "Aucun produit dans le catalogue"
                : "Aucun produit ne correspond aux filtres"
              }
            </div>
          ) : (
            <div className="space-y-2">
              {/* Expand/Collapse all */}
              <div className="flex justify-end gap-2 mb-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => toggleAllCategories(true)}
                  className="text-xs"
                >
                  Tout déplier
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => toggleAllCategories(false)}
                  className="text-xs"
                >
                  Tout replier
                </Button>
              </div>

              {sortedCategories.map((category) => {
                const categoryItems = groupedItems[category];
                const isExpanded = expandedCategories.has(category);
                
                return (
                  <Collapsible 
                    key={category} 
                    open={isExpanded}
                    onOpenChange={() => toggleCategoryExpanded(category)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-semibold">{category}</span>
                        <Badge variant="secondary">{categoryItems.length} produit{categoryItems.length > 1 ? 's' : ''}</Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="overflow-x-auto mt-1 border rounded-lg">
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
                                className="cursor-pointer hover:bg-muted/50 text-right"
                                onClick={() => handleSort("price_uber")}
                              >
                                <div className="flex items-center gap-1 justify-end">
                                  <UberEatsIcon className="h-4 w-4" />
                                  Prix Uber
                                  <ArrowUpDown className="h-3 w-3" />
                                </div>
                              </TableHead>
                              <TableHead 
                                className="cursor-pointer hover:bg-muted/50 text-right"
                                onClick={() => handleSort("price_deliveroo")}
                              >
                                <div className="flex items-center gap-1 justify-end">
                                  <DeliverooIcon className="h-4 w-4" />
                                  Prix Deliveroo
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
                              <TableHead className="text-right">Marge Uber</TableHead>
                              <TableHead className="text-right">Marge Deliveroo</TableHead>
                              <TableHead className="text-center">Statut</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categoryItems.map((item) => {
                              const marginUber = calculateMargin(item.price_uber, item.food_cost);
                              const marginDeliveroo = calculateMargin(item.price_deliveroo, item.food_cost);
                              
                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-1">
                                      {item.name}
                                      {item.description && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                              <p className="text-sm">{item.description}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatPrice(item.price_uber)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatPrice(item.price_deliveroo)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {item.food_cost ? formatPrice(item.food_cost) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {marginUber !== null ? (
                                      <Badge 
                                        variant={marginUber >= 70 ? "default" : marginUber >= 50 ? "secondary" : "destructive"}
                                        className={marginUber >= 70 ? "bg-emerald-500" : ""}
                                      >
                                        {marginUber.toFixed(1)}%
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {marginDeliveroo !== null ? (
                                      <Badge 
                                        variant={marginDeliveroo >= 70 ? "default" : marginDeliveroo >= 50 ? "secondary" : "destructive"}
                                        className={marginDeliveroo >= 70 ? "bg-emerald-500" : ""}
                                      >
                                        {marginDeliveroo.toFixed(1)}%
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
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
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
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du produit (ingrédients, composition...)"
                rows={3}
              />
            </div>
            
            {/* Platform-specific prices */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Prix par plateforme *</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <UberEatsIcon className="h-4 w-4" />
                    <Label htmlFor="price_uber" className="text-xs">Prix Uber Eats (€)</Label>
                  </div>
                  <Input
                    id="price_uber"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_uber}
                    onChange={(e) => setFormData({ ...formData, price_uber: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <DeliverooIcon className="h-4 w-4" />
                    <Label htmlFor="price_deliveroo" className="text-xs">Prix Deliveroo (€)</Label>
                  </div>
                  <Input
                    id="price_deliveroo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_deliveroo}
                    onChange={(e) => setFormData({ ...formData, price_deliveroo: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Au moins un prix doit être renseigné
              </p>
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
