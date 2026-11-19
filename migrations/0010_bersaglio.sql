alter table competition_entries add column if not exists target_kind text not null default '';
alter table competition_entries add column if not exists sagoma_max int;
alter table sessions add column if not exists aim_target text not null default '';
alter table sessions add column if not exists aim_angle text not null default '';
