-- Ruoli dello staff: il fondatore (chi ha le credenziali di amministratore) non può essere
-- tolto né declassato da nessuno; gli altri amministratori e gli editor si nominano con un codice.
-- Il capogruppo è il titolare della compagnia (company_members.role = 'owner').
alter table members add column if not exists is_super boolean not null default false;
alter table members add column if not exists staff text not null default '';
update members set is_super = true where role = 'admin' and user_id is not null;

-- codici monouso per nominare amministratori, editor e capigruppo
create table if not exists role_codes (
  code text primary key,
  kind text not null check (kind in ('admin', 'editor', 'capogruppo')),
  company_id integer references companies (id) on delete cascade,
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by text,
  used_at timestamptz
);

-- richieste degli arcieri allo staff (per esempio: diventare capogruppo della propria compagnia)
create table if not exists role_requests (
  id serial primary key,
  user_id text not null,
  kind text not null check (kind in ('capogruppo', 'editor')),
  company_id integer references companies (id) on delete cascade,
  note text not null default '',
  status text not null default 'attesa' check (status in ('attesa', 'ok', 'no')),
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz
);
create index if not exists role_requests_status_idx on role_requests (status, created_at desc);

-- inviti a una compagnia, da mandare su WhatsApp
create table if not exists company_invites (
  code text primary key,
  company_id integer not null references companies (id) on delete cascade,
  created_by text not null,
  created_at timestamptz not null default now()
);
