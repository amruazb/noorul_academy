alter table public.students enable row level security;
alter table public.student_progress enable row level security;

drop policy if exists "Authenticated read students" on public.students;
create policy "Authenticated read students"
on public.students
for select
to authenticated
using (true);

drop policy if exists "Authenticated insert students" on public.students;
create policy "Authenticated insert students"
on public.students
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated update students" on public.students;
create policy "Authenticated update students"
on public.students
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated read progress" on public.student_progress;
create policy "Authenticated read progress"
on public.student_progress
for select
to authenticated
using (true);

drop policy if exists "Authenticated write progress" on public.student_progress;
create policy "Authenticated write progress"
on public.student_progress
for all
to authenticated
using (true)
with check (true);
