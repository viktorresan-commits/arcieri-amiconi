-- Compagnie del portale FITAST: preparate dall'elenco ufficiale (con stemma disegnato e contatti),
-- da scegliere all'ingresso; restano anche senza iscritti. Le classifiche del portale (generale
-- compagnie e arcieri del campionato, e per ogni gara i primi arcieri e le squadre) si salvano per tutti.
alter table companies add column if not exists source text not null default 'app';
alter table companies add column if not exists fitast_code text not null default '';

create table if not exists fitast_standings (
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
create unique index if not exists fitast_standings_key on fitast_standings (kind, season, gara_id, category);
create index if not exists fitast_standings_season_idx on fitast_standings (season, kind);

-- quando si è letto l'ultima volta l'elenco delle compagnie (e altre letture rare del portale)
create table if not exists fitast_sync (
  key text primary key,
  at timestamptz not null default now(),
  info jsonb not null default '{}'::jsonb
);
