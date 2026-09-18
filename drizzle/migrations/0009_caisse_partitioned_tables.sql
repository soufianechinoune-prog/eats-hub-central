-- Tables de detail caisse partitionnees par mois (nouvelles tables, additif : les tables
-- splash_ticket_* restent en place en lecture pour l'app deployee)

CREATE TABLE public.caisse_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  station text NOT NULL DEFAULT 'default',
  splash_ticket_id text NOT NULL,
  ticket_datetime timestamptz NOT NULL,
  ticket_date date NOT NULL,
  service_type text,
  revenue_center text,
  status text,
  payment_label_raw text,
  payment_category text,
  payment_brand text,
  total_amount numeric,
  total_ht numeric,
  total_vat numeric,
  discount_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, ticket_date),
  UNIQUE (restaurant_id, station, splash_ticket_id, ticket_date)
) PARTITION BY RANGE (ticket_date);

CREATE TABLE public.caisse_ticket_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_uuid uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  ticket_date date NOT NULL,
  line_key text NOT NULL,
  product_name text,
  product_ref text,
  category text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric,
  total_price numeric,
  depth integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, ticket_date),
  UNIQUE (ticket_uuid, line_key, ticket_date)
) PARTITION BY RANGE (ticket_date);

CREATE TABLE public.caisse_ticket_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_uuid uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  ticket_date date NOT NULL,
  payment_key text NOT NULL,
  raw_label text,
  category text NOT NULL DEFAULT 'Autre',
  brand text,
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, ticket_date),
  UNIQUE (ticket_uuid, payment_key, ticket_date)
) PARTITION BY RANGE (ticket_date);

CREATE OR REPLACE FUNCTION public.ensure_caisse_partitions(p_months integer DEFAULT 6, p_from date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_end date;
  v_month date;
  v_created integer := 0;
  v_parent text;
  v_part text;
BEGIN
  v_start := date_trunc('month', coalesce(p_from, current_date - interval '1 month'))::date;
  v_end := date_trunc('month', current_date + (p_months || ' months')::interval)::date;
  v_month := v_start;
  WHILE v_month <= v_end LOOP
    FOREACH v_parent IN ARRAY ARRAY['caisse_tickets', 'caisse_ticket_lines', 'caisse_ticket_payments'] LOOP
      v_part := v_parent || '_' || to_char(v_month, 'YYYYMM');
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = v_part
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          v_part, v_parent, v_month, (v_month + interval '1 month')::date
        );
        v_created := v_created + 1;
      END IF;
    END LOOP;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;
  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_caisse_partitions(integer, date) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_caisse_partitions(integer, date) TO service_role;

SELECT public.ensure_caisse_partitions(6, '2024-01-01'::date);

INSERT INTO public.caisse_tickets (
  id, restaurant_id, chain_id, station, splash_ticket_id, ticket_datetime, ticket_date,
  service_type, revenue_center, status, payment_label_raw, payment_category, payment_brand,
  total_amount, total_ht, total_vat, discount_amount, created_at, updated_at
)
SELECT id, restaurant_id, chain_id, station, splash_ticket_id, ticket_datetime, ticket_date,
       service_type, revenue_center, status, payment_label_raw, payment_category, payment_brand,
       total_amount, total_ht, total_vat, discount_amount, created_at, updated_at
  FROM public.splash_tickets;

INSERT INTO public.caisse_ticket_lines (
  id, ticket_uuid, restaurant_id, chain_id, ticket_date, line_key, product_name, product_ref,
  category, quantity, unit_price, total_price, depth, created_at
)
SELECT id, ticket_uuid, restaurant_id, chain_id, ticket_date, line_key, product_name, product_ref,
       category, quantity, unit_price, total_price, depth, created_at
  FROM public.splash_ticket_lines;

INSERT INTO public.caisse_ticket_payments (
  id, ticket_uuid, restaurant_id, chain_id, ticket_date, payment_key, raw_label, category, brand, amount, created_at
)
SELECT id, ticket_uuid, restaurant_id, chain_id, ticket_date, payment_key, raw_label, category, brand, amount, created_at
  FROM public.splash_ticket_payments;

