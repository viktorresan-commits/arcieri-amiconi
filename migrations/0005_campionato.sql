alter table competition_entries add column if not exists lane_count int;
alter table competition_entries add column if not exists spot int;
alter table competition_entries add column if not exists championship_points int;
