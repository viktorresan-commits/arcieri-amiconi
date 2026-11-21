-- Compagnie: ogni arciere fa parte di una compagnia. Chi non ha ancora scelto
-- resta nella Compagnia degli Arcieri di Fabriano, la prima, creata qui.
create table if not exists companies (
  id serial primary key,
  slug text not null unique,
  name text not null,
  motto text not null default '',
  city text not null default '',
  bio text not null default '',
  logo_url text,
  color text not null default '#1f7a46',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  website text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  youtube text not null default '',
  tiktok text not null default '',
  address text not null default '',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists company_members (
  user_id text primary key,
  company_id integer not null references companies (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now()
);

create index if not exists company_members_company_idx on company_members (company_id);

insert into companies (slug, name, motto, city, logo_url, color)
values ('fabriano', 'Compagnia degli Arcieri di Fabriano', 'In animo iuncti', 'Fabriano', '/compagnie/fabriano-stemma.png', '#1f7a46')
on conflict (slug) do nothing;

insert into company_members (user_id, company_id)
select m.user_id, c.id
from members m
cross join companies c
where c.slug = 'fabriano' and m.user_id is not null
on conflict (user_id) do nothing;
