import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowRightLeft,
  Eye,
  Copy,
  Filter,
  Tag,
} from "lucide-react";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
}

interface CatalogComparisonProps {
  menuItems: MenuItem[];
  onRefresh: () => void;
}

type ComparisonStatus = "all" | "identical" | "price_diff" | "uber_only" | "deliveroo_only" | "desc_diff" | "name_diff";

export function CatalogComparison({ menuItems, onRefresh }: CatalogComparisonProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComparisonStatus>("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);

  // Calculate comparison stats
  const stats = useMemo(() => {
    const uberOnly = menuItems.filter(i => i.price_uber && !i.price_deliveroo).length;
    const deliverooOnly = menuItems.filter(i => !i.price_uber && i.price_deliveroo).length;
    const both = menuItems.filter(i => i.price_uber && i.price_deliveroo);
    
    const identical = both.filter(i => i.price_uber === i.price_deliveroo).length;
    const priceDiff = both.filter(i => i.price_uber !== i.price_deliveroo).length;
    
    const descDiff = menuItems.filter(i => {
      const uberDesc = i.description_uber || i.description || "";
      const deliverooDesc = i.description_deliveroo || "";
      return uberDesc && deliverooDesc && uberDesc !== deliverooDesc;
    }).length;

    const nameDiff = menuItems.filter(i => 
      i.name_uber && i.name_deliveroo && i.name_uber !== i.name_deliveroo
    ).length;

    const avgPriceDiffPercent = both.length > 0
      ? both.reduce((sum, i) => {
          if (i.price_uber && i.price_deliveroo) {
            return sum + Math.abs((i.price_deliveroo - i.price_uber) / i.price_uber * 100);
          }
          return sum;
        }, 0) / both.filter(i => i.price_uber && i.price_deliveroo).length
      : 0;

    return { uberOnly, deliverooOnly, identical, priceDiff, descDiff, nameDiff, avgPriceDiffPercent, total: menuItems.length };
  }, [menuItems]);

  // Get item comparison status
  const getItemStatus = (item: MenuItem): ComparisonStatus => {
    if (item.price_uber && !item.price_deliveroo) return "uber_only";
    if (!item.price_uber && item.price_deliveroo) return "deliveroo_only";
    if (item.price_uber && item.price_deliveroo) {
      if (item.price_uber !== item.price_deliveroo) return "price_diff";
      return "identical";
    }
    return "identical";
  };

  const hasDescriptionDiff = (item: MenuItem): boolean => {
    const uberDesc = item.description_uber || item.description || "";
    const deliverooDesc = item.description_deliveroo || "";
    return !!(uberDesc && deliverooDesc && uberDesc !== deliverooDesc);
  };

  const hasNameDiff = (item: MenuItem): boolean => {
    return !!(item.name_uber && item.name_deliveroo && item.name_uber !== item.name_deliveroo);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (statusFilter === "all") return matchesSearch;
      if (statusFilter === "desc_diff") return matchesSearch && hasDescriptionDiff(item);
      if (statusFilter === "name_diff") return matchesSearch && hasNameDiff(item);
      
      return matchesSearch && getItemStatus(item) === statusFilter;
    });
  }, [menuItems, searchQuery, statusFilter]);

  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const calculatePriceDiff = (item: MenuItem) => {
    if (!item.price_uber || !item.price_deliveroo) return null;
    return ((item.price_deliveroo - item.price_uber) / item.price_uber * 100);
  };

  // Sync price from one platform to another
  const syncPrice = async (item: MenuItem, direction: "uber_to_deliveroo" | "deliveroo_to_uber") => {
    const newPrice = direction === "uber_to_deliveroo" ? item.price_uber : item.price_deliveroo;
    const fieldToUpdate = direction === "uber_to_deliveroo" ? "price_deliveroo" : "price_uber";

    const { error } = await supabase
      .from("menu_items")
      .update({ [fieldToUpdate]: newPrice })
      .eq("id", item.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de synchroniser le prix",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Prix synchronisé",
        description: `${item.name} : ${formatPrice(newPrice)}`,
      });
      onRefresh();
    }
  };

  const viewDescriptions = (item: MenuItem) => {
    setSelectedItem(item);
    setIsDescriptionDialogOpen(true);
  };

  const getStatusBadge = (status: ComparisonStatus) => {
    switch (status) {
      case "identical":
        return <Badge variant="default" className="bg-emerald-500 gap-1"><CheckCircle2 className="h-3 w-3" />Identique</Badge>;
      case "price_diff":
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 gap-1"><AlertTriangle className="h-3 w-3" />Prix différent</Badge>;
      case "uber_only":
        return <Badge variant="outline" className="text-[#06C167] border-[#06C167] gap-1"><UberEatsIcon className="h-3 w-3" />Uber uniquement</Badge>;
      case "deliveroo_only":
        return <Badge variant="outline" className="text-[#00CCBC] border-[#00CCBC] gap-1"><DeliverooIcon className="h-3 w-3" />Deliveroo uniquement</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("all")}>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Produits total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("identical")}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold">{stats.identical}</p>
            </div>
            <p className="text-xs text-muted-foreground">Prix identiques</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("price_diff")}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-2xl font-bold">{stats.priceDiff}</p>
            </div>
            <p className="text-xs text-muted-foreground">Prix différents</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("uber_only")}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <UberEatsIcon className="h-4 w-4" />
              <p className="text-2xl font-bold">{stats.uberOnly}</p>
            </div>
            <p className="text-xs text-muted-foreground">Uber uniquement</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("deliveroo_only")}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <DeliverooIcon className="h-4 w-4" />
              <p className="text-2xl font-bold">{stats.deliverooOnly}</p>
            </div>
            <p className="text-xs text-muted-foreground">Deliveroo uniquement</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("desc_diff")}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <p className="text-2xl font-bold">{stats.descDiff}</p>
            </div>
            <p className="text-xs text-muted-foreground">Desc. différentes</p>
          </CardContent>
        </Card>
        {stats.nameDiff > 0 && (
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("name_diff")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-500" />
                <p className="text-2xl font-bold">{stats.nameDiff}</p>
              </div>
              <p className="text-xs text-muted-foreground">Noms différents</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Average price difference info */}
      {stats.avgPriceDiffPercent > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg flex items-center gap-3">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Écart moyen de prix entre plateformes</p>
            <p className="text-2xl font-bold">{stats.avgPriceDiffPercent.toFixed(1)}%</p>
          </div>
        </div>
      )}

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
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ComparisonStatus)}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                <SelectItem value="identical">Prix identiques</SelectItem>
                <SelectItem value="price_diff">Prix différents</SelectItem>
                <SelectItem value="uber_only">Uber uniquement</SelectItem>
                <SelectItem value="deliveroo_only">Deliveroo uniquement</SelectItem>
                <SelectItem value="desc_diff">Descriptions différentes</SelectItem>
                <SelectItem value="name_diff">Noms différents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comparaison des catalogues ({filteredItems.length})</CardTitle>
          <CardDescription>
            Comparez les prix et descriptions entre Uber Eats et Deliveroo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <UberEatsIcon className="h-4 w-4" />
                      Prix Uber
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <DeliverooIcon className="h-4 w-4" />
                      Prix Deliveroo
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const status = getItemStatus(item);
                  const priceDiff = calculatePriceDiff(item);
                  const hasDescDiff = hasDescriptionDiff(item);

                  const hasNameDiff = item.name_uber && item.name_deliveroo && item.name_uber !== item.name_deliveroo;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {item.name}
                            {hasDescDiff && (
                              <Badge variant="outline" className="text-xs text-blue-500 border-blue-500">
                                Desc. ≠
                              </Badge>
                            )}
                            {hasNameDiff && (
                              <Badge variant="outline" className="text-xs text-purple-500 border-purple-500">
                                Nom ≠
                              </Badge>
                            )}
                          </div>
                          {hasNameDiff && (
                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <UberEatsIcon className="h-3 w-3" />
                                {item.name_uber}
                              </span>
                              <span className="flex items-center gap-1">
                                <DeliverooIcon className="h-3 w-3" />
                                {item.name_deliveroo}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category ? (
                          <Badge variant="secondary">{item.category}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(item.price_uber)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(item.price_deliveroo)}
                      </TableCell>
                      <TableCell className="text-right">
                        {priceDiff !== null ? (
                          <span className={priceDiff > 0 ? "text-emerald-500" : priceDiff < 0 ? "text-red-500" : ""}>
                            {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}%
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(item.description_uber || item.description || item.description_deliveroo) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => viewDescriptions(item)}
                              title="Voir les descriptions"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {item.price_uber && !item.price_deliveroo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => syncPrice(item, "uber_to_deliveroo")}
                              className="text-xs gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              → Deliveroo
                            </Button>
                          )}
                          {!item.price_uber && item.price_deliveroo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => syncPrice(item, "deliveroo_to_uber")}
                              className="text-xs gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              → Uber
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Description Comparison Dialog */}
      <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Comparaison des descriptions</DialogTitle>
            <DialogDescription>
              {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <UberEatsIcon className="h-5 w-5" />
                    <CardTitle className="text-sm">Uber Eats</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {selectedItem.description_uber || selectedItem.description || (
                      <span className="text-muted-foreground italic">Pas de description</span>
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <DeliverooIcon className="h-5 w-5" />
                    <CardTitle className="text-sm">Deliveroo</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {selectedItem.description_deliveroo || (
                      <span className="text-muted-foreground italic">Pas de description</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
