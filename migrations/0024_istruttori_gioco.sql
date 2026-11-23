-- Istruttore: incarico dato dal fondatore, dallo staff o dal capogruppo della compagnia.
alter table members add column if not exists coach boolean not null default false;

-- Avvisi letti tolti dalla Bacheca: restano in tabella (così non tornano), ma non si vedono più.
alter table notifications add column if not exists cleared_at timestamptz;

-- Record del gioco della Home, per bersaglio e livello, con il dettaglio del giro migliore.
create table if not exists game_records (
  user_id text not null,
  mode text not null,
  level text not null,
  best integer not null default 0,
  max_points integer not null default 0,
  stations text not null default '[]',
  arrows integer not null default 0,
  tens integer not null default 0,
  xs integer not null default 0,
  misses integer not null default 0,
  rounds integer not null default 0,
  best_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode, level)
);

-- I 20 anni della Compagnia Arcieri Fabriano: se la gara c'è la rinomino e metto il luogo, altrimenti la aggiungo.
update competitions
set name = 'Compagnia Arcieri Fabriano · 20 anni di attività (2006–2026)',
    place = 'Tenuta San Cassiano',
    organizer = 'Compagnia Arcieri Fabriano'
where notes = 'fitast:2483' or (starts_on = '2026-10-25' and name ilike '%20 anni%');

insert into competitions (name, starts_on, place, organizer, kind, external_url, notes, created_by)
select 'Compagnia Arcieri Fabriano · 20 anni di attività (2006–2026)', '2026-10-25', 'Tenuta San Cassiano', 'Compagnia Arcieri Fabriano',
  'Festa dei 20 anni', '', 'fitast:2483', 'fitast'
where not exists (select 1 from competitions where notes = 'fitast:2483' or (starts_on = '2026-10-25' and name ilike '%20 anni%'));
