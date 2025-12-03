import { useMemo } from "react";
import type { ContextualEvent } from "@/hooks/useSchoolHolidays";

// French public holidays for a given year
// These are fixed dates or calculated based on Easter
export function getFrenchHolidays(year: number): { date: string; name: string }[] {
  const holidays = [
    { date: `${year}-01-01`, name: "Jour de l'An" },
    { date: `${year}-05-01`, name: "Fête du Travail" },
    { date: `${year}-05-08`, name: "Victoire 1945" },
    { date: `${year}-07-14`, name: "Fête Nationale" },
    { date: `${year}-08-15`, name: "Assomption" },
    { date: `${year}-11-01`, name: "Toussaint" },
    { date: `${year}-11-11`, name: "Armistice 1918" },
    { date: `${year}-12-25`, name: "Noël" },
  ];

  // Calculate Easter-based holidays
  const easter = calculateEasterDate(year);
  
  // Lundi de Pâques (Easter Monday)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({ 
    date: formatDate(easterMonday), 
    name: "Lundi de Pâques" 
  });

  // Ascension (39 days after Easter)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  holidays.push({ 
    date: formatDate(ascension), 
    name: "Ascension" 
  });

  // Lundi de Pentecôte (50 days after Easter)
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 50);
  holidays.push({ 
    date: formatDate(pentecost), 
    name: "Lundi de Pentecôte" 
  });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

// Calculate Easter Sunday using the Anonymous Gregorian algorithm
function calculateEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useFrenchHolidays(year: number, enabled: boolean = true) {
  const contextualEvents: ContextualEvent[] = useMemo(() => {
    if (!enabled) return [];
    
    const holidays = getFrenchHolidays(year);
    
    return holidays.map((holiday, index) => ({
      id: `public-holiday-${year}-${index}`,
      title: holiday.name,
      description: `${holiday.name} - Jour férié`,
      start_date: holiday.date,
      end_date: holiday.date, // Public holidays are single-day events
      type: "public_holiday" as const,
      zones: [], // Applies to all of France
      color: {
        bg: "bg-red-500/20",
        text: "text-red-700 dark:text-red-300",
        border: "border-red-500",
      },
      icon: "🇫🇷",
    }));
  }, [year, enabled]);

  return {
    contextualEvents,
    loading: false,
    error: null,
  };
}
