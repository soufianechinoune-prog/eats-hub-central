// Outils Mijo (tool use Anthropic). Le chainId n'est JAMAIS un paramètre d'outil :
// il est injecté côté serveur. Les fonctions SQL mijo_* revérifient l'accès à l'enseigne.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CANAUX = ['uber_eats', 'caisse', 'deliveroo', 'chataigne', 'tous'];
const DATE = { type: 'string', description: 'YYYY-MM-DD, entre 2024-01-01 et aujourd\'hui' };
const CANAL = { type: 'string', enum: CANAUX, description: 'Canal (défaut: tous). Rentabilité uniquement sur uber_eats.' };
const RESTO = { type: 'string', description: 'Nom ou partie du nom du restaurant (optionnel)' };

export const TOOLS = [
  {
    name: 'get_kpis_periode',
    description: "KPIs agrégés (CA TTC, versement, rentabilité, commandes) par canal + total, sur une période, pour l'enseigne active ou un de ses restaurants. Caisse = ventes sur place hors Châtaigne. Rentabilité uniquement Uber Eats.",
    input_schema: { type: 'object', properties: { date_debut: DATE, date_fin: DATE, canal: CANAL, restaurant: RESTO }, required: ['date_debut', 'date_fin'] },
  },
  {
    name: 'get_classement_restaurants',
    description: "Classement des restaurants de l'enseigne active sur une période (données Uber Eats).",
    input_schema: {
      type: 'object',
      properties: {
        date_debut: DATE, date_fin: DATE,
        metrique: { type: 'string', enum: ['ca', 'rentabilite', 'commandes'] },
        ordre: { type: 'string', enum: ['top', 'flop'] },
        limite: { type: 'integer', minimum: 1, maximum: 20 },
      },
      required: ['date_debut', 'date_fin', 'metrique'],
    },
  },
  {
    name: 'get_evolution_mensuelle',
    description: 'Série mensuelle (24 mois max) du CA, versement, rentabilité et commandes, par canal.',
    input_schema: { type: 'object', properties: { date_debut: DATE, date_fin: DATE, canal: CANAL, restaurant: RESTO }, required: ['date_debut', 'date_fin'] },
  },
];

const MAX_RESULT_CHARS = 8000; // ~2000 tokens
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parisToday() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function checkDates(a: unknown, b: unknown): string | null {
  if (typeof a !== 'string' || typeof b !== 'string' || !ISO.test(a) || !ISO.test(b)) return 'Dates au format YYYY-MM-DD requises.';
  const today = parisToday();
  if (a < '2024-01-01') return 'Données disponibles à partir du 2024-01-01 seulement.';
  if (b > today) return `La date de fin ne peut pas dépasser aujourd'hui (${today}).`;
  if (a > b) return 'date_debut doit précéder date_fin.';
  return null;
}

async function resolveResto(client: SupabaseClient, chainId: string, name: unknown) {
  if (name == null || name === '') return { ids: null as string[] | null };
  if (typeof name !== 'string' || name.length > 100) return { error: 'Nom de restaurant invalide.' };
  const { data, error } = await client.rpc('mijo_resolve_restaurants', { p_chain_id: chainId, p_name: name.trim() });
  if (error) return { error: 'Recherche du restaurant impossible.' };
  const rows = (data ?? []) as { id: string; name: string }[];
  if (!rows.length) return { error: `Restaurant « ${name} » introuvable dans l'enseigne.` };
  const exact = rows.find((r) => r.name.toLowerCase() === name.trim().toLowerCase());
  if (exact) return { ids: [exact.id], nom: exact.name };
  if (rows.length > 1) return { ambigu: true, candidats: rows.slice(0, 20).map((r) => r.name), message: 'Plusieurs restaurants correspondent : demander lequel.' };
  return { ids: [rows[0].id], nom: rows[0].name };
}

export async function runTool(name: string, input: any, client: SupabaseClient, chainId: string): Promise<any> {
  try {
    const err = checkDates(input?.date_debut, input?.date_fin);
    if (err) return { erreur: err };
    const canal = input?.canal ?? 'tous';
    if (name !== 'get_classement_restaurants' && !CANAUX.includes(canal)) return { erreur: 'Canal invalide.' };

    if (name === 'get_classement_restaurants') {
      if (!['ca', 'rentabilite', 'commandes'].includes(input?.metrique)) return { erreur: 'Métrique invalide.' };
      const limite = Math.min(20, Math.max(1, Number.parseInt(input?.limite ?? 5, 10) || 5));
      const { data, error } = await client.rpc('mijo_classement', {
        p_chain_id: chainId, p_start: input.date_debut, p_end: input.date_fin,
        p_metrique: input.metrique, p_ordre: input?.ordre === 'flop' ? 'flop' : 'top', p_limite: limite,
      });
      if (error) return { erreur: sqlErr(error.message) };
      return { source: 'Uber Eats', periode: `${input.date_debut} → ${input.date_fin}`, classement: data };
    }

    const r = await resolveResto(client, chainId, input?.restaurant);
    if ('error' in r) return { erreur: r.error };
    if ('ambigu' in r) return r;
    const args = { p_chain_id: chainId, p_start: input.date_debut, p_end: input.date_fin, p_canal: canal, p_restaurant_ids: r.ids };

    if (name === 'get_kpis_periode') {
      const { data, error } = await client.rpc('mijo_kpis_periode', args);
      if (error) return { erreur: sqlErr(error.message) };
      return { periode: `${input.date_debut} → ${input.date_fin}`, restaurant: r.nom ?? 'tous', kpis: data, note: 'rentabilite_pct null hors Uber Eats; caisse hors Châtaigne' };
    }
    if (name === 'get_evolution_mensuelle') {
      const { data, error } = await client.rpc('mijo_evolution_mensuelle', args);
      if (error) return { erreur: sqlErr(error.message) };
      return { restaurant: r.nom ?? 'tous', serie: data };
    }
    return { erreur: `Outil inconnu : ${name}` };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : 'Erreur outil' };
  }
}

function sqlErr(m: string) {
  if (/statement timeout|canceling statement/i.test(m)) return 'Calcul trop long : précisez une période plus courte.';
  if (/24 mois|dates invalides|canal invalide/i.test(m)) return m;
  return 'Donnée indisponible.';
}

export function truncateResult(out: unknown) {
  const s = JSON.stringify(out);
  return s.length > MAX_RESULT_CHARS ? s.slice(0, MAX_RESULT_CHARS) + '…(tronqué)' : s;
}
