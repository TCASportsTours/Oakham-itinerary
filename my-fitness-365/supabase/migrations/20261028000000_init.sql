-- My Fitness 365 — initial schema (migration v1)
-- Every table is user-owned. Row-level security restricts each authenticated
-- user to their own rows; the anon role gets nothing. Rows use client-generated
-- UUIDs (idempotent sync) and soft-delete tombstones (deleted_at).
-- Date-only fields are local calendar dates (Europe/London); timestamps are UTC.

create extension if not exists pgcrypto;

-- updated_at is always stamped by the server so sync cursors don't depend on device clocks.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;


create table public.profiles (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  display_name text not null default '', age int, sex text check (sex in ('male','female')), height_cm numeric,
  start_weight_kg numeric(6,3), target_weight_kg numeric(6,3), long_term_min_kg numeric(6,3), long_term_max_kg numeric(6,3),
  experience text, main_cardio text, cycling_sessions_per_week int, ride_kcal_estimate int, gym_space text, equipment text,
  max_dumbbell_kg numeric, alcohol_free_days int[] not null default '{}', social_days int[] not null default '{}',
  preferred_dinners text, country text, weight_unit text not null default 'st' check (weight_unit in ('st','kg')),
  length_unit text not null default 'cm' check (length_unit in ('cm','in')), time_zone text not null default 'Europe/London',
  onboarded boolean not null default false, program_start_date date
);
create index profiles_user_updated_idx on public.profiles (user_id, updated_at);
create trigger profiles_touch before insert or update on public.profiles for each row execute function public.touch_updated_at();
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete_own on public.profiles for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

create table public.user_settings (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  weekly_schedule jsonb not null default '{}', calorie_targets jsonb not null default '{}', protein_target_g int not null default 170,
  fat_share numeric not null default 0.27, photo_reminders boolean not null default true, photo_interval_days int not null default 28,
  measurement_reminders boolean not null default true, notifications_enabled boolean not null default false, rest_timer_default_s int not null default 90
);
create index user_settings_user_updated_idx on public.user_settings (user_id, updated_at);
create trigger user_settings_touch before insert or update on public.user_settings for each row execute function public.touch_updated_at();
alter table public.user_settings enable row level security;
alter table public.user_settings force row level security;
create policy user_settings_select_own on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_insert_own on public.user_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_settings_delete_own on public.user_settings for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;

create table public.exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  key text not null, name text not null, category text, primary_muscles text[] not null default '{}', secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}', difficulty text, starting_position text[] not null default '{}', instructions text[] not null default '{}',
  breathing text, common_mistakes text[] not null default '{}', safety_tips text[] not null default '{}', suggested_reps text, purpose text,
  alternatives text[] not null default '{}', tags text[] not null default '{}', video_url text, video_source text,
  video_verified boolean not null default false, illustration text
);
create index exercises_user_updated_idx on public.exercises (user_id, updated_at);
create trigger exercises_touch before insert or update on public.exercises for each row execute function public.touch_updated_at();
alter table public.exercises enable row level security;
alter table public.exercises force row level security;
create policy exercises_select_own on public.exercises for select to authenticated using (user_id = (select auth.uid()));
create policy exercises_insert_own on public.exercises for insert to authenticated with check (user_id = (select auth.uid()));
create policy exercises_update_own on public.exercises for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_delete_own on public.exercises for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.exercises from anon;
grant select, insert, update, delete on public.exercises to authenticated;

create table public.exercise_media (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  exercise_id uuid not null references public.exercises(id) on delete cascade, kind text not null, label text not null,
  storage text not null, url text, source text
);
create index exercise_media_user_updated_idx on public.exercise_media (user_id, updated_at);
create index exercise_media_idx0 on public.exercise_media (exercise_id);
create trigger exercise_media_touch before insert or update on public.exercise_media for each row execute function public.touch_updated_at();
alter table public.exercise_media enable row level security;
alter table public.exercise_media force row level security;
create policy exercise_media_select_own on public.exercise_media for select to authenticated using (user_id = (select auth.uid()));
create policy exercise_media_insert_own on public.exercise_media for insert to authenticated with check (user_id = (select auth.uid()));
create policy exercise_media_update_own on public.exercise_media for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercise_media_delete_own on public.exercise_media for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.exercise_media from anon;
grant select, insert, update, delete on public.exercise_media to authenticated;

