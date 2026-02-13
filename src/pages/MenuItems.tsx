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
  BarChart3,
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
  LayoutList,
  LayoutGrid,
  Kanban,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { CsvImportDialog } from "@/components/menu/CsvImportDialog";
import { MenuItemChangeConfirmDialog } from "@/components/menu/MenuItemChangeConfirmDialog";
import { DeliverooImportDialog } from "@/components/menu/DeliverooImportDialog";

import { OfferSimulator } from "@/components/menu/OfferSimulator";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";
import csLogoBase64 from "@/assets/cs-logo.jpeg";
import { FileSpreadsheet, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { RestaurantPriceComparison } from "@/components/menu/RestaurantPriceComparison";
import { ProfitabilityComparison } from "@/components/menu/ProfitabilityComparison";

// State for restaurant price comparison (lifted to persist across tabs)

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
  vat_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const VAT_RATES = [
  { value: "5.5", label: "5,5%" },
  { value: "10", label: "10%" },
  { value: "20", label: "20%" },
];

const CATEGORIES = [
  "Menu Enfant",
  "Menus Raclettes",
  "Sandwichs Raclettes",
  "Menus Naans",
  "Menus Burgers Naan",
  "Menus Fried Chicken",
  "Menus Wraps",
  "Menus Burgers",
  "Menus Xtra",
  "Fried Chicken",
  "Bowls",
  "Burgers",
  "Naans",
  "Burgers Naan",
  "Wraps",
  "À partager",
  "Desserts Glacés",
  "Desserts",
  "À la carte",
  "Salades",
  "Boissons",
];

// Draggable Item Component for Kanban - Simplified directory view
function DraggableKanbanCard({ item, formatPrice, openEditDialog, handleDeleteClick }: {
  item: MenuItem;
  formatPrice: (price: number | null) => string;
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

        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
        )}

        {item.food_cost && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
            <span>Food Cost</span>
            <span className="font-mono">{formatPrice(item.food_cost)}</span>
          </div>
        )}
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

