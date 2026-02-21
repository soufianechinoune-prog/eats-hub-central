CREATE INDEX IF NOT EXISTS idx_order_items_order_id_covering
  ON public.order_items(order_id)
  INCLUDE (item_id, item_title, category, quantity, 
           sales_incl_vat, refund_incl_vat, unit_price);