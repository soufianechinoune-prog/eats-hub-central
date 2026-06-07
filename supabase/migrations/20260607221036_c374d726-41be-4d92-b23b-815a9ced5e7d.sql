
-- Fonction de validation : refuse tout mapping où chain_id ≠ restaurants.chain_id
CREATE OR REPLACE FUNCTION public.enforce_splash_mapping_chain_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resto_chain UUID;
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT chain_id INTO resto_chain
  FROM public.restaurants
  WHERE id = NEW.restaurant_id;

  IF resto_chain IS NULL THEN
    RAISE EXCEPTION 'Restaurant % introuvable', NEW.restaurant_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.chain_id IS NULL THEN
    RAISE EXCEPTION 'chain_id obligatoire sur splash360_restaurant_mapping (splash_id=%)', NEW.restaurant_splash_id
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF resto_chain <> NEW.chain_id THEN
    RAISE EXCEPTION
      'Isolation marque violée : caisse Splash #% (chain=%) ne peut pas être rattachée au restaurant % (chain=%)',
      NEW.restaurant_splash_id, NEW.chain_id, NEW.restaurant_id, resto_chain
      USING ERRCODE = 'check_violation',
            HINT = 'Le restaurant doit appartenir à la même marque que la caisse Splash.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_splash_mapping_chain ON public.splash360_restaurant_mapping;
CREATE TRIGGER trg_enforce_splash_mapping_chain
BEFORE INSERT OR UPDATE OF restaurant_id, chain_id
ON public.splash360_restaurant_mapping
FOR EACH ROW
EXECUTE FUNCTION public.enforce_splash_mapping_chain_consistency();

-- Même garde-fou sur les ventes
CREATE OR REPLACE FUNCTION public.enforce_splash_sales_chain_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resto_chain UUID;
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT chain_id INTO resto_chain
  FROM public.restaurants
  WHERE id = NEW.restaurant_id;

  IF resto_chain IS NOT NULL AND NEW.chain_id IS NOT NULL AND resto_chain <> NEW.chain_id THEN
    RAISE EXCEPTION
      'Isolation marque violée sur splash360_daily_sales : restaurant % (chain=%) incompatible avec chain_id=%',
      NEW.restaurant_id, resto_chain, NEW.chain_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_splash_sales_chain ON public.splash360_daily_sales;
CREATE TRIGGER trg_enforce_splash_sales_chain
BEFORE INSERT OR UPDATE OF restaurant_id, chain_id
ON public.splash360_daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.enforce_splash_sales_chain_consistency();
