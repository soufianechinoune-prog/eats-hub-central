import { useState, useMemo } from "react";
import { Check, ChevronDown, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Restaurant {
  id: string;
  name: string;
  address?: string | null;
  is_pinned?: boolean;
}

interface RestaurantMultiSelectorProps {
  restaurants: Restaurant[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function RestaurantMultiSelector({
  restaurants,
  selectedIds,
  onSelectionChange,
}: RestaurantMultiSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Sort restaurants: pinned first, then alphabetically
  const sortedRestaurants = useMemo(() => {
    return [...restaurants].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [restaurants]);

  // Filter by search
  const filteredRestaurants = useMemo(() => {
    if (!search.trim()) return sortedRestaurants;
    const searchLower = search.toLowerCase();
    return sortedRestaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(searchLower) ||
        r.address?.toLowerCase().includes(searchLower)
    );
  }, [sortedRestaurants, search]);

  // Group by pinned status
  const pinnedRestaurants = filteredRestaurants.filter((r) => r.is_pinned);
  const otherRestaurants = filteredRestaurants.filter((r) => !r.is_pinned);

  const toggleRestaurant = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredRestaurants.map((r) => r.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const getDisplayText = () => {
    if (selectedIds.length === 0) return "Tous les établissements";
    if (selectedIds.length === 1) {
      const restaurant = restaurants.find((r) => r.id === selectedIds[0]);
      return restaurant?.name || "1 établissement";
    }
    return `${selectedIds.length} établissements`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{getDisplayText()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Recherchez des établissements"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-2 p-3 border-b">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Sélectionner tout
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            Effacer
          </Button>
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {/* Pinned restaurants */}
          {pinnedRestaurants.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 flex items-center gap-1">
                <Star className="h-3 w-3" />
                Épinglés
              </div>
              {pinnedRestaurants.map((restaurant) => (
                <RestaurantItem
                  key={restaurant.id}
                  restaurant={restaurant}
                  isSelected={selectedIds.includes(restaurant.id)}
                  onToggle={() => toggleRestaurant(restaurant.id)}
                />
              ))}
            </div>
          )}

          {/* Other restaurants */}
          {otherRestaurants.length > 0 && (
            <div>
              {pinnedRestaurants.length > 0 && (
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  Autres établissements
                </div>
              )}
              {otherRestaurants.map((restaurant) => (
                <RestaurantItem
                  key={restaurant.id}
                  restaurant={restaurant}
                  isSelected={selectedIds.includes(restaurant.id)}
                  onToggle={() => toggleRestaurant(restaurant.id)}
                />
              ))}
            </div>
          )}

          {filteredRestaurants.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Aucun établissement trouvé
            </div>
          )}
        </div>

        <div className="p-3 border-t">
          <Button
            className="w-full bg-foreground text-background hover:bg-foreground/90"
            onClick={() => setOpen(false)}
          >
            Appliquer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RestaurantItem({
  restaurant,
  isSelected,
  onToggle,
}: {
  restaurant: Restaurant;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{restaurant.name}</p>
        {restaurant.address && (
          <p className="text-xs text-muted-foreground truncate">
            {restaurant.address}
          </p>
        )}
      </div>
    </label>
  );
}
