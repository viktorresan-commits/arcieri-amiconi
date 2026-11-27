-- Scadenza della tessera FITAST di ogni arciere: la segna la segreteria o l'arciere dal proprio profilo.
create table if not exists company_fitast_cards (
  company_id integer not null references companies (id) on delete cascade,
  user_id text not null,
  valid_until date,
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
