
-- 1. Add a flag to mark Splash caisses that have no FR restaurant equivalent
ALTER TABLE public.splash360_restaurant_mapping
  ADD COLUMN IF NOT EXISTS is_not_applicable boolean NOT NULL DEFAULT false;

-- 2. Trigger: when restaurant_id is set/changed, rétroactivement rattacher la data déjà reçue
CREATE OR REPLACE FUNCTION public.splash_mapping_backfill_sales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id THEN
    UPDATE public.splash360_daily_sales
       SET restaurant_id = NEW.restaurant_id,
           updated_at = now()
     WHERE chain_id = NEW.chain_id
       AND restaurant_splash_id = NEW.restaurant_splash_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_splash_mapping_backfill ON public.splash360_restaurant_mapping;
CREATE TRIGGER trg_splash_mapping_backfill
AFTER UPDATE OF restaurant_id ON public.splash360_restaurant_mapping
FOR EACH ROW
EXECUTE FUNCTION public.splash_mapping_backfill_sales();
