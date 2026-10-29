GRANT SELECT ON public.splash_notification_stations TO authenticated;

CREATE POLICY "Users read stations of their chains"
  ON public.splash_notification_stations
  FOR SELECT
  TO authenticated
  USING (public.user_has_chain_access(chain_id));