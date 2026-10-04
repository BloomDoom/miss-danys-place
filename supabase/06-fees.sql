-- Round 3: one monthly fee for the whole school (not per group),
-- a lower price for siblings, becas (scholarships, a % off) and the
-- materials fee in April.
-- Run once in Supabase → SQL Editor (after 05-student-sex.sql).
-- Safe to run twice: everything checks whether it already exists.
--
-- What a student pays each month:
--   regular fee, or the sibling fee if a brother or sister also comes,
--   minus their beca %.
--   In April there's a second charge, "Materials", of the full regular fee.
--
-- Months before the school fee starts (October 2026) keep their old
-- charges exactly as they are. Group prices (group_prices) are no longer
-- used for new months.


-- ───────────────────────── Fee history, like group_prices was
create table if not exists fee_prices (
  id              bigint generated always as identity primary key,
  effective_month date not null unique check (extract(day from effective_month) = 1),
  regular         int not null check (regular >= 0),
  sibling         int not null check (sibling >= 0)
);
insert into fee_prices (effective_month, regular, sibling)
values ('2026-10-01', 80000, 70000)
on conflict (effective_month) do nothing;


-- ───────────────────────── Students: beca and siblings
-- Siblings share the same family_id (any number, the app uses the lowest
-- student id of the family). null = no siblings.
alter table students add column if not exists beca_percent int not null default 0;
alter table students drop constraint if exists students_beca_percent_check;
alter table students add constraint students_beca_percent_check check (beca_percent between 0 and 100);
alter table students add column if not exists family_id bigint;


-- ───────────────────────── Charges: monthly fee or materials
alter table charges add column if not exists kind text not null default 'fee';
alter table charges drop constraint if exists charges_kind_check;
alter table charges add constraint charges_kind_check check (kind in ('fee', 'materials'));
-- The group is only shown for information now; a student in two groups pays once.
alter table charges alter column group_id drop not null;
alter table charges drop constraint if exists charges_student_id_group_id_month_key;

-- From October on, one charge per student per month (and kind). Students
-- in two groups had two charges: remove the extra ones she hasn't touched
-- (no payment, amount not edited). Keeps a touched one, or the oldest.
update charges c set deleted_at = now()
where c.month >= '2026-10-01' and c.deleted_at is null and not c.amount_edited
  and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null)
  and exists (
    select 1 from charges d
    where d.student_id = c.student_id and d.month = c.month and d.kind = c.kind
      and d.id <> c.id and d.deleted_at is null
      and (d.id < c.id or d.amount_edited
           or exists (select 1 from payments p where p.charge_id = d.id and p.deleted_at is null))
  );

create unique index if not exists charges_one_per_month
  on charges (student_id, month, kind)
  where deleted_at is null and month >= '2026-10-01';


-- ───────────────────────── What everyone owes in a month
-- One row per charge that should exist: (student, group to show, kind, amount).
-- Who pays: active students in at least one active group that month.
create or replace function fees_due(p_month date)
returns table (student_id bigint, group_id bigint, kind text, amount int)
language sql stable as $$
  with price as (
    select regular, sibling from fee_prices
    where effective_month <= p_month
    order by effective_month desc
    limit 1
  ),
  paying as (
    select s.id, s.family_id, s.beca_percent, min(e.group_id) as group_id
    from students s
    join enrollments e on e.student_id = s.id
    join groups g on g.id = e.group_id and g.active
    where s.active
      and e.start_date <= (p_month + interval '1 month' - interval '1 day')::date
      and (e.end_date is null or e.end_date > p_month)
    group by s.id
  )
  -- The monthly fee: sibling price if a brother or sister also pays this month, minus the beca.
  select p.id, p.group_id, 'fee',
         round(
           (case when exists (select 1 from paying o where o.family_id = p.family_id and o.id <> p.id)
                 then price.sibling else price.regular end)
           * (100 - p.beca_percent) / 100.0
         )::int
  from paying p, price
  union all
  -- April: materials, the full regular fee for everyone.
  select p.id, p.group_id, 'materials', price.regular
  from paying p, price
  where extract(month from p_month) = 4
$$;


-- The app calls ensure_charges('2026-10-01') every time the Payments
-- screen opens a month. It's safe to run any number of times.
-- "Untouched" charge = no payments and not edited by hand. Only those
-- are ever changed automatically; anything she touched stays as it is.
create or replace function ensure_charges(p_month date)
returns void language plpgsql as $$
declare
  this_month date := date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date;
  skipped    boolean;
begin
  -- Months before the school fee started: leave them as they are.
  if not exists (select 1 from fee_prices where effective_month <= p_month) then
    return;
  end if;

  -- Months without fees (Settings → "No fees in these months").
  select extract(month from p_month)::int = any (skip_months) into skipped from settings where id = 1;
  if skipped then
    update charges c set deleted_at = now()
    where c.month = p_month and c.deleted_at is null and not c.amount_edited
      and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null);
    return;
  end if;

  -- 1. A charge for everyone who owes one and doesn't have it yet.
  --    The amount is copied (a "snapshot"), not linked to the price.
  insert into charges (student_id, group_id, month, kind, amount)
  select f.student_id, f.group_id, p_month, f.kind, f.amount
  from fees_due(p_month) f
  where not exists (
    select 1 from charges c
    where c.student_id = f.student_id and c.month = p_month and c.kind = f.kind and c.deleted_at is null
  );

  -- 2. This month and next: untouched charges follow changes in the fee,
  --    the beca or siblings. Past months are never changed.
  if p_month >= this_month then
    update charges c set amount = f.amount
    from fees_due(p_month) f
    where c.month = p_month and c.deleted_at is null and not c.amount_edited
      and c.student_id = f.student_id and c.kind = f.kind and c.amount <> f.amount
      and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null);
  end if;

  -- 3. Next month only: remove untouched charges of students who have
  --    left meanwhile. (Current and past months are never cleaned up:
  --    someone who leaves mid-month still owes that month.)
  if p_month > this_month then
    update charges c set deleted_at = now()
    where c.month = p_month and c.deleted_at is null and not c.amount_edited
      and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null)
      and not exists (select 1 from fees_due(p_month) f where f.student_id = c.student_id and f.kind = c.kind);
  end if;
end $$;


-- ───────────────────────── Security, same rules as schema.sql
alter table fee_prices enable row level security;
drop policy if exists "Logged-in user has full access" on fee_prices;
create policy "Logged-in user has full access" on fee_prices
  for all to authenticated using (true) with check (true);
grant select, insert, update on fee_prices to authenticated;

revoke execute on function fees_due(date) from public, anon;
revoke execute on function ensure_charges(date) from public, anon;
grant execute on function fees_due(date) to authenticated;
grant execute on function ensure_charges(date) to authenticated;
