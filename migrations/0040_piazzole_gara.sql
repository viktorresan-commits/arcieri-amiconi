-- Numero di piazzole di una gara (nel 3D FITAST di solito 20, 3 frecce a piazzola):
-- serve a contare frecce e media di chi non ha ancora inserito il cartellino.
alter table competitions add column if not exists lanes int;

-- La gara del 25 ottobre 2026 (20 anni della Compagnia Arcieri Fabriano) era da 14 piazzole.
update competitions set lanes = 14 where lanes is null and starts_on = '2026-10-25';
