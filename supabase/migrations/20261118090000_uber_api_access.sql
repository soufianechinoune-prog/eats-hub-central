-- Accès API Uber par restaurant : ce qu'on constate réellement, et le suivi des demandes d'accès.
--
-- Pourquoi : le badge « Connecté API » reposait sur la date de provisionnement (uber_pos_activated_at).
-- Le 18/11/2026, Uber refusait pourtant l'accès (HTTP 403 / user_not_allowed) à des restaurants marqués
-- « Connecté » (Tasty Crousty Cachan, République). On se fie donc à ce qu'Uber renvoie vraiment :
--   - des commandes reçues par l'API récemment  → accès OK ;
--   - un refus d'Uber plus récent que la dernière commande API → accès refusé ;
--   - ni l'un ni l'autre → aucune donnée API récente (à surveiller).
-- Et on garde la trace des demandes d'accès envoyées à Uber, pour ne pas les oublier.

-- 1) Demandes d'accès envoyées à Uber (confirmées à la main dans Mijotek).
CREATE TABLE IF NOT EXISTS public.uber_api_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid REFERENCES public.chains(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid DEFAULT auth.uid(),
  requested_by_name text,
  note text,
  cancelled_at timestamptz,
  cancelled_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS uber_api_access_requests_one_open
  ON public.uber_api_access_requests (restaurant_id) WHERE cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION public.uber_api_access_requests_fill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.chain_id := (SELECT r.chain_id FROM public.restaurants r WHERE r.id = NEW.restaurant_id);
    NEW.requested_at := now();
    NEW.requested_by := auth.uid();
    NEW.requested_by_name := (
      SELECT COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
      FROM auth.users u WHERE u.id = auth.uid());
    NEW.cancelled_at := NULL;
    NEW.cancelled_by := NULL;
  ELSE
    -- Seule l'annulation est permise ; la trace d'origine ne bouge pas.
    NEW.restaurant_id := OLD.restaurant_id; NEW.chain_id := OLD.chain_id;
    NEW.requested_at := OLD.requested_at; NEW.requested_by := OLD.requested_by;
    NEW.requested_by_name := OLD.requested_by_name; NEW.note := OLD.note;
    IF OLD.cancelled_at IS NOT NULL THEN NEW.cancelled_at := OLD.cancelled_at; NEW.cancelled_by := OLD.cancelled_by;
    ELSIF NEW.cancelled_at IS NOT NULL THEN NEW.cancelled_at := now(); NEW.cancelled_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS uber_api_access_requests_fill ON public.uber_api_access_requests;
CREATE TRIGGER uber_api_access_requests_fill BEFORE INSERT OR UPDATE ON public.uber_api_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.uber_api_access_requests_fill();

ALTER TABLE public.uber_api_access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uber_api_access_requests_read ON public.uber_api_access_requests;
CREATE POLICY uber_api_access_requests_read ON public.uber_api_access_requests FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
DROP POLICY IF EXISTS uber_api_access_requests_insert ON public.uber_api_access_requests;
CREATE POLICY uber_api_access_requests_insert ON public.uber_api_access_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.user_has_chain_access((SELECT r.chain_id FROM public.restaurants r WHERE r.id = restaurant_id)));
DROP POLICY IF EXISTS uber_api_access_requests_cancel ON public.uber_api_access_requests;
CREATE POLICY uber_api_access_requests_cancel ON public.uber_api_access_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_chain_access(chain_id));
REVOKE ALL ON public.uber_api_access_requests FROM anon;

-- 2) État constaté de l'accès API, par restaurant.
CREATE OR REPLACE FUNCTION public.get_uber_api_access_status(p_chain_id uuid DEFAULT NULL)
RETURNS TABLE (
  restaurant_id uuid,
  chain_id uuid,
  status text,               -- ok | refuse | silencieux | non_configure
  last_api_order_at timestamptz,
  last_refusal_at timestamptz,
  refusal_reason text,
  request_id uuid,
  requested_at timestamptz,
  requested_by_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH scope AS (
    SELECT r.id, r.chain_id, r.uber_store_id
    FROM public.restaurants r
    WHERE (p_chain_id IS NULL OR r.chain_id = p_chain_id)
      AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  refusals AS (
    SELECT q.restaurant_id, max(coalesce(q.requested_at, q.created_at)) AS at, 'Uber a refusé l''accès (HTTP 403)'::text AS reason
    FROM public.payout_adjustment_backfill_requests q
    WHERE q.status = 'refused' AND q.restaurant_id IN (SELECT id FROM scope)
    GROUP BY q.restaurant_id
    UNION ALL
    SELECT b.restaurant_id, max(coalesce(b.updated_at, b.created_at)), 'Restaurant non autorisé par Uber (user_not_allowed)'
    FROM public.backfill_jobs b
    WHERE b.last_error ~* 'user_not_allowed' AND b.restaurant_id IN (SELECT id FROM scope)
    GROUP BY b.restaurant_id
  ),
  last_refusal AS (
    SELECT DISTINCT ON (x.restaurant_id) x.restaurant_id, x.at, x.reason
    FROM refusals x ORDER BY x.restaurant_id, x.at DESC
  ),
  open_request AS (
    SELECT a.restaurant_id, a.id, a.requested_at, a.requested_by_name
    FROM public.uber_api_access_requests a
    WHERE a.cancelled_at IS NULL AND a.restaurant_id IN (SELECT id FROM scope)
  )
  SELECT s.id, s.chain_id,
    CASE
      WHEN s.uber_store_id IS NULL THEN 'non_configure'
      WHEN lr.at IS NOT NULL AND (o.last_at IS NULL OR lr.at > o.last_at) THEN 'refuse'
      WHEN o.last_at >= now() - interval '14 days' THEN 'ok'
      ELSE 'silencieux'
    END,
    o.last_at, lr.at, lr.reason, rq.id, rq.requested_at, rq.requested_by_name
  FROM scope s
  LEFT JOIN LATERAL (
    SELECT max(od.order_datetime) AS last_at
    FROM public.orders od
    WHERE od.restaurant_id = s.id AND od.data_source = 'uber_api'
      AND od.order_datetime >= now() - interval '120 days'
  ) o ON true
  LEFT JOIN last_refusal lr ON lr.restaurant_id = s.id
  LEFT JOIN open_request rq ON rq.restaurant_id = s.id;
$function$;

REVOKE ALL ON FUNCTION public.get_uber_api_access_status(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_uber_api_access_status(uuid) TO authenticated, service_role;
