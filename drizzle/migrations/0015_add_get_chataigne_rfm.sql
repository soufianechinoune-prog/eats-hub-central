-- Matrice RFM (Récence / Fréquence / Montant) sur le canal Chataigne.
-- 100% pseudonymisé : les clients ne sont identifiés que par code_client (hash SHA-256 salé).
create or replace function public.get_chataigne_rfm(p_start date, p_end date, p_restaurant_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
WITH allowed AS (
  SELECT c.id FROM public.chains c
  WHERE public.is_super_admin() OR public.user_has_chain_access(c.id)
),
ord AS (
  SELECT o.code_client, o.order_datetime, coalesce(o.total_amount, 0) AS total
  FROM public.chataigne_orders o
  WHERE o.status = 'completed'
    AND o.code_client IS NOT NULL
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY (p_restaurant_ids))
    AND o.chain_id IN (SELECT id FROM allowed)
    AND o.order_datetime < (p_end + 1)::timestamptz
),
hist AS (
  SELECT code_client, min(order_datetime) AS first_dt, max(order_datetime) AS last_dt
  FROM ord GROUP BY code_client
),
per AS (
  SELECT h.code_client, h.first_dt, h.last_dt,
    ceil(EXTRACT(EPOCH FROM ((p_end + 1)::timestamptz - h.last_dt)) / 86400)::int AS recence,
    coalesce(p.nb, 0)::int AS nb, coalesce(p.ca, 0) AS ca
  FROM hist h
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS nb, sum(total) AS ca FROM ord o
    WHERE o.code_client = h.code_client AND o.order_datetime >= p_start::timestamptz
  ) p ON true
),
seg AS (
  SELECT *, CASE
      WHEN nb = 0 THEN 'Inactifs (hors période)'
      WHEN first_dt >= p_start::timestamptz AND nb <= 2 THEN 'Nouveaux'
      WHEN recence <= 14 AND nb >= 4 THEN 'Champions'
      WHEN recence <= 30 AND nb >= 3 THEN 'Fidèles'
      WHEN recence > 60 AND nb >= 3 THEN 'À risque'
      WHEN recence <= 60 THEN 'Occasionnels'
      ELSE 'Dormants'
    END AS segment
  FROM per
),
segs AS (
  SELECT
    segment,
    CASE segment
      WHEN 'Champions' THEN 1 WHEN 'Fidèles' THEN 2 WHEN 'Nouveaux' THEN 3
      WHEN 'Occasionnels' THEN 4 WHEN 'À risque' THEN 5 WHEN 'Dormants' THEN 6
      ELSE 7 END AS ord,
    count(*)::bigint AS clients,
    sum(nb)::bigint AS commandes,
    round(sum(ca)::numeric, 2) AS ca,
    round(100.0 * sum(ca) / nullif((SELECT sum(ca) FROM seg)::numeric, 0), 1) AS ca_pct,
    round((sum(ca) / nullif(sum(nb), 0))::numeric, 2) AS panier_moyen,
    round((sum(nb)::numeric / nullif(count(*), 0))::numeric, 2) AS frequence_moy,
    round(avg(recence)::numeric, 1) AS recence_moy
  FROM seg
  GROUP BY segment
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'clients', (SELECT count(*) FROM seg WHERE nb > 0),
    'inactifs', (SELECT count(*) FROM seg WHERE nb = 0),
    'nouveaux', (SELECT count(*) FROM seg WHERE segment = 'Nouveaux'),
    'commandes', (SELECT sum(nb) FROM seg),
    'ca', (SELECT sum(ca) FROM seg),
    'panier_moyen', (SELECT round((sum(ca) / nullif(sum(nb), 0))::numeric, 2) FROM seg),
    'frequence_moy', (SELECT round(avg(nb)::numeric, 2) FROM seg WHERE nb > 0),
    'recence_moy', (SELECT round(avg(recence)::numeric, 1) FROM seg WHERE nb > 0)
  ),
  'segments', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'segment', s.segment,
      'clients', s.clients,
      'commandes', s.commandes,
      'ca', s.ca,
      'ca_pct', s.ca_pct,
      'panier_moyen', s.panier_moyen,
      'frequence_moy', s.frequence_moy,
      'recence_moy', s.recence_moy
    ) ORDER BY s.ord)
    FROM segs s
  ), '[]'::jsonb),
  'top_clients', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'client_key', substring(x.code_client, 1, 10) || '…',
      'segment', x.segment,
      'nb', x.nb,
      'ca', x.ca,
      'panier', x.panier,
      'recence', x.recence,
      'premier', x.first_dt,
      'dernier', x.last_dt
    ))
    FROM (
      SELECT code_client, segment, nb, round(ca::numeric, 2) AS ca,
             round((ca / nullif(nb, 0))::numeric, 2) AS panier,
             recence, first_dt, last_dt
      FROM seg
      WHERE nb > 0
      ORDER BY ca DESC
      LIMIT 40
    ) x
  ), '[]'::jsonb)
);
$$;

grant execute on function public.get_chataigne_rfm(date, date, uuid[]) to authenticated;
