
DROP INDEX IF EXISTS public.idx_chain_pos_one_active;
CREATE UNIQUE INDEX idx_chain_pos_one_active_per_connector
  ON public.chain_pos_connections (chain_id, connector_id)
  WHERE is_active = true;
