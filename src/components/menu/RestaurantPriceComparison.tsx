import { InterRestaurantComparison } from "./InterRestaurantComparison";
import { RestaurantMenuImportDialog } from "./RestaurantMenuImportDialog";
import { BulkPriceImportDialog } from "./BulkPriceImportDialog";
import { useRestaurantMenuPrices } from "@/hooks/useRestaurantMenuPrices";

interface RestaurantPriceComparisonProps {
  selectedRestaurantIds: string[];
  onSelectedRestaurantIdsChange: (ids: string[]) => void;
}

export function RestaurantPriceComparison({
  selectedRestaurantIds,
  onSelectedRestaurantIdsChange,
}: RestaurantPriceComparisonProps) {
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
        <div className="flex gap-2">
          <BulkPriceImportDialog />
          <RestaurantMenuImportDialog restaurants={restaurants} />
        </div>
      </div>

      {/* Inter-Restaurant Comparison */}
      <InterRestaurantComparison
        selectedRestaurantIds={selectedRestaurantIds}
        onSelectedRestaurantIdsChange={onSelectedRestaurantIdsChange}
      />
    </div>
  );
}