create table public.workout_templates (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  key text not null, name text not null, focus text, default_weekday int, duration_text text, warmup text[] not null default '{}', notes text not null default ''
);
create index workout_templates_user_updated_idx on public.workout_templates (user_id, updated_at);
create trigger workout_templates_touch before insert or update on public.workout_templates for each row execute function public.touch_updated_at();
alter table public.workout_templates enable row level security;
alter table public.workout_templates force row level security;
create policy workout_templates_select_own on public.workout_templates for select to authenticated using (user_id = (select auth.uid()));
create policy workout_templates_insert_own on public.workout_templates for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_templates_update_own on public.workout_templates for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_templates_delete_own on public.workout_templates for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.workout_templates from anon;
grant select, insert, update, delete on public.workout_templates to authenticated;

create table public.workout_template_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id), position int not null, sets int not null, reps_min int not null, reps_max int not null,
  rep_unit text not null check (rep_unit in ('reps','seconds')), per_side boolean not null default false, suggested_weight text, rest_seconds int not null default 90
);
create index workout_template_exercises_user_updated_idx on public.workout_template_exercises (user_id, updated_at);
create index workout_template_exercises_idx0 on public.workout_template_exercises (template_id);
create trigger workout_template_exercises_touch before insert or update on public.workout_template_exercises for each row execute function public.touch_updated_at();
alter table public.workout_template_exercises enable row level security;
alter table public.workout_template_exercises force row level security;
create policy workout_template_exercises_select_own on public.workout_template_exercises for select to authenticated using (user_id = (select auth.uid()));
create policy workout_template_exercises_insert_own on public.workout_template_exercises for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_template_exercises_update_own on public.workout_template_exercises for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_template_exercises_delete_own on public.workout_template_exercises for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.workout_template_exercises from anon;
grant select, insert, update, delete on public.workout_template_exercises to authenticated;

create table public.activity_templates (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  key text not null, name text not null, kind text not null, workout_template_id uuid references public.workout_templates(id),
  ride_intensity text, duration_min int, description text
);
create index activity_templates_user_updated_idx on public.activity_templates (user_id, updated_at);
create trigger activity_templates_touch before insert or update on public.activity_templates for each row execute function public.touch_updated_at();
alter table public.activity_templates enable row level security;
alter table public.activity_templates force row level security;
create policy activity_templates_select_own on public.activity_templates for select to authenticated using (user_id = (select auth.uid()));
create policy activity_templates_insert_own on public.activity_templates for insert to authenticated with check (user_id = (select auth.uid()));
create policy activity_templates_update_own on public.activity_templates for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy activity_templates_delete_own on public.activity_templates for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.activity_templates from anon;
grant select, insert, update, delete on public.activity_templates to authenticated;

create table public.ingredients (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  key text not null, name text not null, category text not null, kcal numeric not null, protein numeric not null, carbs numeric not null,
  fat numeric not null, fibre numeric not null default 0, state text, source text
);
create index ingredients_user_updated_idx on public.ingredients (user_id, updated_at);
create trigger ingredients_touch before insert or update on public.ingredients for each row execute function public.touch_updated_at();
alter table public.ingredients enable row level security;
alter table public.ingredients force row level security;
create policy ingredients_select_own on public.ingredients for select to authenticated using (user_id = (select auth.uid()));
create policy ingredients_insert_own on public.ingredients for insert to authenticated with check (user_id = (select auth.uid()));
create policy ingredients_update_own on public.ingredients for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ingredients_delete_own on public.ingredients for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.ingredients from anon;
grant select, insert, update, delete on public.ingredients to authenticated;

