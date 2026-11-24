-- Ruoli: restano il fondatore, il presidente della compagnia (company_members.role = 'owner')
-- e l'allenatore (members.coach). Amministratori e moderatori (editor) non esistono più:
-- chi lo era torna arciere. Il fondatore resta l'unico con role = 'admin'.
update members set role = 'archer' where role = 'admin' and not coalesce(is_super, false);
update members set staff = '' where staff <> '';
-- codici di nomina ancora aperti per incarichi che non esistono più: scaduti subito
update role_codes set expires_at = now() where used_by is null and kind in ('admin', 'editor');

-- Schede di allenamento che l'allenatore prepara per un allievo della sua compagnia.
create table if not exists coach_plans (
  id serial primary key,
  company_id integer references companies (id) on delete cascade,
  coach_user_id text not null,
  athlete_user_id text not null,
  title text not null default '',
  goal text not null default '',
  notes text not null default '',
  items jsonb not null default '[]'::jsonb,
  done jsonb not null default '[]'::jsonb,
  starts_on date,
  ends_on date,
  status text not null default 'attiva' check (status in ('attiva', 'conclusa')),
  athlete_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_plans_athlete_idx on coach_plans (athlete_user_id, status, updated_at desc);
create index if not exists coach_plans_coach_idx on coach_plans (coach_user_id, updated_at desc);
