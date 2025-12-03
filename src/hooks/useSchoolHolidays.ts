import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SchoolHoliday {
  id: string;
  description: string;
  start_date: string;
  end_date: string;
  zones: string[];
  location: string;
  annee_scolaire: string;
}

interface Restaurant {
  id: string;
  name: string;
  postal_code: string | null;
}

// Mapping departments to school zones
const DEPARTMENT_TO_ZONE: Record<string, string> = {
  // Zone A
  "01": "A", "03": "A", "07": "A", "15": "A", "26": "A", "38": "A", "42": "A",
  "43": "A", "63": "A", "69": "A", "73": "A", "74": "A",
  "21": "A", "25": "A", "39": "A", "58": "A", "70": "A", "71": "A", "89": "A", "90": "A",
  "24": "A", "33": "A", "40": "A", "47": "A", "64": "A",
  "19": "A", "23": "A", "87": "A",
  "16": "A", "17": "A", "79": "A", "86": "A",
  
  // Zone B
  "14": "B", "27": "B", "50": "B", "61": "B", "76": "B",
  "02": "B", "59": "B", "60": "B", "62": "B", "80": "B",
  "08": "B", "10": "B", "51": "B", "52": "B", "54": "B", "55": "B", "57": "B", 
  "67": "B", "68": "B", "88": "B",
  "18": "B", "28": "B", "36": "B", "37": "B", "41": "B", "45": "B",
  "22": "B", "29": "B", "35": "B", "56": "B",
  "44": "B", "49": "B", "53": "B", "72": "B", "85": "B",
  
  // Zone C
  "75": "C", "77": "C", "78": "C", "91": "C", "92": "C", "93": "C", "94": "C", "95": "C",
  "09": "C", "11": "C", "12": "C", "30": "C", "31": "C", "32": "C", "34": "C", 
  "46": "C", "48": "C", "65": "C", "66": "C", "81": "C", "82": "C",
  "04": "C", "05": "C", "06": "C", "13": "C", "83": "C", "84": "C",
  "2A": "C", "2B": "C",
};

export interface ContextualEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  type: "school_holiday" | "football_match" | "public_holiday";
  zones: string[];
  color: { bg: string; text: string; border: string };
  icon: string;
  // Football match specific fields
  home_team?: string;
  away_team?: string;
  home_team_logo?: string;
  away_team_logo?: string;
  time?: string;
  venue?: string;
}

export function useSchoolHolidays(
  year: number,
  restaurants: Restaurant[],
  enabled: boolean = true
) {
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHolidays([]);
      return;
    }

    const fetchHolidays = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fnError } = await supabase.functions.invoke('fetch-school-holidays', {
          body: { year }
        });
        
        if (fnError) throw fnError;
        
        setHolidays(data.holidays || []);
      } catch (err: any) {
        console.error('Error fetching school holidays:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, [year, enabled]);

  // Get zones relevant to current restaurants
  const relevantZones = useMemo(() => {
    const zones = new Set<string>();
    
    restaurants.forEach(restaurant => {
      if (restaurant.postal_code) {
        const dept = restaurant.postal_code.slice(0, 2);
        const zone = DEPARTMENT_TO_ZONE[dept];
        if (zone) {
          zones.add(`Zone ${zone}`);
        }
      }
    });
    
    return Array.from(zones);
  }, [restaurants]);

  // Filter holidays by relevant zones
  const contextualEvents: ContextualEvent[] = useMemo(() => {
    if (!enabled || holidays.length === 0) return [];
    
    return holidays
      .filter(holiday => {
        // If no restaurants selected, show all zones
        if (relevantZones.length === 0) return true;
        // Show holiday if it affects any of the relevant zones
        return holiday.zones.some(z => relevantZones.includes(z));
      })
      .map(holiday => ({
        id: holiday.id,
        title: holiday.description,
        description: `${holiday.description} - ${holiday.zones.join(', ')}`,
        start_date: holiday.start_date,
        end_date: holiday.end_date,
        type: "school_holiday" as const,
        zones: holiday.zones,
        color: {
          bg: "bg-orange-500/20",
          text: "text-orange-700 dark:text-orange-300",
          border: "border-orange-500",
        },
        icon: "🎒",
      }));
  }, [holidays, relevantZones, enabled]);

  return {
    contextualEvents,
    loading,
    error,
    relevantZones,
  };
}

export function getDepartmentZone(postalCode: string | null): string | null {
  if (!postalCode) return null;
  const dept = postalCode.slice(0, 2);
  return DEPARTMENT_TO_ZONE[dept] || null;
}
