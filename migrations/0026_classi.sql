-- Classi degli allenatori (es. «Corso A», lunedì e mercoledì alle 18): allievi, allenatori,
-- gruppo WhatsApp già esistente collegato, codice d'invito e richieste alla classe.
create table if not exists coach_classes (
  id serial primary key,
  company_id integer references companies (id) on delete cascade,
  name text not null,
  days text not null default '',
  time text not null default '',
  place text not null default '',
  whatsapp_url text not null default '',
  invite_code text unique,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_classes_company_idx on coach_classes (company_id);

create table if not exists class_coaches (
  class_id integer not null references coach_classes (id) on delete cascade,
  user_id text not null,
  primary key (class_id, user_id)
);

create table if not exists class_members (
  class_id integer not null references coach_classes (id) on delete cascade,
  user_id text not null,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_members_user_idx on class_members (user_id);

-- richieste dell'allenatore alla classe: segnare punteggi, una gara, un'analisi del gesto, le foto…
create table if not exists class_requests (
  id serial primary key,
  class_id integer not null references coach_classes (id) on delete cascade,
  created_by text not null,
  kind text not null default 'altro',
  message text not null default '',
  due_on date,
  created_at timestamptz not null default now()
);
create index if not exists class_requests_class_idx on class_requests (class_id, created_at desc);

create table if not exists class_request_done (
  request_id integer not null references class_requests (id) on delete cascade,
  user_id text not null,
  done_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
