import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfferTypeHeader, OfferType } from "./offers/OfferTypeHeader";
import { BogoSimulator } from "./offers/BogoSimulator";
import { CrossProductSimulator } from "./offers/CrossProductSimulator";
import { PercentDiscountSimulator } from "./offers/PercentDiscountSimulator";
import { RestaurantSelector } from "./RestaurantSelector";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { useSimulatorRestaurantPrices } from "@/hooks/useSimulatorRestaurantPrices";
import { Store } from "lucide-react";

export type Platform = "uber" | "deliveroo";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  vat_rate: number | null;
  is_active: boolean;
}

interface OfferSimulatorProps {
  menuItems: MenuItem[];
}

// Default commission values per platform
const DEFAULT_COMMISSIONS = {
  uber: 27,
  deliveroo: 25,
};

export function OfferSimulator({ menuItems }: OfferSimulatorProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("uber");
  const [selectedOfferType, setSelectedOfferType] = useState<OfferType>("bogo");
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  
  // Persist commission values per platform
  const [uberCommission, setUberCommission] = useState<number>(DEFAULT_COMMISSIONS.uber);
  const [deliverooCommission, setDeliverooCommission] = useState<number>(DEFAULT_COMMISSIONS.deliveroo);
  
  const currentCommission = selectedPlatform === "uber" ? uberCommission : deliverooCommission;
  const setCurrentCommission = (value: number) => {
    if (selectedPlatform === "uber") {
      setUberCommission(value);
    } else {
      setDeliverooCommission(value);
    }
  };

  // Fetch restaurants and enriched prices
  const { restaurants, enrichedMenuItems } = useSimulatorRestaurantPrices(
    menuItems,
    selectedRestaurantIds,
    selectedPlatform
  );

  // Render the appropriate simulator based on selection
  const renderSimulator = () => {
    const commonProps = {
      menuItems,
      platform: selectedPlatform,
      commission: currentCommission,
      onCommissionChange: setCurrentCommission,
      restaurantIds: selectedRestaurantIds,
      enrichedMenuItems,
    };

    switch (selectedOfferType) {
      case "bogo":
        return <BogoSimulator {...commonProps} />;
      case "cross_product":
        return <CrossProductSimulator {...commonProps} />;
      case "percent_discount":
        return <PercentDiscountSimulator {...commonProps} />;
      default:
        return <BogoSimulator {...commonProps} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Restaurant Selector */}
      <Card className="border-0 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
        <div className="absolute inset-0 border border-white/30 rounded-lg pointer-events-none" />
        <CardHeader className="relative pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-primary" />
            Restaurants concernés
          </CardTitle>
        </CardHeader>
        <CardContent className="relative pt-0">
          <RestaurantSelector
            restaurants={restaurants}
            selectedIds={selectedRestaurantIds}
            onSelectionChange={setSelectedRestaurantIds}
            maxSelection={6}
            placeholder="Sélectionnez des restaurants pour voir les résultats par établissement..."
          />
          {selectedRestaurantIds.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Sans sélection, les calculs utilisent les prix du catalogue global.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Platform Tabs */}
      <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as Platform)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="uber" className="flex items-center gap-2 data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-600">
            <UberEatsIcon className="h-4 w-4" />
            Uber Eats
          </TabsTrigger>
          <TabsTrigger value="deliveroo" className="flex items-center gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-600">
            <DeliverooIcon className="h-4 w-4" />
            Deliveroo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uber" className="mt-4 space-y-4">
          <OfferTypeHeader
            selectedType={selectedOfferType}
            onTypeChange={setSelectedOfferType}
            platform="uber"
          />
          {renderSimulator()}
        </TabsContent>
        
        <TabsContent value="deliveroo" className="mt-4 space-y-4">
          <OfferTypeHeader
            selectedType={selectedOfferType}
            onTypeChange={setSelectedOfferType}
            platform="deliveroo"
          />
          {renderSimulator()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
