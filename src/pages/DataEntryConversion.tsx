import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Pencil, Trash2, TrendingUp, ArrowLeft, AlertTriangle } from "lucide-react";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";

const MONTHS = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const PLATFORMS = [
  { 
    value: "uber_eats", 
    label: "Uber Eats", 
    color: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30", 
    cardStyle: "border-green-500 bg-green-50/50 dark:bg-green-950/20",
    indicatorStyle: "bg-green-500",
    Logo: UberEatsLogo 
  },
  { 
    value: "deliveroo", 
    label: "Deliveroo", 
    color: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30", 
    cardStyle: "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20",
    indicatorStyle: "bg-cyan-500",
    Logo: DeliverooLogo 
  },
];

export default function DataEntryConversion() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const restaurantFromUrl = searchParams.get("restaurant");
  
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>(restaurantFromUrl || "");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("uber_eats");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [visits, setVisits] = useState<string>("");
  const [menuViews, setMenuViews] = useState<string>("");
  const [addToCart, setAddToCart] = useState<string>("");
  const [orders, setOrders] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Update selectedRestaurant when URL param changes
  useEffect(() => {
    if (restaurantFromUrl) {
      setSelectedRestaurant(restaurantFromUrl);
    }
  }, [restaurantFromUrl]);

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing entries for selected restaurant and platform
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ["monthly_conversion", selectedRestaurant, selectedPlatform],
    queryFn: async () => {
      if (!selectedRestaurant) return [];
      const { data, error } = await supabase
        .from("monthly_conversion")
        .select("*")
        .eq("restaurant_id", selectedRestaurant)
        .eq("platform", selectedPlatform)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRestaurant,
  });

  // Check if entry already exists for selected period
  const existingEntry = useMemo(() => {
    if (!entries || editingId) return null;
    return entries.find(
      (e) => e.year === selectedYear && e.month === selectedMonth
    );
  }, [entries, selectedYear, selectedMonth, editingId]);

  const getMonthLabel = (month: number) => MONTHS.find(m => m.value === month)?.label || "";

  // Handle save with confirmation
  const handleSave = () => {
    if (existingEntry && !editingId) {
      setShowConfirmDialog(true);
    } else {
      saveMutation.mutate();
    }
  };

  const confirmSave = () => {
    setShowConfirmDialog(false);
    saveMutation.mutate();
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        restaurant_id: selectedRestaurant,
        year: selectedYear,
        month: selectedMonth,
        platform: selectedPlatform,
        visits: parseInt(visits) || 0,
        menu_views: parseInt(menuViews) || 0,
        add_to_cart: parseInt(addToCart) || 0,
        orders: parseInt(orders) || 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from("monthly_conversion")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("monthly_conversion")
          .upsert(payload, { onConflict: "restaurant_id,year,month,platform" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Données enregistrées avec succès" });
      queryClient.invalidateQueries({ queryKey: ["monthly_conversion"] });
      resetForm();
    },
    onError: (error) => {
      toast({ 
        title: "Erreur lors de l'enregistrement", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("monthly_conversion")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entrée supprimée" });
      queryClient.invalidateQueries({ queryKey: ["monthly_conversion"] });
    },
    onError: (error) => {
      toast({ 
        title: "Erreur lors de la suppression", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setVisits("");
    setMenuViews("");
    setAddToCart("");
    setOrders("");
    setEditingId(null);
  };

  const handleEdit = (entry: any) => {
    setSelectedYear(entry.year);
    setSelectedMonth(entry.month);
    setSelectedPlatform(entry.platform || "uber_eats");
    setVisits(entry.visits?.toString() || "");
    setMenuViews(entry.menu_views?.toString() || "");
    setAddToCart(entry.add_to_cart?.toString() || "");
    setOrders(entry.orders?.toString() || "");
    setEditingId(entry.id);
  };

  // Calculate preview rates
  const v = parseInt(visits) || 0;
  const mv = parseInt(menuViews) || 0;
  const atc = parseInt(addToCart) || 0;
  const o = parseInt(orders) || 0;
  
  const viewRate = v > 0 ? ((mv / v) * 100).toFixed(1) : "0.0";
  const cartRate = mv > 0 ? ((atc / mv) * 100).toFixed(1) : "0.0";
  const conversionRate = atc > 0 ? ((o / atc) * 100).toFixed(1) : "0.0";
  const overallRate = v > 0 ? ((o / v) * 100).toFixed(1) : "0.0";

  const getPlatformBadge = (platform: string) => {
    const p = PLATFORMS.find(pl => pl.value === platform);
    return p ? (
      <Badge className={`${p.color} flex items-center gap-1.5`}>
        <p.Logo size={14} />
        {p.label}
      </Badge>
    ) : <Badge variant="outline">{platform}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {restaurantFromUrl && (
          <Button variant="ghost" size="icon" onClick={() => navigate(`/restaurants/${restaurantFromUrl}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Saisie Données de Conversion</h1>
          <p className="text-muted-foreground mt-2">
            Entrez les métriques du funnel de conversion mensuel
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Card */}
        <Card className={`transition-all duration-300 border-2 ${PLATFORMS.find(p => p.value === selectedPlatform)?.cardStyle}`}>
          <CardHeader className="relative">
            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-lg ${PLATFORMS.find(p => p.value === selectedPlatform)?.indicatorStyle}`} />
            <div className="flex items-center justify-between">
              <CardTitle>{editingId ? "Modifier l'entrée" : "Nouvelle entrée"}</CardTitle>
              <div className="flex items-center gap-2">
                {(() => {
                  const platform = PLATFORMS.find(p => p.value === selectedPlatform);
                  return platform ? (
                    <Badge className={`${platform.color} flex items-center gap-1.5`}>
                      <platform.Logo size={16} />
                      {platform.label}
                    </Badge>
                  ) : null;
                })()}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Restaurant</Label>
              <Select 
                value={selectedRestaurant} 
                onValueChange={setSelectedRestaurant}
                disabled={!!restaurantFromUrl}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} {r.city && `(${r.city})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform selector */}
            <div className="space-y-2">
              <Label>Plateforme</Label>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    variant={selectedPlatform === p.value ? "default" : "outline"}
                    className="flex items-center gap-2"
                    onClick={() => setSelectedPlatform(p.value)}
                  >
                    <p.Logo size={18} />
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Année</Label>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mois</Label>
                <Select 
                  value={selectedMonth.toString()} 
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre de visites</Label>
              <Input
                type="number"
                value={visits}
                onChange={(e) => setVisits(e.target.value)}
                placeholder="Ex: 5000"
              />
            </div>

            <div className="space-y-2">
              <Label>Consultations du menu</Label>
              <Input
                type="number"
                value={menuViews}
                onChange={(e) => setMenuViews(e.target.value)}
                placeholder="Ex: 3500"
              />
            </div>

            <div className="space-y-2">
              <Label>Ajouts au panier</Label>
              <Input
                type="number"
                value={addToCart}
                onChange={(e) => setAddToCart(e.target.value)}
                placeholder="Ex: 800"
              />
            </div>

            <div className="space-y-2">
              <Label>Commandes passées</Label>
              <Input
                type="number"
                value={orders}
                onChange={(e) => setOrders(e.target.value)}
                placeholder="Ex: 450"
              />
            </div>

            {/* Warning for existing entry */}
            {existingEntry && !editingId && (
              <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Des données existent déjà pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                  <div className="mt-1 text-sm">
                    Visites: {existingEntry.visits.toLocaleString("fr-FR")} • 
                    Commandes: {existingEntry.orders} • 
                    Taux: {Number(existingEntry.overall_rate).toFixed(1)}%
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 mt-1 text-amber-700 dark:text-amber-300"
                    onClick={() => handleEdit(existingEntry)}
                  >
                    Modifier cette entrée
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview calculations */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Taux de conversion :
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Visites → Menu :</span>
                <span className="font-medium">{viewRate}%</span>
                <span className="text-muted-foreground">Menu → Panier :</span>
                <span className="font-medium">{cartRate}%</span>
                <span className="text-muted-foreground">Panier → Commande :</span>
                <span className="font-medium">{conversionRate}%</span>
                <span className="text-muted-foreground font-medium">Taux global :</span>
                <span className="font-bold text-primary">{overallRate}%</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!selectedRestaurant || saveMutation.isPending}
                className="flex-1"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingId ? "Mettre à jour" : existingEntry ? "Remplacer les données" : "Enregistrer"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* History Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Historique des saisies</CardTitle>
              {(() => {
                const platform = PLATFORMS.find(p => p.value === selectedPlatform);
                return platform ? (
                  <Badge className={`${platform.color} flex items-center gap-1.5`}>
                    <platform.Logo size={14} />
                    {platform.label}
                  </Badge>
                ) : null;
              })()}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRestaurant ? (
              <p className="text-muted-foreground text-center py-8">
                Sélectionnez un restaurant pour voir l'historique
              </p>
            ) : loadingEntries ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : entries?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune donnée enregistrée
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead>Plateforme</TableHead>
                      <TableHead className="text-right">Visites</TableHead>
                      <TableHead className="text-right">Cmd</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {getMonthLabel(entry.month)} {entry.year}
                        </TableCell>
                        <TableCell>
                          {getPlatformBadge(entry.platform || "uber_eats")}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.visits.toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.orders}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(entry.overall_rate).toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer les données existantes ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Des données existent déjà pour {getMonthLabel(selectedMonth)} {selectedYear}.</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium mb-2 text-foreground">Données actuelles</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p>Visites: {existingEntry?.visits.toLocaleString("fr-FR") || 0}</p>
                      <p>Commandes: {existingEntry?.orders || 0}</p>
                      <p>Taux: {existingEntry ? Number(existingEntry.overall_rate).toFixed(1) : "0.0"}%</p>
                    </div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                    <p className="font-medium mb-2 text-foreground">Nouvelles données</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p>Visites: {parseInt(visits || "0").toLocaleString("fr-FR")}</p>
                      <p>Commandes: {orders || 0}</p>
                      <p>Taux: {overallRate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>
              Remplacer les données
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}