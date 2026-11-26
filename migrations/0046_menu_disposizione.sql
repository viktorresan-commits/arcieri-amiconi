-- Impostazioni dell'app uguali per tutti (per ora: la disposizione delle voci nei menu, scelta dal fondatore)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
