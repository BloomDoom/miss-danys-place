-- Girl or boy, so names show in pink or blue like on the paper sheets.
-- 'f' = girl, 'm' = boy, empty = not set (the name stays the normal color).
-- Run once in Supabase → SQL Editor (after 04-school-year.sql). Safe to run twice.
--
-- Set each student's value in the app (Edit details → Girl / Boy), or in
-- bulk here. Never put student names in this file: the repo is public.

alter table students add column if not exists sex text
  check (sex in ('f', 'm'));
