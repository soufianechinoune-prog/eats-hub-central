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

// French team IDs in API-Football
const FRENCH_TEAM_IDS = [85, 79, 91, 80, 81, 106]; // PSG, Lille, Monaco, Lyon, Marseille, Brest

// Fetch matches from RapidAPI Football API
async function fetchFromRapidAPI(): Promise<Match[] | null> {
  const apiKey = Deno.env.get('RAPIDAPI_KEY');
  if (!apiKey) {
    console.log('RAPIDAPI_KEY not configured, using static data');
    return null;
  }

  try {
    const currentYear = new Date().getFullYear();
    const season = new Date().getMonth() >= 7 ? currentYear : currentYear - 1;
    
    // Champions League ID = 2
    const response = await fetch(
      `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=2&season=${season}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      console.error('RapidAPI error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    if (!data.response || !Array.isArray(data.response)) {
      console.error('Invalid API response format');
      return null;
    }

    // Filter matches involving French teams
    const frenchMatches = data.response.filter((fixture: any) => 
      FRENCH_TEAM_IDS.includes(fixture.teams?.home?.id) || 
      FRENCH_TEAM_IDS.includes(fixture.teams?.away?.id)
    );

    console.log(`Found ${frenchMatches.length} matches involving French teams from API`);

    return frenchMatches.map((fixture: any) => ({
      id: `api-${fixture.fixture.id}`,
      home_team: fixture.teams.home.name,
      away_team: fixture.teams.away.name,
      home_team_logo: fixture.teams.home.logo,
      away_team_logo: fixture.teams.away.logo,
      date: fixture.fixture.date.split('T')[0],
      time: new Date(fixture.fixture.date).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Europe/Paris'
      }),
      competition: fixture.league.name,
      competition_logo: fixture.league.logo,
      venue: fixture.fixture.venue?.name || 'TBD',
      status: fixture.fixture.status.short,
    }));
  } catch (error) {
    console.error('Error fetching from RapidAPI:', error);
    return null;
  }
}

// Static Champions League data as fallback
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
  // === CAN 2025 - Coupe d'Afrique des Nations (Maroc) ===
  // GROUPE A - MAROC
  {
    id: "can-2025-grpA-maroc-1",
    home_team: "Maroc",
    away_team: "Comores",
    home_team_logo: "https://media.api-sports.io/football/teams/31.png",
    away_team_logo: "https://media.api-sports.io/football/teams/5529.png",
    date: "2025-12-21",
    time: "21:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Complexe Mohammed V, Casablanca",
    status: "NS",
  },
  {
    id: "can-2025-grpA-maroc-2",
    home_team: "Maroc",
    away_team: "Mali",
    home_team_logo: "https://media.api-sports.io/football/teams/31.png",
    away_team_logo: "https://media.api-sports.io/football/teams/1066.png",
    date: "2025-12-25",
    time: "18:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Stade de Marrakech",
    status: "NS",
  },
  {
    id: "can-2025-grpA-maroc-3",
    home_team: "Zambie",
    away_team: "Maroc",
    home_team_logo: "https://media.api-sports.io/football/teams/1061.png",
    away_team_logo: "https://media.api-sports.io/football/teams/31.png",
    date: "2025-12-29",
    time: "21:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Grand Stade de Tanger",
    status: "NS",
  },
  // GROUPE E - ALGÉRIE
  {
    id: "can-2025-grpE-algerie-1",
    home_team: "Algérie",
    away_team: "Soudan",
    home_team_logo: "https://media.api-sports.io/football/teams/1569.png",
    away_team_logo: "https://media.api-sports.io/football/teams/1526.png",
    date: "2025-12-22",
    time: "18:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Stade Moulay Abdallah, Rabat",
    status: "NS",
  },
  {
    id: "can-2025-grpE-algerie-2",
    home_team: "Burkina Faso",
    away_team: "Algérie",
    home_team_logo: "https://media.api-sports.io/football/teams/1041.png",
    away_team_logo: "https://media.api-sports.io/football/teams/1569.png",
    date: "2025-12-26",
    time: "21:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Grand Stade d'Agadir",
    status: "NS",
  },
  {
    id: "can-2025-grpE-algerie-3",
    home_team: "Algérie",
    away_team: "Angola",
    home_team_logo: "https://media.api-sports.io/football/teams/1569.png",
    away_team_logo: "https://media.api-sports.io/football/teams/1026.png",
    date: "2025-12-30",
    time: "18:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Stade de Fès",
    status: "NS",
  },
  // GROUPE B - TUNISIE
  {
    id: "can-2025-grpB-tunisie-1",
    home_team: "Tunisie",
    away_team: "Afrique du Sud",
    home_team_logo: "https://media.api-sports.io/football/teams/28.png",
    away_team_logo: "https://media.api-sports.io/football/teams/15.png",
    date: "2025-12-22",
    time: "21:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Stade Mohammed V, Casablanca",
    status: "NS",
  },
  {
    id: "can-2025-grpB-tunisie-2",
    home_team: "Égypte",
    away_team: "Tunisie",
    home_team_logo: "https://media.api-sports.io/football/teams/32.png",
    away_team_logo: "https://media.api-sports.io/football/teams/28.png",
    date: "2025-12-26",
    time: "18:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Grand Stade de Tanger",
    status: "NS",
  },
  {
    id: "can-2025-grpB-tunisie-3",
    home_team: "Tunisie",
    away_team: "Zimbabwe",
    home_team_logo: "https://media.api-sports.io/football/teams/28.png",
    away_team_logo: "https://media.api-sports.io/football/teams/1062.png",
    date: "2025-12-30",
    time: "21:00",
    competition: "CAN 2025",
    competition_logo: "https://media.api-sports.io/football/leagues/6.png",
    venue: "Stade de Marrakech",
    status: "NS",
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try RapidAPI first if key is configured
    const apiMatches = await fetchFromRapidAPI();
    
    if (apiMatches && apiMatches.length > 0) {
      console.log(`Returning ${apiMatches.length} matches from RapidAPI`);
      return new Response(JSON.stringify({ matches: apiMatches, source: 'api' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback to static data
    console.log('Using static Champions League data (API not available or no matches found)');
    console.log(`Total static matches: ${STATIC_MATCHES.length}`);

    return new Response(JSON.stringify({ matches: STATIC_MATCHES, source: 'static' }), {
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
