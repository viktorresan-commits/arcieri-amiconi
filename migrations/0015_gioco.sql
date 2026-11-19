create table if not exists game_matches (
  id serial primary key,
  member_id integer not null references members(id),
  mode text not null,
  seed text not null,
  duel_id integer,
  score integer not null default 0,
  arrows integer not null default 0,
  hits integer not null default 0,
  perfects integer not null default 0,
  best_combo integer not null default 0,
  xp integer not null default 0,
  shots jsonb not null default '[]'::jsonb,
  status text not null default 'aperta',
  created_at timestamptz not null default now()
);

create index if not exists game_matches_member_idx on game_matches (member_id, created_at desc);
create index if not exists game_matches_status_idx on game_matches (status, mode);

create table if not exists game_duels (
  id serial primary key,
  challenger_id integer not null references members(id),
  opponent_id integer not null references members(id),
  seed text not null,
  challenger_score integer,
  opponent_score integer,
  challenger_hits integer,
  opponent_hits integer,
  challenger_perfects integer,
  opponent_perfects integer,
  status text not null default 'aperta',
  created_at timestamptz not null default now()
);

create table if not exists game_rewards (
  member_id integer not null references members(id),
  code text not null,
  unlocked_at timestamptz not null default now(),
  primary key (member_id, code)
);
