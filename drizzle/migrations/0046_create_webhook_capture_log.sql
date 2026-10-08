create table if not exists public.webhook_capture_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null,
  method text,
  url text,
  headers jsonb,
  body text
);
alter table public.webhook_capture_log enable row level security;
create policy "authenticated read webhook_capture_log" on public.webhook_capture_log for select to authenticated using (true);
grant select on public.webhook_capture_log to authenticated;