DO $$
DECLARE a numeric; b numeric;
BEGIN
  SELECT count(*) INTO a FROM public.splash_tickets;
  SELECT count(*) INTO b FROM public.caisse_tickets;
  IF a <> b THEN RAISE EXCEPTION 'Ecart tickets: % vs %', a, b; END IF;

  SELECT count(*) INTO a FROM public.splash_ticket_lines;
  SELECT count(*) INTO b FROM public.caisse_ticket_lines;
  IF a <> b THEN RAISE EXCEPTION 'Ecart lignes: % vs %', a, b; END IF;

  SELECT count(*) INTO a FROM public.splash_ticket_payments;
  SELECT count(*) INTO b FROM public.caisse_ticket_payments;
  IF a <> b THEN RAISE EXCEPTION 'Ecart reglements: % vs %', a, b; END IF;

  SELECT round(sum(coalesce(total_amount,0)),2) INTO a FROM public.splash_tickets;
  SELECT round(sum(coalesce(total_amount,0)),2) INTO b FROM public.caisse_tickets;
  IF a <> b THEN RAISE EXCEPTION 'Ecart CA: % vs %', a, b; END IF;

  SELECT round(sum(coalesce(amount,0)),2) INTO a FROM public.splash_ticket_payments;
  SELECT round(sum(coalesce(amount,0)),2) INTO b FROM public.caisse_ticket_payments;
  IF a <> b THEN RAISE EXCEPTION 'Ecart montants reglements: % vs %', a, b; END IF;
END $$;

CREATE INDEX caisse_tickets_resto_date ON public.caisse_tickets (restaurant_id, ticket_date);
CREATE INDEX caisse_tickets_chain_date ON public.caisse_tickets (chain_id, ticket_date);
CREATE INDEX caisse_tickets_resto_dt ON public.caisse_tickets (restaurant_id, ticket_datetime);
CREATE INDEX caisse_lines_resto_date ON public.caisse_ticket_lines (restaurant_id, ticket_date);
CREATE INDEX caisse_lines_chain_cat_date ON public.caisse_ticket_lines (chain_id, category, ticket_date);
CREATE INDEX caisse_lines_ticket ON public.caisse_ticket_lines (ticket_uuid);
CREATE INDEX caisse_payments_resto_date ON public.caisse_ticket_payments (restaurant_id, ticket_date);
CREATE INDEX caisse_payments_chain_cat_date ON public.caisse_ticket_payments (chain_id, category, ticket_date);
CREATE INDEX caisse_payments_ticket ON public.caisse_ticket_payments (ticket_uuid);

CREATE TRIGGER caisse_tickets_chain_check BEFORE INSERT OR UPDATE ON public.caisse_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();
CREATE TRIGGER caisse_lines_chain_check BEFORE INSERT OR UPDATE ON public.caisse_ticket_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();
CREATE TRIGGER caisse_payments_chain_check BEFORE INSERT OR UPDATE ON public.caisse_ticket_payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();

GRANT SELECT ON public.caisse_tickets TO authenticated;
GRANT SELECT ON public.caisse_ticket_lines TO authenticated;
GRANT SELECT ON public.caisse_ticket_payments TO authenticated;
GRANT ALL ON public.caisse_tickets TO service_role;
GRANT ALL ON public.caisse_ticket_lines TO service_role;
GRANT ALL ON public.caisse_ticket_payments TO service_role;
REVOKE ALL ON public.caisse_tickets FROM anon;
REVOKE ALL ON public.caisse_ticket_lines FROM anon;
REVOKE ALL ON public.caisse_ticket_payments FROM anon;

ALTER TABLE public.caisse_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_ticket_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_ticket_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caisse_tickets_read" ON public.caisse_tickets
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
CREATE POLICY "caisse_ticket_lines_read" ON public.caisse_ticket_lines
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
CREATE POLICY "caisse_ticket_payments_read" ON public.caisse_ticket_payments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