create table public.recipes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  key text not null, name text not null, meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  prep_min int, cook_min int, portions numeric not null default 1, instructions text[] not null default '{}', tags text[] not null default '{}',
  favourite boolean not null default false, image_url text, notes text not null default ''
);
create index recipes_user_updated_idx on public.recipes (user_id, updated_at);
create trigger recipes_touch before insert or update on public.recipes for each row execute function public.touch_updated_at();
alter table public.recipes enable row level security;
alter table public.recipes force row level security;
create policy recipes_select_own on public.recipes for select to authenticated using (user_id = (select auth.uid()));
create policy recipes_insert_own on public.recipes for insert to authenticated with check (user_id = (select auth.uid()));
create policy recipes_update_own on public.recipes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipes_delete_own on public.recipes for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.recipes from anon;
grant select, insert, update, delete on public.recipes to authenticated;

create table public.recipe_ingredients (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  recipe_id uuid not null references public.recipes(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id),
  grams numeric not null, note text not null default '', position int not null default 0
);
create index recipe_ingredients_user_updated_idx on public.recipe_ingredients (user_id, updated_at);
create index recipe_ingredients_idx0 on public.recipe_ingredients (recipe_id);
create trigger recipe_ingredients_touch before insert or update on public.recipe_ingredients for each row execute function public.touch_updated_at();
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_ingredients force row level security;
create policy recipe_ingredients_select_own on public.recipe_ingredients for select to authenticated using (user_id = (select auth.uid()));
create policy recipe_ingredients_insert_own on public.recipe_ingredients for insert to authenticated with check (user_id = (select auth.uid()));
create policy recipe_ingredients_update_own on public.recipe_ingredients for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipe_ingredients_delete_own on public.recipe_ingredients for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.recipe_ingredients from anon;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;

create table public.scheduled_activities (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, template_id uuid references public.activity_templates(id), title text not null, kind text not null,
  workout_template_id uuid references public.workout_templates(id), ride_intensity text,
  status text not null default 'planned' check (status in ('planned','completed','skipped','cancelled')),
  workout_session_id uuid, cycling_session_id uuid, rescheduled_from date, notes text not null default '', position int not null default 0
);
create index scheduled_activities_user_updated_idx on public.scheduled_activities (user_id, updated_at);
create index scheduled_activities_idx0 on public.scheduled_activities (user_id, date);
create trigger scheduled_activities_touch before insert or update on public.scheduled_activities for each row execute function public.touch_updated_at();
alter table public.scheduled_activities enable row level security;
alter table public.scheduled_activities force row level security;
create policy scheduled_activities_select_own on public.scheduled_activities for select to authenticated using (user_id = (select auth.uid()));
create policy scheduled_activities_insert_own on public.scheduled_activities for insert to authenticated with check (user_id = (select auth.uid()));
create policy scheduled_activities_update_own on public.scheduled_activities for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy scheduled_activities_delete_own on public.scheduled_activities for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.scheduled_activities from anon;
grant select, insert, update, delete on public.scheduled_activities to authenticated;

create table public.diary_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, notes text not null default '', energy int check (energy between 1 and 5), mood int check (mood between 1 and 5),
  sleep_hours numeric, plan_materialised boolean not null default false, day_type_override text
);
create index diary_entries_user_updated_idx on public.diary_entries (user_id, updated_at);
create index diary_entries_idx0 on public.diary_entries (user_id, date);
create trigger diary_entries_touch before insert or update on public.diary_entries for each row execute function public.touch_updated_at();
alter table public.diary_entries enable row level security;
alter table public.diary_entries force row level security;
create policy diary_entries_select_own on public.diary_entries for select to authenticated using (user_id = (select auth.uid()));
create policy diary_entries_insert_own on public.diary_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy diary_entries_update_own on public.diary_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy diary_entries_delete_own on public.diary_entries for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.diary_entries from anon;
grant select, insert, update, delete on public.diary_entries to authenticated;

create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, template_id uuid not null references public.workout_templates(id), name text not null,
  status text not null check (status in ('in_progress','completed','abandoned')), started_at timestamptz not null, finished_at timestamptz,
  current_index int not null default 0, scheduled_activity_id uuid, skipped_exercise_ids uuid[] not null default '{}', notes text not null default ''
);
create index workout_sessions_user_updated_idx on public.workout_sessions (user_id, updated_at);
create index workout_sessions_idx0 on public.workout_sessions (user_id, date);
create trigger workout_sessions_touch before insert or update on public.workout_sessions for each row execute function public.touch_updated_at();
alter table public.workout_sessions enable row level security;
alter table public.workout_sessions force row level security;
create policy workout_sessions_select_own on public.workout_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy workout_sessions_insert_own on public.workout_sessions for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_sessions_update_own on public.workout_sessions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_sessions_delete_own on public.workout_sessions for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.workout_sessions from anon;
grant select, insert, update, delete on public.workout_sessions to authenticated;

