import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  History, 
  Search, 
  Calendar as CalendarIcon,
  Filter,
  ChevronDown,
  ArrowRight,
  X,
  Euro,
  Package,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { Link } from "react-router-dom";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import type { DateRange } from "react-day-picker";

interface PriceHistoryEntry {
  id: string;
  menu_item_id: string;
  field_name: string;
  old_value: number | null;
  new_value: number | null;
  changed_at: string;
  restaurant_action_id: string | null;
  notes: string | null;
  menu_item?: {
    name: string;
    category: string | null;
  };
}

interface MenuItemChange {
  id: string;
  menu_item_id: string | null;
  change_type: string;
  item_name: string;
  field_changes: any;
  changed_at: string;
  restaurant_action_id: string | null;
  notes: string | null;
}

interface RestaurantAction {
  id: string;
  title: string;
  category: string;
  action_type: string;
  start_date: string;
  change_context?: any;
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  created: { label: "Création", color: "bg-emerald-500", icon: Plus },
  updated: { label: "Modification", color: "bg-blue-500", icon: Pencil },
  deleted: { label: "Suppression", color: "bg-destructive", icon: Trash2 },
  activated: { label: "Activation", color: "bg-emerald-500", icon: Power },
  deactivated: { label: "Désactivation", color: "bg-amber-500", icon: PowerOff },
};

const FIELD_LABELS: Record<string, string> = {
  price_uber: "Prix Uber",
  price_deliveroo: "Prix Deliveroo",
  food_cost: "Food Cost",
  name: "Nom",
  category: "Catégorie",
  description: "Description",
  is_active: "Statut",
};

