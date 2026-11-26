-- Mercatino: un codice per condividere l'anteprima dell'annuncio fuori dall'app (WhatsApp, Facebook, Instagram, e-mail).
-- La pagina pubblica mostra solo l'oggetto (foto, prezzo, stato, luogo), mai chi vende né i suoi contatti.
alter table market_items add column if not exists share_token text;
create unique index if not exists market_items_share_token on market_items (share_token) where share_token is not null;
