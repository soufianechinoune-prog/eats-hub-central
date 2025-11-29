-- Create price_history table for complete price tracking
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL, -- 'price_uber', 'price_deliveroo', 'food_cost'
  old_value NUMERIC,
  new_value NUMERIC,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  restaurant_action_id UUID REFERENCES public.restaurant_actions(id) ON DELETE SET NULL,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow read price_history for all"
ON public.price_history FOR SELECT
USING (true);

CREATE POLICY "Allow insert price_history for all"
ON public.price_history FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update price_history for all"
ON public.price_history FOR UPDATE
USING (true);

CREATE POLICY "Allow delete price_history for all"
ON public.price_history FOR DELETE
USING (true);

-- Create menu_item_changes table for tracking all menu item modifications
CREATE TABLE public.menu_item_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'activated', 'deactivated'
  item_name TEXT NOT NULL, -- Store name for reference even if item deleted
  field_changes JSONB, -- [{ field: 'price_uber', from: 12.90, to: 13.50 }, ...]
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  restaurant_action_id UUID REFERENCES public.restaurant_actions(id) ON DELETE SET NULL,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.menu_item_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow read menu_item_changes for all"
ON public.menu_item_changes FOR SELECT
USING (true);

CREATE POLICY "Allow insert menu_item_changes for all"
ON public.menu_item_changes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update menu_item_changes for all"
ON public.menu_item_changes FOR UPDATE
USING (true);

CREATE POLICY "Allow delete menu_item_changes for all"
ON public.menu_item_changes FOR DELETE
USING (true);

-- Add change_context column to restaurant_actions for structured change details
ALTER TABLE public.restaurant_actions 
ADD COLUMN IF NOT EXISTS change_context JSONB;

-- Create indexes for performance
CREATE INDEX idx_price_history_menu_item ON public.price_history(menu_item_id);
CREATE INDEX idx_price_history_changed_at ON public.price_history(changed_at DESC);
CREATE INDEX idx_menu_item_changes_menu_item ON public.menu_item_changes(menu_item_id);
CREATE INDEX idx_menu_item_changes_changed_at ON public.menu_item_changes(changed_at DESC);