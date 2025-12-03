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

// French teams in Champions League 2024-25
const CHAMPIONS_LEAGUE_TEAMS = ["Paris Saint-Germain", "PSG", "LOSC Lille", "Lille", "AS Monaco", "Monaco", "Stade Brestois", "Brest"];

export function useFootballMatches(
  year: number,
  _restaurants: Restaurant[],
  enabled: boolean = true
) {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          body: {}
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
  }, [year, enabled]);

  // Format matches as FootballEvents - show all Champions League matches
  const footballEvents: FootballEvent[] = useMemo(() => {
    if (!enabled || matches.length === 0) return [];

    return matches.map(match => ({
      id: match.id,
      title: `⚽ ${match.home_team} vs ${match.away_team}`,
      description: `${match.competition} • ${match.time} • ${match.venue}`,
      start_date: match.date,
      end_date: match.date,
      type: "football_match" as const,
      teams: [match.home_team, match.away_team],
      competition: match.competition,
      time: match.time,
      color: {
        bg: "bg-blue-600/20",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-600",
      },
      icon: "⚽",
    }));
  }, [matches, enabled]);

  // Return relevant teams for display
  const relevantTeams = useMemo(() => {
    if (!enabled || matches.length === 0) return [];
    const teams = new Set<string>();
    matches.forEach(m => {
      if (CHAMPIONS_LEAGUE_TEAMS.some(t => m.home_team.includes(t))) {
        teams.add(m.home_team);
      }
      if (CHAMPIONS_LEAGUE_TEAMS.some(t => m.away_team.includes(t))) {
        teams.add(m.away_team);
      }
    });
    return Array.from(teams).slice(0, 4); // Max 4 teams
  }, [matches, enabled]);

  return {
    footballEvents,
    loading,
    error,
    relevantTeams,
  };
}