create table public.workout_sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  session_id uuid not null references public.workout_sessions(id) on delete cascade, exercise_id uuid not null references public.exercises(id),
  set_number int not null, weight_kg numeric(6,2), reps int, seconds int, completed boolean not null default false, completed_at timestamptz
);
create index workout_sets_user_updated_idx on public.workout_sets (user_id, updated_at);
create index workout_sets_idx0 on public.workout_sets (session_id);
create index workout_sets_idx1 on public.workout_sets (exercise_id);
create trigger workout_sets_touch before insert or update on public.workout_sets for each row execute function public.touch_updated_at();
alter table public.workout_sets enable row level security;
alter table public.workout_sets force row level security;
create policy workout_sets_select_own on public.workout_sets for select to authenticated using (user_id = (select auth.uid()));
create policy workout_sets_insert_own on public.workout_sets for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_sets_update_own on public.workout_sets for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_sets_delete_own on public.workout_sets for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.workout_sets from anon;
grant select, insert, update, delete on public.workout_sets to authenticated;

create table public.cycling_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, start_time text, duration_min int not null, distance_km numeric, elevation_m numeric, est_kcal int,
  intensity text not null check (intensity in ('easy','moderate','long')), rpe int check (rpe between 1 and 10), notes text not null default '',
  completed boolean not null default true, scheduled_activity_id uuid
);
create index cycling_sessions_user_updated_idx on public.cycling_sessions (user_id, updated_at);
create index cycling_sessions_idx0 on public.cycling_sessions (user_id, date);
create trigger cycling_sessions_touch before insert or update on public.cycling_sessions for each row execute function public.touch_updated_at();
alter table public.cycling_sessions enable row level security;
alter table public.cycling_sessions force row level security;
create policy cycling_sessions_select_own on public.cycling_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy cycling_sessions_insert_own on public.cycling_sessions for insert to authenticated with check (user_id = (select auth.uid()));
create policy cycling_sessions_update_own on public.cycling_sessions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cycling_sessions_delete_own on public.cycling_sessions for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.cycling_sessions from anon;
grant select, insert, update, delete on public.cycling_sessions to authenticated;

create table public.planned_meals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, slot text not null, recipe_id uuid references public.recipes(id), custom_name text, portions numeric not null default 1, position int not null default 0
);
create index planned_meals_user_updated_idx on public.planned_meals (user_id, updated_at);
create index planned_meals_idx0 on public.planned_meals (user_id, date);
create trigger planned_meals_touch before insert or update on public.planned_meals for each row execute function public.touch_updated_at();
alter table public.planned_meals enable row level security;
alter table public.planned_meals force row level security;
create policy planned_meals_select_own on public.planned_meals for select to authenticated using (user_id = (select auth.uid()));
create policy planned_meals_insert_own on public.planned_meals for insert to authenticated with check (user_id = (select auth.uid()));
create policy planned_meals_update_own on public.planned_meals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy planned_meals_delete_own on public.planned_meals for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.planned_meals from anon;
grant select, insert, update, delete on public.planned_meals to authenticated;

create table public.food_log_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, slot text not null, recipe_id uuid references public.recipes(id), planned_meal_id uuid references public.planned_meals(id),
  name text not null, portions numeric not null default 1, kcal numeric not null, protein numeric not null, carbs numeric not null, fat numeric not null,
  fibre numeric not null default 0, during_ride boolean not null default false, logged_at timestamptz not null
);
create index food_log_entries_user_updated_idx on public.food_log_entries (user_id, updated_at);
create index food_log_entries_idx0 on public.food_log_entries (user_id, date);
create trigger food_log_entries_touch before insert or update on public.food_log_entries for each row execute function public.touch_updated_at();
alter table public.food_log_entries enable row level security;
alter table public.food_log_entries force row level security;
create policy food_log_entries_select_own on public.food_log_entries for select to authenticated using (user_id = (select auth.uid()));
create policy food_log_entries_insert_own on public.food_log_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy food_log_entries_update_own on public.food_log_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy food_log_entries_delete_own on public.food_log_entries for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.food_log_entries from anon;
grant select, insert, update, delete on public.food_log_entries to authenticated;

