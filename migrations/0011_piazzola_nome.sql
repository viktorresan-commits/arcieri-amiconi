alter table piazzole add column if not exists label text not null default '';
alter table piazzole add column if not exists distance_m double precision;
