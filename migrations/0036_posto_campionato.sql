-- il nome con cui il portale FITAST conosce l'arciere (salvato quando porta un risultato dal portale)
alter table members add column if not exists fitast_name text not null default '';

-- nuovi traguardi dei punti campionato, oltre i 100
insert into achievements (code, title, detail) values
  ('champ_150', '150 punti campionato', 'Centocinquanta punti campionato sommati.'),
  ('champ_200', '200 punti campionato', 'Duecento punti campionato sommati.'),
  ('champ_300', '300 punti campionato', 'Trecento punti campionato sommati.'),
  ('champ_400', '400 punti campionato', 'Quattrocento punti campionato sommati.'),
  ('champ_500', '500 punti campionato', 'Cinquecento punti campionato sommati.'),
  ('champ_750', '750 punti campionato', 'Settecentocinquanta punti campionato sommati.'),
  ('champ_1000', '1000 punti campionato', 'Mille punti campionato sommati.')
on conflict (code) do nothing;
