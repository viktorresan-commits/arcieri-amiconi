-- Allenamenti mai salvati: prima l'app li scriveva da sola appena si apriva il segnapunti dal vivo.
-- Con il consenso del fondatore si tolgono quelli rimasti vuoti: mai chiusi, nessuna freccia, nessuna nota e nessun voto.
-- Quelli con delle frecce restano: si possono togliere a mano dal calendario.
delete from sessions s
where s.ended_at is null
  and s.notes = ''
  and s.rating is null
  and not exists (select 1 from shots x where x.session_id = s.id);