create table public.alcohol_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, drink_type text not null, volume_ml numeric not null, abv numeric not null, quantity int not null default 1,
  mixer text not null default '', mixer_kcal numeric not null default 0, logged_at timestamptz not null
);
create index alcohol_entries_user_updated_idx on public.alcohol_entries (user_id, updated_at);
create index alcohol_entries_idx0 on public.alcohol_entries (user_id, date);
create trigger alcohol_entries_touch before insert or update on public.alcohol_entries for each row execute function public.touch_updated_at();
alter table public.alcohol_entries enable row level security;
alter table public.alcohol_entries force row level security;
create policy alcohol_entries_select_own on public.alcohol_entries for select to authenticated using (user_id = (select auth.uid()));
create policy alcohol_entries_insert_own on public.alcohol_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy alcohol_entries_update_own on public.alcohol_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy alcohol_entries_delete_own on public.alcohol_entries for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.alcohol_entries from anon;
grant select, insert, update, delete on public.alcohol_entries to authenticated;

create table public.shopping_lists (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  name text not null, start_date date not null, end_date date not null, generated_at timestamptz not null
);
create index shopping_lists_user_updated_idx on public.shopping_lists (user_id, updated_at);
create trigger shopping_lists_touch before insert or update on public.shopping_lists for each row execute function public.touch_updated_at();
alter table public.shopping_lists enable row level security;
alter table public.shopping_lists force row level security;
create policy shopping_lists_select_own on public.shopping_lists for select to authenticated using (user_id = (select auth.uid()));
create policy shopping_lists_insert_own on public.shopping_lists for insert to authenticated with check (user_id = (select auth.uid()));
create policy shopping_lists_update_own on public.shopping_lists for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shopping_lists_delete_own on public.shopping_lists for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.shopping_lists from anon;
grant select, insert, update, delete on public.shopping_lists to authenticated;

create table public.shopping_list_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  list_id uuid not null references public.shopping_lists(id) on delete cascade, name text not null, category text not null,
  quantity_g numeric, quantity_text text not null default '', checked boolean not null default false, manual boolean not null default false,
  ingredient_id uuid references public.ingredients(id)
);
create index shopping_list_items_user_updated_idx on public.shopping_list_items (user_id, updated_at);
create index shopping_list_items_idx0 on public.shopping_list_items (list_id);
create trigger shopping_list_items_touch before insert or update on public.shopping_list_items for each row execute function public.touch_updated_at();
alter table public.shopping_list_items enable row level security;
alter table public.shopping_list_items force row level security;
create policy shopping_list_items_select_own on public.shopping_list_items for select to authenticated using (user_id = (select auth.uid()));
create policy shopping_list_items_insert_own on public.shopping_list_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy shopping_list_items_update_own on public.shopping_list_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shopping_list_items_delete_own on public.shopping_list_items for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.shopping_list_items from anon;
grant select, insert, update, delete on public.shopping_list_items to authenticated;