export default function MenuHistory() {
  const { toast } = useToast();
  const { selectedChainId } = useAnalyticsContext();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [changeTypeFilters, setChangeTypeFilters] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  // Fetch price history
  const { data: priceHistory, isLoading: loadingPrices } = useQuery({
    queryKey: ["price_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_history")
        .select(`
          *,
          menu_item:menu_items(name, category)
        `)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data as PriceHistoryEntry[];
    },
  });

  // Fetch menu item changes
  const { data: menuChanges, isLoading: loadingChanges } = useQuery({
    queryKey: ["menu_item_changes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_changes")
        .select("*")
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data as MenuItemChange[];
    },
  });

  // Fetch linked restaurant actions
  const { data: linkedActions } = useQuery({
    queryKey: ["linked_actions", priceHistory, menuChanges],
    queryFn: async () => {
      const actionIds = new Set<string>();
      priceHistory?.forEach(p => p.restaurant_action_id && actionIds.add(p.restaurant_action_id));
      menuChanges?.forEach(c => c.restaurant_action_id && actionIds.add(c.restaurant_action_id));
      
      if (actionIds.size === 0) return {};

      const { data, error } = await supabase
        .from("restaurant_actions")
        .select("id, title, category, action_type, start_date, change_context")
        .in("id", Array.from(actionIds));

      if (error) throw error;
      
      const map: Record<string, RestaurantAction> = {};
      data?.forEach(a => map[a.id] = a);
      return map;
    },
    enabled: !!(priceHistory || menuChanges),
  });

  // Filter function
  const filterByDateRange = (date: string) => {
    if (!dateRange?.from) return true;
    const d = parseISO(date);
    const from = dateRange.from;
    const to = dateRange.to || dateRange.from;
    return isWithinInterval(d, { start: from, end: to });
  };

  // Filtered price history
  const filteredPriceHistory = useMemo(() => {
    if (!priceHistory) return [];
    return priceHistory.filter(p => {
      const matchesSearch = !searchQuery || 
        p.menu_item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = filterByDateRange(p.changed_at);
      const matchesBrand = !selectedChainId || (!!p.restaurant_action_id && linkedActions?.[p.restaurant_action_id]?.change_context?.brand_chain_id === selectedChainId);
      return matchesSearch && matchesDate && matchesBrand;
    });
  }, [priceHistory, searchQuery, dateRange, selectedChainId, linkedActions]);

  // Filtered menu changes
  const filteredMenuChanges = useMemo(() => {
    if (!menuChanges) return [];
    return menuChanges.filter(c => {
      const matchesSearch = !searchQuery || 
        c.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = changeTypeFilters.length === 0 || changeTypeFilters.includes(c.change_type);
      const matchesDate = filterByDateRange(c.changed_at);
      const matchesBrand = !selectedChainId || (!!c.restaurant_action_id && linkedActions?.[c.restaurant_action_id]?.change_context?.brand_chain_id === selectedChainId);
      return matchesSearch && matchesType && matchesDate && matchesBrand;
    });
  }, [menuChanges, searchQuery, changeTypeFilters, dateRange, selectedChainId, linkedActions]);

  // Stats
  const stats = useMemo(() => {
    const priceChanges = filteredPriceHistory.length || 0;
    const totalChanges = filteredMenuChanges.length || 0;
    const priceIncreases = filteredPriceHistory.filter(p => 
      (p.new_value || 0) > (p.old_value || 0)
    ).length || 0;
    const priceDecreases = filteredPriceHistory.filter(p => 
      (p.new_value || 0) < (p.old_value || 0)
    ).length || 0;
    return { priceChanges, totalChanges, priceIncreases, priceDecreases };
  }, [filteredPriceHistory, filteredMenuChanges]);

  const formatPrice = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const toggleChangeTypeFilter = (type: string) => {
    setChangeTypeFilters(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setChangeTypeFilters([]);
    setDateRange(undefined);
  };

  const isLoading = loadingPrices || loadingChanges;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8 text-primary" />
            Historique des Modifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Traçabilité complète des changements de prix et modifications produits
          </p>
        </div>
        <Link to="/menu-items">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Catalogue Produits
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalChanges}</p>
                <p className="text-xs text-muted-foreground">Modifications totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Euro className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.priceChanges}</p>
                <p className="text-xs text-muted-foreground">Changements de prix</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.priceIncreases}</p>
                <p className="text-xs text-muted-foreground">Hausses de prix</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.priceDecreases}</p>
                <p className="text-xs text-muted-foreground">Baisses de prix</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Date range picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[250px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd MMM", { locale: fr })} -{" "}
                        {format(dateRange.to, "dd MMM yyyy", { locale: fr })}
                      </>
                    ) : (
                      format(dateRange.from, "dd MMM yyyy", { locale: fr })
                    )
                  ) : (
                    <span>Sélectionner une période</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>

            {/* Change type filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {changeTypeFilters.length === 0 
                      ? "Type de modif." 
                      : `${changeTypeFilters.length} type(s)`
                    }
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                {Object.entries(CHANGE_TYPE_LABELS).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <div 
                      key={type} 
                      className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer"
                      onClick={() => toggleChangeTypeFilter(type)}
                    >
                      <Checkbox checked={changeTypeFilters.includes(type)} />
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{config.label}</span>
                    </div>
                  );
                })}
              </PopoverContent>
            </Popover>

            {(searchQuery || changeTypeFilters.length > 0 || dateRange) && (
              <Button variant="ghost" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                Effacer
              </Button>
            )}
          </div>

          {/* Active filters badges */}
          {changeTypeFilters.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {changeTypeFilters.map(type => {
                const config = CHANGE_TYPE_LABELS[type];
                return (
                  <Badge key={type} variant="secondary" className="gap-1">
                    {config.label}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => toggleChangeTypeFilter(type)}
                    />
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Toutes les modifications</TabsTrigger>
          <TabsTrigger value="prices">Historique des prix</TabsTrigger>
        </TabsList>

        {/* All Changes Tab */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Modifications produits ({filteredMenuChanges.length})</CardTitle>
              <CardDescription>
                Historique complet des créations, modifications, suppressions et changements de statut
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredMenuChanges.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Aucune modification enregistrée
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>Détail des changements</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Action liée</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMenuChanges.map((change) => {
                        const typeConfig = CHANGE_TYPE_LABELS[change.change_type] || { 
                          label: change.change_type, 
                          color: "bg-gray-500", 
                          icon: Pencil 
                        };
                        const Icon = typeConfig.icon;
                        const linkedAction = change.restaurant_action_id ? linkedActions?.[change.restaurant_action_id] : null;

                        return (
                          <TableRow key={change.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="text-sm">
                                {format(parseISO(change.changed_at), "dd MMM yyyy", { locale: fr })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(parseISO(change.changed_at), "HH:mm", { locale: fr })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${typeConfig.color} gap-1`}>
                                <Icon className="h-3 w-3" />
                                {typeConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {change.item_name}
                            </TableCell>
                            <TableCell>
                              {change.field_changes && Array.isArray(change.field_changes) && change.field_changes.length > 0 ? (
                                <div className="space-y-1">
                                  {change.field_changes.slice(0, 3).map((fc: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1 text-sm">
                                      <span className="text-muted-foreground">
                                        {FIELD_LABELS[fc.field] || fc.field}:
                                      </span>
                                      {fc.from !== null && fc.from !== undefined && (
                                        <>
                                          <span className="line-through text-muted-foreground">
                                            {fc.field.includes("price") || fc.field === "food_cost" 
                                              ? formatPrice(fc.from) 
                                              : String(fc.from)}
                                          </span>
                                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        </>
                                      )}
                                      <span className="font-medium">
                                        {fc.field.includes("price") || fc.field === "food_cost" 
                                          ? formatPrice(fc.to) 
                                          : String(fc.to)}
                                      </span>
                                    </div>
                                  ))}
                                  {change.field_changes.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{change.field_changes.length - 3} autres...
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {change.notes ? (
                                <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                                  {change.notes}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {linkedAction ? (
                                <Link to="/actions" className="text-primary hover:underline text-sm">
                                  {linkedAction.title}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
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
        </TabsContent>

        {/* Price History Tab */}
        <TabsContent value="prices">
          <Card>
            <CardHeader>
              <CardTitle>Historique des prix ({filteredPriceHistory.length})</CardTitle>
              <CardDescription>
                Suivi détaillé de tous les changements de prix par produit
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredPriceHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Aucun changement de prix enregistré
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Ancien prix</TableHead>
                        <TableHead></TableHead>
                        <TableHead className="text-right">Nouveau prix</TableHead>
                        <TableHead className="text-right">Variation</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPriceHistory.map((entry) => {
                        const variation = entry.old_value && entry.new_value 
                          ? ((entry.new_value - entry.old_value) / entry.old_value) * 100 
                          : null;
                        const isIncrease = (entry.new_value || 0) > (entry.old_value || 0);

                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="text-sm">
                                {format(parseISO(entry.changed_at), "dd MMM yyyy", { locale: fr })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(parseISO(entry.changed_at), "HH:mm", { locale: fr })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{entry.menu_item?.name || "-"}</div>
                              {entry.menu_item?.category && (
                                <div className="text-xs text-muted-foreground">
                                  {entry.menu_item.category}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {entry.field_name === "price_uber" && <UberEatsIcon className="h-4 w-4" />}
                                {entry.field_name === "price_deliveroo" && <DeliverooIcon className="h-4 w-4" />}
                                {entry.field_name === "food_cost" && <Euro className="h-4 w-4 text-muted-foreground" />}
                                <span className="text-sm">{FIELD_LABELS[entry.field_name] || entry.field_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatPrice(entry.old_value)}
                            </TableCell>
                            <TableCell className="text-center">
                              <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {formatPrice(entry.new_value)}
                            </TableCell>
                            <TableCell className="text-right">
                              {variation !== null ? (
                                <Badge variant={isIncrease ? "default" : "secondary"} className={isIncrease ? "bg-emerald-500" : "bg-amber-500"}>
                                  {isIncrease ? "+" : ""}{variation.toFixed(1)}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {entry.notes ? (
                                <span className="text-sm text-muted-foreground max-w-[150px] truncate block">
                                  {entry.notes}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
