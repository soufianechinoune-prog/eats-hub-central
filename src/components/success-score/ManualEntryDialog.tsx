import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const TIER_OPTIONS = [
  { value: 'Excellent', label: 'Excellent' },
  { value: 'Great', label: 'Très Bon' },
  { value: 'Good', label: 'Bon' },
  { value: 'Fair', label: 'Correct' },
  { value: 'Poor', label: 'Insuffisant' },
];

interface ManualEntryDialogProps {
  onSuccess?: () => void;
}

export function ManualEntryDialog({ onSuccess }: ManualEntryDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [scoreMonth, setScoreMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [scoreTier, setScoreTier] = useState<string>("");
  const [operationalExcellence, setOperationalExcellence] = useState<string>("");
  const [menuDetails, setMenuDetails] = useState<string>("");
  const [ratings, setRatings] = useState<string>("");
  const [sustainablePackaging, setSustainablePackaging] = useState<string>("");
  const [salesAmount, setSalesAmount] = useState<string>("");
  const [unfulfilledOrders, setUnfulfilledOrders] = useState<string>("");
  const [avoidableCourierWait, setAvoidableCourierWait] = useState<string>("");
  const [incorrectOrders, setIncorrectOrders] = useState<string>("");
  const [foodQuality, setFoodQuality] = useState<string>("");

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Load existing data when restaurant/month changes
  useEffect(() => {
    if (!restaurantId || !scoreMonth) return;

    const loadExisting = async () => {
      const normalizedMonth = scoreMonth.length === 7 ? `${scoreMonth}-01` : scoreMonth;
      const { data } = await supabase
        .from("success_scores")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("score_month", normalizedMonth)
        .maybeSingle();

      if (data) {
        setScoreTier(data.score_tier || "");
        setOperationalExcellence(data.operational_excellence?.toString() || "");
        setMenuDetails(data.menu_details?.toString() || "");
        setRatings(data.ratings?.toString() || "");
        setSustainablePackaging(data.sustainable_packaging?.toString() || "");
        setSalesAmount(data.sales_amount?.toString() || "");
        setUnfulfilledOrders(data.unfulfilled_orders?.toString() || "");
        setAvoidableCourierWait(data.avoidable_courier_wait?.toString() || "");
        setIncorrectOrders(data.incorrect_orders?.toString() || "");
        setFoodQuality(data.food_quality?.toString() || "");
      } else {
        setScoreTier("");
        setOperationalExcellence("");
        setMenuDetails("");
        setRatings("");
        setSustainablePackaging("");
        setSalesAmount("");
        setUnfulfilledOrders("");
        setAvoidableCourierWait("");
        setIncorrectOrders("");
        setFoodQuality("");
      }
    };

    loadExisting();
  }, [restaurantId, scoreMonth]);

  const resetForm = () => {
    setScoreTier("");
    setOperationalExcellence("");
    setMenuDetails("");
    setRatings("");
    setSustainablePackaging("");
    setSalesAmount("");
    setUnfulfilledOrders("");
    setAvoidableCourierWait("");
    setIncorrectOrders("");
    setFoodQuality("");
  };

  const handleSave = async (andNext: boolean = false) => {
    if (!restaurantId || !scoreMonth || !scoreTier) {
      toast.error("Veuillez remplir le restaurant, le mois et le niveau");
      return;
    }

    setSaving(true);
    try {
      const normalizedMonth = scoreMonth.length === 7 ? `${scoreMonth}-01` : scoreMonth;
      const { error } = await supabase
        .from("success_scores")
        .upsert({
          restaurant_id: restaurantId,
          score_month: normalizedMonth,
          score_tier: scoreTier,
          operational_excellence: operationalExcellence ? parseFloat(operationalExcellence) : null,
          menu_details: menuDetails ? parseFloat(menuDetails) : null,
          ratings: ratings ? parseFloat(ratings) : null,
          sustainable_packaging: sustainablePackaging ? parseFloat(sustainablePackaging) : null,
          sales_amount: salesAmount ? parseFloat(salesAmount) : null,
        }, {
          onConflict: 'restaurant_id,score_month'
        });

      if (error) throw error;

      toast.success("Données enregistrées");
      queryClient.invalidateQueries({ queryKey: ["success-scores"] });
      onSuccess?.();

      if (andNext && restaurants) {
        // Move to next restaurant
        const currentIndex = restaurants.findIndex(r => r.id === restaurantId);
        if (currentIndex < restaurants.length - 1) {
          setRestaurantId(restaurants[currentIndex + 1].id);
        } else {
          toast.info("Tous les restaurants ont été saisis");
          setOpen(false);
        }
      } else {
        setOpen(false);
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Pencil className="h-4 w-4" />
          Saisie manuelle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saisie manuelle - Score de Réussite</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Month selector */}
          <div className="space-y-2">
            <Label htmlFor="month">Mois concerné</Label>
            <Input
              id="month"
              type="month"
              value={scoreMonth}
              onChange={(e) => setScoreMonth(e.target.value)}
            />
          </div>

          {/* Restaurant selector */}
          <div className="space-y-2">
            <Label>Restaurant</Label>
            <Select value={restaurantId} onValueChange={setRestaurantId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un restaurant" />
              </SelectTrigger>
              <SelectContent>
                {restaurants?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tier selector */}
          <div className="space-y-2">
            <Label>Niveau</Label>
            <Select value={scoreTier} onValueChange={setScoreTier}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner le niveau" />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map((tier) => (
                  <SelectItem key={tier.value} value={tier.value}>
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opex">Excellence Op. (%)</Label>
              <Input
                id="opex"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="97.0"
                value={operationalExcellence}
                onChange={(e) => setOperationalExcellence(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="menu">Détails Menu (%)</Label>
              <Input
                id="menu"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="81"
                value={menuDetails}
                onChange={(e) => setMenuDetails(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ratings">Note (/5)</Label>
              <Input
                id="ratings"
                type="number"
                min="0"
                max="5"
                step="0.01"
                placeholder="4.40"
                value={ratings}
                onChange={(e) => setRatings(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="packaging">Emballages (%)</Label>
              <Input
                id="packaging"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="100"
                value={sustainablePackaging}
                onChange={(e) => setSustainablePackaging(e.target.value)}
              />
            </div>
          </div>

          {/* Sales amount */}
          <div className="space-y-2">
            <Label htmlFor="sales">CA mensuel (€)</Label>
            <Input
              id="sales"
              type="number"
              min="0"
              step="1"
              placeholder="119084"
              value={salesAmount}
              onChange={(e) => setSalesAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="gap-1"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer et suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
