import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Save, Pencil, Trash2, Calculator, ArrowLeft, AlertTriangle } from "lucide-react";
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

export default function DataEntryFees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const restaurantFromUrl = searchParams.get("restaurant");
  
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>(restaurantFromUrl || "");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("uber_eats");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [uberFee, setUberFee] = useState<string>("");
  const [marketingFee, setMarketingFee] = useState<string>("");
  const [offersCost, setOffersCost] = useState<string>("");
  const [offerUsageFee, setOfferUsageFee] = useState<string>("");
  const [adsCost, setAdsCost] = useState<string>("");
  const [orderError, setOrderError] = useState<string>("");
  const [errorAdjustments, setErrorAdjustments] = useState<string>("");
  const [ecoContribution, setEcoContribution] = useState<string>("");
  const [netPayout, setNetPayout] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
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
    queryKey: ["monthly_fees", selectedRestaurant, selectedPlatform],
    queryFn: async () => {
      if (!selectedRestaurant) return [];
      const { data, error } = await supabase
        .from("monthly_fees")
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

  // Fetch revenue for percentage calculations
  const { data: revenueData } = useQuery({
    queryKey: ["monthly_revenue", selectedRestaurant, selectedYear, selectedMonth, selectedPlatform],
    queryFn: async () => {
      if (!selectedRestaurant) return null;
      const { data, error } = await supabase
        .from("monthly_revenue")
        .select("revenue_ttc")
        .eq("restaurant_id", selectedRestaurant)
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .eq("platform", selectedPlatform)
        .maybeSingle();
      if (error) throw error;
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
        platform: selectedPlatform,
        uber_fee: parseFloat(uberFee) || 0,
        marketing_fee: parseFloat(marketingFee) || 0,
        offers_cost: parseFloat(offersCost) || 0,
        offer_usage_fee: parseFloat(offerUsageFee) || 0,
        ads_cost: parseFloat(adsCost) || 0,
        order_error: parseFloat(orderError) || 0,
        error_adjustments: parseFloat(errorAdjustments) || 0,
        eco_contribution: parseFloat(ecoContribution) || 0,
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
          .upsert(payload, { onConflict: "restaurant_id,year,month,platform" });
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
    setOfferUsageFee("");
    setAdsCost("");
    setOrderError("");
    setErrorAdjustments("");
    setEcoContribution("");
    setNetPayout("");
    setNotes("");
    setEditingId(null);
  };

  const handleEdit = (entry: any) => {
    setSelectedYear(entry.year);
    setSelectedMonth(entry.month);
    setSelectedPlatform(entry.platform || "uber_eats");
    setUberFee(entry.uber_fee?.toString() || "");
    setMarketingFee(entry.marketing_fee?.toString() || "");
    setOffersCost(entry.offers_cost?.toString() || "");
    setOfferUsageFee(entry.offer_usage_fee?.toString() || "");
    setAdsCost(entry.ads_cost?.toString() || "");
    setOrderError(entry.order_error?.toString() || "");
    setErrorAdjustments(entry.error_adjustments?.toString() || "");
    setEcoContribution(entry.eco_contribution?.toString() || "");
    setNetPayout(entry.net_payout?.toString() || "");
    setNotes(entry.notes || "");
    setEditingId(entry.id);
  };

  // Calculate totals
  const totalFees = 
    (parseFloat(uberFee) || 0) +
    (parseFloat(marketingFee) || 0) +
    (parseFloat(offersCost) || 0) +
    (parseFloat(offerUsageFee) || 0) +
    (parseFloat(adsCost) || 0) +
    (parseFloat(orderError) || 0) +
    (parseFloat(errorAdjustments) || 0) +
    (parseFloat(ecoContribution) || 0);

  const revenue = revenueData?.revenue_ttc ? Number(revenueData.revenue_ttc) : 0;
  const feesPercentage = revenue > 0 ? ((totalFees / revenue) * 100).toFixed(1) : "0.0";

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
          <h1 className="text-3xl font-bold text-foreground">Saisie Frais & Marketing</h1>
          <p className="text-muted-foreground mt-2">
            Entrez les frais et dépenses marketing mensuels
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frais UBER (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={uberFee}
                  onChange={(e) => setUberFee(e.target.value)}
                  placeholder="Ex: 4500.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Marketing UBER (€)</Label>
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
                <Label className="italic">Offres sur les articles (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={offersCost}
                  onChange={(e) => setOffersCost(e.target.value)}
                  placeholder="Ex: 350.00"
                />
              </div>

              <div className="space-y-2">
                <Label className="italic">Frais d'utilisation de l'offre (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={offerUsageFee}
                  onChange={(e) => setOfferUsageFee(e.target.value)}
                  placeholder="Ex: 50.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="italic">Dépenses publicitaire (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adsCost}
                  onChange={(e) => setAdsCost(e.target.value)}
                  placeholder="Ex: 150.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Erreur de commande (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={orderError}
                  onChange={(e) => setOrderError(e.target.value)}
                  placeholder="Ex: 30.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ajustements liés aux erreurs (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={errorAdjustments}
                  onChange={(e) => setErrorAdjustments(e.target.value)}
                  placeholder="Ex: 50.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Eco contribution (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ecoContribution}
                  onChange={(e) => setEcoContribution(e.target.value)}
                  placeholder="Ex: 25.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Versement (€)</Label>
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

            {/* Warning for existing entry */}
            {existingEntry && !editingId && (
              <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Des données existent déjà pour {getMonthLabel(selectedMonth)} {selectedYear}</span>
                  <div className="mt-1 text-sm">
                    Total frais: {(Number(existingEntry.uber_fee) + Number(existingEntry.marketing_fee) + Number(existingEntry.offers_cost) + Number(existingEntry.offer_usage_fee || 0) + Number(existingEntry.ads_cost) + Number(existingEntry.order_error || 0) + Number(existingEntry.error_adjustments) + Number(existingEntry.eco_contribution)).toLocaleString("fr-FR")} € • 
                    Net: {Number(existingEntry.net_payout).toLocaleString("fr-FR")} €
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
                      <TableHead className="text-right">Commission</TableHead>
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
                        <TableCell>
                          {getPlatformBadge(entry.platform || "uber_eats")}
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
                      <p>Total frais: {existingEntry ? (Number(existingEntry.uber_fee) + Number(existingEntry.marketing_fee) + Number(existingEntry.offers_cost) + Number(existingEntry.offer_usage_fee || 0) + Number(existingEntry.ads_cost) + Number(existingEntry.order_error || 0) + Number(existingEntry.error_adjustments) + Number(existingEntry.eco_contribution)).toLocaleString("fr-FR") : 0} €</p>
                      <p>Net: {existingEntry ? Number(existingEntry.net_payout).toLocaleString("fr-FR") : 0} €</p>
                    </div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                    <p className="font-medium mb-2 text-foreground">Nouvelles données</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p>Total frais: {totalFees.toLocaleString("fr-FR")} €</p>
                      <p>Net: {parseFloat(netPayout || "0").toLocaleString("fr-FR")} €</p>
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