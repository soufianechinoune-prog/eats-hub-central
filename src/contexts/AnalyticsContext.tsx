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
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

const STORAGE_KEY = "analytics-context";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage or defaults
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).selectedRestaurants || [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).selectedPlatform || "uber_eats";
      } catch {
        return "uber_eats";
      }
    }
    return "uber_eats";
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).selectedYear || currentYear;
      } catch {
        return currentYear;
      }
    }
    return currentYear;
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).selectedMonth || currentMonth;
      } catch {
        return currentMonth;
      }
    }
    return currentMonth;
  });

  const [periodMode, setPeriodMode] = useState<PeriodMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).periodMode || "year";
      } catch {
        return "year";
      }
    }
    return "year";
  });

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const range = JSON.parse(stored).dateRange;
        if (range && range.from && range.to) {
          return {
            from: new Date(range.from),
            to: new Date(range.to),
          };
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  });

  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).comparisonMode || "yearOverYear";
      } catch {
        return "yearOverYear";
      }
    }
    return "yearOverYear";
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
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
  }, [selectedRestaurants, selectedPlatform, selectedYear, selectedMonth, periodMode, dateRange, comparisonMode]);

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