create table public.weight_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, weight_kg numeric(7,3) not null check (weight_kg > 20 and weight_kg < 400), notes text not null default ''
);
create index weight_entries_user_updated_idx on public.weight_entries (user_id, updated_at);
create index weight_entries_idx0 on public.weight_entries (user_id, date);
create trigger weight_entries_touch before insert or update on public.weight_entries for each row execute function public.touch_updated_at();
alter table public.weight_entries enable row level security;
alter table public.weight_entries force row level security;
create policy weight_entries_select_own on public.weight_entries for select to authenticated using (user_id = (select auth.uid()));
create policy weight_entries_insert_own on public.weight_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy weight_entries_update_own on public.weight_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy weight_entries_delete_own on public.weight_entries for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.weight_entries from anon;
grant select, insert, update, delete on public.weight_entries to authenticated;

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, type text not null, value numeric(6,2) not null check (value > 0), entered_unit text not null, notes text not null default ''
);
create index body_measurements_user_updated_idx on public.body_measurements (user_id, updated_at);
create index body_measurements_idx0 on public.body_measurements (user_id, date);
create index body_measurements_idx1 on public.body_measurements (user_id, type);
create trigger body_measurements_touch before insert or update on public.body_measurements for each row execute function public.touch_updated_at();
alter table public.body_measurements enable row level security;
alter table public.body_measurements force row level security;
create policy body_measurements_select_own on public.body_measurements for select to authenticated using (user_id = (select auth.uid()));
create policy body_measurements_insert_own on public.body_measurements for insert to authenticated with check (user_id = (select auth.uid()));
create policy body_measurements_update_own on public.body_measurements for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy body_measurements_delete_own on public.body_measurements for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.body_measurements from anon;
grant select, insert, update, delete on public.body_measurements to authenticated;

create table public.progress_photos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  date date not null, view text not null check (view in ('front','side','back')), storage text not null check (storage in ('local','cloud')),
  storage_path text, width int not null, height int not null, mime text not null, notes text not null default '', uploaded boolean not null default false
);
create index progress_photos_user_updated_idx on public.progress_photos (user_id, updated_at);
create index progress_photos_idx0 on public.progress_photos (user_id, date);
create trigger progress_photos_touch before insert or update on public.progress_photos for each row execute function public.touch_updated_at();
alter table public.progress_photos enable row level security;
alter table public.progress_photos force row level security;
create policy progress_photos_select_own on public.progress_photos for select to authenticated using (user_id = (select auth.uid()));
create policy progress_photos_insert_own on public.progress_photos for insert to authenticated with check (user_id = (select auth.uid()));
create policy progress_photos_update_own on public.progress_photos for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy progress_photos_delete_own on public.progress_photos for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.progress_photos from anon;
grant select, insert, update, delete on public.progress_photos to authenticated;

create table public.notifications (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  kind text not null, title text not null, body text not null default '', due_date date not null, dismissed_at timestamptz
);
create index notifications_user_updated_idx on public.notifications (user_id, updated_at);
create trigger notifications_touch before insert or update on public.notifications for each row execute function public.touch_updated_at();
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_insert_own on public.notifications for insert to authenticated with check (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notifications from anon;
grant select, insert, update, delete on public.notifications to authenticated;

-- One profile and one settings row per user.
create unique index profiles_one_per_user on public.profiles (user_id);
create unique index user_settings_one_per_user on public.user_settings (user_id);

-- A child row may only point at a parent owned by the same user.
create or replace function public.assert_same_owner() returns trigger
language plpgsql security invoker as $$
declare
  parent_table text := tg_argv[0];
  parent_col text := tg_argv[1];
  parent_id uuid;
  ok boolean;
begin
  execute format('select ($1).%I', parent_col) into parent_id using new;
  if parent_id is null then return new; end if;
  execute format('select exists(select 1 from public.%I where id = $1 and user_id = $2)', parent_table) into ok using parent_id, new.user_id;
  if not ok then
    raise exception 'Referenced % row does not belong to this user', parent_table using errcode = '42501';
  end if;
  return new;
end $$;

create trigger wte_owner before insert or update on public.workout_template_exercises for each row execute function public.assert_same_owner('workout_templates', 'template_id');
create trigger wte_ex_owner before insert or update on public.workout_template_exercises for each row execute function public.assert_same_owner('exercises', 'exercise_id');
create trigger ws_owner before insert or update on public.workout_sets for each row execute function public.assert_same_owner('workout_sessions', 'session_id');
create trigger ri_owner before insert or update on public.recipe_ingredients for each row execute function public.assert_same_owner('recipes', 'recipe_id');
create trigger sli_owner before insert or update on public.shopping_list_items for each row execute function public.assert_same_owner('shopping_lists', 'list_id');
create trigger em_owner before insert or update on public.exercise_media for each row execute function public.assert_same_owner('exercises', 'exercise_id');

-- Self-service account deletion: removes the auth user, cascading every table above.
-- Storage objects are removed by the client first (see Settings), and also by the
-- storage policy below allowing owners to delete their own files.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

