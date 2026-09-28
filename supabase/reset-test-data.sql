-- ⚠️  ERASES ALL DATA: groups, students, classes, attendance, payments.
-- Use it ONCE, after testing and before loading the real data from the
-- paper sheets. Settings (due day, months without fees) and the login
-- accounts are kept.
--
-- Supabase → SQL Editor → paste → Run. There is no undo.

truncate payments, charges, absences, sessions, enrollments, students, group_prices, group_slots, groups
  restart identity;
