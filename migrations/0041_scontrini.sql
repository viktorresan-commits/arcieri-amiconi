-- Scontrini e fatture degli acquisti: la foto (ridotta), negozio, data e totale.
-- Le righe lette diventano voci "prese" della lista della spesa, legate allo scontrino.
create table if not exists receipts (
  id serial primary key,
  user_id text not null,
  store text not null default '',
  day date,
  total_cents int,
  photo text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists receipts_user on receipts (user_id);
alter table shopping_items add column if not exists receipt_id int;
