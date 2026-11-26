-- nome FITAST collegato dal fondatore: non compare all'arciere né ad altri (solo il fondatore lo vede)
alter table members add column if not exists fitast_hidden boolean not null default false;
