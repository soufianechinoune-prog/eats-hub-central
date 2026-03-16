
DROP POLICY "Allow all access to bodacc_dismissed_alerts" ON public.bodacc_dismissed_alerts;

CREATE POLICY "Allow all access to bodacc_dismissed_alerts"
  ON public.bodacc_dismissed_alerts
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
