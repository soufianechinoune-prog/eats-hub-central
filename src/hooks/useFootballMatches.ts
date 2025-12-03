import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FootballMatch {
  id: string;
  home_team: string;
  away_team: string;
  home_team_logo: string;
  away_team_logo: string;
  date: string;
  time: string;
  competition: string;
  competition_logo: string;
  venue: string;
  status: string;
}

interface Restaurant {
  id: string;
  name: string;
  city?: string | null;
}

export interface FootballEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  type: "football_match";
  teams: string[];
  competition: string;
  time: string;
  color: { bg: string; text: string; border: string };
  icon: string;
}

// Mapping cities to team names for filtering
const CITY_TO_TEAM_NAME: Record<string, string[]> = {
  "paris": ["Paris Saint-Germain", "PSG"],
  "marseille": ["Olympique de Marseille", "Marseille"],
  "lyon": ["Olympique Lyonnais", "Lyon"],
  "monaco": ["AS Monaco", "Monaco"],
  "lille": ["LOSC Lille", "Lille"],
  "nice": ["OGC Nice", "Nice"],
  "rennes": ["Stade Rennais", "Rennes"],
  "lens": ["RC Lens", "Lens"],
  "strasbourg": ["RC Strasbourg", "Strasbourg"],
  "nantes": ["FC Nantes", "Nantes"],
  "toulouse": ["Toulouse FC", "Toulouse"],
  "montpellier": ["Montpellier HSC", "Montpellier"],
  "reims": ["Stade de Reims", "Reims"],
  "brest": ["Stade Brestois", "Brest"],
  "le havre": ["Le Havre AC", "Le Havre"],
  "auxerre": ["AJ Auxerre", "Auxerre"],
  "saint-etienne": ["AS Saint-Étienne", "Saint-Étienne"],
  "saint-étienne": ["AS Saint-Étienne", "Saint-Étienne"],
  "angers": ["Angers SCO", "Angers"],
};

export function useFootballMatches(
  year: number,
  restaurants: Restaurant[],
  enabled: boolean = true
) {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get cities from restaurants
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    restaurants.forEach(r => {
      if (r.city) {
        citySet.add(r.city.toLowerCase().trim());
      }
    });
    return Array.from(citySet);
  }, [restaurants]);

  // Get team names relevant to restaurants
  const relevantTeams = useMemo(() => {
    const teams = new Set<string>();
    cities.forEach(city => {
      const teamNames = CITY_TO_TEAM_NAME[city];
      if (teamNames) {
        teamNames.forEach(t => teams.add(t));
      }
    });
    return Array.from(teams);
  }, [cities]);

  useEffect(() => {
    if (!enabled) {
      setMatches([]);
      return;
    }

    const fetchMatches = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('fetch-football-matches', {
          body: { year, cities }
        });

        if (fnError) throw fnError;

        setMatches(data.matches || []);
      } catch (err: any) {
        console.error('Error fetching football matches:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [year, enabled, JSON.stringify(cities)]);

  // Filter and format matches as FootballEvents
  const footballEvents: FootballEvent[] = useMemo(() => {
    if (!enabled || matches.length === 0) return [];

    return matches
      .filter(match => {
        // If no specific restaurants/cities, show all matches
        if (relevantTeams.length === 0) return true;
        // Show match if it involves a relevant team
        return relevantTeams.some(team => 
          match.home_team.includes(team) || match.away_team.includes(team)
        );
      })
      .map(match => {
        const isChampionsLeague = match.competition === 'Champions League';
        return {
          id: match.id,
          title: `${match.home_team} vs ${match.away_team}`,
          description: `${match.competition} • ${match.time} • ${match.venue}`,
          start_date: match.date,
          end_date: match.date, // Single day event
          type: "football_match" as const,
          teams: [match.home_team, match.away_team],
          competition: match.competition,
          time: match.time,
          color: isChampionsLeague 
            ? {
                bg: "bg-blue-600/20",
                text: "text-blue-700 dark:text-blue-300",
                border: "border-blue-600",
              }
            : {
                bg: "bg-green-600/20",
                text: "text-green-700 dark:text-green-300",
                border: "border-green-600",
              },
          icon: "⚽",
        };
      });
  }, [matches, relevantTeams, enabled]);

  return {
    footballEvents,
    loading,
    error,
    relevantTeams,
  };
}
