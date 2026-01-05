-- Ajouter un index unique pour permettre les upserts efficaces sur order_items
ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_order_id_item_id_unique 
UNIQUE (order_id, item_id);