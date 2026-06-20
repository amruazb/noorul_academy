create table if not exists public.daily_progress (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete cascade,
  progress_date date not null,
  attendance boolean not null default true,
  ayats_learned integer not null default 0,
  new_dars_practice boolean not null default false,
  juz_dars_practice boolean not null default false,
  old_dars_practice boolean not null default false,
  current_juz integer,
  target_lines integer,
  achieved_lines integer,
  performance text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_progress_student_date_key
  on public.daily_progress (student_id, progress_date);

create index if not exists daily_progress_date_idx on public.daily_progress (progress_date);

alter table public.daily_progress enable row level security;

drop policy if exists "Authenticated read daily progress" on public.daily_progress;
create policy "Authenticated read daily progress"
on public.daily_progress
for select
to authenticated
using (true);

drop policy if exists "Authenticated insert daily progress" on public.daily_progress;
create policy "Authenticated insert daily progress"
on public.daily_progress
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated update daily progress" on public.daily_progress;
create policy "Authenticated update daily progress"
on public.daily_progress
for update
to authenticated
using (true);
