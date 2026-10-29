-- Strava import + ride calories in the allowance (migration v2).
alter table public.cycling_sessions
  add column source text not null default 'manual' check (source in ('manual', 'strava')),
  add column external_id text,
  add column avg_hr numeric;
create unique index cycling_sessions_external_idx on public.cycling_sessions (user_id, external_id) where external_id is not null;

alter table public.user_settings
  add column count_ride_kcal boolean not null default true,
  add column ride_kcal_source text not null default 'strava' check (ride_kcal_source in ('strava', 'all')),
  add column ride_kcal_share numeric not null default 100 check (ride_kcal_share between 0 and 100);
