import { useState } from "react";
import { Check, ChevronsUpDown, Store, Calendar, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { DateRange } from "react-day-picker";

const MONTHS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"
];

const MONTHS_FULL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

export type PeriodMode = "year" | "month" | "range";

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
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
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
  dateRange,
  onDateRangeChange,
}: AnalyticsFiltersProps) {
  const [restaurantOpen, setRestaurantOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [tempYear, setTempYear] = useState(selectedYear);

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

  const handleMonthSelect = (monthIndex: number) => {
    onPeriodModeChange("month");
    onYearChange(tempYear);
    onMonthChange(monthIndex + 1); // monthIndex is 0-based, selectedMonth is 1-based
    setPeriodOpen(false);
  };

  const handleYearSelect = (year: number) => {
    onPeriodModeChange("year");
    onYearChange(year);
    setPeriodOpen(false);
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onPeriodModeChange("range");
      onDateRangeChange?.(range);
    } else {
      onDateRangeChange?.(range);
    }
  };

  // Format the display text for the period button
  const getPeriodDisplayText = () => {
    if (periodMode === "month") {
      return `${MONTHS_FULL[selectedMonth - 1]} ${selectedYear}`;
    } else if (periodMode === "year") {
      return `${selectedYear}`;
    } else if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "dd/MM/yyyy")} – ${format(dateRange.to, "dd/MM/yyyy")}`;
    }
    return "Sélectionner une période";
  };

  return (
    <div className="space-y-4">
      {/* Restaurant Multi-Select & Period Selector */}
      <div className="flex flex-wrap gap-3 items-start">
        {/* Restaurant Multi-Select */}
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

        {/* Period Selector */}
        <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="min-w-[200px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{getPeriodDisplayText()}</span>
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Tabs defaultValue={periodMode} className="w-full">
              <TabsList className="w-full grid grid-cols-3 rounded-b-none">
                <TabsTrigger value="month" className="text-xs">Mois</TabsTrigger>
                <TabsTrigger value="year" className="text-xs">Année</TabsTrigger>
                <TabsTrigger value="range" className="text-xs">Période perso.</TabsTrigger>
              </TabsList>

              {/* Month Tab */}
              <TabsContent value="month" className="p-4 mt-0">
                {/* Year Navigation */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setTempYear(tempYear - 1)}
                    disabled={tempYear <= YEARS[0]}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-semibold text-sm w-12 text-center">{tempYear}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setTempYear(tempYear + 1)}
                    disabled={tempYear >= YEARS[YEARS.length - 1]}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Months Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {MONTHS_SHORT.map((month, index) => {
                    const isSelected = periodMode === "month" && 
                                       selectedMonth === index + 1 && 
                                       selectedYear === tempYear;
                    return (
                      <Button
                        key={month}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-9 text-xs",
                          isSelected && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => handleMonthSelect(index)}
                      >
                        {month}
                      </Button>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Year Tab */}
              <TabsContent value="year" className="p-4 mt-0">
                <div className="grid grid-cols-3 gap-2">
                  {YEARS.map((year) => {
                    const isSelected = periodMode === "year" && selectedYear === year;
                    return (
                      <Button
                        key={year}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-10",
                          isSelected && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => handleYearSelect(year)}
                      >
                        {year}
                      </Button>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Custom Range Tab */}
              <TabsContent value="range" className="p-0 mt-0">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                  locale={fr}
                  className="pointer-events-auto"
                />
                {dateRange?.from && dateRange?.to && (
                  <div className="p-3 border-t text-center">
                    <Button 
                      size="sm" 
                      onClick={() => setPeriodOpen(false)}
                    >
                      Appliquer
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
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
