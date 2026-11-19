-- Arcieri Amiconi. Roster rows exist before anyone signs in.
-- Auth users claim a row with claim_code. Sessions hang off the auth user id.

create table if not exists members (
  id serial primary key,
  user_id text unique,
  given_name text not null,
  family_name text not null default '',
  nickname text not null default '',
  slug text not null unique,
  role text not null default 'archer' check (role in ('admin', 'archer', 'viewer')),
  bow_type text not null default '',
  bio text not null default '',
  avatar_color text not null default '#1f5c38',
  photo_url text,
  joined_on date not null default current_date,
  claim_code text not null unique,
  status text not null default 'roster',
  sort_order int not null default 0,
  notify_board boolean not null default true,
  notify_challenges boolean not null default true,
  notify_goals boolean not null default true,
  notify_comps boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists equipment (
  id serial primary key,
  user_id text not null,
  visibility text not null default 'personal' check (visibility in ('personal', 'group')),
  category text not null,
  name text not null,
  brand text not null default '',
  model text not null default '',
  photo_url text,
  purchased_on date,
  price_cents int,
  shop text not null default '',
  notes text not null default '',
  status text not null default 'in_use' check (status in ('in_use', 'replace', 'unused')),
  specs text not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists equipment_user_idx on equipment (user_id);

create table if not exists setups (
  id serial primary key,
  user_id text not null,
  name text not null,
  bow_id int,
  arrow_id int,
  string_note text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists setups_user_idx on setups (user_id);

create table if not exists sessions (
  id serial primary key,
  client_key text not null unique,
  user_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  place text not null default '',
  distance_m double precision not null,
  discipline text not null,
  bow_type text not null,
  bow_custom text not null default '',
  face text not null,
  max_arrow int not null,
  setup_id int,
  arrows_per_end int not null,
  ends_planned int not null,
  blocks_planned int not null,
  weather text not null default '',
  feeling text not null default '',
  rating int,
  notes text not null default '',
  duration_ms int not null default 0,
  timer_limit_ms int,
  end_limit_ms int,
  gear_snapshot text not null default '',
  string_note text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists sessions_user_started_idx on sessions (user_id, started_at desc);

create table if not exists shots (
  id serial primary key,
  session_id int not null references sessions (id) on delete cascade,
  block_index int not null,
  end_index int not null,
  arrow_index int not null,
  score int not null,
  is_x boolean not null default false,
  miss boolean not null default false,
  nx double precision,
  ny double precision,
  unique (session_id, block_index, end_index, arrow_index)
);
create index if not exists shots_session_idx on shots (session_id);

create table if not exists challenges (
  id serial primary key,
  created_by text not null,
  title text not null,
  rules text not null,
  starts_on date not null,
  ends_on date not null,
  open_join boolean not null default false,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists challenge_members (
  challenge_id int not null references challenges (id) on delete cascade,
  user_id text not null,
  state text not null check (state in ('invited', 'accepted', 'declined')),
  team_name text not null default '',
  primary key (challenge_id, user_id)
);

create table if not exists competitions (
  id serial primary key,
  name text not null,
  starts_on date not null,
  place text not null default '',
  organizer text not null default '',
  kind text not null default '',
  distance_m double precision,
  category text not null default '',
  signup_deadline date,
  external_url text not null default '',
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists competition_entries (
  id serial primary key,
  competition_id int not null references competitions (id) on delete cascade,
  user_id text not null,
  score int,
  rank int,
  category text not null default '',
  notes text not null default '',
  unique (competition_id, user_id)
);

create table if not exists events (
  id serial primary key,
  user_id text,
  title text not null,
  starts_on date not null,
  kind text not null default 'nota',
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists shopping_items (
  id serial primary key,
  user_id text not null,
  visibility text not null default 'personal' check (visibility in ('personal', 'group')),
  name text not null,
  category text not null default 'accessorio',
  qty int not null default 1,
  price_cents int,
  url text not null default '',
  priority text not null default 'normal' check (priority in ('alta', 'normal', 'bassa')),
  notes text not null default '',
  status text not null default 'todo' check (status in ('todo', 'ordered', 'bought')),
  size_label text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists shopping_user_idx on shopping_items (user_id);

create table if not exists goals (
  id serial primary key,
  user_id text,
  title text not null,
  metric text not null check (metric in ('arrows', 'sessions', 'avg', 'days')),
  target double precision not null,
  bow_type text not null default '',
  distance_m double precision,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists achievements (
  code text primary key,
  title text not null,
  detail text not null
);

create table if not exists user_achievements (
  user_id text not null,
  code text not null references achievements (code),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table if not exists notifications (
  id serial primary key,
  user_id text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  dedupe text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists messages (
  id serial primary key,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists password_requests (
  id serial primary key,
  email text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

insert into achievements (code, title, detail) values
  ('first_session', 'Primo allenamento', 'Hai chiuso la prima sessione con almeno una freccia.'),
  ('arrows_100', 'Cento frecce', 'Cento frecce registrate, senza buchi rispetto al piano.'),
  ('arrows_1000', 'Mille frecce', 'Mille frecce registrate nel quaderno.'),
  ('sessions_10', 'Dieci allenamenti', 'Dieci sessioni chiuse.'),
  ('first_record', 'Primo record', 'Hai migliorato la tua miglior media, su almeno sei frecce.'),
  ('first_comp', 'Prima gara', 'Hai un risultato gara registrato.'),
  ('improve_5', 'Media in salita', 'La media degli ultimi 30 giorni è almeno il 5% sopra i 30 precedenti.'),
  ('days_30', 'Trenta giorni', 'Ti sei allenato in trenta giorni diversi.'),
  ('streak_7', 'Sette giorni di fila', 'Sette giorni consecutivi con almeno una freccia.')
on conflict (code) do nothing;

insert into members (given_name, slug, claim_code, avatar_color, sort_order, role, status) values
  ('Simone', 'simone', 'SIMONE', '#1f5c38', 1, 'archer', 'roster'),
  ('Melissa', 'melissa', 'MELISS', '#245c45', 2, 'archer', 'roster'),
  ('Romina', 'romina', 'ROMINA', '#184833', 3, 'archer', 'roster'),
  ('Diego', 'diego', 'DIEGO', '#3d8f5f', 4, 'archer', 'roster'),
  ('Victor', 'victor', 'VICTOR', '#1f5c38', 5, 'archer', 'roster'),
  ('Manuel', 'manuel-1', 'MANUEL1', '#16382c', 6, 'archer', 'roster'),
  ('Stefano', 'stefano-1', 'STEFANO1', '#245c45', 7, 'archer', 'roster'),
  ('Michael', 'michael', 'MICHAEL', '#1f5c38', 8, 'archer', 'roster'),
  ('Alessio', 'alessio', 'ALESSIO', '#184833', 9, 'archer', 'roster'),
  ('Stefano', 'stefano-2', 'STEFANO2', '#3d8f5f', 10, 'archer', 'roster'),
  ('Giulia', 'giulia', 'GIULIA', '#16382c', 11, 'archer', 'roster'),
  ('Maraska', 'maraska', 'MARASKA', '#245c45', 12, 'archer', 'roster'),
  ('Martina', 'martina', 'MARTINA', '#1f5c38', 13, 'archer', 'roster'),
  ('Manuel', 'manuel-2', 'MANUEL2', '#184833', 14, 'archer', 'roster'),
  ('Pagno', 'pagno', 'PAGNO', '#3d8f5f', 15, 'archer', 'roster')
on conflict (slug) do nothing;
