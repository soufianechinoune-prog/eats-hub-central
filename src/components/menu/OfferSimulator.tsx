import { useState } from "react";
import { OfferTypeSelector, OfferType } from "./offers/OfferTypeSelector";
import { BogoSimulator } from "./offers/BogoSimulator";
import { CrossProductSimulator } from "./offers/CrossProductSimulator";
import { PercentDiscountSimulator } from "./offers/PercentDiscountSimulator";

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

export function OfferSimulator({ menuItems }: OfferSimulatorProps) {
  const [selectedOfferType, setSelectedOfferType] = useState<OfferType | null>(null);

  const handleBack = () => {
    setSelectedOfferType(null);
  };

  // Render the appropriate simulator based on selection
  if (selectedOfferType === "bogo") {
    return <BogoSimulator menuItems={menuItems} onBack={handleBack} />;
  }

  if (selectedOfferType === "cross_product") {
    return <CrossProductSimulator menuItems={menuItems} onBack={handleBack} />;
  }

  if (selectedOfferType === "percent_discount") {
    return <PercentDiscountSimulator menuItems={menuItems} onBack={handleBack} />;
  }

  // Default: show the offer type selector
  return <OfferTypeSelector onSelectOffer={setSelectedOfferType} />;
}
