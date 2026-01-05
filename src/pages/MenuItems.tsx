import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMenuItemTracking, type MenuItem as TrackingMenuItem, type FieldChange } from "@/hooks/useMenuItemTracking";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Upload,
  ArrowRightLeft,
  Link2,
  LayoutList,
  LayoutGrid,
  Kanban,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { CsvImportDialog } from "@/components/menu/CsvImportDialog";
import { MenuItemChangeConfirmDialog } from "@/components/menu/MenuItemChangeConfirmDialog";
import { CatalogComparison } from "@/components/menu/CatalogComparison";
import { DeliverooImportDialog } from "@/components/menu/DeliverooImportDialog";
import { ProductMatcher } from "@/components/menu/ProductMatcher";
import { FoodCostManager } from "@/components/menu/FoodCostManager";
import { OfferSimulator } from "@/components/menu/OfferSimulator";
import { RestaurantPriceComparison } from "@/components/menu/RestaurantPriceComparison";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface MenuItem {
  id: string;
  name: string;
  name_uber: string | null;
  name_deliveroo: string | null;
  category: string | null;
  description: string | null;
  description_uber: string | null;
  description_deliveroo: string | null;
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

// Draggable Item Component for Kanban
function DraggableKanbanCard({ item, formatPrice, calculateMargin, openEditDialog, handleDeleteClick }: {
  item: MenuItem;
  formatPrice: (price: number | null) => string;
  calculateMargin: (price: number | null, foodCost: number | null) => number | null;
  openEditDialog: (item: MenuItem) => void;
  handleDeleteClick: (item: MenuItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: item.id });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const marginUber = calculateMargin(item.price_uber, item.food_cost);
  const marginDeliveroo = calculateMargin(item.price_deliveroo, item.food_cost);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 rounded-xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] transition-all duration-300 cursor-grab active:cursor-grabbing"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{item.name}</h3>
            {item.category && (
              <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary">
                {item.category}
              </Badge>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(item);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(item);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <UberEatsIcon className="h-4 w-4" />
              <span className="text-muted-foreground">Uber</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">{formatPrice(item.price_uber)}</span>
              {marginUber !== null && (
                <Badge 
                  variant={marginUber >= 70 ? "default" : marginUber >= 50 ? "secondary" : "destructive"}
                  className={`text-xs ${marginUber >= 70 ? "bg-emerald-500" : ""}`}
                >
                  {marginUber.toFixed(0)}%
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <DeliverooIcon className="h-4 w-4" />
              <span className="text-muted-foreground">Deliveroo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">{formatPrice(item.price_deliveroo)}</span>
              {marginDeliveroo !== null && (
                <Badge 
                  variant={marginDeliveroo >= 70 ? "default" : marginDeliveroo >= 50 ? "secondary" : "destructive"}
                  className={`text-xs ${marginDeliveroo >= 70 ? "bg-emerald-500" : ""}`}
                >
                  {marginDeliveroo.toFixed(0)}%
                </Badge>
              )}
            </div>
          </div>

          {item.food_cost && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
              <span>Food Cost</span>
              <span className="font-mono">{formatPrice(item.food_cost)}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Droppable Zone Component
function DroppableZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] space-y-3 p-4 rounded-xl border-2 border-dashed transition-all duration-300 ${
        id === "active"
          ? `border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm ${isOver ? "border-emerald-500 bg-emerald-500/10" : ""}`
          : `border-gray-500/30 bg-gray-500/5 backdrop-blur-sm ${isOver ? "border-gray-500 bg-gray-500/10" : ""}`
      }`}
    >
      {children}
    </div>
  );
}

// Kanban View Component
function KanbanView({ 
  items, 
  loading, 
  onDragStart, 
  onDragEnd, 
  sensors,
  draggedItem,
  formatPrice,
  calculateMargin,
  openEditDialog,
  handleDeleteClick,
}: {
  items: MenuItem[];
  loading: boolean;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: any;
  draggedItem: MenuItem | null;
  formatPrice: (price: number | null) => string;
  calculateMargin: (price: number | null, foodCost: number | null) => number | null;
  openEditDialog: (item: MenuItem) => void;
  handleDeleteClick: (item: MenuItem) => void;
}) {
  const activeItems = items.filter(item => item.is_active);
  const inactiveItems = items.filter(item => !item.is_active);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center py-24"
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </motion.div>
    );
  }

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-center py-24 text-muted-foreground"
      >
        Aucun produit dans le catalogue
      </motion.div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Active Column */}
        <div className="space-y-4">
          <Card className="border-0 bg-emerald-500/10 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(16,185,129,0.2)]">
            <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-lg pointer-events-none" />
            <CardHeader className="relative pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-600">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Produits Actifs
                <Badge className="ml-auto bg-emerald-500">{activeItems.length}</Badge>
              </CardTitle>
            </CardHeader>
          </Card>
          <DroppableZone id="active">
            {activeItems.map((item) => (
              <DraggableKanbanCard
                key={item.id}
                item={item}
                formatPrice={formatPrice}
                calculateMargin={calculateMargin}
                openEditDialog={openEditDialog}
                handleDeleteClick={handleDeleteClick}
              />
            ))}
            {activeItems.length === 0 && (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Glissez des produits ici pour les activer
              </div>
            )}
          </DroppableZone>
        </div>

        {/* Inactive Column */}
        <div className="space-y-4">
          <Card className="border-0 bg-gray-500/10 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(100,116,139,0.2)]">
            <div className="absolute inset-0 border-2 border-gray-500/30 rounded-lg pointer-events-none" />
            <CardHeader className="relative pb-3">
              <CardTitle className="flex items-center gap-2 text-gray-600">
                <div className="h-2 w-2 rounded-full bg-gray-500" />
                Produits Inactifs
                <Badge className="ml-auto bg-gray-500">{inactiveItems.length}</Badge>
              </CardTitle>
            </CardHeader>
          </Card>
          <DroppableZone id="inactive">
            {inactiveItems.map((item) => (
              <DraggableKanbanCard
                key={item.id}
                item={item}
                formatPrice={formatPrice}
                calculateMargin={calculateMargin}
                openEditDialog={openEditDialog}
                handleDeleteClick={handleDeleteClick}
              />
            ))}
            {inactiveItems.length === 0 && (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Glissez des produits ici pour les désactiver
              </div>
            )}
          </DroppableZone>
        </div>
      </motion.div>

      <DragOverlay>
        {draggedItem ? (
          <div className="bg-white/90 dark:bg-white/10 backdrop-blur-xl border-2 border-primary rounded-xl p-4 shadow-2xl rotate-3">
            <div className="font-semibold">{draggedItem.name}</div>
            <Badge variant="secondary" className="mt-1 text-xs">
              {draggedItem.category}
            </Badge>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function MenuItems() {
  const { toast } = useToast();
  const { detectChanges, trackChange } = useMenuItemTracking();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [draggedItem, setDraggedItem] = useState<MenuItem | null>(null);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeliverooImportDialogOpen, setIsDeliverooImportDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"catalog" | "comparison" | "matcher" | "foodcost" | "simulator" | "prices">("catalog");
  
  // Tab configuration with icons and colors
  const tabConfig = [
    { value: "catalog", label: "Catalogue", icon: Package, color: "text-emerald-500", bgActive: "bg-emerald-500/15", borderActive: "border-emerald-500/40" },
    { value: "comparison", label: "Comparaison", icon: ArrowRightLeft, color: "text-blue-500", bgActive: "bg-blue-500/15", borderActive: "border-blue-500/40" },
    { value: "prices", label: "Prix Restaurants", icon: Euro, color: "text-rose-500", bgActive: "bg-rose-500/15", borderActive: "border-rose-500/40" },
    { value: "matcher", label: "Matcher", icon: Link2, color: "text-purple-500", bgActive: "bg-purple-500/15", borderActive: "border-purple-500/40" },
    { value: "foodcost", label: "Food Cost", icon: Calculator, color: "text-amber-500", bgActive: "bg-amber-500/15", borderActive: "border-amber-500/40" },
    { value: "simulator", label: "Simulateur", icon: TrendingUp, color: "text-orange-500", bgActive: "bg-orange-500/15", borderActive: "border-orange-500/40" },
  ] as const;
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  
  // Pending change state for confirmation
  const [pendingChange, setPendingChange] = useState<{
    changeType: "created" | "updated" | "deleted" | "activated" | "deactivated";
    itemName: string;
    changes: FieldChange[];
    itemData?: any;
  } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    description_uber: "",
    description_deliveroo: "",
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
      description_uber: "",
      description_deliveroo: "",
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
      description_uber: item.description_uber || "",
      description_deliveroo: item.description_deliveroo || "",
      price_uber: item.price_uber?.toString() || "",
      price_deliveroo: item.price_deliveroo?.toString() || "",
      food_cost: item.food_cost?.toString() || "",
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  // Prepare submit - show confirmation dialog
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
      description_uber: formData.description_uber.trim() || null,
      description_deliveroo: formData.description_deliveroo.trim() || null,
      price_uber: formData.price_uber ? parseFloat(formData.price_uber) : null,
      price_deliveroo: formData.price_deliveroo ? parseFloat(formData.price_deliveroo) : null,
      food_cost: formData.food_cost ? parseFloat(formData.food_cost) : null,
      is_active: formData.is_active,
    };

    // Detect changes
    const changes = detectChanges(editingItem as TrackingMenuItem | null, itemData);
    const changeType = editingItem ? "updated" : "created";

    // Show confirmation dialog
    setPendingChange({
      changeType,
      itemName: itemData.name,
      changes,
      itemData,
    });
    setIsDialogOpen(false);
    setIsConfirmDialogOpen(true);
  };

  // Execute the confirmed change
  const executeChange = async (notes: string) => {
    if (!pendingChange) return;

    const { changeType, itemName, changes, itemData } = pendingChange;

    if (changeType === "updated" && editingItem) {
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

      // Track the change
      await trackChange(changeType, editingItem.id, itemName, changes, notes);

      toast({
        title: "Succès",
        description: "Produit modifié et changement enregistré",
      });
    } else if (changeType === "created") {
      const { data, error } = await supabase
        .from("menu_items")
        .insert(itemData)
        .select("id")
        .single();

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de créer le produit",
          variant: "destructive",
        });
        return;
      }

      // Track the change
      await trackChange(changeType, data?.id || null, itemName, changes, notes);

      toast({
        title: "Succès",
        description: "Produit ajouté et changement enregistré",
      });
    } else if (changeType === "deleted" && itemToDelete) {
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

      // Track the change
      await trackChange(changeType, itemToDelete.id, itemName, changes, notes);

      toast({
        title: "Succès",
        description: "Produit supprimé et changement enregistré",
      });
      setItemToDelete(null);
    } else if ((changeType === "activated" || changeType === "deactivated") && itemData?.itemId) {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_active: changeType === "activated" })
        .eq("id", itemData.itemId);

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de modifier le statut",
          variant: "destructive",
        });
        return;
      }

      // Track the change
      await trackChange(changeType, itemData.itemId, itemName, changes, notes);

      toast({
        title: "Succès",
        description: `Produit ${changeType === "activated" ? "activé" : "désactivé"} et changement enregistré`,
      });
    }

    setIsConfirmDialogOpen(false);
    setPendingChange(null);
    setEditingItem(null);
    fetchMenuItems();
  };

  // Handle delete - show confirmation dialog with tracking info
  const handleDeleteClick = (item: MenuItem) => {
    setItemToDelete(item);
    
    const changes: FieldChange[] = [
      { field: "name", fieldLabel: "Nom", from: item.name, to: null },
      { field: "category", fieldLabel: "Catégorie", from: item.category, to: null },
      { field: "price_uber", fieldLabel: "Prix Uber", from: item.price_uber, to: null },
      { field: "price_deliveroo", fieldLabel: "Prix Deliveroo", from: item.price_deliveroo, to: null },
    ];

    setPendingChange({
      changeType: "deleted",
      itemName: item.name,
      changes,
    });
    setIsConfirmDialogOpen(true);
  };

  // Toggle item active - show confirmation dialog
  const toggleItemActive = (item: MenuItem) => {
    const newStatus = !item.is_active;
    const changeType = newStatus ? "activated" : "deactivated";

    const changes: FieldChange[] = [
      { field: "is_active", fieldLabel: "Statut", from: item.is_active, to: newStatus },
    ];

    setPendingChange({
      changeType,
      itemName: item.name,
      changes,
      itemData: { itemId: item.id },
    });
    setIsConfirmDialogOpen(true);
  };

  // Cancel pending change
  const cancelPendingChange = () => {
    setIsConfirmDialogOpen(false);
    setPendingChange(null);
    setItemToDelete(null);
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const item = menuItems.find((item) => item.id === event.active.id);
    if (item) {
      setDraggedItem(item);
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over) return;

    const itemId = active.id as string;
    const newStatus = over.id === "active";
    const item = menuItems.find((i) => i.id === itemId);

    if (!item || item.is_active === newStatus) return;

    // Update status with tracking
    const changeType = newStatus ? "activated" : "deactivated";
    const changes: FieldChange[] = [
      { field: "is_active", fieldLabel: "Statut", from: item.is_active, to: newStatus },
    ];

    setPendingChange({
      changeType,
      itemName: item.name,
      changes,
      itemData: { itemId: item.id },
    });
    setIsConfirmDialogOpen(true);
  };

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
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <UtensilsCrossed className="h-8 w-8 text-primary" />
            </motion.div>
            Catalogue Produits
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Gérez le catalogue de produits commun avec les prix par plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="gap-2 bg-white/60 dark:bg-white/5 backdrop-blur-sm border-white/40 hover:bg-white/80 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] hover:border-primary/30 transition-all duration-500">
              <Upload className="h-5 w-5" />
              Import CSV
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant="outline" onClick={() => setIsDeliverooImportDialogOpen(true)} className="gap-2 bg-white/60 dark:bg-white/5 backdrop-blur-sm border-white/40 hover:bg-white/80 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] hover:border-[#00CCBC]/50 transition-all duration-500">
              <DeliverooIcon className="h-5 w-5" />
              Import Deliveroo
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button onClick={openCreateDialog} className="gap-2 bg-gradient-to-r from-primary via-primary to-primary/90 shadow-[0_8px_24px_-8px_rgba(99,102,241,0.5)] hover:shadow-[0_16px_40px_-8px_rgba(99,102,241,0.6)] hover:scale-105 transition-all duration-500">
              <Plus className="h-5 w-5" />
              Ajouter un produit
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Tabs for Catalog / Comparison */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "catalog" | "comparison" | "matcher" | "foodcost" | "simulator")}>
        <TabsList className="h-auto p-1.5 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 shadow-lg rounded-xl gap-1">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className={`gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 data-[state=active]:shadow-md ${
                  isActive 
                    ? `${tab.bgActive} ${tab.borderActive} border` 
                    : 'hover:bg-muted/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? tab.color : 'text-muted-foreground'}`} />
                <span className={isActive ? 'font-semibold' : 'text-muted-foreground'}>{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="comparison" className="mt-6">
          <CatalogComparison menuItems={menuItems} onRefresh={fetchMenuItems} />
        </TabsContent>

        <TabsContent value="matcher" className="mt-6">
          <ProductMatcher menuItems={menuItems} onRefresh={fetchMenuItems} />
        </TabsContent>

        <TabsContent value="foodcost" className="mt-6">
          <FoodCostManager menuItems={menuItems} onRefresh={fetchMenuItems} />
        </TabsContent>

        <TabsContent value="simulator" className="mt-6">
          <OfferSimulator menuItems={menuItems} />
        </TabsContent>

        <TabsContent value="prices" className="mt-6">
          <RestaurantPriceComparison />
        </TabsContent>

        <TabsContent value="catalog" className="mt-6 space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.5 } }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-primary/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <Package className="h-7 w-7 text-primary" />
                </motion.div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{totalItems}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Produits total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.5 } }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-emerald-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <Package className="h-7 w-7 text-emerald-500" />
                </motion.div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{activeItems}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Produits actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.5 } }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-[#06C167]/15 via-[#06C167]/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-[#06C167]/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <UberEatsIcon className="h-7 w-7" />
                </motion.div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{formatPrice(avgPriceUber)}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Prix moyen Uber</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 200 }}
          whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.5 } }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00CCBC]/15 via-[#00CCBC]/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-[#00CCBC]/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <DeliverooIcon className="h-7 w-7" />
                </motion.div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{formatPrice(avgPriceDeliveroo)}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Prix moyen Deliveroo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.5 } }}
        >
          <Card className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-blue-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <TrendingUp className="h-7 w-7 text-blue-500" />
                </motion.div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">
                    {priceDifference !== null ? `${priceDifference > 0 ? "+" : ""}${priceDifference.toFixed(1)}%` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Écart prix</p>
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
        transition={{ delay: 0.35 }}
      >
        <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] transition-all duration-500">
          <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
          <CardContent className="pt-6 relative">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1 max-w-sm group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary group-focus-within:scale-110 transition-all duration-300" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white/80 dark:bg-white/5 backdrop-blur-sm border-white/40 focus:ring-2 focus:ring-primary/30 focus:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300"
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
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("list")}
                      className="transition-all duration-200 ease-out"
                    >
                      <LayoutList className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vue Liste</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === "kanban" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("kanban")}
                      className="transition-all duration-200 ease-out"
                    >
                      <Kanban className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vue Kanban</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Products View */}
      {viewMode === "list" ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] transition-all duration-500">
            <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
            <CardHeader className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
              <CardTitle className="relative">Produits ({filteredItems.length})</CardTitle>
              <CardDescription className="relative">
                Catalogue partagé avec prix différenciés par plateforme
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
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
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleAllCategories(true)}
                      className="text-xs hover:shadow-sm transition-shadow"
                    >
                      Tout déplier
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleAllCategories(false)}
                      className="text-xs hover:shadow-sm transition-shadow"
                    >
                      Tout replier
                    </Button>
                  </motion.div>
                </div>

                {sortedCategories.map((category, idx) => {
                  const categoryItems = groupedItems[category];
                  const isExpanded = expandedCategories.has(category);
                  
                  return (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 + idx * 0.05 }}
                    >
                      <Collapsible 
                        open={isExpanded}
                        onOpenChange={() => toggleCategoryExpanded(category)}
                      >
                        <CollapsibleTrigger asChild>
                          <motion.div 
                            className="flex items-center gap-3 p-4 bg-white/60 dark:bg-white/5 backdrop-blur-lg rounded-xl cursor-pointer hover:bg-white/80 transition-all duration-500 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-white/40 hover:border-primary/30"
                            whileHover={{ x: 6, scale: 1.01 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          >
                            <motion.div
                              animate={{ rotate: isExpanded ? 0 : -90 }}
                              transition={{ duration: 0.3, type: "spring" }}
                            >
                              <ChevronDown className="h-5 w-5 text-primary" />
                            </motion.div>
                            <span className="font-semibold text-base tracking-tight">{category}</span>
                            <Badge variant="secondary" className="shadow-sm bg-primary/10 text-primary backdrop-blur-sm border-white/40">{categoryItems.length} produit{categoryItems.length > 1 ? 's' : ''}</Badge>
                          </motion.div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                        <motion.div 
                          className="overflow-x-auto mt-3 border-0 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] bg-white/50 dark:bg-white/5 backdrop-blur-md"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.4, type: "spring" }}
                        >
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
                              {categoryItems.map((item, itemIdx) => {
                                const marginUber = calculateMargin(item.price_uber, item.food_cost);
                                const marginDeliveroo = calculateMargin(item.price_deliveroo, item.food_cost);
                                
                                return (
                                  <TableRow 
                                    key={item.id}
                                    className="border-b transition-all duration-200 hover:bg-muted/50 data-[state=selected]:bg-muted"
                                  >
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
                                      <div className="flex justify-center">
                                        <Switch
                                          checked={item.is_active}
                                          onCheckedChange={() => toggleItemActive(item)}
                                        />
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(item)}
                                            className="hover:bg-primary/10 hover:text-primary transition-colors"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </motion.div>
                                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteClick(item)}
                                            className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </motion.div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </motion.div>
                      </CollapsibleContent>
                    </Collapsible>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>
      ) : (
        <KanbanView
          items={filteredItems}
          loading={loading}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          draggedItem={draggedItem}
          formatPrice={formatPrice}
          calculateMargin={calculateMargin}
          openEditDialog={openEditDialog}
          handleDeleteClick={handleDeleteClick}
        />
      )}
        </TabsContent>
      </Tabs>

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
            {/* Platform-specific descriptions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Description par plateforme</Label>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <UberEatsIcon className="h-4 w-4" />
                    <Label htmlFor="description_uber" className="text-xs">Description Uber Eats</Label>
                  </div>
                  <Textarea
                    id="description_uber"
                    value={formData.description_uber}
                    onChange={(e) => setFormData({ ...formData, description_uber: e.target.value })}
                    placeholder="Description pour Uber Eats..."
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <DeliverooIcon className="h-4 w-4" />
                    <Label htmlFor="description_deliveroo" className="text-xs">Description Deliveroo</Label>
                  </div>
                  <Textarea
                    id="description_deliveroo"
                    value={formData.description_deliveroo}
                    onChange={(e) => setFormData({ ...formData, description_deliveroo: e.target.value })}
                    placeholder="Description pour Deliveroo..."
                    rows={2}
                  />
                </div>
              </div>
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

      {/* Change Confirmation Dialog */}
      {pendingChange && (
        <MenuItemChangeConfirmDialog
          open={isConfirmDialogOpen}
          onOpenChange={setIsConfirmDialogOpen}
          itemName={pendingChange.itemName}
          changeType={pendingChange.changeType}
          changes={pendingChange.changes}
          onConfirm={executeChange}
          onCancel={cancelPendingChange}
        />
      )}

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={fetchMenuItems}
        existingCategories={existingCategories as string[]}
      />

      {/* Deliveroo Import Dialog */}
      <DeliverooImportDialog
        open={isDeliverooImportDialogOpen}
        onOpenChange={setIsDeliverooImportDialogOpen}
        onImportComplete={fetchMenuItems}
        existingItems={menuItems.map(i => ({ id: i.id, name: i.name, price_uber: i.price_uber, price_deliveroo: i.price_deliveroo }))}
      />
    </div>
  );
}
