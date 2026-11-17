-- Traçabilité des déclarations éco-contribution envoyées à Uber (formulaire Google d'Uber).
-- Uber ne nous prévient pas de l'envoi : l'utilisateur confirme lui-même dans Mijotek.
-- On garde qui, quand, et une éventuelle annulation (jamais de suppression).

CREATE TABLE IF NOT EXISTS public.eco_uber_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid REFERENCES public.chains(id) ON DELETE SET NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  declared_by uuid DEFAULT auth.uid(),
  declared_by_name text,
  cancelled_at timestamptz,
  cancelled_by uuid
);

-- Une seule déclaration active par restaurant.
CREATE UNIQUE INDEX IF NOT EXISTS eco_uber_declarations_one_active
  ON public.eco_uber_declarations (restaurant_id) WHERE cancelled_at IS NULL;

-- L'enseigne, l'auteur et son nom sont fixés côté base (jamais par le navigateur).
CREATE OR REPLACE FUNCTION public.eco_uber_declarations_fill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.chain_id := (SELECT r.chain_id FROM public.restaurants r WHERE r.id = NEW.restaurant_id);
    NEW.declared_at := now();
    NEW.declared_by := auth.uid();
    NEW.declared_by_name := (
      SELECT COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
      FROM auth.users u WHERE u.id = auth.uid());
    NEW.cancelled_at := NULL;
    NEW.cancelled_by := NULL;
  ELSE
    -- Seule l'annulation est permise : le reste de la ligne ne bouge pas.
    NEW.restaurant_id := OLD.restaurant_id; NEW.chain_id := OLD.chain_id;
    NEW.declared_at := OLD.declared_at; NEW.declared_by := OLD.declared_by; NEW.declared_by_name := OLD.declared_by_name;
    IF OLD.cancelled_at IS NOT NULL THEN NEW.cancelled_at := OLD.cancelled_at; NEW.cancelled_by := OLD.cancelled_by;
    ELSIF NEW.cancelled_at IS NOT NULL THEN NEW.cancelled_at := now(); NEW.cancelled_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS eco_uber_declarations_fill ON public.eco_uber_declarations;
CREATE TRIGGER eco_uber_declarations_fill BEFORE INSERT OR UPDATE ON public.eco_uber_declarations
  FOR EACH ROW EXECUTE FUNCTION public.eco_uber_declarations_fill();

ALTER TABLE public.eco_uber_declarations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eco_uber_declarations_read ON public.eco_uber_declarations;
CREATE POLICY eco_uber_declarations_read ON public.eco_uber_declarations FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
DROP POLICY IF EXISTS eco_uber_declarations_insert ON public.eco_uber_declarations;
CREATE POLICY eco_uber_declarations_insert ON public.eco_uber_declarations FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.user_has_chain_access(chain_id));
DROP POLICY IF EXISTS eco_uber_declarations_cancel ON public.eco_uber_declarations;
CREATE POLICY eco_uber_declarations_cancel ON public.eco_uber_declarations FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_chain_access(chain_id));
REVOKE ALL ON public.eco_uber_declarations FROM anon;
