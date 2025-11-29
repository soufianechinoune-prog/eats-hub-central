import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Save, Pencil, Trash2, Calculator } from "lucide-react";

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

export default function DataEntryFees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [uberFee, setUberFee] = useState<string>("");
  const [marketingFee, setMarketingFee] = useState<string>("");
  const [offersCost, setOffersCost] = useState<string>("");
  const [adsCost, setAdsCost] = useState<string>("");
  const [errorAdjustments, setErrorAdjustments] = useState<string>("");
  const [otherFees, setOtherFees] = useState<string>("");
  const [netPayout, setNetPayout] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

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

  // Fetch existing entries
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ["monthly_fees", selectedRestaurant],
    queryFn: async () => {
      if (!selectedRestaurant) return [];
      const { data, error } = await supabase
        .from("monthly_fees")
        .select("*")
        .eq("restaurant_id", selectedRestaurant)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRestaurant,
  });

  // Fetch revenue for percentage calculations
  const { data: revenueData } = useQuery({
    queryKey: ["monthly_revenue", selectedRestaurant, selectedYear, selectedMonth],
    queryFn: async () => {
      if (!selectedRestaurant) return null;
      const { data, error } = await supabase
        .from("monthly_revenue")
        .select("revenue_ttc")
        .eq("restaurant_id", selectedRestaurant)
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!selectedRestaurant,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        restaurant_id: selectedRestaurant,
        year: selectedYear,
        month: selectedMonth,
        uber_fee: parseFloat(uberFee) || 0,
        marketing_fee: parseFloat(marketingFee) || 0,
        offers_cost: parseFloat(offersCost) || 0,
        ads_cost: parseFloat(adsCost) || 0,
        error_adjustments: parseFloat(errorAdjustments) || 0,
        other_fees: parseFloat(otherFees) || 0,
        net_payout: parseFloat(netPayout) || 0,
        notes: notes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("monthly_fees")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("monthly_fees")
          .upsert(payload, { onConflict: "restaurant_id,year,month" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Données enregistrées avec succès" });
      queryClient.invalidateQueries({ queryKey: ["monthly_fees"] });
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
        .from("monthly_fees")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entrée supprimée" });
      queryClient.invalidateQueries({ queryKey: ["monthly_fees"] });
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
    setUberFee("");
    setMarketingFee("");
    setOffersCost("");
    setAdsCost("");
    setErrorAdjustments("");
    setOtherFees("");
    setNetPayout("");
    setNotes("");
    setEditingId(null);
  };

  const handleEdit = (entry: any) => {
    setSelectedYear(entry.year);
    setSelectedMonth(entry.month);
    setUberFee(entry.uber_fee?.toString() || "");
    setMarketingFee(entry.marketing_fee?.toString() || "");
    setOffersCost(entry.offers_cost?.toString() || "");
    setAdsCost(entry.ads_cost?.toString() || "");
    setErrorAdjustments(entry.error_adjustments?.toString() || "");
    setOtherFees(entry.other_fees?.toString() || "");
    setNetPayout(entry.net_payout?.toString() || "");
    setNotes(entry.notes || "");
    setEditingId(entry.id);
  };

  // Calculate totals
  const totalFees = 
    (parseFloat(uberFee) || 0) +
    (parseFloat(marketingFee) || 0) +
    (parseFloat(offersCost) || 0) +
    (parseFloat(adsCost) || 0) +
    (parseFloat(errorAdjustments) || 0) +
    (parseFloat(otherFees) || 0);

  const revenue = revenueData?.revenue_ttc ? Number(revenueData.revenue_ttc) : 0;
  const feesPercentage = revenue > 0 ? ((totalFees / revenue) * 100).toFixed(1) : "0.0";

  const getMonthLabel = (month: number) => MONTHS.find(m => m.value === month)?.label || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Saisie Frais & Marketing</h1>
        <p className="text-muted-foreground mt-2">
          Entrez les frais Uber et dépenses marketing mensuels
        </p>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commission Uber (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={uberFee}
                  onChange={(e) => setUberFee(e.target.value)}
                  placeholder="Ex: 4500.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Frais marketing (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={marketingFee}
                  onChange={(e) => setMarketingFee(e.target.value)}
                  placeholder="Ex: 200.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Coût des offres (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={offersCost}
                  onChange={(e) => setOffersCost(e.target.value)}
                  placeholder="Ex: 350.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Publicité (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adsCost}
                  onChange={(e) => setAdsCost(e.target.value)}
                  placeholder="Ex: 150.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ajustements erreurs (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={errorAdjustments}
                  onChange={(e) => setErrorAdjustments(e.target.value)}
                  placeholder="Ex: 50.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Autres frais (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={otherFees}
                  onChange={(e) => setOtherFees(e.target.value)}
                  placeholder="Ex: 25.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Versement net reçu (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={netPayout}
                onChange={(e) => setNetPayout(e.target.value)}
                placeholder="Ex: 9724.50"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarques sur ce mois..."
                rows={2}
              />
            </div>

            {/* Preview calculations */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Récapitulatif :
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Total des frais :</span>
                <span className="font-medium">{totalFees.toLocaleString("fr-FR")} €</span>
                {revenue > 0 && (
                  <>
                    <span className="text-muted-foreground">CA du mois :</span>
                    <span className="font-medium">{revenue.toLocaleString("fr-FR")} €</span>
                    <span className="text-muted-foreground">% du CA :</span>
                    <span className="font-bold text-primary">{feesPercentage}%</span>
                  </>
                )}
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
                      <TableHead className="text-right">Uber</TableHead>
                      <TableHead className="text-right">Marketing</TableHead>
                      <TableHead className="text-right">Net</TableHead>
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
                          {Number(entry.uber_fee).toLocaleString("fr-FR")} €
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(entry.marketing_fee).toLocaleString("fr-FR")} €
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(entry.net_payout).toLocaleString("fr-FR")} €
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