// Kanban View Component - Simplified
function KanbanView({ 
  items, 
  loading, 
  onDragStart, 
  onDragEnd, 
  sensors,
  draggedItem,
  formatPrice,
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
  const [menuItemsWithRestaurantPrices, setMenuItemsWithRestaurantPrices] = useState<Set<string>>(new Set());
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
  const [activeTab, setActiveTab] = useState<"catalog" | "simulator" | "prices" | "profitability">("catalog");
  
  // Inline food cost editing
  const [editingFoodCostId, setEditingFoodCostId] = useState<string | null>(null);
  const [editingFoodCostValue, setEditingFoodCostValue] = useState<string>("");
  
  // Inline VAT editing
  const [editingVatId, setEditingVatId] = useState<string | null>(null);
  
  // Restaurant price comparison state (persisted across tabs)
  const [priceComparisonRestaurantIds, setPriceComparisonRestaurantIds] = useState<string[]>([]);
  
  // Tab configuration with icons and colors
  const tabConfig = [
    { value: "catalog", label: "Catalogue", icon: Package, color: "text-emerald-500", bgActive: "bg-emerald-500/15", borderActive: "border-emerald-500/40" },
    { value: "prices", label: "Prix Restaurants", icon: Euro, color: "text-rose-500", bgActive: "bg-rose-500/15", borderActive: "border-rose-500/40" },
    { value: "profitability", label: "Rentabilité", icon: BarChart3, color: "text-violet-500", bgActive: "bg-violet-500/15", borderActive: "border-violet-500/40" },
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
    vat_rate: "10",
    is_active: true,
  });

  // Sort state
  const [sortField, setSortField] = useState<"name" | "category" | "price_uber" | "price_deliveroo" | "food_cost">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchMenuItems();
    fetchMenuItemsWithRestaurantPrices();
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

  const fetchMenuItemsWithRestaurantPrices = async () => {
    const { data, error } = await supabase
      .from("restaurant_menu_prices")
      .select("menu_item_id");

    if (!error && data) {
      const uniqueIds = new Set(data.map(item => item.menu_item_id));
      setMenuItemsWithRestaurantPrices(uniqueIds);
    }
  };

  // Food cost stats
  const foodCostStats = {
    withFoodCost: menuItems.filter(item => item.food_cost !== null && item.food_cost > 0).length,
    withoutFoodCost: menuItems.filter(item => item.food_cost === null || item.food_cost === 0).length,
    completionRate: menuItems.length > 0 
      ? (menuItems.filter(item => item.food_cost !== null && item.food_cost > 0).length / menuItems.length) * 100 
      : 0,
  };

  // Inline food cost editing handlers
  const startFoodCostEdit = (item: MenuItem) => {
    setEditingFoodCostId(item.id);
    setEditingFoodCostValue(item.food_cost?.toString() || "");
  };

  const saveFoodCostEdit = async (itemId: string) => {
    const newValue = editingFoodCostValue ? parseFloat(editingFoodCostValue) : null;
    
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
      fetchMenuItems();
    }
    setEditingFoodCostId(null);
  };

  const handleFoodCostKeyPress = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === "Enter") {
      saveFoodCostEdit(itemId);
    } else if (e.key === "Escape") {
      setEditingFoodCostId(null);
    }
  };

  // Inline VAT editing handlers
  const saveVatEdit = async (itemId: string, newValue: string) => {
    const vatValue = newValue ? parseFloat(newValue) : 10;
    
    const { error } = await supabase
      .from("menu_items")
      .update({ vat_rate: vatValue })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la TVA",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Succès",
        description: "TVA mise à jour",
      });
      fetchMenuItems();
    }
    setEditingVatId(null);
  };

  // Export to Excel - Mercuriale Food Cost complète
  const exportToExcel = () => {
    const activeItems = menuItems.filter(i => i.is_active);
    const sorted = [...activeItems].sort((a, b) => {
      const catA = a.category || "ZZZ";
      const catB = b.category || "ZZZ";
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "10B981" } },
      alignment: { horizontal: "center" as const, vertical: "center" as const },
      border: {
        bottom: { style: "thin" as const, color: { rgb: "059669" } },
      },
    };

    const headers = ["Produit", "Catégorie", "Food Cost HT (EUR)", "TVA (%)", "Statut"];
    const wsData: any[][] = [headers];

    sorted.forEach((item) => {
      const hasFoodCost = item.food_cost !== null && item.food_cost > 0;
      wsData.push([
        item.name,
        item.category || "-",
        hasFoodCost ? item.food_cost : "",
        item.vat_rate ? item.vat_rate : 10,
        hasFoodCost ? "Renseigné" : "À compléter",
      ]);
    });

    // Summary rows
    const withFC = sorted.filter(i => i.food_cost !== null && i.food_cost > 0).length;
    const completionRate = sorted.length > 0 ? Math.round((withFC / sorted.length) * 100) : 0;
    wsData.push([]);
    wsData.push(["Total produits", sorted.length, "", "", ""]);
    wsData.push(["Renseignés", withFC, "", "", ""]);
    wsData.push(["Taux de complétion", `${completionRate}%`, "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Style headers
    headers.forEach((_, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    });

    // Alternating row colors + status coloring
    const evenRowStyle = { fill: { fgColor: { rgb: "F0FDF4" } } };
    const statusGreen = { font: { color: { rgb: "059669" }, bold: true } };
    const statusOrange = { font: { color: { rgb: "D97706" }, bold: true } };

    for (let r = 1; r <= sorted.length; r++) {
      for (let c = 0; c < headers.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;
        if (r % 2 === 0) {
          ws[cellRef].s = { ...(ws[cellRef].s || {}), ...evenRowStyle };
        }
        // Status column color
        if (c === 4) {
          const isComplete = ws[cellRef].v === "Renseigné";
          ws[cellRef].s = { ...(ws[cellRef].s || {}), ...(isComplete ? statusGreen : statusOrange) };
        }
        // Food Cost number format
        if (c === 2 && typeof ws[cellRef].v === "number") {
          ws[cellRef].z = "0.00";
        }
      }
    }

    // Summary rows bold
    for (let r = sorted.length + 2; r < wsData.length; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
    }

    ws["!cols"] = [
      { wch: 42 },
      { wch: 25 },
      { wch: 18 },
      { wch: 10 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mercuriale Food Cost");
    XLSX.writeFile(wb, `mercuriale_food_cost_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Export réussi",
      description: `Mercuriale exportée : ${sorted.length} produits`,
    });
  };

  // Export to PDF - Mercuriale Food Cost complète
  const exportToPdf = () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    const activeItems = menuItems.filter(i => i.is_active);
    const sorted = [...activeItems].sort((a, b) => {
      const catA = a.category || "ZZZ";
      const catB = b.category || "ZZZ";
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });

    const withFC = sorted.filter(i => i.food_cost !== null && i.food_cost > 0);
    const completionRate = sorted.length > 0 ? Math.round((withFC.length / sorted.length) * 100) : 0;
    const avgFoodCost = withFC.length > 0
      ? (withFC.reduce((sum, i) => sum + (i.food_cost || 0), 0) / withFC.length)
      : 0;

    // --- Header ---
    pdf.setFillColor(16, 185, 129);
    pdf.rect(0, 0, pageWidth, 28, "F");
    try { pdf.addImage(csLogoBase64, "JPEG", margin, 4, 20, 20); } catch (e) { /* ignore */ }
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Mercuriale - Food Cost", margin + 24, 14);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    pdf.text(dateStr, margin + 24, 22);

    // --- KPIs ---
    let yPos = 36;
    const kpiW = (pageWidth - margin * 2 - 10) / 3;
    const kpis = [
      { label: "Produits analyses", value: sorted.length.toString() },
      { label: "Taux completion", value: completionRate.toString() + "%" },
      { label: "Food Cost moyen", value: avgFoodCost.toFixed(2) + " EUR" },
    ];
    kpis.forEach((kpi, i) => {
      const x = margin + i * (kpiW + 5);
      pdf.setFillColor(240, 253, 244);
      pdf.roundedRect(x, yPos, kpiW, 16, 2, 2, "F");
      pdf.setTextColor(5, 150, 105);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(kpi.value, x + kpiW / 2, yPos + 7, { align: "center" });
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(107, 114, 128);
      pdf.text(kpi.label, x + kpiW / 2, yPos + 13, { align: "center" });
    });

    yPos = 58;

    // Group by category
    const categories = new Map<string, MenuItem[]>();
    sorted.forEach(item => {
      const cat = item.category || "Sans catégorie";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(item);
    });

    const colX = {
      name: margin + 3,
      foodCost: margin + 110,
      vat: margin + 140,
      status: margin + 160,
    };

    const drawTableHeader = () => {
      pdf.setFillColor(243, 244, 246);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(55, 65, 81);
      pdf.text("Produit", colX.name, yPos + 5.5);
      pdf.text("Food Cost HT", colX.foodCost, yPos + 5.5);
      pdf.text("TVA", colX.vat, yPos + 5.5);
      pdf.text("Statut", colX.status, yPos + 5.5);
      yPos += 10;
    };

    const checkNewPage = (needed: number) => {
      if (yPos + needed > pageHeight - 20) {
        // Footer
        pdf.setFontSize(7);
        pdf.setTextColor(156, 163, 175);
        pdf.text("CS Delivery - Mercuriale Food Cost", margin, pageHeight - 6);
        pdf.addPage();
        yPos = 15;
        drawTableHeader();
      }
    };

    let rowIdx = 0;
    categories.forEach((items, catName) => {
      checkNewPage(18);

      // Category header
      pdf.setFillColor(16, 185, 129);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      const catFC = items.filter(i => i.food_cost !== null && i.food_cost > 0);
      pdf.text(`${catName} (${items.length})`, colX.name, yPos + 5.5);
      if (catFC.length > 0) {
        const catAvg = (catFC.reduce((s, i) => s + (i.food_cost || 0), 0) / catFC.length).toFixed(2);
        pdf.text(`Moy: ${catAvg} EUR`, colX.foodCost, yPos + 5.5);
      }
      yPos += 10;

      drawTableHeader();

      items.forEach((item) => {
        checkNewPage(7);

        if (rowIdx % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, yPos - 3, pageWidth - margin * 2, 7, "F");
        }

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        const name = item.name.length > 50 ? item.name.substring(0, 47) + "..." : item.name;
        pdf.text(name, colX.name, yPos + 2);

        if (item.food_cost !== null && item.food_cost > 0) {
          pdf.setTextColor(16, 185, 129);
          pdf.text(item.food_cost.toFixed(2) + " EUR", colX.foodCost, yPos + 2);
        } else {
          pdf.setTextColor(245, 158, 11);
          pdf.text("A completer", colX.foodCost, yPos + 2);
        }

        pdf.setTextColor(99, 102, 241);
        pdf.text((item.vat_rate || 10).toString() + "%", colX.vat, yPos + 2);

        if (item.food_cost !== null && item.food_cost > 0) {
          pdf.setTextColor(16, 185, 129);
          pdf.text("OK", colX.status, yPos + 2);
        } else {
          pdf.setTextColor(245, 158, 11);
          pdf.text("--", colX.status, yPos + 2);
        }

        yPos += 7;
        rowIdx++;
      });

      yPos += 4;
    });

    // Legend
    checkNewPage(20);
    yPos += 4;
    pdf.setDrawColor(229, 231, 235);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(16, 185, 129);
    pdf.text("Vert = Food Cost renseigne", margin, yPos);
    pdf.setTextColor(245, 158, 11);
    pdf.text("Orange = A completer", margin + 50, yPos);
    pdf.setTextColor(156, 163, 175);
    pdf.text("Tous les produits actifs du catalogue sont inclus, independamment des filtres", margin, yPos + 5);

    // Footer
    pdf.setFontSize(7);
    pdf.setTextColor(156, 163, 175);
    pdf.text("CS Delivery - Mercuriale Food Cost", margin, pageHeight - 6);
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(7);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`Page ${p}/${totalPages}`, pageWidth - margin - 20, pageHeight - 6);
    }

    pdf.save(`mercuriale_food_cost_${new Date().toISOString().split("T")[0]}.pdf`);

    toast({
      title: "Export réussi",
      description: "Le fichier PDF a été téléchargé",
    });
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
      vat_rate: "10",
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
      vat_rate: item.vat_rate?.toString() || "10",
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

    const itemData = {
      name: formData.name.trim(),
      category: formData.category || null,
      description: formData.description.trim() || null,
      description_uber: formData.description_uber.trim() || null,
      description_deliveroo: formData.description_deliveroo.trim() || null,
      price_uber: formData.price_uber ? parseFloat(formData.price_uber) : null,
      price_deliveroo: formData.price_deliveroo ? parseFloat(formData.price_deliveroo) : null,
      food_cost: formData.food_cost ? parseFloat(formData.food_cost) : null,
      vat_rate: formData.vat_rate ? parseFloat(formData.vat_rate) : 10,
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
            Annuaire des produits avec gestion des prix et rentabilité
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

      {/* Tabs for Catalog / Food Cost / etc. */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "catalog" | "simulator" | "prices" | "profitability")}>
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

        <TabsContent value="simulator" className="mt-6">
          <OfferSimulator menuItems={menuItems} />
        </TabsContent>

        <TabsContent value="prices" className="mt-6">
          <RestaurantPriceComparison 
            selectedRestaurantIds={priceComparisonRestaurantIds}
            onSelectedRestaurantIdsChange={setPriceComparisonRestaurantIds}
          />
        </TabsContent>

        <TabsContent value="profitability" className="mt-6">
          <ProfitabilityComparison />
        </TabsContent>

        <TabsContent value="catalog" className="mt-6 space-y-6">

      {/* Stats Cards - Directory stats with Food Cost completion */}
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
                  <Package className="h-6 w-6 text-primary" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{totalItems}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Produits</p>
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
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{activeItems}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Actifs</p>
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
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-violet-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <Calculator className="h-6 w-6 text-violet-500" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{foodCostStats.withFoodCost}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Avec Food Cost</p>
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
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-amber-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{foodCostStats.withoutFoodCost}</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">À compléter</p>
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
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent" />
            <div className="absolute inset-0 border border-white/40 rounded-lg" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-rose-500/15 backdrop-blur-sm rounded-xl shadow-lg"
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <BarChart3 className="h-6 w-6 text-rose-500" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{foodCostStats.completionRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Complétion</p>
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToPdf}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
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
                Annuaire des produits référencés dans le réseau
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
                                <TableHead>Description</TableHead>
                                <TableHead 
                                  className="cursor-pointer hover:bg-muted/50 text-right"
                                  onClick={() => handleSort("food_cost")}
                                >
                                  <div className="flex items-center gap-1 justify-end">
                                    Food Cost
                                    <ArrowUpDown className="h-3 w-3" />
                                  </div>
                                </TableHead>
                                <TableHead className="text-center">TVA</TableHead>
                                <TableHead className="text-center">Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryItems.map((item) => {
                                return (
                                  <TableRow 
                                    key={item.id}
                                    className="border-b transition-all duration-200 hover:bg-muted/50 data-[state=selected]:bg-muted"
                                  >
                                    <TableCell className="font-medium">
                                      {item.name}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground max-w-xs truncate">
                                      {item.description || "-"}
                                    </TableCell>
                                    <TableCell 
                                      className="text-right font-mono cursor-pointer hover:bg-primary/5 transition-colors"
                                      onClick={() => startFoodCostEdit(item)}
                                    >
                                      {editingFoodCostId === item.id ? (
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={editingFoodCostValue}
                                          onChange={(e) => setEditingFoodCostValue(e.target.value)}
                                          onBlur={() => saveFoodCostEdit(item.id)}
                                          onKeyDown={(e) => handleFoodCostKeyPress(e, item.id)}
                                          autoFocus
                                          className="w-20 h-7 text-right text-sm"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : item.food_cost ? (
                                        <span className="hover:text-primary">{formatPrice(item.food_cost)}</span>
                                      ) : (
                                        <span className="text-amber-500 hover:text-amber-600">À renseigner</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {editingVatId === item.id ? (
                                        <Select
                                          defaultValue={item.vat_rate?.toString() || "10"}
                                          onValueChange={(value) => {
                                            saveVatEdit(item.id, value);
                                          }}
                                        >
                                          <SelectTrigger className="w-20 h-7 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {VAT_RATES.map((rate) => (
                                              <SelectItem key={rate.value} value={rate.value}>
                                                {rate.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Badge 
                                          variant="outline" 
                                          className="cursor-pointer hover:bg-primary/10 transition-colors"
                                          onClick={() => setEditingVatId(item.id)}
                                        >
                                          {item.vat_rate || 10}%
                                        </Badge>
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
            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du produit..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="food_cost">Food Cost HT (€)</Label>
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
              <div className="grid gap-2">
                <Label htmlFor="vat_rate">Taux de TVA</Label>
                <Select 
                  value={formData.vat_rate} 
                  onValueChange={(value) => setFormData({ ...formData, vat_rate: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_RATES.map((rate) => (
                      <SelectItem key={rate.value} value={rate.value}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
