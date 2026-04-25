import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import type { DateRange } from "react-day-picker";

export type PeriodMode = "year" | "month" | "range" | "previous_week" | "7d" | "30d" | "current_month";
export type Platform = "uber_eats" | "deliveroo" | "global";
export type ComparisonMode = "yearOverYear" | "rollingPeriod";
export type ProfitabilityBase = "gross" | "net"; // gross = Ventes TTC, net = Ventes - Promos

interface AnalyticsContextType {
  selectedRestaurants: string[];
  setSelectedRestaurants: (ids: string[]) => void;
  visibleRestaurants: string[];
  setVisibleRestaurants: (ids: string[]) => void;
  toggleRestaurantSelection: (id: string) => void;
  addVisibleRestaurant: (id: string) => void;
  removeVisibleRestaurant: (id: string) => void;
  selectedPlatform: Platform;
  setSelectedPlatform: (platform: Platform) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  periodMode: PeriodMode;
  setPeriodMode: (mode: PeriodMode) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  comparisonMode: ComparisonMode;
  setComparisonMode: (mode: ComparisonMode) => void;
  profitabilityBase: ProfitabilityBase;
  setProfitabilityBase: (base: ProfitabilityBase) => void;
  selectedChainId: string | null;
  setSelectedChainId: (id: string | null) => void;
  isInitialized: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

const STORAGE_KEY = "analytics-context";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// Get stored state ONCE at module load time (outside component)
let cachedStoredState: any = null;
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  cachedStoredState = stored ? JSON.parse(stored) : null;
} catch {
  cachedStoredState = null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  // Use cached stored state from module load (avoids re-reading localStorage)
  const storedState = cachedStoredState;

  // Initialize state from stored values
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>(
    () => storedState?.selectedRestaurants || []
  );

  const [visibleRestaurants, setVisibleRestaurants] = useState<string[]>(
    () => storedState?.visibleRestaurants || storedState?.selectedRestaurants || []
  );

  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(
    () => storedState?.selectedPlatform || "uber_eats"
  );

  const [selectedYear, setSelectedYear] = useState<number>(
    () => storedState?.selectedYear || currentYear
  );

  const [selectedMonth, setSelectedMonth] = useState<number>(
    () => storedState?.selectedMonth || currentMonth
  );

  const [periodMode, setPeriodMode] = useState<PeriodMode>(
    () => storedState?.periodMode || "year"
  );

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const range = storedState?.dateRange;
    if (range?.from && range?.to) {
      return {
        from: new Date(range.from),
        to: new Date(range.to),
      };
    }
    return undefined;
  });

  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(
    () => storedState?.comparisonMode || "yearOverYear"
  );

  const [profitabilityBase, setProfitabilityBase] = useState<ProfitabilityBase>(
    () => storedState?.profitabilityBase || "gross"
  );

  const [selectedChainId, setSelectedChainId] = useState<string | null>(
    () => storedState?.selectedChainId || null
  );

  // Track if initial mount is complete to prevent saving during hydration
  const hasMounted = useRef(false);

  // Toggle restaurant selection state (visible but selected/deselected)
  const toggleRestaurantSelection = (id: string) => {
    if (selectedRestaurants.includes(id)) {
      // Désélectionner (mais garder visible)
      setSelectedRestaurants(selectedRestaurants.filter(r => r !== id));
    } else {
      // Re-sélectionner
      setSelectedRestaurants([...selectedRestaurants, id]);
    }
  };

  // Add a restaurant to visible list (and select it)
  const addVisibleRestaurant = (id: string) => {
    if (!visibleRestaurants.includes(id)) {
      setVisibleRestaurants([...visibleRestaurants, id]);
    }
    if (!selectedRestaurants.includes(id)) {
      setSelectedRestaurants([...selectedRestaurants, id]);
    }
  };

  // Remove a restaurant from visible list (and deselect it)
  const removeVisibleRestaurant = (id: string) => {
    setVisibleRestaurants(visibleRestaurants.filter((r) => r !== id));
    setSelectedRestaurants(selectedRestaurants.filter((r) => r !== id));
  };

  // Keep invariants between lists:
  // - selectedRestaurants must always be a subset of visibleRestaurants
  useEffect(() => {
    setSelectedRestaurants((prev) => prev.filter((id) => visibleRestaurants.includes(id)));
  }, [visibleRestaurants]);

  // Persist to localStorage whenever state changes (but not on initial mount)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const state = {
      selectedRestaurants,
      visibleRestaurants,
      selectedPlatform,
      selectedYear,
      selectedMonth,
      periodMode,
      comparisonMode,
      profitabilityBase,
      selectedChainId,
      dateRange: dateRange
        ? {
            from: dateRange.from?.toISOString(),
            to: dateRange.to?.toISOString(),
          }
        : undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    cachedStoredState = state;
  }, [
    selectedRestaurants,
    visibleRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    comparisonMode,
    profitabilityBase,
    selectedChainId,
  ]);

  const value = {
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
    profitabilityBase,
    setProfitabilityBase,
    selectedChainId,
    setSelectedChainId,
    isInitialized: true,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error("useAnalyticsContext must be used within AnalyticsProvider");
  }
  return context;
}
