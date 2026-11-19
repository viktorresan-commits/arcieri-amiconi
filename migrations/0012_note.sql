alter table piazzole add column if not exists note text not null default '';
alter table piazzole add column if not exists note_done boolean not null default false;
alter table equipment add column if not exists note_done boolean not null default false;
alter table sessions add column if not exists note_done boolean not null default false;
