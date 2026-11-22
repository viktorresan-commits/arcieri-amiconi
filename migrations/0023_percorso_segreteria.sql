-- Percorso iniziale: chi entra da ora sceglie come tira (principiante, compagnia, istruttore).
-- Chi c'era già resta com'è: lo segniamo come "esistente" e non gli chiediamo niente.
alter table members add column if not exists percorso text not null default '';
update members set percorso = 'esistente' where percorso = '';

-- l'arciere sceglie se gli istruttori della sua compagnia vedono i suoi allenamenti
alter table members add column if not exists share_coach boolean not null default true;

-- Segreteria della compagnia: quote, certificati medici, presenze ai corsi.
-- Le vedono solo lo staff e il capogruppo della compagnia.
create table if not exists company_dues (
  company_id integer not null references companies (id) on delete cascade,
  user_id text not null,
  season integer not null,
  paid boolean not null default false,
  paid_on date,
  amount_cents integer,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id, season)
);

create table if not exists company_certs (
  company_id integer not null references companies (id) on delete cascade,
  user_id text not null,
  valid_until date,
  kind text not null default 'agonistico',
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists course_days (
  id serial primary key,
  company_id integer not null references companies (id) on delete cascade,
  day date not null,
  title text not null default 'Corso',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists course_days_company_idx on course_days (company_id, day desc);

create table if not exists course_presence (
  day_id integer not null references course_days (id) on delete cascade,
  user_id text not null,
  primary key (day_id, user_id)
);
