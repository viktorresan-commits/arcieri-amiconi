-- Scadenza della tessera della stagione: la segna la segreteria o l'arciere stesso dal proprio profilo.
-- Senza data scritta, una quota pagata vale fino al 31 dicembre della sua stagione.
alter table company_dues add column if not exists card_until date;
