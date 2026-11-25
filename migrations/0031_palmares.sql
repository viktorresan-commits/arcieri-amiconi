-- Palmarès delle compagnie: trofei e piazzamenti di squadra (le medaglie individuali vengono dalle gare)
create table if not exists company_awards (
  id serial primary key,
  company_id integer not null references companies (id) on delete cascade,
  title text not null,
  place integer,
  competition text not null default '',
  held_on date,
  category text not null default '',
  notes text not null default '',
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists company_awards_company_idx on company_awards (company_id, held_on desc);
