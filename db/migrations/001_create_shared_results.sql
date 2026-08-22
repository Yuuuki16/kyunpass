create table if not exists public.shared_results (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.shared_results enable row level security;

revoke all on table public.shared_results from anon, authenticated;
