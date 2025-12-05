import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { DateRange } from "react-day-picker";

export type PeriodMode = "year" | "month" | "range";
export type Platform = "uber_eats" | "deliveroo" | "global";
export type ComparisonMode = "yearOverYear" | "rollingPeriod";

interface AnalyticsContextType {
  selectedRestaurants: string[];
  setSelectedRestaurants: (ids: string[]) => void;
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
  isInitialized: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

const STORAGE_KEY = "analytics-context";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// Helper to safely parse localStorage once
function getStoredState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  // Track initialization to prevent flicker
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Get stored state once during initialization
  const [storedState] = useState(() => getStoredState());

  // Initialize state from stored values
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>(
    () => storedState?.selectedRestaurants || []
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

  // Mark as initialized after first render
  useEffect(() => {
    // Small delay to ensure state is stable before rendering children
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Persist to localStorage whenever state changes (but not on initial load)
  useEffect(() => {
    if (!isInitialized) return;
    
    const state = {
      selectedRestaurants,
      selectedPlatform,
      selectedYear,
      selectedMonth,
      periodMode,
      comparisonMode,
      dateRange: dateRange ? {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      } : undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [selectedRestaurants, selectedPlatform, selectedYear, selectedMonth, periodMode, dateRange, comparisonMode, isInitialized]);

  const value = {
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
    comparisonMode,
    setComparisonMode,
    isInitialized,
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
