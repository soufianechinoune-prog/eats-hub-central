ALTER FUNCTION public.get_profitability_daily(uuid[], date, date)
  SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.get_availability_daily(date, date, uuid[], text)
  SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.get_monthly_sales_from_daily(integer, uuid[], text)
  SECURITY DEFINER SET search_path = public;