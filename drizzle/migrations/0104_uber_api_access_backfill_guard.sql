ALTER TABLE public.restaurants ADD COLUMN uber_api_access_granted boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.restaurants.uber_api_access_granted IS 'Operational Uber report access flag; false blocks payout backfill dispatch. Existing stores default true for compatibility, not independent proof of authorization.';
CREATE OR REPLACE FUNCTION public.guard_payout_wave_api_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('queued','dispatching') AND EXISTS (SELECT 1 FROM public.restaurants WHERE id=NEW.restaurant_id AND uber_api_access_granted=false) THEN
 NEW.status := 'awaiting_access';
 NEW.error := 'Awaiting Uber API access approval';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_payout_wave_api_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_payout_wave_api_access() TO service_role;
CREATE TRIGGER payout_wave_api_access_guard BEFORE INSERT OR UPDATE ON public.payout_adjustment_backfill_requests FOR EACH ROW EXECUTE FUNCTION public.guard_payout_wave_api_access();