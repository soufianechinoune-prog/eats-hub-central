CREATE OR REPLACE FUNCTION public.prevent_conflicting_uber_alias()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  real_owner uuid;
BEGIN
  SELECT id INTO real_owner
  FROM public.restaurants
  WHERE uber_store_id = NEW.uber_store_id;

  IF real_owner IS NOT NULL AND real_owner <> NEW.restaurant_id THEN
    RAISE EXCEPTION
      'Alias Uber conflictuel : le store % appartient deja au restaurant %, refuse pour %',
      NEW.uber_store_id, real_owner, NEW.restaurant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_conflicting_uber_alias ON public.restaurant_uber_ids;
CREATE TRIGGER trg_prevent_conflicting_uber_alias
BEFORE INSERT OR UPDATE ON public.restaurant_uber_ids
FOR EACH ROW EXECUTE FUNCTION public.prevent_conflicting_uber_alias();