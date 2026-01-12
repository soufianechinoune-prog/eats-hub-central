import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, CalendarPlus, Store, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type OfferType = "bogo" | "cross_product" | "percent_discount";
export type Platform = "uber" | "deliveroo";

export interface SimulationData {
  offerType: OfferType;
  platform: Platform;
  productName: string;
  productId: string;
  freeProductName?: string;
  freeProductId?: string;
  commission: number;
  offerFee: number;
  platformFunding: number;
  fundingType: "percent" | "euro";
  estimatedIncrease: number | null;
  netMarginWithOffer: number;
  breakevenPercent: number | null;
  // For percent discount
  discountPercent?: number;
  minSpend?: number;
  maxDiscountValue?: number;
}

interface Restaurant {
  id: string;
  name: string;
}

interface SaveAsActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simulationData: SimulationData;
}

const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  bogo: "1 acheté = 1 offert",
  cross_product: "1 acheté = 1 autre offert",
  percent_discount: "Réduction %",
};

export function SaveAsActionDialog({ 
  open, 
  onOpenChange, 
  simulationData 
}: SaveAsActionDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name")
          .order("name");
        
        if (error) throw error;
        setRestaurants(data || []);
        // Select all by default
        setSelectedRestaurantIds((data || []).map(r => r.id));
      } catch (error) {
        console.error("Error fetching restaurants:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      fetchRestaurants();
    }
  }, [open]);

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurantIds(prev => 
      prev.includes(id) 
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedRestaurantIds.length === restaurants.length) {
      setSelectedRestaurantIds([]);
    } else {
      setSelectedRestaurantIds(restaurants.map(r => r.id));
    }
  };

  const handleSave = async () => {
    if (!startDate) {
      toast({ 
        title: "Date requise", 
        description: "Veuillez sélectionner une date de début",
        variant: "destructive" 
      });
      return;
    }

    if (selectedRestaurantIds.length === 0) {
      toast({ 
        title: "Restaurant requis", 
        description: "Veuillez sélectionner au moins un restaurant",
        variant: "destructive" 
      });
      return;
    }

    setIsSaving(true);
    try {
      const platformValue = simulationData.platform === "uber" ? "uber_eats" : "deliveroo";
      
      // Build the title
      const platformLabel = simulationData.platform === "uber" ? "Uber" : "Deliveroo";
      let title = `${platformLabel} - ${simulationData.productName}`;
      if (simulationData.freeProductName) {
        title = `${platformLabel} - ${simulationData.productName} + ${simulationData.freeProductName}`;
      }
      if (simulationData.discountPercent) {
        title = `${platformLabel} - ${simulationData.discountPercent}% de réduction`;
      }

      // Build the change_context with all simulation parameters
      const changeContext = {
        simulation_type: simulationData.offerType,
        commission: simulationData.commission,
        offer_fee: simulationData.offerFee,
        platform_funding: simulationData.platformFunding,
        funding_type: simulationData.fundingType,
        estimated_increase: simulationData.estimatedIncrease,
        net_margin: simulationData.netMarginWithOffer,
        breakeven_percent: simulationData.breakevenPercent,
        discount_percent: simulationData.discountPercent,
        min_spend: simulationData.minSpend,
        max_discount_value: simulationData.maxDiscountValue,
      };

      // Get target item IDs
      const targetItemIds = [simulationData.productId];
      if (simulationData.freeProductId) {
        targetItemIds.push(simulationData.freeProductId);
      }

      const { error } = await supabase
        .from("restaurant_actions")
        .insert({
          restaurant_ids: selectedRestaurantIds,
          category: "promotions",
          action_type: OFFER_TYPE_LABELS[simulationData.offerType],
          title,
          description: description || null,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          platform: platformValue,
          target_item_ids: targetItemIds,
          change_context: changeContext,
        });

      if (error) throw error;

      toast({ 
        title: "Action ajoutée", 
        description: "L'offre a été ajoutée à votre calendrier d'actions" 
      });
      onOpenChange(false);
      
      // Reset form
      setDescription("");
      setStartDate(new Date());
      setEndDate(undefined);
    } catch (error) {
      console.error("Error saving action:", error);
      toast({ 
        title: "Erreur", 
        description: "Impossible d'enregistrer l'action",
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Ajouter comme action
          </DialogTitle>
          <DialogDescription>
            Enregistrez cette simulation pour suivre son impact sur vos ventes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Offer Summary */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium">{OFFER_TYPE_LABELS[simulationData.offerType]}</p>
            <p className="text-sm text-muted-foreground">{simulationData.productName}</p>
            {simulationData.freeProductName && (
              <p className="text-sm text-muted-foreground">+ {simulationData.freeProductName} offert</p>
            )}
            <div className="flex gap-2 mt-2">
              <Badge variant="outline">
                {simulationData.platform === "uber" ? "Uber Eats" : "Deliveroo"}
              </Badge>
              {simulationData.platformFunding > 0 && (
                <Badge className="bg-emerald-500 text-white">
                  Financement {simulationData.fundingType === "percent" ? `${simulationData.platformFunding}%` : `${simulationData.platformFunding}€`}
                </Badge>
              )}
            </div>
          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de début *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "d MMM yyyy", { locale: fr }) : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date de fin (optionnel)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "d MMM yyyy", { locale: fr }) : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Restaurant Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Restaurants concernés
              </Label>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedRestaurantIds.length === restaurants.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[120px] rounded-md border p-2">
                <div className="space-y-2">
                  {restaurants.map((restaurant) => (
                    <div key={restaurant.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={restaurant.id}
                        checked={selectedRestaurantIds.includes(restaurant.id)}
                        onCheckedChange={() => toggleRestaurant(restaurant.id)}
                      />
                      <label
                        htmlFor={restaurant.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {restaurant.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedRestaurantIds.length} restaurant(s) sélectionné(s)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optionnel)</Label>
            <Textarea
              placeholder="Notes sur cette offre..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Ajouter au calendrier
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
