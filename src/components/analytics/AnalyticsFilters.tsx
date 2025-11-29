import { useState } from "react";
import { Check, ChevronsUpDown, Store, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = [
  { value: 0, label: "Tous les mois" },
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

type PeriodMode = "year" | "month" | "range";

interface Restaurant {
  id: string;
  name: string;
  city?: string | null;
}

interface AnalyticsFiltersProps {
  restaurants: Restaurant[] | undefined;
  selectedRestaurants: string[];
  onRestaurantsChange: (ids: string[]) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  periodMode: PeriodMode;
  onPeriodModeChange: (mode: PeriodMode) => void;
  startMonth?: number;
  endMonth?: number;
  onRangeChange?: (start: number, end: number) => void;
}

export function AnalyticsFilters({
  restaurants,
  selectedRestaurants,
  onRestaurantsChange,
  selectedYear,
  onYearChange,
  selectedMonth,
  onMonthChange,
  periodMode,
  onPeriodModeChange,
  startMonth = 1,
  endMonth = 12,
  onRangeChange,
}: AnalyticsFiltersProps) {
  const [restaurantOpen, setRestaurantOpen] = useState(false);

  const toggleRestaurant = (id: string) => {
    if (id === "all") {
      onRestaurantsChange([]);
      return;
    }
    const newSelection = selectedRestaurants.includes(id)
      ? selectedRestaurants.filter((r) => r !== id)
      : [...selectedRestaurants, id];
    onRestaurantsChange(newSelection);
  };

  const removeRestaurant = (id: string) => {
    onRestaurantsChange(selectedRestaurants.filter((r) => r !== id));
  };

  const selectedRestaurantNames = restaurants
    ?.filter((r) => selectedRestaurants.includes(r.id))
    .map((r) => r.name) || [];

  return (
    <div className="space-y-4">
      {/* Restaurant Multi-Select */}
      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex-1 min-w-[250px]">
          <Popover open={restaurantOpen} onOpenChange={setRestaurantOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={restaurantOpen}
                className="w-full justify-between h-auto min-h-10"
              >
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                  {selectedRestaurants.length === 0 ? (
                    <span>Tous les restaurants</span>
                  ) : (
                    <span className="text-primary font-medium">
                      {selectedRestaurants.length} restaurant{selectedRestaurants.length > 1 ? "s" : ""} sélectionné{selectedRestaurants.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un restaurant..." />
                <CommandList>
                  <CommandEmpty>Aucun restaurant trouvé.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => toggleRestaurant("all")}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedRestaurants.length === 0 ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">Tous les restaurants</span>
                    </CommandItem>
                    {restaurants?.map((restaurant) => (
                      <CommandItem
                        key={restaurant.id}
                        value={restaurant.name}
                        onSelect={() => toggleRestaurant(restaurant.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedRestaurants.includes(restaurant.id)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{restaurant.name}</span>
                          {restaurant.city && (
                            <span className="text-xs text-muted-foreground">
                              {restaurant.city}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Period Mode Selector */}
        <Select value={periodMode} onValueChange={(v) => onPeriodModeChange(v as PeriodMode)}>
          <SelectTrigger className="w-[140px]">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="year">Année</SelectItem>
            <SelectItem value="month">Mois</SelectItem>
            <SelectItem value="range">Période</SelectItem>
          </SelectContent>
        </Select>

        {/* Year Selector */}
        <Select value={selectedYear.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month Selector (shown for month mode) */}
        {periodMode === "month" && (
          <Select value={selectedMonth.toString()} onValueChange={(v) => onMonthChange(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.slice(1).map((m) => (
                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Range Selectors (shown for range mode) */}
        {periodMode === "range" && onRangeChange && (
          <>
            <Select value={startMonth.toString()} onValueChange={(v) => onRangeChange(parseInt(v), endMonth)}>
              <SelectTrigger className="w-[130px]">
                <span className="text-muted-foreground text-xs mr-1">De:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.slice(1).map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={endMonth.toString()} onValueChange={(v) => onRangeChange(startMonth, parseInt(v))}>
              <SelectTrigger className="w-[130px]">
                <span className="text-muted-foreground text-xs mr-1">À:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.slice(1).map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Selected Restaurants Display */}
      {selectedRestaurants.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Restaurants sélectionnés:</span>
          {selectedRestaurantNames.map((name, index) => (
            <Badge key={selectedRestaurants[index]} variant="secondary" className="gap-1">
              {name}
              <button
                onClick={() => removeRestaurant(selectedRestaurants[index])}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedRestaurants.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRestaurantsChange([])}
              className="text-xs h-6"
            >
              Effacer tout
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
