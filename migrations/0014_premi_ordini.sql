create table if not exists club_orders (
  id serial primary key,
  user_id text not null,
  item text not null,
  qty integer not null default 1,
  note text not null default '',
  status text not null default 'aperto',
  created_at timestamptz not null default now()
);

insert into achievements (code, title, detail) values
  ('sessions_5', '5 allenamenti', 'Cinque sessioni con almeno una freccia.'),
  ('sessions_50', '50 allenamenti', 'Cinquanta sessioni chiuse.'),
  ('sessions_100', '100 allenamenti', 'Cento sessioni chiuse.'),
  ('arrows_500', '500 frecce', 'Cinquecento frecce registrate.'),
  ('arrows_5000', '5000 frecce', 'Cinquemila frecce registrate.'),
  ('gare_5', '5 gare', 'Cinque gare con il punteggio segnato.'),
  ('gare_10', '10 gare', 'Dieci gare con il punteggio segnato.'),
  ('champ_10', '10 punti campionato', 'Dieci punti campionato sommati.'),
  ('champ_50', '50 punti campionato', 'Cinquanta punti campionato sommati.'),
  ('champ_100', '100 punti campionato', 'Cento punti campionato sommati.')
on conflict (code) do nothing;
