CREATE TABLE IF NOT EXISTS public.uber_app_token (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uber_app_token ENABLE ROW LEVEL SECURITY;

-- No policies => only service_role (backend) can read/write.
COMMENT ON TABLE public.uber_app_token IS 'Singleton row caching Uber client_credentials token to avoid OAuth rate-limit.';