-- Sconto ricevuto sullo scontrino (in centesimi): le righe sono salvate già scontate,
-- qui resta quanto si è risparmiato in tutto.
alter table receipts add column if not exists discount_cents int;
