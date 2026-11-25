-- Loghi veri delle compagnie FITAST: cercati dal server (portale FITAST, sito della compagnia,
-- dominio della sua e-mail) e serviti da /api/logo/<id>; lo stemma disegnato resta finché non si trova.
alter table companies add column if not exists logo_hint text not null default '';
alter table companies add column if not exists logo_checked_at timestamptz;

create table if not exists company_logos (
  company_id integer primary key references companies(id) on delete cascade,
  mime text not null,
  data text not null,
  source text not null default '',
  found_at timestamptz not null default now()
);
