-- Giri del minigioco della Home, uno per riga con l'ora: servono alle sfide di tipo minigioco
-- (miglior giro, media, giri giocati nel periodo). I record restano in game_records.
create table if not exists game_rounds (
  id serial primary key,
  user_id text not null,
  mode text not null,
  level text not null,
  total integer not null,
  max_points integer not null default 0,
  tens integer not null default 0,
  xs integer not null default 0,
  misses integer not null default 0,
  played_at timestamptz not null default now()
);

create index if not exists game_rounds_user_idx on game_rounds (user_id, played_at desc);
