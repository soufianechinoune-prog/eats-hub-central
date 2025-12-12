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
  home_team: string;
  away_team: string;
  home_team_logo: string;
  away_team_logo: string;
  venue: string;
}

// French teams in Champions League 2024-25
const CHAMPIONS_LEAGUE_TEAMS = ["Paris Saint-Germain", "PSG", "LOSC Lille", "Lille", "AS Monaco", "Monaco", "Stade Brestois", "Brest"];

// CAN 2025 teams
const CAN_TEAMS = ["Maroc", "Algérie", "Tunisie"];

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
        bg: "rgba(59, 130, 246, 0.08)",
        text: "#2563eb",
        border: "rgba(59, 130, 246, 0.6)",
      },
      icon: "⚽",
      home_team: match.home_team,
      away_team: match.away_team,
      home_team_logo: match.home_team_logo,
      away_team_logo: match.away_team_logo,
      venue: match.venue,
    }));
  }, [matches, enabled]);

  // Return relevant teams for display (UCL + CAN)
  const relevantTeams = useMemo(() => {
    if (!enabled || matches.length === 0) return [];
    const teams = new Set<string>();
    matches.forEach(m => {
      // Champions League teams
      if (CHAMPIONS_LEAGUE_TEAMS.some(t => m.home_team.includes(t))) {
        teams.add(m.home_team);
      }
      if (CHAMPIONS_LEAGUE_TEAMS.some(t => m.away_team.includes(t))) {
        teams.add(m.away_team);
      }
      // CAN teams
      if (CAN_TEAMS.includes(m.home_team)) {
        teams.add(m.home_team);
      }
      if (CAN_TEAMS.includes(m.away_team)) {
        teams.add(m.away_team);
      }
    });
    return Array.from(teams).slice(0, 7); // Max 7 teams (4 UCL + 3 CAN)
  }, [matches, enabled]);

  return {
    footballEvents,
    loading,
    error,
    relevantTeams,
  };
}
