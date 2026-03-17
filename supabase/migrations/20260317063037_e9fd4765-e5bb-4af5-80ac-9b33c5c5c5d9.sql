
-- Create restaurant_name_aliases table for manual name-to-restaurant mappings
CREATE TABLE public.restaurant_name_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  source TEXT DEFAULT 'manual_import',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on normalized_name to avoid duplicates
CREATE UNIQUE INDEX idx_restaurant_name_aliases_normalized ON public.restaurant_name_aliases(normalized_name);

-- Index for fast lookups
CREATE INDEX idx_restaurant_name_aliases_restaurant ON public.restaurant_name_aliases(restaurant_id);

-- Disable RLS (internal tool table, no user-facing data)
ALTER TABLE public.restaurant_name_aliases ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert
CREATE POLICY "Authenticated users can read aliases" ON public.restaurant_name_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert aliases" ON public.restaurant_name_aliases FOR INSERT TO authenticated WITH CHECK (true);

-- Clean up polluted restaurant_uber_ids entries (names saved as store IDs)
-- Delete entries where uber_store_id looks like a restaurant name (contains spaces)
DELETE FROM public.restaurant_uber_ids WHERE uber_store_id LIKE '% %';
