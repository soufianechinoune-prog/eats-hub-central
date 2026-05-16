import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Store, Calendar, X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, subDays, startOfMonth, endOfMonth } from "date-fns";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { NetworkViewToggle } from "@/components/compare/NetworkViewToggle";
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

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth(); // 0-11 (janvier = 0)
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

export function AnalyticsHeader({ hidePeriodSelector = false, hideFilters = false, weekOnlyRange = false }: { hidePeriodSelector?: boolean; hideFilters?: boolean; weekOnlyRange?: boolean } = {}) {
  const {
    selectedRestaurants,
    setSelectedRestaurants,
    visibleRestaurants,
    setVisibleRestaurants,
    toggleRestaurantSelection,
    addVisibleRestaurant,
    removeVisibleRestaurant,
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
    comparisonMode,
    setComparisonMode,
    selectedChainId,
  } = useAnalyticsContext();

  const [restaurantOpen, setRestaurantOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [tempYear, setTempYear] = useState(selectedYear);
  
  const derivedTab = useMemo(() => {
    if (["previous_week", "7d", "30d", "current_month"].includes(periodMode)) {
      return "quick";
    }
    return periodMode;
  }, [periodMode]);

  const [activeTab, setActiveTab] = useState<string>(derivedTab);

  useEffect(() => {
    if (periodOpen) setActiveTab(derivedTab);
  }, [periodOpen, derivedTab]);

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, city, is_pinned, is_active")
        .order("name");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Counts for NetworkViewToggle badges
  const pinnedCount = useMemo(() => 
    restaurants?.filter(r => r.is_pinned && r.is_active).length || 0
  , [restaurants]);

  const networkCount = useMemo(() => 
    restaurants?.filter(r => r.is_active).length || 0
  , [restaurants]);

  // Système d'épinglage retiré : tous les actifs de la marque sont utilisés par défaut.

  // Clean up invalid restaurant IDs when restaurants are loaded
  useEffect(() => {
    if (restaurants && restaurants.length > 0) {
      const validIds = new Set(restaurants.map(r => r.id));
      
      // Clean selectedRestaurants - remove IDs that don't exist in database
      const validSelectedIds = selectedRestaurants.filter(id => validIds.has(id));
      if (validSelectedIds.length !== selectedRestaurants.length) {
        console.log("Cleaning invalid selectedRestaurants:", {
          before: selectedRestaurants,
          after: validSelectedIds
        });
        setSelectedRestaurants(validSelectedIds);
      }
      
      // Clean visibleRestaurants - remove IDs that don't exist in database
      const validVisibleIds = visibleRestaurants.filter(id => validIds.has(id));
      if (validVisibleIds.length !== visibleRestaurants.length) {
        console.log("Cleaning invalid visibleRestaurants:", {
          before: visibleRestaurants,
          after: validVisibleIds
        });
        setVisibleRestaurants(validVisibleIds);
      }
    }
  }, [restaurants]);

  const pinnedRestaurants = useMemo(() => 
    restaurants?.filter(r => r.is_pinned) || []
  , [restaurants]);

  const unpinnedRestaurants = useMemo(() => 
    restaurants?.filter(r => !r.is_pinned) || []
  , [restaurants]);

  const selectAllPinned = () => {
    const pinnedIds = pinnedRestaurants.map(r => r.id);
    setSelectedRestaurants(pinnedIds);
    setVisibleRestaurants(pinnedIds);
  };

  const toggleRestaurant = (id: string) => {
    if (id === "all") {
      setSelectedRestaurants([]);
      setVisibleRestaurants([]);
      return;
    }
    // Add to visible and select
    addVisibleRestaurant(id);
  };

  const handleClearAll = () => {
    setSelectedRestaurants([]);
    setVisibleRestaurants([]);
  };

  // Get names for visible restaurants
  const visibleRestaurantData = restaurants
    ?.filter((r) => visibleRestaurants.includes(r.id)) || [];

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
    if (weekOnlyRange && range?.from) {
      const snappedFrom = startOfWeek(range.from, { weekStartsOn: 1 });
      const snappedTo = endOfWeek(range.to || range.from, { weekStartsOn: 1 });
      const snapped = { from: snappedFrom, to: snappedTo };
      setPeriodMode("range");
      setDateRange(snapped);
    } else if (range?.from && range?.to) {
      setPeriodMode("range");
      setDateRange(range);
    } else {
      setDateRange(range);
    }
  };

  const handleQuickSelect = (mode: "previous_week" | "7d" | "30d" | "current_month") => {
    const today = new Date();
    let from: Date;
    let to: Date;

    switch (mode) {
      case "previous_week":
        const lastWeek = subWeeks(today, 1);
        from = startOfWeek(lastWeek, { weekStartsOn: 1 });
        to = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      case "7d":
        from = subDays(today, 6);
        to = today;
        break;
      case "30d":
        from = subDays(today, 29);
        to = today;
        break;
      case "current_month":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
    }
    setPeriodMode(mode);
    setDateRange({ from, to });
    setPeriodOpen(false);
  };

  const getPeriodDisplayText = () => {
    switch (periodMode) {
      case "previous_week":
        return "Semaine précédente";
      case "7d":
        return "7 derniers jours";
      case "30d":
        return "30 derniers jours";
      case "current_month":
        return "Mois en cours";
      case "month":
        return `${MONTHS_FULL[selectedMonth - 1]} ${selectedYear}`;
      case "year":
        return `${selectedYear}`;
      case "range":
        if (dateRange?.from && dateRange?.to) {
          return `${format(dateRange.from, "dd/MM/yyyy")} – ${format(dateRange.to, "dd/MM/yyyy")}`;
        }
        return "Sélectionner une période";
      default:
        return "Sélectionner une période";
    }
  };

  const handleResetPeriod = () => {
    setPeriodMode("year");
    setSelectedYear(currentYear);
    setDateRange(undefined);
    setPeriodOpen(false);
  };

  const showResetButton = periodMode === "month" || 
    periodMode === "previous_week" || 
    periodMode === "7d" || 
    periodMode === "30d" || 
    periodMode === "current_month" || 
    (periodMode === "range" && dateRange?.from);

  return (
    <div className="sticky top-0 z-40 backdrop-blur-xl bg-background/95 border-2 border-border/40 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex flex-wrap gap-3 items-start">
        {/* Restaurant Multi-Select (compact) */}
        <div className="w-[280px] shrink-0">
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
                  {visibleRestaurants.length === 0 ? (
                    <span>Tous les restaurants</span>
                  ) : (
                    <span className="text-primary font-medium">
                      {visibleRestaurants.length} restaurant{visibleRestaurants.length > 1 ? "s" : ""} affiché{visibleRestaurants.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-background border shadow-lg" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un restaurant..." />
                <CommandList>
                  <CommandEmpty>Aucun restaurant trouvé.</CommandEmpty>
                  
                  {/* Quick actions */}
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => toggleRestaurant("all")}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          visibleRestaurants.length === 0 ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">Tous les restaurants</span>
                    </CommandItem>
                    {pinnedRestaurants.length > 0 && (
                      <CommandItem
                        value="select-all-pinned"
                        onSelect={selectAllPinned}
                        className="text-amber-600"
                      >
                        <Star className="mr-2 h-4 w-4 fill-amber-500 text-amber-500" />
                        <span className="font-medium">Sélectionner les {pinnedRestaurants.length} épinglés</span>
                      </CommandItem>
                    )}
                  </CommandGroup>

                  {/* Pinned restaurants */}
                  {pinnedRestaurants.length > 0 && (
                    <CommandGroup heading={`⭐ Épinglés (${pinnedRestaurants.length})`}>
                      {pinnedRestaurants.map((restaurant) => (
                        <CommandItem
                          key={restaurant.id}
                          value={restaurant.name}
                          onSelect={() => toggleRestaurant(restaurant.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              visibleRestaurants.includes(restaurant.id)
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
                  )}

                  {/* Other restaurants */}
                  <CommandGroup heading={pinnedRestaurants.length > 0 ? "Autres restaurants" : undefined}>
                    {unpinnedRestaurants.map((restaurant) => (
                      <CommandItem
                        key={restaurant.id}
                        value={restaurant.name}
                        onSelect={() => toggleRestaurant(restaurant.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            visibleRestaurants.includes(restaurant.id)
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
        <div className="flex flex-wrap gap-2">
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
          <Button
            variant={selectedPlatform === "pos" ? "default" : "outline"}
            onClick={() => setSelectedPlatform("pos")}
            className={cn(
              "h-10 gap-2 transition-all duration-200",
              selectedPlatform === "pos" && "bg-amber-600 hover:bg-amber-700 text-white border-0"
            )}
          >
            <Store className="h-4 w-4" />
            <span>Caisse</span>
          </Button>
        </div>



        {!hidePeriodSelector && <div className="flex items-center gap-2">
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
                      value="quick" 
                      className="flex-1 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                    >
                      Rapide
                    </TabsTrigger>
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

                <TabsContent value="quick" className="p-5 mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className={cn(
                        "h-11 text-sm font-medium rounded-lg transition-all",
                        periodMode === "previous_week"
                          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                          : "hover:bg-muted hover:border-muted-foreground/30"
                      )}
                      onClick={() => handleQuickSelect("previous_week")}
                    >
                      Semaine précédente
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-11 text-sm font-medium rounded-lg transition-all",
                        periodMode === "7d"
                          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                          : "hover:bg-muted hover:border-muted-foreground/30"
                      )}
                      onClick={() => handleQuickSelect("7d")}
                    >
                      7 derniers jours
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-11 text-sm font-medium rounded-lg transition-all",
                        periodMode === "30d"
                          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                          : "hover:bg-muted hover:border-muted-foreground/30"
                      )}
                      onClick={() => handleQuickSelect("30d")}
                    >
                      30 derniers jours
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-11 text-sm font-medium rounded-lg transition-all",
                        periodMode === "current_month"
                          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                          : "hover:bg-muted hover:border-muted-foreground/30"
                      )}
                      onClick={() => handleQuickSelect("current_month")}
                    >
                      Mois en cours
                    </Button>
                  </div>
                </TabsContent>

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
                      disabled={tempYear >= currentYear}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {MONTHS_SHORT.map((month, index) => {
                      const isSelected = periodMode === "month" && 
                                         selectedMonth === index + 1 && 
                                         selectedYear === tempYear;
                      const isFutureMonth = tempYear > currentYear || 
                                            (tempYear === currentYear && index > currentMonth);
                      return (
                        <Button
                          key={month}
                          variant="outline"
                          size="sm"
                          disabled={isFutureMonth}
                          className={cn(
                            "h-11 text-sm font-medium rounded-lg transition-all",
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" 
                              : "hover:bg-muted hover:border-muted-foreground/30",
                            isFutureMonth && "opacity-50 cursor-not-allowed"
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
                      const isFutureYear = year > currentYear;
                      return (
                        <Button
                          key={year}
                          variant="outline"
                          disabled={isFutureYear}
                          className={cn(
                            "h-12 text-base font-medium rounded-lg transition-all",
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" 
                              : "hover:bg-muted hover:border-muted-foreground/30",
                            isFutureYear && "opacity-50 cursor-not-allowed"
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
                      disabled={{ after: today }}
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
                  {weekOnlyRange && (
                    <p className="text-xs text-muted-foreground text-center pb-2">
                      Sélection par semaine uniquement (lun–dim)
                    </p>
                  )}
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
        </div>}
      </div>

      {/* Visible Restaurants Display */}
      {visibleRestaurants.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Restaurants:</span>
          {visibleRestaurantData.map((restaurant) => {
            const isSelected = selectedRestaurants.includes(restaurant.id);
            
            return (
              <Tooltip key={restaurant.id}>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className={`gap-1 py-1 px-3 cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30" 
                        : "bg-muted text-muted-foreground opacity-60 hover:opacity-80"
                    }`}
                    onClick={() => toggleRestaurantSelection(restaurant.id)}
                  >
                    <span className="font-medium">{restaurant.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeVisibleRestaurant(restaurant.id);
                      }}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {isSelected 
                    ? "Cliquer pour désélectionner (données exclues)" 
                    : "Cliquer pour re-sélectionner (données incluses)"}
                </TooltipContent>
              </Tooltip>
            );
          })}
          {visibleRestaurants.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
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
