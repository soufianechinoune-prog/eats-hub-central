import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Store, Tag, Target, Calendar, Wallet, Settings2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { BogoAudienceSelector, AudienceType } from "./BogoAudienceSelector";
import { BogoDurationSelector, DurationType, CustomSchedule } from "./BogoDurationSelector";
import { BogoImpactPanel } from "./BogoImpactPanel";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
}

interface Restaurant {
  id: string;
  name: string;
}

interface BogoSimulatorUberProps {
  menuItems: MenuItem[];
  onBack: () => void;
}

const OFFER_FEE = 0.89;

export function BogoSimulatorUber({ menuItems, onBack }: BogoSimulatorUberProps) {
  // State
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<AudienceType>("all");
  const [durationType, setDurationType] = useState<DurationType>("1year");
  const [customSchedule, setCustomSchedule] = useState<CustomSchedule>({
    startDate: new Date(),
    endDate: undefined,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    timeSlots: [{ startTime: "11:00", endTime: "22:00" }],
  });
  const [weeklyBudget, setWeeklyBudget] = useState<string>("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["etablissements"]);

  // Fetch restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name");
      
      if (!error && data) {
        setRestaurants(data);
      }
    };
    fetchRestaurants();
  }, []);

  // Eligible menu items (active with uber price)
  const eligibleItems = useMemo(() => {
    return menuItems.filter(
      (item) => item.is_active && item.price_uber && item.price_uber > 0
    );
  }, [menuItems]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    eligibleItems.forEach((item) => {
      const cat = item.category || "Autres";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    return grouped;
  }, [eligibleItems]);

  // Toggle restaurant selection
  const toggleRestaurant = (id: string) => {
    setSelectedRestaurantIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  // Toggle item selection
  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all items in a category
  const toggleCategory = (category: string) => {
    const categoryItemIds = (itemsByCategory[category] || []).map((i) => i.id);
    const allSelected = categoryItemIds.every((id) => selectedItemIds.includes(id));
    
    if (allSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !categoryItemIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => [...new Set([...prev, ...categoryItemIds])]);
    }
  };

  // Form validation
  const isFormValid = selectedItemIds.length > 0 && acceptedTerms;

  // Handle create offer
  const handleCreateOffer = () => {
    console.log("Creating offer:", {
      restaurants: selectedRestaurantIds,
      items: selectedItemIds,
      audience,
      durationType,
      customSchedule,
      weeklyBudget,
    });
    // TODO: Save to restaurant_actions
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Un acheté = un offert</h1>
              <p className="text-sm text-muted-foreground">
                Encouragez les clients à commander en leur proposant une offre de type « un acheté = un offert ».
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 2 columns */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column - Form (60%) */}
          <div className="lg:col-span-3 space-y-2">
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
              className="space-y-2"
            >
              {/* 1. Établissements */}
              <AccordionItem value="etablissements" className="bg-background rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-medium">Établissements</p>
                      <p className="text-sm text-muted-foreground font-normal">
                        {selectedRestaurantIds.length === 0
                          ? "Tous les établissements"
                          : `${selectedRestaurantIds.length} sélectionné${selectedRestaurantIds.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {restaurants.map((restaurant) => (
                      <label
                        key={restaurant.id}
                        className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedRestaurantIds.includes(restaurant.id)}
                          onCheckedChange={() => toggleRestaurant(restaurant.id)}
                        />
                        <span>{restaurant.name}</span>
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 2. Articles */}
              <AccordionItem value="articles" className="bg-background rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Tag className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-medium">Articles</p>
                      {selectedItemIds.length === 0 ? (
                        <p className="text-sm text-destructive font-normal">
                          Aucun article sélectionné
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground font-normal">
                          {selectedItemIds.length} article{selectedItemIds.length > 1 ? "s" : ""} sélectionné{selectedItemIds.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {Object.entries(itemsByCategory).map(([category, items]) => {
                      const categoryItemIds = items.map((i) => i.id);
                      const allSelected = categoryItemIds.every((id) =>
                        selectedItemIds.includes(id)
                      );
                      const someSelected =
                        categoryItemIds.some((id) => selectedItemIds.includes(id)) &&
                        !allSelected;

                      return (
                        <div key={category} className="space-y-2">
                          <label className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 cursor-pointer">
                            <Checkbox
                              checked={allSelected}
                              ref={(el) => {
                                if (el) {
                                  (el as unknown as HTMLInputElement).indeterminate = someSelected;
                                }
                              }}
                              onCheckedChange={() => toggleCategory(category)}
                            />
                            <span className="font-medium text-sm">{category}</span>
                            <Badge variant="secondary" className="ml-auto">
                              {items.length}
                            </Badge>
                          </label>
                          <div className="pl-6 space-y-1">
                            {items.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/30 transition-colors"
                              >
                                <Checkbox
                                  checked={selectedItemIds.includes(item.id)}
                                  onCheckedChange={() => toggleItem(item.id)}
                                />
                                <span className="flex-1 text-sm">{item.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {item.price_uber?.toFixed(2)} €
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 3. Audience */}
              <AccordionItem value="audience" className="bg-background rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-medium">Audience</p>
                      <p className="text-sm text-muted-foreground font-normal">
                        {audience === "all" && "Tous les clients"}
                        {audience === "new" && "Nouveaux clients"}
                        {audience === "returning" && "Utilisateurs repassant commande"}
                        {audience === "inactive" && "Utilisateurs inactifs"}
                        {audience === "uberOne" && "Membres Uber One"}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <BogoAudienceSelector value={audience} onChange={setAudience} />
                </AccordionContent>
              </AccordionItem>

              {/* 4. Durée */}
              <AccordionItem value="duree" className="bg-background rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-medium">Durée</p>
                      <p className="text-sm text-muted-foreground font-normal">
                        {durationType === "1year" && "1 an"}
                        {durationType === "6months" && "6 mois"}
                        {durationType === "custom" && "Personnalisé"}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <BogoDurationSelector
                    durationType={durationType}
                    onDurationTypeChange={setDurationType}
                    customSchedule={customSchedule}
                    onCustomScheduleChange={setCustomSchedule}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* 5. Dépenses hebdomadaires */}
              <AccordionItem value="budget" className="bg-background rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-medium">Dépenses hebdomadaires</p>
                      <p className="text-sm text-muted-foreground font-normal">
                        {weeklyBudget ? `${weeklyBudget} € / semaine` : "Aucune limite"}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Vous ne payez que lorsque les clients passent commande. Si vous le souhaitez, vous pouvez également définir un plafond de dépense maximal.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">EUR</span>
                      <Input
                        type="number"
                        placeholder="Saisissez un budget"
                        value={weeklyBudget}
                        onChange={(e) => setWeeklyBudget(e.target.value)}
                        className="max-w-[200px]"
                      />
                      <span className="text-sm text-muted-foreground">/ semaine</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Les dépenses hebdomadaires sont réinitialisées tous les lundis matin.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 6. Paramètres avancés */}
              <AccordionItem value="advanced" className="bg-background rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-medium">Paramètres avancés</p>
                      <p className="text-sm text-muted-foreground font-normal">
                        Commission, cofinancement
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="text-sm text-muted-foreground">
                    Les paramètres avancés de simulation de marge seront disponibles prochainement.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Footer - Terms & Create Button */}
            <div className="bg-background rounded-lg border p-4 mt-4 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  J'accepte les{" "}
                  <button className="text-primary underline underline-offset-2">
                    Conditions générales
                  </button>
                </span>
              </label>

              <Button
                onClick={handleCreateOffer}
                disabled={!isFormValid}
                className="w-full bg-foreground text-background hover:bg-foreground/90"
                size="lg"
              >
                Créez une offre
              </Button>
            </div>
          </div>

          {/* Right Column - Preview & Impact (40%) */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <BogoImpactPanel
                restaurantCount={selectedRestaurantIds.length}
                selectedItemsCount={selectedItemIds.length}
                offerFee={OFFER_FEE}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
