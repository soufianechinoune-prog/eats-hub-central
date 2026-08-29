DROP INDEX IF EXISTS public.uber_conversion_funnel_store_window_key;

UPDATE public.uber_conversion_funnel SET window_label = '' WHERE window_label IS NULL;

ALTER TABLE public.uber_conversion_funnel
  ALTER COLUMN window_label SET DEFAULT '',
  ALTER COLUMN window_label SET NOT NULL;

ALTER TABLE public.uber_conversion_funnel
  ADD CONSTRAINT uber_conversion_funnel_store_window_key UNIQUE (uber_store_uuid, window_label);