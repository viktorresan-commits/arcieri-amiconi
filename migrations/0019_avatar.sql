-- Aspetto dell'arciere disegnato (Home, podio, classifiche): uno per account.
create table if not exists avatars (
  user_id text primary key,
  look jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
