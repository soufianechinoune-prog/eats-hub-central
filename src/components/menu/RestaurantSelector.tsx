import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";

interface Restaurant {
  id: string;
  name: string;
}

interface RestaurantSelectorProps {
  restaurants: Restaurant[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxSelection?: number;
  placeholder?: string;
}

export function RestaurantSelector({
  restaurants,
  selectedIds,
  onSelectionChange,
  maxSelection = 6,
  placeholder = "Sélectionner des restaurants...",
}: RestaurantSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedRestaurants = restaurants.filter((r) => selectedIds.includes(r.id));

  const toggleRestaurant = (restaurantId: string) => {
    if (selectedIds.includes(restaurantId)) {
      onSelectionChange(selectedIds.filter((id) => id !== restaurantId));
    } else if (selectedIds.length < maxSelection) {
      onSelectionChange([...selectedIds, restaurantId]);
    }
  };

  const removeRestaurant = (restaurantId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedIds.filter((id) => id !== restaurantId));
  };

  // Extract short name for badge display
  const getShortName = (name: string) => {
    // Remove "CHICKEN STREET " prefix if present
    const cleaned = name.replace(/^CHICKEN STREET\s*/i, "");
    // Take first part if too long
    if (cleaned.length > 15) {
      return cleaned.split(/[-\s]/)[0];
    }
    return cleaned;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between min-h-10 h-auto"
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedRestaurants.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedRestaurants.map((restaurant) => (
                <Badge
                  key={restaurant.id}
                  variant="secondary"
                  className="mr-1"
                >
                  {getShortName(restaurant.name)}
                  <button
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={(e) => removeRestaurant(restaurant.id, e)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un restaurant..." />
          <CommandList>
            <CommandEmpty>Aucun restaurant trouvé.</CommandEmpty>
            <CommandGroup>
              {restaurants.map((restaurant) => {
                const isSelected = selectedIds.includes(restaurant.id);
                const isDisabled = !isSelected && selectedIds.length >= maxSelection;

                return (
                  <CommandItem
                    key={restaurant.id}
                    value={restaurant.name}
                    onSelect={() => !isDisabled && toggleRestaurant(restaurant.id)}
                    className={cn(isDisabled && "opacity-50 cursor-not-allowed")}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {restaurant.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selectedIds.length >= maxSelection && (
          <div className="p-2 text-xs text-muted-foreground text-center border-t">
            Maximum {maxSelection} restaurants
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
