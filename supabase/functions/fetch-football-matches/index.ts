import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping French cities to Ligue 1 team IDs
const CITY_TO_TEAM: Record<string, { id: number; name: string }> = {
  "paris": { id: 85, name: "Paris Saint-Germain" },
  "marseille": { id: 81, name: "Olympique de Marseille" },
  "lyon": { id: 80, name: "Olympique Lyonnais" },
  "monaco": { id: 91, name: "AS Monaco" },
  "lille": { id: 79, name: "LOSC Lille" },
  "nice": { id: 84, name: "OGC Nice" },
  "rennes": { id: 94, name: "Stade Rennais" },
  "lens": { id: 116, name: "RC Lens" },
  "strasbourg": { id: 95, name: "RC Strasbourg" },
  "nantes": { id: 83, name: "FC Nantes" },
  "toulouse": { id: 96, name: "Toulouse FC" },
  "montpellier": { id: 82, name: "Montpellier HSC" },
  "reims": { id: 93, name: "Stade de Reims" },
  "brest": { id: 106, name: "Stade Brestois" },
  "le havre": { id: 97, name: "Le Havre AC" },
  "auxerre": { id: 98, name: "AJ Auxerre" },
  "saint-etienne": { id: 1063, name: "AS Saint-Étienne" },
  "saint-étienne": { id: 1063, name: "AS Saint-Étienne" },
  "angers": { id: 77, name: "Angers SCO" },
};

// Teams that play in Champions League (update each season)
const CHAMPIONS_LEAGUE_TEAMS = [85, 79, 91]; // PSG, Lille, Monaco for 2024-25

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, cities } = await req.json();
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    
    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY is not configured');
    }

    console.log(`Fetching football matches for year ${year}, cities:`, cities);

    // Get team IDs from cities
    const teamIds = new Set<number>();
    const teamNames = new Map<number, string>();
    
    for (const city of cities || []) {
      const cityLower = city.toLowerCase().trim();
      const team = CITY_TO_TEAM[cityLower];
      if (team) {
        teamIds.add(team.id);
        teamNames.set(team.id, team.name);
      }
    }

    // If no specific cities, use all teams
    if (teamIds.size === 0) {
      Object.values(CITY_TO_TEAM).forEach(team => {
        teamIds.add(team.id);
        teamNames.set(team.id, team.name);
      });
    }

    console.log(`Found ${teamIds.size} teams to fetch matches for`);

    const allMatches: Match[] = [];
    const season = year; // API uses season year (e.g., 2024 for 2024-25 season)

    // Fetch Ligue 1 matches for each team
    for (const teamId of teamIds) {
      try {
        const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&season=${season}&league=61`;
        console.log(`Fetching Ligue 1 for team ${teamId}:`, url);
        
        const response = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
        });

        if (!response.ok) {
          console.error(`API error for team ${teamId}:`, response.status);
          continue;
        }

        const data = await response.json();
        
        if (data.response && Array.isArray(data.response)) {
          for (const fixture of data.response) {
            allMatches.push({
              id: `ligue1-${fixture.fixture.id}`,
              home_team: fixture.teams.home.name,
              away_team: fixture.teams.away.name,
              home_team_logo: fixture.teams.home.logo,
              away_team_logo: fixture.teams.away.logo,
              date: fixture.fixture.date.split('T')[0],
              time: fixture.fixture.date.split('T')[1]?.substring(0, 5) || '20:00',
              competition: 'Ligue 1',
              competition_logo: fixture.league.logo,
              venue: fixture.fixture.venue?.name || '',
              status: fixture.fixture.status.short,
            });
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error fetching Ligue 1 for team ${teamId}:`, err);
      }
    }

    // Fetch Champions League matches for qualifying teams
    for (const teamId of teamIds) {
      if (!CHAMPIONS_LEAGUE_TEAMS.includes(teamId)) continue;
      
      try {
        const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&season=${season}&league=2`;
        console.log(`Fetching Champions League for team ${teamId}:`, url);
        
        const response = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
        });

        if (!response.ok) {
          console.error(`API error for CL team ${teamId}:`, response.status);
          continue;
        }

        const data = await response.json();
        
        if (data.response && Array.isArray(data.response)) {
          for (const fixture of data.response) {
            allMatches.push({
              id: `ucl-${fixture.fixture.id}`,
              home_team: fixture.teams.home.name,
              away_team: fixture.teams.away.name,
              home_team_logo: fixture.teams.home.logo,
              away_team_logo: fixture.teams.away.logo,
              date: fixture.fixture.date.split('T')[0],
              time: fixture.fixture.date.split('T')[1]?.substring(0, 5) || '21:00',
              competition: 'Champions League',
              competition_logo: fixture.league.logo,
              venue: fixture.fixture.venue?.name || '',
              status: fixture.fixture.status.short,
            });
          }
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error fetching CL for team ${teamId}:`, err);
      }
    }

    // Deduplicate matches (same match can appear for both teams)
    const uniqueMatches = Array.from(
      new Map(allMatches.map(m => [m.id, m])).values()
    );

    console.log(`Returning ${uniqueMatches.length} unique matches`);

    return new Response(JSON.stringify({ matches: uniqueMatches }), {
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
