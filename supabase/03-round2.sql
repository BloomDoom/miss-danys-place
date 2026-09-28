-- Round 2: Cuenta DNI, student contacts/birthdays/school, rewards,
-- Trinity exams, birthday message.
-- Run once in Supabase → SQL Editor (after schema.sql and 02-payments.sql).
-- Safe to run twice: everything checks whether it already exists.


-- ───────────────────────── Cuenta DNI as a payment method
alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash', 'transfer', 'mercado_pago', 'cuenta_dni'));


-- ───────────────────────── Students: birth date, school, contacts
alter table students add column if not exists birth_date date;
alter table students add column if not exists school text;

-- Any number of contacts per student (mum, dad, the student...).
-- The first one (lowest position) is used for WhatsApp messages.
create table if not exists student_contacts (
  id         bigint generated always as identity primary key,
  student_id bigint not null references students(id),
  name       text not null,
  phone      text,
  position   int not null default 1
);

-- Copy the old phone / parent fields into contacts (only for students
-- that don't have contacts yet). The old columns stay, unused.
insert into student_contacts (student_id, name, phone, position)
select s.id, s.name, s.phone, 1
from students s
where coalesce(s.phone, '') <> ''
  and not exists (select 1 from student_contacts c where c.student_id = s.id);

insert into student_contacts (student_id, name, phone, position)
select s.id, coalesce(nullif(s.guardian_name, ''), 'Parent'), s.guardian_phone, 2
from students s
where (coalesce(s.guardian_name, '') <> '' or coalesce(s.guardian_phone, '') <> '')
  and not exists (select 1 from student_contacts c where c.student_id = s.id and c.position = 2);


-- ───────────────────────── Rewards (stickers / badges)
create table if not exists reward_types (
  id         bigint generated always as identity primary key,
  emoji      text not null,
  name       text not null,
  active     boolean not null default true,  -- turned off instead of deleted
  created_at timestamptz not null default now()
);

create table if not exists rewards (
  id             bigint generated always as identity primary key,
  student_id     bigint not null references students(id),
  reward_type_id bigint not null references reward_types(id),
  given_on       date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz  -- Undo marks it instead of deleting
);


-- ───────────────────────── Trinity exams
create table if not exists trinity_exams (
  id         bigint generated always as identity primary key,
  student_id bigint not null references students(id),
  level      text,   -- e.g. 'GESE Grade 3', 'ISE I' (the list lives in the app)
  exam_date  date,
  result     text check (result in ('fail', 'pass', 'merit', 'distinction')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);


-- ───────────────────────── Birthday message (editable in Settings)
alter table settings add column if not exists birthday_message text not null
  default 'Happy birthday, {name}! 🎂 Wishing you a wonderful day full of joy. Love, Ms Dany';


-- ───────────────────────── Security, same rules as schema.sql
do $$
declare t text;
begin
  foreach t in array array['student_contacts', 'reward_types', 'rewards', 'trinity_exams']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "Logged-in user has full access" on %I', t);
    execute format('create policy "Logged-in user has full access" on %I
                    for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update on %I to authenticated', t);
  end loop;
end $$;

-- Contacts can really be deleted (they aren't history). Rewards and
-- exams use deleted_at; reward types use active = false.
grant delete on student_contacts to authenticated;
