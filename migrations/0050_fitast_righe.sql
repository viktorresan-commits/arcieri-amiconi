-- Archivio FITAST: una riga per ogni arciere di ogni classifica salvata, con le parole del nome.
-- Così i profili cercano i propri nomi con l'indice (in un attimo) invece di rileggere tutto l'archivio.
create table if not exists fitast_history_rows (
  history_id integer not null references fitast_history (id) on delete cascade,
  kind text not null,
  season text not null,
  gara_id text not null default '',
  pos integer not null,
  total integer not null,
  words text[] not null,
  row jsonb not null
);
create index if not exists fitast_history_rows_words on fitast_history_rows using gin (words);
create index if not exists fitast_history_rows_hist on fitast_history_rows (history_id);

insert into fitast_history_rows (history_id, kind, season, gara_id, pos, total, words, row)
select h.id, h.kind, h.season, h.gara_id, x.n::int, jsonb_array_length(h.rows)::int,
  array(select w from unnest(regexp_split_to_array(upper(translate(coalesce(x.v->>'name', ''), 'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑàáâãäåèéêëìíîïòóôõöùúûüçñ', 'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn')), '[^A-Z]+')) w where length(w) > 1),
  x.v
from fitast_history h
cross join lateral jsonb_array_elements(h.rows) with ordinality as x(v, n)
where not exists (select 1 from fitast_history_rows r where r.history_id = h.id);
