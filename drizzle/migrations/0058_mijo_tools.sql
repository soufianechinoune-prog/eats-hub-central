ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS tool_calls_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.mijo_resolve_restaurants(p_chain_id uuid, p_name text)
RETURNS TABLE(id uuid, name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.user_has_chain_access(p_chain_id) OR public.is_super_admin()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT r.id, r.name FROM public.restaurants r
   WHERE r.chain_id = p_chain_id
     AND (p_name IS NULL OR r.name ILIKE '%'||replace(replace(p_name,'%',''),'_','')||'%')
   ORDER BY r.name LIMIT 21;
END $$;

CREATE OR REPLACE FUNCTION public.mijo_daily_base(p_chain_id uuid, p_start date, p_end date, p_canal text, p_restaurant_ids uuid[])
RETURNS TABLE(restaurant_id uuid, day date, canal text, ca numeric, versement numeric, commandes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET statement_timeout='25s' AS $$
DECLARE v_ids uuid[];
BEGIN
  IF NOT (public.user_has_chain_access(p_chain_id) OR public.is_super_admin()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_start < '2024-01-01' OR p_end > (now() AT TIME ZONE 'Europe/Paris')::date OR p_start > p_end THEN RAISE EXCEPTION 'dates invalides'; END IF;
  IF p_canal NOT IN ('uber_eats','caisse','deliveroo','chataigne','tous') THEN RAISE EXCEPTION 'canal invalide'; END IF;
  SELECT array_agg(r.id) INTO v_ids FROM public.restaurants r
   WHERE r.chain_id = p_chain_id AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  IF v_ids IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH uber AS (
    SELECT o.restaurant_id rid, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date d,
           SUM(ABS(o.sales_incl_vat)) ca, SUM(o.net_payout + COALESCE(o.meal_voucher_amount,0)) v, COUNT(*) n
      FROM public.orders o
     WHERE p_canal IN ('uber_eats','tous') AND o.restaurant_id = ANY(v_ids)
       AND o.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
       AND o.order_datetime <  ((p_end+1)::timestamp AT TIME ZONE 'Europe/Paris')
     GROUP BY 1,2),
  chat AS (
    SELECT c.restaurant_id rid, (c.order_datetime AT TIME ZONE 'Europe/Paris')::date d, SUM(c.total_amount) ca, COUNT(*) n
      FROM public.chataigne_orders c
     WHERE p_canal IN ('caisse','chataigne','tous') AND c.chain_id = p_chain_id
       AND c.restaurant_id = ANY(v_ids) AND c.status = 'completed'
       AND c.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
       AND c.order_datetime <  ((p_end+1)::timestamp AT TIME ZONE 'Europe/Paris')
     GROUP BY 1,2),
  splash AS (
    SELECT s.restaurant_id rid, s.date d, s.platform pf, SUM(s.revenue_ttc) ca, SUM(s.order_count) n
      FROM public.splash360_daily_sales s
     WHERE p_canal IN ('caisse','deliveroo','tous') AND s.granularity='day' AND s.restaurant_splash_id<>0
       AND s.chain_id = p_chain_id AND s.restaurant_id = ANY(v_ids)
       AND s.platform IN ('global','deliveroo') AND s.date BETWEEN p_start AND p_end
     GROUP BY 1,2,3)
  SELECT u.rid, u.d, 'uber_eats'::text, u.ca, u.v, u.n::bigint FROM uber u
  UNION ALL
  SELECT s.rid, s.d, 'caisse'::text, GREATEST(0, s.ca - COALESCE(c.ca,0)), NULL::numeric, GREATEST(0, s.n - COALESCE(c.n,0))::bigint
    FROM splash s LEFT JOIN chat c ON c.rid = s.rid AND c.d = s.d
   WHERE s.pf='global' AND p_canal IN ('caisse','tous')
  UNION ALL
  SELECT s.rid, s.d, 'deliveroo'::text, s.ca, NULL::numeric, s.n::bigint FROM splash s
   WHERE s.pf='deliveroo' AND p_canal IN ('deliveroo','tous')
  UNION ALL
  SELECT c.rid, c.d, 'chataigne'::text, c.ca, NULL::numeric, c.n::bigint FROM chat c
   WHERE p_canal IN ('chataigne','tous');
END $$;

CREATE OR REPLACE FUNCTION public.mijo_kpis_periode(p_chain_id uuid, p_start date, p_end date, p_canal text DEFAULT 'tous', p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(canal text, ca numeric, versement numeric, rentabilite_pct numeric, commandes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(b.canal,'total'), ROUND(SUM(b.ca)), ROUND(SUM(b.versement)),
         CASE WHEN b.canal='uber_eats' AND SUM(b.ca)>0 THEN ROUND(SUM(b.versement)/SUM(b.ca)*100,1) END,
         SUM(b.commandes)::bigint
    FROM public.mijo_daily_base(p_chain_id,p_start,p_end,p_canal,p_restaurant_ids) b
   GROUP BY ROLLUP(b.canal) ORDER BY b.canal NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.mijo_classement(p_chain_id uuid, p_start date, p_end date, p_metrique text, p_ordre text DEFAULT 'top', p_limite int DEFAULT 5)
RETURNS TABLE(restaurant text, ca numeric, versement numeric, rentabilite_pct numeric, commandes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH t AS (
    SELECT r.name nm, SUM(b.ca) ca, SUM(b.versement) v, SUM(b.commandes) n
      FROM public.mijo_daily_base(p_chain_id,p_start,p_end,'uber_eats',NULL) b
      JOIN public.restaurants r ON r.id=b.restaurant_id
     GROUP BY r.name HAVING SUM(b.ca) > 0)
  SELECT nm, ROUND(ca), ROUND(v), ROUND(v/ca*100,1), n::bigint FROM t
   ORDER BY
     CASE WHEN p_ordre<>'flop' THEN CASE p_metrique WHEN 'ca' THEN ca WHEN 'commandes' THEN n ELSE v/ca END END DESC NULLS LAST,
     CASE WHEN p_ordre='flop' THEN CASE p_metrique WHEN 'ca' THEN ca WHEN 'commandes' THEN n ELSE v/ca END END ASC NULLS LAST
   LIMIT LEAST(GREATEST(p_limite,1),20);
$$;

CREATE OR REPLACE FUNCTION public.mijo_evolution_mensuelle(p_chain_id uuid, p_start date, p_end date, p_canal text DEFAULT 'tous', p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(mois text, canal text, ca numeric, versement numeric, rentabilite_pct numeric, commandes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_end > (p_start + interval '24 months')::date THEN RAISE EXCEPTION 'période limitée à 24 mois'; END IF;
  RETURN QUERY
  SELECT to_char(date_trunc('month',b.day),'YYYY-MM'), b.canal, ROUND(SUM(b.ca)), ROUND(SUM(b.versement)),
         CASE WHEN b.canal='uber_eats' AND SUM(b.ca)>0 THEN ROUND(SUM(b.versement)/SUM(b.ca)*100,1) END,
         SUM(b.commandes)::bigint
    FROM public.mijo_daily_base(p_chain_id,p_start,p_end,p_canal,p_restaurant_ids) b
   GROUP BY 1,2 ORDER BY 1,2;
END $$;

COMMENT ON FUNCTION public.mijo_daily_base(uuid,date,date,text,uuid[]) IS 'Mijo tool source. Callable by any authenticated user: never extend columns/data without explicit validation.';

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['mijo_resolve_restaurants(uuid,text)','mijo_daily_base(uuid,date,date,text,uuid[])','mijo_kpis_periode(uuid,date,date,text,uuid[])','mijo_classement(uuid,date,date,text,text,int)','mijo_evolution_mensuelle(uuid,date,date,text,uuid[])'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;