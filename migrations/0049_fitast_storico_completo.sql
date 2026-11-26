-- Storico FITAST completo: le classifiche lette per intero dalla scansione dal 2019 hanno v = 2.
-- Quelle più vecchie (solo i primi tre per gara) o lette a metà restano a 1 e la scansione le rilegge.
alter table fitast_history add column if not exists v int not null default 1;
