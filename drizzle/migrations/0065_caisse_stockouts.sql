CREATE TABLE public.caisse_stockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL,
  item_id text NOT NULL,
  product_name text NOT NULL,
  category text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_minutes numeric,
  status text NOT NULL DEFAULT 'ongoing',
  open_event_id uuid,
  close_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.caisse_stockouts TO authenticated;
GRANT ALL ON public.caisse_stockouts TO service_role;
ALTER TABLE public.caisse_stockouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chain members read stockouts" ON public.caisse_stockouts FOR SELECT TO authenticated USING (public.user_has_chain_access(chain_id));

CREATE UNIQUE INDEX uq_caisse_stockouts_open ON public.caisse_stockouts (restaurant_id, item_id) WHERE ended_at IS NULL;
CREATE INDEX idx_caisse_stockouts_resto_start ON public.caisse_stockouts (restaurant_id, started_at DESC);
CREATE INDEX idx_caisse_stockouts_chain_start ON public.caisse_stockouts (chain_id, started_at DESC);

-- Applique un événement stock de façon idempotente (ouverture / clôture)
CREATE OR REPLACE FUNCTION public.apply_splash_stock_event(p_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; x jsonb; v_item text; v_status text; v_name text; v_cat text;
BEGIN
  SELECT * INTO e FROM splash_webhook_events WHERE id = p_event_id;
  IF e IS NULL OR e.event_type <> 'stock' OR e.restaurant_id IS NULL OR e.chain_id IS NULL
     OR jsonb_typeof(e.payload) <> 'array' THEN RETURN; END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(e.payload) LOOP
    v_item := x->>'item_id'; v_status := x->>'status';
    CONTINUE WHEN v_item IS NULL OR v_item LIKE 'ing%';
    IF v_status = 'unavailable' THEN
      SELECT p.product_name, p.category INTO v_name, v_cat FROM caisse_daily_products p
       WHERE p.restaurant_id = e.restaurant_id AND p.product_ref = v_item AND p.ticket_date >= current_date - 90
       ORDER BY p.ticket_date DESC LIMIT 1;
      IF v_name IS NULL THEN
        SELECT p.product_name, p.category INTO v_name, v_cat FROM caisse_daily_products p
         WHERE p.chain_id = e.chain_id AND p.product_ref = v_item AND p.ticket_date >= current_date - 30
         ORDER BY p.ticket_date DESC LIMIT 1;
      END IF;
      INSERT INTO caisse_stockouts (restaurant_id, chain_id, item_id, product_name, category, started_at, open_event_id)
      VALUES (e.restaurant_id, e.chain_id, v_item, COALESCE(v_name, v_item), v_cat, e.received_at, e.id)
      ON CONFLICT (restaurant_id, item_id) WHERE ended_at IS NULL DO NOTHING;
    ELSIF v_status = 'available' THEN
      UPDATE caisse_stockouts SET ended_at = e.received_at, status = 'resolved', close_event_id = e.id,
        duration_minutes = round(extract(epoch FROM (e.received_at - started_at))/60.0, 1), updated_at = now()
       WHERE restaurant_id = e.restaurant_id AND item_id = v_item AND ended_at IS NULL AND started_at <= e.received_at;
    END IF;
    v_name := NULL; v_cat := NULL;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.apply_splash_stock_event(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_splash_stock_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.restaurant_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id) THEN
    PERFORM public.apply_splash_stock_event(NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER splash_stock_event_apply AFTER INSERT OR UPDATE OF restaurant_id ON public.splash_webhook_events
FOR EACH ROW EXECUTE FUNCTION public.trg_splash_stock_event();

-- Rattrapage chronologique
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM splash_webhook_events WHERE event_type='stock' AND restaurant_id IS NOT NULL ORDER BY received_at ASC, id LOOP
    PERFORM public.apply_splash_stock_event(r.id);
  END LOOP;
END $$;

-- Lecture instantanée (même signature que l'écran)
CREATE OR REPLACE FUNCTION public.get_splash_stockouts(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(restaurant_id uuid, restaurant_name text, item_id text, product_name text, category text,
  started_at timestamptz, ended_at timestamptz, duration_minutes numeric, is_ongoing boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.restaurant_id, r.name, s.item_id, s.product_name, s.category, s.started_at, s.ended_at,
    COALESCE(s.duration_minutes, round(extract(epoch FROM (now() - s.started_at))/60.0, 1)), s.ended_at IS NULL
  FROM caisse_stockouts s JOIN restaurants r ON r.id = s.restaurant_id
  WHERE s.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(s.chain_id)
    AND s.started_at < ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
    AND COALESCE(s.ended_at, now()) >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
  ORDER BY s.started_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_splash_stockouts(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_splash_stockouts(uuid[], date, date) TO authenticated;