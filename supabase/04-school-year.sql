-- School year for students: a number 1–7 plus "grade" (primaria, grado)
-- or "year" (secundaria, año). Shown as "Grade 3" / "Year 2".
-- The student's own phone uses the existing students.phone column.
-- Run once in Supabase → SQL Editor (after 03-round2.sql). Safe to run twice.

alter table students add column if not exists school_year smallint
  check (school_year between 1 and 7);
alter table students add column if not exists school_year_type text
  check (school_year_type in ('grade', 'year'));
