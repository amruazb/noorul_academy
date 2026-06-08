create table if not exists public.students (
  id bigint generated always as identity primary key,
  name text not null,
  gender text not null,
  age integer,
  class_name text,
  course text not null,
  teacher text,
  phone text,
  notes text,
  status text not null default 'Active',
  enrolled_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists students_course_idx on public.students (course);
create index if not exists students_name_idx on public.students (name);
