-- Add is_pinned column to restaurants table for quick access filtering
ALTER TABLE public.restaurants ADD COLUMN is_pinned boolean DEFAULT false;

-- Set the 4 target restaurants as pinned
UPDATE public.restaurants SET is_pinned = true WHERE name ILIKE '%athis%mons%' OR name ILIKE '%antony%' OR name ILIKE '%bonneuil%' OR name ILIKE '%juvisy%';