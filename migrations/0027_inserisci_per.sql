-- «Inserisci per un allievo»: il fondatore (per tutti) e allenatori/presidente (per la loro compagnia)
-- possono registrare analisi del gesto, allenamenti e gare a nome di un allievo.
create table if not exists acting_as (
  user_id text primary key,
  target_member_id integer not null references members (id) on delete cascade,
  until timestamptz not null
);
alter table gestures add column if not exists added_by text;
alter table sessions add column if not exists added_by text;
alter table competition_entries add column if not exists added_by text;
