CREATE TABLE public.restaurant_deliveroo_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  deliveroo_store_name text NOT NULL,
  is_primary boolean DEFAULT false,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deliveroo_store_name)
);

ALTER TABLE public.restaurant_deliveroo_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on restaurant_deliveroo_ids" ON public.restaurant_deliveroo_ids FOR ALL USING (true) WITH CHECK (true);

-- Migrate existing deliveroo_store_id values
INSERT INTO public.restaurant_deliveroo_ids (restaurant_id, deliveroo_store_name, is_primary, label)
SELECT id, deliveroo_store_id, true, 'principal'
FROM public.restaurants
WHERE deliveroo_store_id IS NOT NULL AND deliveroo_store_id != '';