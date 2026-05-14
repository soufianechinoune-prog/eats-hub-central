CREATE OR REPLACE FUNCTION public.tag_orders_on_backfill_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    UPDATE public.orders
    SET data_source = 'uber_api'
    WHERE restaurant_id = NEW.restaurant_id
      AND order_datetime >= NEW.month_start::timestamptz
      AND order_datetime < (NEW.month_end + INTERVAL '1 day')
      AND (data_source IS NULL OR data_source = 'csv_import');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tag_orders_on_backfill_done ON public.backfill_jobs;
CREATE TRIGGER trg_tag_orders_on_backfill_done
AFTER UPDATE ON public.backfill_jobs
FOR EACH ROW
EXECUTE FUNCTION public.tag_orders_on_backfill_done();