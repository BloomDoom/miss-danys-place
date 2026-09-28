-- Miss Dany's Place: database schema
-- Run this once in Supabase → SQL Editor → New query → paste → Run.
--
-- Conventions:
--   * Money is stored as whole pesos (integer). No centavos.
--   * Months are stored as a date on the 1st (2026-03-01 = March 2026).
--   * Weekdays: 1 = Monday ... 7 = Sunday (ISO standard).
--   * Payments, charges and absences are never deleted: they get a
--     deleted_at timestamp instead ("soft delete"), so history survives.


-- ───────────────────────── Settings (always exactly one row)
create table settings (
  id          int primary key default 1 check (id = 1),
  due_day     int not null default 10 check (due_day between 1 and 28),
  skip_months int[] not null default '{}'  -- e.g. {1} = no charges in January
);
insert into settings (id) values (1);


-- ───────────────────────── Groups
create table groups (
  id         bigint generated always as identity primary key,
  name       text not null,
  level      text,
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- The fixed weekly times of each group ("Tuesday 18:00, 60 min").
create table group_slots (
  id           bigint generated always as identity primary key,
  group_id     bigint not null references groups(id),
  weekday      int not null check (weekday between 1 and 7),
  start_time   time not null,
  duration_min int not null default 60 check (duration_min > 0),
  active       boolean not null default true  -- turned off instead of deleted
);

-- Price history. The price for a month = the row with the latest
-- effective_month that is <= that month.
create table group_prices (
  id              bigint generated always as identity primary key,
  group_id        bigint not null references groups(id),
  amount          int not null check (amount >= 0),
  effective_month date not null check (extract(day from effective_month) = 1),
  unique (group_id, effective_month)
);


-- ───────────────────────── Students
create table students (
  id             bigint generated always as identity primary key,
  name           text not null,
  phone          text,
  guardian_name  text,
  guardian_phone text,
  notes          text,
  active         boolean not null default true,
  start_date     date not null default current_date,
  created_at     timestamptz not null default now()
);

-- Which group(s) a student is in. Leaving a group sets end_date, so
-- the history of who was in which group is kept.
create table enrollments (
  id         bigint generated always as identity primary key,
  student_id bigint not null references students(id),
  group_id   bigint not null references groups(id),
  start_date date not null default current_date,
  end_date   date
);


-- ───────────────────────── Sessions
-- Regular weekly classes are NOT stored in advance: the app calculates
-- them from group_slots. A row is saved here only when something happens
-- to a class: attendance saved, cancelled, moved, extra class, or a
-- make-up booked into it.
--   original_date = the week's regular date this class belongs to
--   date          = when it actually happens (differs if it was moved)
-- Extra (one-off) classes have slot_id and original_date = null.
create table sessions (
  id                  bigint generated always as identity primary key,
  group_id            bigint not null references groups(id),
  slot_id             bigint references group_slots(id),
  original_date       date,
  date                date not null,
  start_time          time not null,
  duration_min        int not null check (duration_min > 0),
  cancelled           boolean not null default false,
  note                text,
  attendance_saved_at timestamptz,
  created_at          timestamptz not null default now(),
  unique (slot_id, original_date)
);


-- ───────────────────────── Attendance + make-ups
-- Everyone is present unless there's a row here. The same row tracks
-- the make-up for that absence.
create table absences (
  id                bigint generated always as identity primary key,
  session_id        bigint not null references sessions(id),
  student_id        bigint not null references students(id),
  makeup_status     text not null default 'missed'
                    check (makeup_status in ('missed', 'scheduled', 'done', 'waived')),
  makeup_session_id bigint references sessions(id),
  note              text,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (session_id, student_id)
);


-- ───────────────────────── Payments
-- One charge per student, per group, per month. The amount is COPIED from
-- the price when the charge is created, so later price changes never
-- touch past months.
create table charges (
  id            bigint generated always as identity primary key,
  student_id    bigint not null references students(id),
  group_id      bigint not null references groups(id),
  month         date not null check (extract(day from month) = 1),
  amount        int not null check (amount >= 0),
  amount_edited boolean not null default false,  -- she changed it by hand
  note          text,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (student_id, group_id, month)
);

create table payments (
  id         bigint generated always as identity primary key,
  charge_id  bigint not null references charges(id),
  amount     int not null check (amount > 0),
  paid_on    date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  method     text not null check (method in ('cash', 'transfer', 'mercado_pago')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);


-- ───────────────────────── Security (Row Level Security)
-- Sign-ups are turned off in Supabase, so the only account that can log
-- in is the teacher's. Rule: logged-in users can do everything,
-- visitors who aren't logged in can't see or change anything.
do $$
declare t text;
begin
  foreach t in array array['settings', 'groups', 'group_slots', 'group_prices',
    'students', 'enrollments', 'sessions', 'absences', 'charges', 'payments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "Logged-in user has full access" on %I
                    for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update on %I to authenticated', t);
  end loop;
end $$;

-- Deleting is only allowed where it can't destroy history. Payments,
-- charges, absences and sessions have no delete permission at all, so
-- even a bug in the app can't erase them.
grant delete on groups, group_slots, group_prices, students, enrollments to authenticated;


-- ───────────────────────── Keep-alive
-- Supabase pauses free projects after 7 days without activity (e.g. the
-- January holidays). A GitHub Action calls this every few days.
create function ping() returns int language sql as 'select 1';
grant execute on function ping() to anon;
