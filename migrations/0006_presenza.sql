create table if not exists competition_presence (
  competition_id int not null references competitions (id) on delete cascade,
  user_id text not null,
  attended boolean not null,
  primary key (competition_id, user_id)
);
