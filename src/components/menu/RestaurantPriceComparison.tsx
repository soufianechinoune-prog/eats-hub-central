import { InterRestaurantComparison } from "./InterRestaurantComparison";
import { RestaurantMenuImportDialog } from "./RestaurantMenuImportDialog";
import { useRestaurantMenuPrices } from "@/hooks/useRestaurantMenuPrices";

export function RestaurantPriceComparison() {
  const { restaurants } = useRestaurantMenuPrices([], 0);

  return (
    <div className="space-y-6">
      {/* Header with Import Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Comparaison des prix inter-restaurants</h2>
          <p className="text-sm text-muted-foreground">
            Comparez les prix d'un même produit entre différents restaurants sur une même plateforme
          </p>
        </div>
        <RestaurantMenuImportDialog restaurants={restaurants} />
      </div>

      {/* Inter-Restaurant Comparison */}
      <InterRestaurantComparison />
    </div>
  );
}
