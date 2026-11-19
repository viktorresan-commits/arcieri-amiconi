-- Niente rosa fittizia: restano solo gli account davvero registrati.
update members
set status = 'active',
    role = case when role = 'viewer' then 'archer' else role end
where user_id is not null;

delete from members where user_id is null;

create table if not exists piazzole (
  id serial primary key,
  competition_id int not null references competitions (id) on delete cascade,
  user_id text not null,
  n int not null check (n between 1 and 40),
  score int not null,
  unique (competition_id, user_id, n)
);

-- Campionato invernale FITAST 2026/2027, letto dal portale pubblico (niente API).
-- notes = codice gara, per non duplicare se la migrazione riparte.
insert into competitions (name, starts_on, place, organizer, kind, external_url, notes, created_by)
select v.name, v.starts_on::date, v.place, v.organizer, 'Camp. invernale FITAST 2026/2027',
  'http://89.46.73.21/FITAST_WEB/IT/pagView-GARE.awp', v.code, 'fitast'
from (values
  ('20 anni · Arcieri Fabriano', '2026-10-25', 'Fabriano', 'Arcieri Fabriano', 'fitast:2483'),
  ('Gara invernale · Arcieri Fabriano', '2026-11-15', 'Fabriano', 'Arcieri Fabriano', 'fitast:2472'),
  ('Gara invernale · La Fenice', '2026-11-22', '', 'Polisportiva "La Fenice"', 'fitast:2473'),
  ('Gara invernale · Grottazzolina', '2026-11-29', 'Grottazzolina', 'Arcieri di Grottazzolina', 'fitast:2474'),
  ('Gara invernale · Castello di Enna', '2026-11-29', 'Enna', 'Compagnia Arcieri del Castello di Enna', 'fitast:2487'),
  ('Gara invernale · Ripa Cerreto', '2026-12-13', 'Ripa Cerreto', 'Arcieri Storici Ripa Cerreto A.S.D.', 'fitast:2475'),
  ('Gara invernale · Montalbano Elicona', '2026-12-13', 'Montalbano Elicona', 'A.M.A.L.A.C di Montalbano Elicona', 'fitast:2488'),
  ('Gara invernale · Arcus Tuder', '2026-12-27', '', 'A.s.d. Arcus Tuder', 'fitast:2486'),
  ('Gara invernale · Belforte', '2027-01-10', 'Belforte', 'Arcieri Storici Belforte', 'fitast:2476'),
  ('Gara invernale · Spinetoli-Pagliare', '2027-01-17', 'Spinetoli', 'Arcieri Storici Avis Spinetoli-Pagliare', 'fitast:2477'),
  ('Gara invernale · Castrum Collis Palumbi', '2027-01-24', '', 'Castrum Collis Palumbi A.S.D.', 'fitast:2485'),
  ('Gara invernale · San Marco', '2027-01-24', '', 'Compagnia ASD Arcieri San Marco', 'fitast:2490'),
  ('Gara invernale · Fano', '2027-01-31', 'Fano', 'Compagnia Malatestiana del Liocorno Arcieri di Fano', 'fitast:2484'),
  ('Gara invernale · Castrum Collis Palumbi', '2027-02-07', '', 'Castrum Collis Palumbi A.S.D.', 'fitast:2478'),
  ('Gara invernale · San Severino Marche', '2027-02-14', 'San Severino Marche', 'Arcieri Palio dei Castelli San Severino Marche', 'fitast:2479'),
  ('Gara invernale · Arcieri de Varano', '2027-02-21', '', 'A.S.D. "Arcieri de Varano"', 'fitast:2480'),
  ('Gara invernale · Katabba', '2027-02-21', '', 'Compagnia A.S.D. Arcieri della Katabba', 'fitast:2491'),
  ('Gara invernale · Cagli', '2027-02-28', 'Cagli', 'Compagnia Arcieri dell''Oca di Cagli', 'fitast:2482'),
  ('Finale invernale · Castrum Fossati', '2027-03-07', '', 'Arcieri Storici Castrum Fossati', 'fitast:2481')
) as v(name, starts_on, place, organizer, code)
where not exists (select 1 from competitions c where c.notes = v.code);
