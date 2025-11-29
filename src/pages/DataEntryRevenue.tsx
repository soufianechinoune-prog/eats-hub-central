import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Pencil, Trash2, ArrowLeft } from "lucide-react";

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

export default function DataEntryRevenue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const restaurantFromUrl = searchParams.get("restaurant");
  
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>(restaurantFromUrl || "");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [revenueTtc, setRevenueTtc] = useState<string>("");
  const [orderCount, setOrderCount] = useState<string>("");
  const [workingDays, setWorkingDays] = useState<string>("");
  const [averageBasket, setAverageBasket] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Update selectedRestaurant when URL param changes
  useEffect(() => {
    if (restaurantFromUrl) {
      setSelectedRestaurant(restaurantFromUrl);
    }
  }, [restaurantFromUrl]);

  // Fetch restaurants
  const { data: restaurants, isLoading: loadingRestaurants } = useQuery({
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

  // Fetch existing entries for selected restaurant
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ["monthly_revenue", selectedRestaurant],
    queryFn: async () => {
      if (!selectedRestaurant) return [];
      const { data, error } = await supabase
        .from("monthly_revenue")
        .select("*")
        .eq("restaurant_id", selectedRestaurant)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRestaurant,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Use manual basket if provided, otherwise calculate
      const calculatedBasket = orderCount && parseFloat(orderCount) > 0 
        ? parseFloat(revenueTtc || "0") / parseFloat(orderCount) 
        : 0;
      const finalBasket = averageBasket ? parseFloat(averageBasket) : calculatedBasket;

      const payload = {
        restaurant_id: selectedRestaurant,
        year: selectedYear,
        month: selectedMonth,
        revenue_ttc: parseFloat(revenueTtc) || 0,
        order_count: parseInt(orderCount) || 0,
        working_days: workingDays ? parseInt(workingDays) : null,
        average_basket: finalBasket,
      };

      if (editingId) {
        const { error } = await supabase
          .from("monthly_revenue")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("monthly_revenue")
          .upsert(payload, { onConflict: "restaurant_id,year,month" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Données enregistrées avec succès" });
      queryClient.invalidateQueries({ queryKey: ["monthly_revenue"] });
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
        .from("monthly_revenue")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entrée supprimée" });
      queryClient.invalidateQueries({ queryKey: ["monthly_revenue"] });
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
    setRevenueTtc("");
    setOrderCount("");
    setWorkingDays("");
    setAverageBasket("");
    setEditingId(null);
  };

  const handleEdit = (entry: any) => {
    setSelectedYear(entry.year);
    setSelectedMonth(entry.month);
    setRevenueTtc(entry.revenue_ttc?.toString() || "");
    setOrderCount(entry.order_count?.toString() || "");
    setWorkingDays(entry.working_days?.toString() || "");
    setAverageBasket(entry.average_basket?.toString() || "");
    setEditingId(entry.id);
  };

  // Calculate preview values
  const calculatedBasket = orderCount && parseFloat(orderCount) > 0 
    ? (parseFloat(revenueTtc || "0") / parseFloat(orderCount)).toFixed(2) 
    : "0.00";
  const previewBasket = averageBasket || calculatedBasket;
  const previewPerDay = workingDays && parseFloat(workingDays) > 0 
    ? (parseFloat(revenueTtc || "0") / parseFloat(workingDays)).toFixed(2) 
    : "0.00";

  const getMonthLabel = (month: number) => MONTHS.find(m => m.value === month)?.label || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {restaurantFromUrl && (
          <Button variant="ghost" size="icon" onClick={() => navigate(`/restaurants/${restaurantFromUrl}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Saisie CA & Commandes</h1>
          <p className="text-muted-foreground mt-2">
            Entrez les données mensuelles de chiffre d'affaires et de commandes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Modifier l'entrée" : "Nouvelle entrée"}</CardTitle>
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
              <Label>CA TTC (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={revenueTtc}
                onChange={(e) => setRevenueTtc(e.target.value)}
                placeholder="Ex: 15000.50"
              />
            </div>

            <div className="space-y-2">
              <Label>Nombre de commandes</Label>
              <Input
                type="number"
                value={orderCount}
                onChange={(e) => setOrderCount(e.target.value)}
                placeholder="Ex: 450"
              />
            </div>

            <div className="space-y-2">
              <Label>Jours ouvrés (optionnel)</Label>
              <Input
                type="number"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                placeholder="Ex: 30"
              />
            </div>

            <div className="space-y-2">
              <Label>Panier moyen (€) - optionnel</Label>
              <Input
                type="number"
                step="0.01"
                value={averageBasket}
                onChange={(e) => setAverageBasket(e.target.value)}
                placeholder={`Auto: ${calculatedBasket} €`}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour calculer automatiquement (CA ÷ Commandes)
              </p>
            </div>

            {/* Preview calculations */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Calculs automatiques :</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Panier moyen :</span>
                <span className="font-medium">{previewBasket} €</span>
                <span className="text-muted-foreground">CA/jour :</span>
                <span className="font-medium">{previewPerDay} €</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!selectedRestaurant || saveMutation.isPending}
                className="flex-1"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingId ? "Mettre à jour" : "Enregistrer"}
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
            <CardTitle>Historique des saisies</CardTitle>
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
                      <TableHead className="text-right">CA TTC</TableHead>
                      <TableHead className="text-right">Cmd</TableHead>
                      <TableHead className="text-right">Panier</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {getMonthLabel(entry.month)} {entry.year}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(entry.revenue_ttc).toLocaleString("fr-FR")} €
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.order_count}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(entry.average_basket).toFixed(2)} €
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
    </div>
  );
}