-- Les rollups se calculent desormais depuis les tables partitionnees
CREATE OR REPLACE FUNCTION public.refresh_caisse_rollups(
  p_restaurant_id uuid,
  p_from date,
  p_to date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.caisse_daily_tickets
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);
  DELETE FROM public.caisse_daily_payments
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);
  DELETE FROM public.caisse_daily_products
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);
  DELETE FROM public.caisse_daily_attachment
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  INSERT INTO public.caisse_daily_tickets (
    restaurant_id, chain_id, ticket_date, tickets, revenue_ttc, revenue_ht, vat_amount,
    tickets_onsite, tickets_takeaway, tickets_delivery,
    revenue_onsite, revenue_takeaway, revenue_delivery
  )
  SELECT s.restaurant_id, s.chain_id, s.ticket_date,
         count(*)::bigint,
         sum(coalesce(s.total_amount, 0)),
         sum(coalesce(s.total_ht, 0)),
         sum(coalesce(s.total_vat, 0)),
         count(*) FILTER (WHERE s.service_type = 'sur_place')::bigint,
         count(*) FILTER (WHERE s.service_type = 'emporter')::bigint,
         count(*) FILTER (WHERE s.service_type = 'livraison')::bigint,
         sum(CASE WHEN s.service_type = 'sur_place' THEN coalesce(s.total_amount, 0) ELSE 0 END),
         sum(CASE WHEN s.service_type = 'emporter' THEN coalesce(s.total_amount, 0) ELSE 0 END),
         sum(CASE WHEN s.service_type = 'livraison' THEN coalesce(s.total_amount, 0) ELSE 0 END)
    FROM public.caisse_tickets s
   WHERE s.ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR s.restaurant_id = p_restaurant_id)
   GROUP BY 1, 2, 3;

  INSERT INTO public.caisse_daily_payments (
    restaurant_id, chain_id, ticket_date, category, brand, payments, amount
  )
  SELECT pay.restaurant_id, pay.chain_id, pay.ticket_date,
         coalesce(pay.category, 'Autre'), coalesce(pay.brand, ''),
         count(*)::bigint, sum(coalesce(pay.amount, 0))
    FROM public.caisse_ticket_payments pay
   WHERE pay.ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR pay.restaurant_id = p_restaurant_id)
   GROUP BY 1, 2, 3, 4, 5;

  INSERT INTO public.caisse_daily_products (
    restaurant_id, chain_id, ticket_date, product_key, product_name, product_ref, category, quantity, revenue
  )
  SELECT l.restaurant_id, l.chain_id, l.ticket_date,
         coalesce(nullif(l.product_ref, ''), lower(coalesce(l.product_name, ''))) AS product_key,
         min(l.product_name), min(l.product_ref), min(l.category),
         sum(coalesce(l.quantity, 0)), sum(coalesce(l.total_price, 0))
    FROM public.caisse_ticket_lines l
   WHERE l.ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR l.restaurant_id = p_restaurant_id)
   GROUP BY 1, 2, 3, 4;

  INSERT INTO public.caisse_daily_attachment (
    restaurant_id, chain_id, ticket_date, category, tickets_with_category, tickets_total
  )
  WITH flags AS (
    SELECT DISTINCT l.restaurant_id, l.chain_id, l.ticket_date, l.category, l.ticket_uuid
      FROM public.caisse_ticket_lines l
     WHERE l.ticket_date BETWEEN p_from AND p_to
       AND (p_restaurant_id IS NULL OR l.restaurant_id = p_restaurant_id)
       AND l.category IS NOT NULL
  ),
  totals AS (
    SELECT t.restaurant_id, t.ticket_date, count(*)::bigint AS tickets_total
      FROM public.caisse_tickets t
     WHERE t.ticket_date BETWEEN p_from AND p_to
       AND (p_restaurant_id IS NULL OR t.restaurant_id = p_restaurant_id)
     GROUP BY 1, 2
  )
  SELECT f.restaurant_id, f.chain_id, f.ticket_date, f.category,
         count(*)::bigint,
         coalesce(tt.tickets_total, 0)
    FROM flags f
    LEFT JOIN totals tt
      ON tt.restaurant_id = f.restaurant_id AND tt.ticket_date = f.ticket_date
   GROUP BY 1, 2, 3, 4, tt.tickets_total;
END;
$$;

-- Indicateur d'occupation par mois et enseigne (admin)
CREATE OR REPLACE VIEW public.caisse_storage_by_month AS
 WITH t AS (
   SELECT chain_id, date_trunc('month', ticket_date)::date AS month,
          count(DISTINCT restaurant_id) AS restaurants, count(*) AS tickets
     FROM public.caisse_tickets GROUP BY 1, 2
 ), l AS (
   SELECT chain_id, date_trunc('month', ticket_date)::date AS month, count(*) AS lines_count
     FROM public.caisse_ticket_lines GROUP BY 1, 2
 ), p AS (
   SELECT chain_id, date_trunc('month', ticket_date)::date AS month, count(*) AS payments_count
     FROM public.caisse_ticket_payments GROUP BY 1, 2
 )
 SELECT t.chain_id, t.month, t.restaurants, t.tickets,
        coalesce(l.lines_count, 0) AS lines_count,
        coalesce(p.payments_count, 0) AS payments_count
   FROM t
   LEFT JOIN l ON l.chain_id = t.chain_id AND l.month = t.month
   LEFT JOIN p ON p.chain_id = t.chain_id AND p.month = t.month;

GRANT SELECT ON public.caisse_storage_by_month TO authenticated;
REVOKE ALL ON public.caisse_storage_by_month FROM anon;