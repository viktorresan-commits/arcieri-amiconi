-- Mercatino dell'usato: annunci degli arcieri, visibili alla propria compagnia o a tutte.
create table if not exists market_items (
  id serial primary key,
  user_id text not null,
  company_id int,
  equipment_id int,
  category text not null default 'altro',
  title text not null,
  description text not null default '',
  qty int not null default 1,
  price_cents int,
  condition text not null default 'buono',
  place text not null default '',
  lat double precision,
  lng double precision,
  contact text not null default '',
  everyone boolean not null default false,
  status text not null default 'open',
  thumb text not null default '',
  video_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_items_company on market_items (company_id, status);
create index if not exists market_items_user on market_items (user_id);
-- foto e video degli annunci (compressi sul telefono), uno per riga
create table if not exists market_media (
  id serial primary key,
  item_id int not null,
  kind text not null default 'photo',
  data text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists market_media_item on market_media (item_id);
-- i dati degli acquisti salvati come note del pezzo non sono promemoria da spuntare
update equipment set note_done = true where notes ~* '^(comprato da|scontrino)' and note_done = false;
-- l'inventario è personale: i pezzi messi «nel gruppo» tornano solo di chi li ha inseriti
update equipment set visibility = 'personal' where visibility <> 'personal';
