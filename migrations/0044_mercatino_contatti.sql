-- Mercatino: i contatti del venditore in campi separati (telefono, WhatsApp, e-mail)
alter table market_items add column if not exists phone text not null default '';
alter table market_items add column if not exists whatsapp text not null default '';
alter table market_items add column if not exists email text not null default '';
