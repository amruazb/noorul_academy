create table if not exists public.student_progress (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete cascade,
  teacher text,
  examiner text,
  mark integer,
  notes text,
  juz_status jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists student_progress_student_id_key on public.student_progress (student_id);
