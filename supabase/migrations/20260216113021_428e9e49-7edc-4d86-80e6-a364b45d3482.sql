CREATE POLICY "Allow public read on payout_adjustments"
  ON public.payout_adjustments
  FOR SELECT
  USING (true);