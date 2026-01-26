import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OfferTypeSelector, OfferType } from "./offers/OfferTypeSelector";
import { BogoSimulator } from "./offers/BogoSimulator";
import { BogoSimulatorUber } from "./offers/BogoSimulatorUber";
import { CrossProductSimulator } from "./offers/CrossProductSimulator";
import { PercentDiscountSimulator } from "./offers/PercentDiscountSimulator";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

export type Platform = "uber" | "deliveroo";

interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
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
  const [selectedOfferType, setSelectedOfferType] = useState<OfferType | null>(null);
  
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

  const handleBack = () => {
    setSelectedOfferType(null);
  };

  // Render the appropriate simulator based on selection
  const renderSimulator = () => {
    // For Uber BOGO, use the new Uber-style interface
    if (selectedOfferType === "bogo" && selectedPlatform === "uber") {
      return (
        <BogoSimulatorUber 
          menuItems={menuItems} 
          onBack={handleBack} 
        />
      );
    }

    // For Deliveroo BOGO, use the existing simulator
    if (selectedOfferType === "bogo" && selectedPlatform === "deliveroo") {
      return (
        <BogoSimulator 
          menuItems={menuItems} 
          onBack={handleBack} 
          platform={selectedPlatform}
          commission={currentCommission}
          onCommissionChange={setCurrentCommission}
        />
      );
    }

    if (selectedOfferType === "cross_product") {
      return (
        <CrossProductSimulator 
          menuItems={menuItems} 
          onBack={handleBack} 
          platform={selectedPlatform}
          commission={currentCommission}
          onCommissionChange={setCurrentCommission}
        />
      );
    }

    if (selectedOfferType === "percent_discount") {
      return (
        <PercentDiscountSimulator 
          menuItems={menuItems} 
          onBack={handleBack} 
          platform={selectedPlatform}
          commission={currentCommission}
          onCommissionChange={setCurrentCommission}
        />
      );
    }

    // Default: show the offer type selector
    return <OfferTypeSelector onSelectOffer={setSelectedOfferType} platform={selectedPlatform} />;
  };

  return (
    <div className="space-y-4">
      {/* Platform Tabs */}
      <Tabs value={selectedPlatform} onValueChange={(v) => { setSelectedPlatform(v as Platform); setSelectedOfferType(null); }}>
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

        <TabsContent value="uber" className="mt-4">
          {renderSimulator()}
        </TabsContent>
        
        <TabsContent value="deliveroo" className="mt-4">
          {renderSimulator()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
