-- Analisi del gesto salvate: riassunto numerico e una miniatura (il video resta sul telefono).
create table if not exists gestures (
  id serial primary key,
  member_id integer not null references members(id) on delete cascade,
  title text not null default '',
  kind text not null default 'video' check (kind in ('video', 'foto')),
  hand text not null default 'destro',
  score integer,
  shots integer not null default 0,
  anchor_s real,
  draw_s real,
  line_deg real,
  bow_deg real,
  shoulder_deg real,
  jitter real,
  distance_m real,
  data jsonb not null default '{}'::jsonb,
  thumb text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists gestures_member_idx on gestures (member_id, created_at desc);
create index if not exists gestures_score_idx on gestures (score desc nulls last);
