-- Numero della freccia dell'attrezzatura (quella che hai in mano: 1–12, 7, ...), diverso dall'ordine nella volée.
alter table shots add column if not exists arrow_tag integer;
