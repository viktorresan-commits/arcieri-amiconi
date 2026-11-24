-- Registro di quando il fondatore apre o modifica i dati di un altro profilo (solo lato server, non mostrato all'utente).
create table if not exists founder_access_log (
  id serial primary key,
  by_user text not null,
  member_id integer not null,
  action text not null,
  detail text not null default '',
  at timestamptz not null default now()
);
create index if not exists founder_access_log_member on founder_access_log (member_id, at desc);
