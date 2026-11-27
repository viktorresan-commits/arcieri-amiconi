-- File riservati al Fondatore: per ora le animazioni da arco della pagina nascosta "Prova 3D".
-- Le carica lui dalla pagina stessa; non stanno nel codice perché la loro licenza non ne permette la diffusione.
create table if not exists founder_files (
  name text primary key,
  body text not null,
  updated_at timestamptz not null default now()
);
