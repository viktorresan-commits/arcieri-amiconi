-- Chi entra per la prima volta sceglie se stare nella compagnia di Fabriano o fondarne una.
-- Chi c'era già ha la sua compagnia e non deve rispondere di nuovo.
alter table company_members add column if not exists chosen boolean not null default false;
update company_members set chosen = true;
