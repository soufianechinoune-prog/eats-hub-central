ALTER TABLE public.chart_notes ADD COLUMN end_date date;
ALTER TABLE public.chart_notes ADD CONSTRAINT chart_notes_date_range_valid CHECK (end_date IS NULL OR end_date >= note_date);
COMMENT ON COLUMN public.chart_notes.end_date IS 'Inclusive end of an event period; NULL denotes a single-day event.';