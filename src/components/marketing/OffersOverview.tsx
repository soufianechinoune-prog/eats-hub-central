import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Gift, Users, ShoppingCart, Percent, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from "lucide-react";
import { OffersCampaign } from "@/hooks/useMarketingCampaigns";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type SortField = "product" | "type" | "restaurant" | "date" | "sales" | "newCustomers" | "orders" | "funding" | "status";
type SortDirection = "asc" | "desc";

interface OffersOverviewProps {
  offers: OffersCampaign[];
  stats: {
    totalSales: number;
    totalNewCustomers: number;
    totalOrders: number;
    avgUberFunding: number;
    campaignCount: number;
    byType: Record<string, { count: number; sales: number; orders: number; newCustomers: number }>;
  };
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function OffersOverview({ offers, stats }: OffersOverviewProps) {
  const [editingFunding, setEditingFunding] = useState<string | null>(null);
  const [fundingValue, setFundingValue] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRestaurant, setFilterRestaurant] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const queryClient = useQueryClient();

  // Extract unique values for filters
  const uniqueTypes = useMemo(() => {
    const types = new Set(offers.map(o => o.offer_type).filter(Boolean));
    return Array.from(types).sort();
  }, [offers]);

  const uniqueRestaurants = useMemo(() => {
    const restaurants = new Set(offers.flatMap(o => o.restaurant_names || []).filter(Boolean));
    return Array.from(restaurants).sort();
  }, [offers]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(offers.map(o => o.change_context?.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [offers]);

  // Filter and sort offers
  const filteredAndSortedOffers = useMemo(() => {
    let filtered = [...offers];

    // Apply filters
    if (filterType !== "all") {
      filtered = filtered.filter(o => o.offer_type === filterType);
    }
    if (filterRestaurant !== "all") {
      filtered = filtered.filter(o => o.restaurant_names?.includes(filterRestaurant));
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter(o => o.change_context?.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "product":
          comparison = (a.items_affected || a.title || "").localeCompare(b.items_affected || b.title || "");
          break;
        case "type":
          comparison = (a.offer_type || "").localeCompare(b.offer_type || "");
          break;
        case "restaurant":
          comparison = (a.restaurant_names?.[0] || "").localeCompare(b.restaurant_names?.[0] || "");
          break;
        case "date":
          comparison = new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime();
          break;
        case "sales":
          comparison = (a.generated_sales || 0) - (b.generated_sales || 0);
          break;
        case "newCustomers":
          comparison = (a.new_customers || 0) - (b.new_customers || 0);
          break;
        case "orders":
          comparison = (a.orders || 0) - (b.orders || 0);
          break;
        case "funding":
          comparison = (a.uber_funding_percent || 0) - (b.uber_funding_percent || 0);
          break;
        case "status":
          comparison = (a.change_context?.status || "").localeCompare(b.change_context?.status || "");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [offers, filterType, filterRestaurant, filterStatus, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="ml-1 h-3 w-3" /> 
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const hasActiveFilters = filterType !== "all" || filterRestaurant !== "all" || filterStatus !== "all";

  const clearFilters = () => {
    setFilterType("all");
    setFilterRestaurant("all");
    setFilterStatus("all");
  };

  const handleFundingUpdate = async (offerId: string, newValue: number) => {
    try {
      // Fetch current change_context
      const { data: currentData, error: fetchError } = await supabase
        .from("restaurant_actions")
        .select("change_context")
        .eq("id", offerId)
        .single();

      if (fetchError) throw fetchError;

      const currentContext = typeof currentData?.change_context === 'object' && currentData?.change_context !== null
        ? currentData.change_context
        : {};
      const updatedContext = {
        ...(currentContext as Record<string, unknown>),
        uber_funding_percent: newValue,
      };

      const { error } = await supabase
        .from("restaurant_actions")
        .update({ change_context: updatedContext })
        .eq("id", offerId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      toast.success("Co-financement mis à jour");
    } catch (error) {
      console.error("Error updating funding:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setEditingFunding(null);
    }
  };

  const byTypeData = Object.entries(stats.byType).map(([type, data]) => ({
    name: type,
    ventes: data.sales,
    commandes: data.orders,
    nouveaux: data.newCustomers,
    count: data.count,
  }));

  const pieData = Object.entries(stats.byType).map(([type, data]) => ({
    name: type,
    value: data.sales,
  }));

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "en cours":
        return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">Actif</Badge>;
      case "completed":
      case "terminé":
        return <Badge variant="secondary">Terminé</Badge>;
      case "scheduled":
      case "planifié":
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">Planifié</Badge>;
      default:
        return <Badge variant="outline">{status || "N/A"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventes générées</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(stats.totalSales)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nouveaux clients</p>
                <p className="text-2xl font-bold text-blue-700">
                  {stats.totalNewCustomers.toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commandes</p>
                <p className="text-2xl font-bold text-amber-700">
                  {stats.totalOrders.toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Percent className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Financement Uber moy.</p>
                <p className="text-2xl font-bold text-purple-700">
                  {stats.avgUberFunding.toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Performance par type d'offre
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byTypeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="ventes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée d'offres disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Répartition des ventes par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Historique des offres ({filteredAndSortedOffers.length})</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Réinitialiser filtres
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center p-3 bg-muted/30 rounded-lg">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Type d'offre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRestaurant} onValueChange={setFilterRestaurant}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Restaurant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les restaurants</SelectItem>
                {uniqueRestaurants.map(restaurant => (
                  <SelectItem key={restaurant} value={restaurant}>{restaurant}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort("product")}>
                    Produit/Offre <SortIcon field="product" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort("type")}>
                    Type <SortIcon field="type" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort("restaurant")}>
                    Restaurant <SortIcon field="restaurant" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort("date")}>
                    Période <SortIcon field="date" />
                  </Button>
                </TableHead>
                <TableHead>Audience</TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-8 px-2 -mr-2" onClick={() => handleSort("sales")}>
                    Ventes <SortIcon field="sales" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-8 px-2 -mr-2" onClick={() => handleSort("newCustomers")}>
                    Nouveaux <SortIcon field="newCustomers" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-8 px-2 -mr-2" onClick={() => handleSort("orders")}>
                    Commandes <SortIcon field="orders" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-8 px-2 -mr-2" onClick={() => handleSort("funding")}>
                    Financement <SortIcon field="funding" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort("status")}>
                    Statut <SortIcon field="status" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedOffers.slice(0, 50).map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium max-w-[200px]">
                    <div className="truncate" title={offer.title || ""}>
                      {offer.items_affected || offer.title || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {offer.offer_type || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {offer.restaurant_names && offer.restaurant_names.length > 0
                      ? offer.restaurant_names[0]
                      : "N/A"}
                    {offer.restaurant_names && offer.restaurant_names.length > 1 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        +{offer.restaurant_names.length - 1}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {offer.start_date
                      ? format(new Date(offer.start_date), "dd MMM", { locale: fr })
                      : "N/A"}{" "}
                    -{" "}
                    {offer.end_date
                      ? format(new Date(offer.end_date), "dd MMM yy", { locale: fr })
                      : "en cours"}
                  </TableCell>
                  <TableCell className="text-sm">{offer.audience || "Tous"}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(offer.generated_sales)}
                  </TableCell>
                  <TableCell className="text-right">{offer.new_customers}</TableCell>
                  <TableCell className="text-right">{offer.orders}</TableCell>
                  <TableCell className="text-right">
                    {editingFunding === offer.id ? (
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 h-7 text-right text-sm"
                        value={fundingValue}
                        onChange={(e) => setFundingValue(e.target.value)}
                        onBlur={() => {
                          const val = Math.min(100, Math.max(0, parseInt(fundingValue) || 0));
                          handleFundingUpdate(offer.id, val);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = Math.min(100, Math.max(0, parseInt(fundingValue) || 0));
                            handleFundingUpdate(offer.id, val);
                          } else if (e.key === "Escape") {
                            setEditingFunding(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-purple-500/10 hover:border-purple-500/30 transition-colors"
                        onClick={() => {
                          setEditingFunding(offer.id);
                          setFundingValue((offer.uber_funding_percent || 0).toString());
                        }}
                      >
                        {offer.uber_funding_percent || 0}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(offer.change_context?.status || "")}</TableCell>
                </TableRow>
              ))}
              {filteredAndSortedOffers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {hasActiveFilters ? "Aucune offre ne correspond aux filtres" : "Aucune offre promotionnelle importée"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
