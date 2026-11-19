alter table sessions add column if not exists program text not null default '';
alter table sessions add column if not exists body text not null default '';
alter table sessions add column if not exists dispersion text not null default '';
alter table sessions add column if not exists tech_errors text not null default '';
alter table sessions add column if not exists target_photo text not null default '';
