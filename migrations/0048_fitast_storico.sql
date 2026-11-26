-- Storico FITAST dalle stagioni passate (dal 2019): stesse classifiche del campionato in corso, in una tabella
-- a parte così il campionato di adesso resta quello mostrato ovunque. Serve alla bacheca di ogni compagnia.
create table if not exists fitast_history (
  id serial primary key,
  kind text not null,
  season text not null default '',
  season_name text not null default '',
  gara_id text not null default '',
  gara_title text not null default '',
  held_on date,
  category text not null default '',
  rows jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
create unique index if not exists fitast_history_key on fitast_history (kind, season, gara_id, category);
create index if not exists fitast_history_season_idx on fitast_history (season, kind);
