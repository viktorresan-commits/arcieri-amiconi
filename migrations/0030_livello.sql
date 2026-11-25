-- Punti esperienza dell'arciere anche sul server: il livello si vede sul suo profilo e passa da un telefono all'altro.
alter table members add column if not exists xp integer not null default 0;
