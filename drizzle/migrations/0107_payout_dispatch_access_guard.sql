CREATE OR REPLACE FUNCTION public.guard_payout_wave_api_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE access_status text;
BEGIN
 IF NEW.status='dispatching' THEN
 SELECT a.status INTO access_status FROM public.get_uber_api_access_status(NEW.chain_id) a WHERE a.restaurant_id=NEW.restaurant_id;
 IF access_status IS NULL OR access_status NOT IN ('ok','silencieux') THEN
 NEW.status := 'awaiting_access'; NEW.error := 'Awaiting Uber API access approval';
 END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_payout_wave_api_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_payout_wave_api_access() TO service_role;