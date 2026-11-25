-- Risultati di squadra delle compagnie nelle gare, presi dalla classifica squadre del portale FITAST:
-- chi fa la ricerca li salva per tutta la sua compagnia (posizione e punteggio ufficiali), senza
-- aspettare che ogni arciere metta il suo punteggio.
alter table companies add column if not exists fitast_name text not null default '';

create table if not exists company_results (
  id serial primary key,
  company_id integer not null references companies (id) on delete cascade,
  fitast_id text not null default '',
  competition_id integer references competitions (id) on delete set null,
  competition text not null default '',
  held_on date,
  team text not null default '',
  category text not null default '',
  place integer,
  score numeric,
  teams integer,
  updated_by text,
  updated_at timestamptz not null default now()
);

create unique index if not exists company_results_key on company_results (company_id, fitast_id, team, category);
create index if not exists company_results_company_idx on company_results (company_id, held_on desc);
