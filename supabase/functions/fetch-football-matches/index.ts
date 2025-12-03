import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Match {
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

// Static Champions League 2024-25 data for French teams
// This is a temporary solution while waiting for RapidAPI approval
const STATIC_MATCHES: Match[] = [
  // Journée 6 - 10-11 décembre 2024
  {
    id: "ucl-2024-j6-psg",
    home_team: "Red Bull Salzburg",
    away_team: "Paris Saint-Germain",
    home_team_logo: "https://media.api-sports.io/football/teams/571.png",
    away_team_logo: "https://media.api-sports.io/football/teams/85.png",
    date: "2024-12-10",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Red Bull Arena",
    status: "NS",
  },
  {
    id: "ucl-2024-j6-lille",
    home_team: "LOSC Lille",
    away_team: "Sturm Graz",
    home_team_logo: "https://media.api-sports.io/football/teams/79.png",
    away_team_logo: "https://media.api-sports.io/football/teams/2381.png",
    date: "2024-12-10",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Pierre-Mauroy",
    status: "NS",
  },
  {
    id: "ucl-2024-j6-monaco",
    home_team: "AS Monaco",
    away_team: "Benfica",
    home_team_logo: "https://media.api-sports.io/football/teams/91.png",
    away_team_logo: "https://media.api-sports.io/football/teams/211.png",
    date: "2024-12-10",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Louis II",
    status: "NS",
  },
  {
    id: "ucl-2024-j6-brest",
    home_team: "Stade Brestois",
    away_team: "PSV Eindhoven",
    home_team_logo: "https://media.api-sports.io/football/teams/106.png",
    away_team_logo: "https://media.api-sports.io/football/teams/197.png",
    date: "2024-12-11",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Francis-Le Blé",
    status: "NS",
  },
  // Journée 7 - 21-22 janvier 2025
  {
    id: "ucl-2025-j7-psg",
    home_team: "Paris Saint-Germain",
    away_team: "Manchester City",
    home_team_logo: "https://media.api-sports.io/football/teams/85.png",
    away_team_logo: "https://media.api-sports.io/football/teams/50.png",
    date: "2025-01-22",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Parc des Princes",
    status: "NS",
  },
  {
    id: "ucl-2025-j7-lille",
    home_team: "Liverpool",
    away_team: "LOSC Lille",
    home_team_logo: "https://media.api-sports.io/football/teams/40.png",
    away_team_logo: "https://media.api-sports.io/football/teams/79.png",
    date: "2025-01-21",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Anfield",
    status: "NS",
  },
  {
    id: "ucl-2025-j7-monaco",
    home_team: "Aston Villa",
    away_team: "AS Monaco",
    home_team_logo: "https://media.api-sports.io/football/teams/66.png",
    away_team_logo: "https://media.api-sports.io/football/teams/91.png",
    date: "2025-01-21",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Villa Park",
    status: "NS",
  },
  {
    id: "ucl-2025-j7-brest",
    home_team: "Real Madrid",
    away_team: "Stade Brestois",
    home_team_logo: "https://media.api-sports.io/football/teams/541.png",
    away_team_logo: "https://media.api-sports.io/football/teams/106.png",
    date: "2025-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Santiago Bernabéu",
    status: "NS",
  },
  // Journée 8 - 29 janvier 2025
  {
    id: "ucl-2025-j8-psg",
    home_team: "VfB Stuttgart",
    away_team: "Paris Saint-Germain",
    home_team_logo: "https://media.api-sports.io/football/teams/172.png",
    away_team_logo: "https://media.api-sports.io/football/teams/85.png",
    date: "2025-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "MHPArena",
    status: "NS",
  },
  {
    id: "ucl-2025-j8-lille",
    home_team: "LOSC Lille",
    away_team: "Feyenoord",
    home_team_logo: "https://media.api-sports.io/football/teams/79.png",
    away_team_logo: "https://media.api-sports.io/football/teams/215.png",
    date: "2025-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Pierre-Mauroy",
    status: "NS",
  },
  {
    id: "ucl-2025-j8-monaco",
    home_team: "AS Monaco",
    away_team: "Inter Milan",
    home_team_logo: "https://media.api-sports.io/football/teams/91.png",
    away_team_logo: "https://media.api-sports.io/football/teams/505.png",
    date: "2025-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Louis II",
    status: "NS",
  },
  // === SAISON 2025-26 (données fictives pour test) ===
  // Phase de ligue - Décembre 2025
  {
    id: "ucl-2025-26-j6-psg",
    home_team: "Paris Saint-Germain",
    away_team: "Bayern Munich",
    home_team_logo: "https://media.api-sports.io/football/teams/85.png",
    away_team_logo: "https://media.api-sports.io/football/teams/157.png",
    date: "2025-12-10",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Parc des Princes",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j6-lille",
    home_team: "LOSC Lille",
    away_team: "AC Milan",
    home_team_logo: "https://media.api-sports.io/football/teams/79.png",
    away_team_logo: "https://media.api-sports.io/football/teams/489.png",
    date: "2025-12-10",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Pierre-Mauroy",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j6-monaco",
    home_team: "Barcelona",
    away_team: "AS Monaco",
    home_team_logo: "https://media.api-sports.io/football/teams/529.png",
    away_team_logo: "https://media.api-sports.io/football/teams/91.png",
    date: "2025-12-11",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Camp Nou",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j6-lyon",
    home_team: "Olympique Lyonnais",
    away_team: "Juventus",
    home_team_logo: "https://media.api-sports.io/football/teams/80.png",
    away_team_logo: "https://media.api-sports.io/football/teams/496.png",
    date: "2025-12-11",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Groupama Stadium",
    status: "NS",
  },
  // Phase de ligue - Janvier 2026 (données fictives pour test)
  {
    id: "ucl-2025-26-j7-psg",
    home_team: "Manchester City",
    away_team: "Paris Saint-Germain",
    home_team_logo: "https://media.api-sports.io/football/teams/50.png",
    away_team_logo: "https://media.api-sports.io/football/teams/85.png",
    date: "2026-01-21",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Etihad Stadium",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j7-lille",
    home_team: "LOSC Lille",
    away_team: "Real Madrid",
    home_team_logo: "https://media.api-sports.io/football/teams/79.png",
    away_team_logo: "https://media.api-sports.io/football/teams/541.png",
    date: "2026-01-21",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Pierre-Mauroy",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j7-monaco",
    home_team: "AS Monaco",
    away_team: "Liverpool",
    home_team_logo: "https://media.api-sports.io/football/teams/91.png",
    away_team_logo: "https://media.api-sports.io/football/teams/40.png",
    date: "2026-01-22",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stade Louis II",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j7-lyon",
    home_team: "Borussia Dortmund",
    away_team: "Olympique Lyonnais",
    home_team_logo: "https://media.api-sports.io/football/teams/165.png",
    away_team_logo: "https://media.api-sports.io/football/teams/80.png",
    date: "2026-01-22",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Signal Iduna Park",
    status: "NS",
  },
  // Journée 8 - Janvier 2026
  {
    id: "ucl-2025-26-j8-psg",
    home_team: "Paris Saint-Germain",
    away_team: "Inter Milan",
    home_team_logo: "https://media.api-sports.io/football/teams/85.png",
    away_team_logo: "https://media.api-sports.io/football/teams/505.png",
    date: "2026-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Parc des Princes",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j8-lille",
    home_team: "Atlético Madrid",
    away_team: "LOSC Lille",
    home_team_logo: "https://media.api-sports.io/football/teams/530.png",
    away_team_logo: "https://media.api-sports.io/football/teams/79.png",
    date: "2026-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Metropolitano",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j8-monaco",
    home_team: "Chelsea",
    away_team: "AS Monaco",
    home_team_logo: "https://media.api-sports.io/football/teams/49.png",
    away_team_logo: "https://media.api-sports.io/football/teams/91.png",
    date: "2026-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Stamford Bridge",
    status: "NS",
  },
  {
    id: "ucl-2025-26-j8-lyon",
    home_team: "Olympique Lyonnais",
    away_team: "Arsenal",
    home_team_logo: "https://media.api-sports.io/football/teams/80.png",
    away_team_logo: "https://media.api-sports.io/football/teams/42.png",
    date: "2026-01-29",
    time: "21:00",
    competition: "Champions League",
    competition_logo: "https://media.api-sports.io/football/leagues/2.png",
    venue: "Groupama Stadium",
    status: "NS",
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Returning static Champions League 2024-25 matches for French teams');
    console.log(`Total matches: ${STATIC_MATCHES.length}`);

    return new Response(JSON.stringify({ matches: STATIC_MATCHES }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in fetch-football-matches:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
