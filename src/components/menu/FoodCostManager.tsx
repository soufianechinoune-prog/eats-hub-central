import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Calculator, 
  AlertTriangle, 
  CheckCircle2,
  Plus,
  Package,
  Euro,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  food_cost: number | null;
  food_cost_combo?: number | null;
  is_active: boolean;
}

const CATEGORIES = [
  "Menu enfant",
  "Menus Naans",
  "Menus Fried Chicken",
  "Menus Wraps",
  "Menus Burgers",
  "Menus Burgers Naan",
  "Menu Xtra",
  "Menus Family",
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
  "Extras",
  "Salades",
  "Boissons",
  "Sauces",
  "Autre",
];

interface FoodCostManagerProps {
  menuItems: MenuItem[];
  onRefresh: () => void;
}

export function FoodCostManager({ menuItems, onRefresh }: FoodCostManagerProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    food_cost: "",
  });

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems
      .filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [menuItems, searchQuery, categoryFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const withFoodCost = menuItems.filter(item => item.food_cost !== null && item.food_cost > 0);
    const withoutFoodCost = menuItems.filter(item => item.food_cost === null || item.food_cost === 0);
    
    // Calculate average food cost
    const avgFoodCost = withFoodCost.length > 0 
      ? withFoodCost.reduce((sum, item) => sum + (item.food_cost || 0), 0) / withFoodCost.length 
      : null;

    return {
      total: menuItems.length,
      withFoodCost: withFoodCost.length,
      withoutFoodCost: withoutFoodCost.length,
      avgFoodCost,
      completionRate: menuItems.length > 0 ? (withFoodCost.length / menuItems.length) * 100 : 0,
    };
  }, [menuItems]);

  // Handle inline edit start
  const startEditing = (item: MenuItem) => {
    setEditingId(item.id);
    setEditValue(item.food_cost?.toString() || "");
  };

  // Handle inline edit save
  const saveEdit = async (itemId: string) => {
    const newValue = editValue ? parseFloat(editValue) : null;
    
    const { error } = await supabase
      .from("menu_items")
      .update({ food_cost: newValue })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le food cost",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Succès",
        description: "Food cost mis à jour",
      });
      onRefresh();
    }
    setEditingId(null);
  };

  // Handle key press in edit input
  const handleKeyPress = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === "Enter") {
      saveEdit(itemId);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  // Add new product
  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du produit est requis",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("menu_items")
      .insert({
        name: newProduct.name.trim(),
        category: newProduct.category || null,
        food_cost: newProduct.food_cost ? parseFloat(newProduct.food_cost) : null,
        is_active: true,
      });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le produit",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Succès",
        description: "Produit ajouté avec succès",
      });
      setNewProduct({ name: "", category: "", food_cost: "" });
      setIsAddDialogOpen(false);
      onRefresh();
    }
  };

  // Get unique categories from items
  const existingCategories = [...new Set(menuItems.map(item => item.category).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          whileHover={{ y: -4, scale: 1.02 }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-emerald-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{stats.withFoodCost}</p>
                  <p className="text-xs text-muted-foreground">Avec Food Cost</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          whileHover={{ y: -4, scale: 1.02 }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-amber-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{stats.withoutFoodCost}</p>
                  <p className="text-xs text-muted-foreground">À compléter</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          whileHover={{ y: -4, scale: 1.02 }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-primary/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <Calculator className="h-6 w-6 text-primary" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">
                    {stats.completionRate.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Complétion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters and Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <CardContent className="pt-6 relative">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1 max-w-sm group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white/60 dark:bg-white/5 border-white/40 focus:border-primary/50"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px] bg-white/60 dark:bg-white/5 border-white/40">
                    <SelectValue placeholder="Toutes catégories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {existingCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button 
                  onClick={() => setIsAddDialogOpen(true)} 
                  className="gap-2 bg-gradient-to-r from-primary via-primary to-primary/90 shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un produit
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Products Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Produits ({filteredItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="rounded-lg border border-white/20 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Produit</TableHead>
                    <TableHead className="font-semibold">Catégorie</TableHead>
                    <TableHead className="font-semibold text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Euro className="h-4 w-4 text-primary" />
                        Food Cost HT
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const hasFoodCost = item.food_cost !== null && item.food_cost > 0;

                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`group hover:bg-primary/5 transition-colors ${!hasFoodCost ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {!hasFoodCost && (
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            )}
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.category ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {item.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {editingId === item.id ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => saveEdit(item.id)}
                              onKeyDown={(e) => handleKeyPress(e, item.id)}
                              className="w-24 h-8 text-center mx-auto"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => startEditing(item)}
                              className="font-mono cursor-pointer hover:bg-primary/10 px-3 py-1 rounded transition-colors"
                            >
                              {hasFoodCost ? `${item.food_cost!.toFixed(2)}€` : (
                                <span className="text-muted-foreground italic text-xs">Cliquer</span>
                              )}
                            </button>
                          )}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Aucun produit trouvé
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Ajouter un produit</DialogTitle>
            <DialogDescription>
              Renseignez les informations du nouveau produit
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-name">Nom du produit *</Label>
              <Input
                id="new-name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Ex: Big Mac, Margherita..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-category">Catégorie</Label>
              <Select
                value={newProduct.category}
                onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
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
              <Label htmlFor="new-food-cost" className="flex items-center gap-1">
                <Euro className="h-4 w-4 text-primary" />
                Food Cost HT (€)
              </Label>
              <Input
                id="new-food-cost"
                type="number"
                step="0.01"
                min="0"
                value={newProduct.food_cost}
                onChange={(e) => setNewProduct({ ...newProduct, food_cost: e.target.value })}
                placeholder="Ex: 2.50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddProduct}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
