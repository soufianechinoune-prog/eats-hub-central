import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// French teams in Champions League 2024-25 season
const CHAMPIONS_LEAGUE_TEAMS = [
  { id: 85, name: "Paris Saint-Germain" },
  { id: 79, name: "LOSC Lille" },
  { id: 91, name: "AS Monaco" },
  { id: 106, name: "Stade Brestois" },
];

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
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    
    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY is not configured');
    }

    console.log('Fetching Champions League matches');

    const allMatches: Match[] = [];
    // Use 2024 season (2024-25 season runs Aug 2024 - May 2025)
    const season = 2024;

    // Fetch Champions League matches for French teams only
    for (const team of CHAMPIONS_LEAGUE_TEAMS) {
      try {
        const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${team.id}&season=${season}&league=2`;
        console.log(`Fetching Champions League for ${team.name}:`, url);
        
        const response = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
        });

        if (!response.ok) {
          console.error(`API error for ${team.name}: ${response.status}`);
          // If rate limited, wait longer and continue
          if (response.status === 429) {
            console.log('Rate limited, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          continue;
        }

        const data = await response.json();
        console.log(`Got ${data.response?.length || 0} matches for ${team.name}`);
        
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

        // Longer delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error fetching CL for ${team.name}:`, err);
      }
    }

    // Deduplicate matches (same match can appear for both teams)
    const uniqueMatches = Array.from(
      new Map(allMatches.map(m => [m.id, m])).values()
    );

    console.log(`Returning ${uniqueMatches.length} unique Champions League matches`);

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
