-- Il 24 gennaio 2026 non è una gara del gruppo.
delete from competitions
where notes = 'fitast:2489'
   or (starts_on = date '2026-01-24' and name = 'Gara 2489');
