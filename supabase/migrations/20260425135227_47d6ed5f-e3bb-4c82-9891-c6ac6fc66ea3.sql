ALTER FUNCTION public.get_network_orders_summary(uuid[], date, date)
  SET statement_timeout TO '60s';

ALTER FUNCTION public.get_product_sales_for_period(timestamp with time zone, timestamp with time zone, uuid[])
  SET statement_timeout TO '60s';

ALTER FUNCTION public.get_product_sales_for_period(timestamp with time zone, uuid[])
  SET statement_timeout TO '60s';