import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar, ChevronsUpDown, ChevronLeft, ChevronRight, X } from "lucide-react";

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
const currentMonth = today.getMonth(); // 0-11
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

export type OverviewPeriodMode = "previous_week" | "7d" | "30d" | "current_month" | "year" | "custom_month" | "custom_range";

interface OverviewPeriodSelectorProps {
  periodMode: OverviewPeriodMode;
  onPeriodModeChange: (mode: OverviewPeriodMode) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onReset?: () => void;
  showReset?: boolean;
}

export function OverviewPeriodSelector({
  periodMode,
  onPeriodModeChange,
  selectedYear,
  onYearChange,
  selectedMonth,
  onMonthChange,
  dateRange,
  onDateRangeChange,
  onReset,
  showReset = false,
}: OverviewPeriodSelectorProps) {
  const [periodOpen, setPeriodOpen] = useState(false);
  const [tempYear, setTempYear] = useState(selectedYear);
  const [activeTab, setActiveTab] = useState<string>(
    periodMode === "custom_month" ? "month" : 
    periodMode === "year" ? "year" : 
    periodMode === "custom_range" ? "range" : "quick"
  );

  const handleMonthSelect = (monthIndex: number) => {
    onPeriodModeChange("custom_month");
    onYearChange(tempYear);
    onMonthChange(monthIndex + 1);
    setPeriodOpen(false);
  };

  const handleYearSelect = (year: number) => {
    onPeriodModeChange("year");
    onYearChange(year);
    setPeriodOpen(false);
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onPeriodModeChange("custom_range");
      onDateRangeChange(range);
      setPeriodOpen(false);
    } else {
      onDateRangeChange(range);
    }
  };

  const handleQuickSelect = (mode: OverviewPeriodMode) => {
    onPeriodModeChange(mode);
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
      case "year":
        return `${selectedYear}`;
      case "custom_month":
        return `${MONTHS_FULL[selectedMonth - 1]} ${selectedYear}`;
      case "custom_range":
        if (dateRange?.from && dateRange?.to) {
          return `${format(dateRange.from, "dd/MM/yyyy")} – ${format(dateRange.to, "dd/MM/yyyy")}`;
        }
        return "Période personnalisée";
      default:
        return "Sélectionner une période";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="min-w-[180px] justify-between bg-background"
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

          {/* Quick selections */}
          <TabsContent value="quick" className="p-4 mt-0">
            <div className="flex flex-col gap-2">
              {[
                { value: "previous_week" as OverviewPeriodMode, label: "Semaine précédente" },
                { value: "7d" as OverviewPeriodMode, label: "7 derniers jours" },
                { value: "30d" as OverviewPeriodMode, label: "30 derniers jours" },
                { value: "current_month" as OverviewPeriodMode, label: "Mois en cours" },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  className={cn(
                    "justify-start h-10 font-normal",
                    periodMode === option.value && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  )}
                  onClick={() => handleQuickSelect(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* Month selection */}
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
                const isSelected = periodMode === "custom_month" && 
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

          {/* Year selection */}
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

          {/* Custom date range */}
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
              />
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
    
    {showReset && onReset && (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        onClick={onReset}
        title="Réinitialiser la période"
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
  );
}
