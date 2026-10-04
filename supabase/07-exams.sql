-- Round 3: exams are created first (one level, one date and time), and
-- then students are added to them. Each student keeps their own result
-- in trinity_exams, which now points to its exam.
-- Run once in Supabase → SQL Editor (after 03-round2.sql).
-- Safe to run twice: everything checks whether it already exists.


create table if not exists exams (
  id         bigint generated always as identity primary key,
  level      text not null,   -- e.g. 'GESE Grade 3' (the list lives in the app)
  exam_date  date not null,
  exam_time  time,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table trinity_exams add column if not exists exam_id bigint references exams(id);


-- Exams saved before this: one exam per level + date, and link them.
-- Entries without a level or date stay unlinked ("Not in an exam yet").
insert into exams (level, exam_date)
select distinct t.level, t.exam_date
from trinity_exams t
where t.exam_id is null and t.deleted_at is null and t.level is not null and t.exam_date is not null
  and not exists (select 1 from exams e where e.level = t.level and e.exam_date = t.exam_date and e.deleted_at is null);

update trinity_exams t set exam_id = e.id
from exams e
where t.exam_id is null and e.deleted_at is null and e.level = t.level and e.exam_date = t.exam_date;


-- ───────────────────────── Security, same rules as schema.sql
alter table exams enable row level security;
drop policy if exists "Logged-in user has full access" on exams;
create policy "Logged-in user has full access" on exams
  for all to authenticated using (true) with check (true);
grant select, insert, update on exams to authenticated;
