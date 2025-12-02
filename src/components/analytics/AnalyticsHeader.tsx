import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Store, Calendar, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
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
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";

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

export function AnalyticsHeader() {
  const {
    selectedRestaurants,
    setSelectedRestaurants,
    selectedPlatform,
    setSelectedPlatform,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    periodMode,
    setPeriodMode,
    dateRange,
    setDateRange,
  } = useAnalyticsContext();

  const [restaurantOpen, setRestaurantOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [tempYear, setTempYear] = useState(selectedYear);
  const [activeTab, setActiveTab] = useState<string>(periodMode);

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const toggleRestaurant = (id: string) => {
    if (id === "all") {
      setSelectedRestaurants([]);
      return;
    }
    const newSelection = selectedRestaurants.includes(id)
      ? selectedRestaurants.filter((r) => r !== id)
      : [...selectedRestaurants, id];
    setSelectedRestaurants(newSelection);
  };

  const removeRestaurant = (id: string) => {
    setSelectedRestaurants(selectedRestaurants.filter((r) => r !== id));
  };

  const selectedRestaurantNames = restaurants
    ?.filter((r) => selectedRestaurants.includes(r.id))
    .map((r) => r.name) || [];

  const handleMonthSelect = (monthIndex: number) => {
    setPeriodMode("month");
    setSelectedYear(tempYear);
    setSelectedMonth(monthIndex + 1);
    setPeriodOpen(false);
  };

  const handleYearSelect = (year: number) => {
    setPeriodMode("year");
    setSelectedYear(year);
    setPeriodOpen(false);
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setPeriodMode("range");
      setDateRange(range);
    } else {
      setDateRange(range);
    }
  };

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

  const handleResetPeriod = () => {
    setPeriodMode("year");
    setSelectedYear(currentYear);
    setDateRange(undefined);
    setPeriodOpen(false);
  };

  const showResetButton = periodMode === "month" || (periodMode === "range" && dateRange?.from);

  return (
    <div className="backdrop-blur-xl bg-background/70 border-2 border-border/40 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex flex-wrap gap-3 items-start">
        {/* Restaurant Multi-Select */}
        <div className="flex-1 min-w-[250px]">
          <Popover open={restaurantOpen} onOpenChange={setRestaurantOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={restaurantOpen}
                className="w-full justify-between h-auto min-h-10 bg-background"
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
            <PopoverContent className="w-[350px] p-0 bg-background border shadow-lg" align="start">
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

        {/* Platform Pills */}
        <div className="flex gap-2">
          <Button
            variant={selectedPlatform === "uber_eats" ? "default" : "outline"}
            onClick={() => setSelectedPlatform("uber_eats")}
            className={cn(
              "h-10 gap-2 transition-all duration-200",
              selectedPlatform === "uber_eats" && "bg-[#06C167] hover:bg-[#06C167]/90 text-white border-0"
            )}
          >
            <img src={uberEatsLogo} alt="Uber Eats" className="h-4 w-4" />
            <span>Uber Eats</span>
          </Button>
          <Button
            variant={selectedPlatform === "deliveroo" ? "default" : "outline"}
            onClick={() => setSelectedPlatform("deliveroo")}
            className={cn(
              "h-10 gap-2 transition-all duration-200",
              selectedPlatform === "deliveroo" && "bg-[#00CCBC] hover:bg-[#00CCBC]/90 text-white border-0"
            )}
          >
            <img src={deliverooLogo} alt="Deliveroo" className="h-4 w-4" />
            <span>Deliveroo</span>
          </Button>
          <Button
            variant={selectedPlatform === "global" ? "default" : "outline"}
            onClick={() => setSelectedPlatform("global")}
            className={cn(
              "h-10 transition-all duration-200",
              selectedPlatform === "global" && "bg-primary hover:bg-primary/90"
            )}
          >
            Global
          </Button>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button
                className="min-w-[180px] justify-between bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">{getPeriodDisplayText()}</span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 bg-background border shadow-xl rounded-xl overflow-hidden" 
              align="end"
              sideOffset={8}
            >
              <Tabs 
                value={activeTab} 
                onValueChange={setActiveTab} 
                className="w-full"
              >
                <div className="border-b bg-muted/30">
                  <TabsList className="w-full h-12 bg-transparent p-0 rounded-none">
                    <TabsTrigger 
                      value="month" 
                      className="flex-1 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                    >
                      Mois
                    </TabsTrigger>
                    <TabsTrigger 
                      value="year" 
                      className="flex-1 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                    >
                      Année
                    </TabsTrigger>
                    <TabsTrigger 
                      value="range" 
                      className="flex-1 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                    >
                      Période perso.
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="month" className="p-5 mt-0">
                  <div className="flex items-center justify-center gap-6 mb-5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-muted"
                      onClick={() => setTempYear(tempYear - 1)}
                      disabled={tempYear <= YEARS[0]}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="font-semibold text-lg w-16 text-center">{tempYear}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-muted"
                      onClick={() => setTempYear(tempYear + 1)}
                      disabled={tempYear >= YEARS[YEARS.length - 1]}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {MONTHS_SHORT.map((month, index) => {
                      const isSelected = periodMode === "month" && 
                                         selectedMonth === index + 1 && 
                                         selectedYear === tempYear;
                      return (
                        <Button
                          key={month}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-11 text-sm font-medium rounded-lg transition-all",
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" 
                              : "hover:bg-muted hover:border-muted-foreground/30"
                          )}
                          onClick={() => handleMonthSelect(index)}
                        >
                          {month}
                        </Button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="year" className="p-5 mt-0">
                  <div className="grid grid-cols-3 gap-3">
                    {YEARS.map((year) => {
                      const isSelected = periodMode === "year" && selectedYear === year;
                      return (
                        <Button
                          key={year}
                          variant="outline"
                          className={cn(
                            "h-12 text-base font-medium rounded-lg transition-all",
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" 
                              : "hover:bg-muted hover:border-muted-foreground/30"
                          )}
                          onClick={() => handleYearSelect(year)}
                        >
                          {year}
                        </Button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="range" className="mt-0">
                  <div className="p-2">
                    <CalendarComponent
                      mode="range"
                      selected={dateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={2}
                      locale={fr}
                      className="pointer-events-auto"
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-full hover:bg-muted",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-muted transition-colors",
                        day_range_start: "day-range-start bg-primary text-primary-foreground hover:bg-primary",
                        day_range_end: "day-range-end bg-primary text-primary-foreground hover:bg-primary",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-emerald-600 text-white",
                        day_outside: "day-outside text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                  </div>
                  {dateRange?.from && dateRange?.to && (
                    <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {format(dateRange.from, "dd MMM yyyy", { locale: fr })} – {format(dateRange.to, "dd MMM yyyy", { locale: fr })}
                      </span>
                      <Button 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90"
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
          
          {showResetButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetPeriod}
              className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Réinitialiser la période"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Selected Restaurants Display */}
      {selectedRestaurants.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Restaurants sélectionnés:</span>
          {selectedRestaurantNames.map((name, index) => (
            <Badge key={selectedRestaurants[index]} variant="secondary" className="gap-1 py-1 px-2">
              {name}
              <button
                onClick={() => removeRestaurant(selectedRestaurants[index])}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedRestaurants.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRestaurants([])}
              className="text-xs h-6 text-muted-foreground hover:text-foreground"
            >
              Effacer tout
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
