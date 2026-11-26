-- cartellini di gara letti dalla foto: le piazzole di ogni arciere del gruppo (anche chi non usa l'app),
-- per vedere con chi si era in piazzola e i suoi punti piazzola per piazzola
create table if not exists gara_cartellini (
  id serial primary key,
  competition_id int not null,
  piazzola int not null default 0,
  name text not null,
  name_key text not null,
  user_id text,
  lanes jsonb not null default '[]'::jsonb,
  total int,
  spots int,
  updated_by text,
  updated_at timestamptz not null default now()
);
create unique index if not exists gara_cartellini_key on gara_cartellini (competition_id, name_key);
