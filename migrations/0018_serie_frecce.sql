-- Serie di frecce (scheda "freccia" dell'attrezzatura) a cui appartiene il numero: un arciere può
-- averne più di una, con penne di colore diverso.
alter table shots add column if not exists arrow_set integer;
