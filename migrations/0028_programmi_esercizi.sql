-- Programmi di esercizi dell'allenatore (PDF da stampare o inviare): per un allievo dell'app
-- (athlete_member_id) oppure per un nome scritto a mano.
create table if not exists exercise_programs (
  id serial primary key,
  company_id integer references companies (id) on delete cascade,
  coach_user_id text not null,
  athlete_member_id integer references members (id) on delete set null,
  athlete_name text not null default '',
  level integer not null default 1 check (level between 1 and 3),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exercise_programs_company_idx on exercise_programs (company_id, updated_at desc);
create index if not exists exercise_programs_athlete_idx on exercise_programs (athlete_member_id, updated_at desc);
