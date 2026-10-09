-- Private classes: one student, a time and a price, no group.
-- Run once in Supabase → SQL Editor (after 07-exams.sql).
-- Safe to run twice: everything checks whether it already exists.
--
-- A private class is a row in `sessions` with student_id and price set
-- and group_id empty. Its price becomes a charge (kind = 'private') so it
-- shows on Payments to collect. A trigger keeps that charge in step with
-- the class: moved to another month, price changed, cancelled.


-- ───────────────────────── Sessions: a group class OR a private class
alter table sessions alter column group_id drop not null;
alter table sessions add column if not exists student_id bigint references students(id);
alter table sessions add column if not exists price int;
alter table sessions drop constraint if exists sessions_price_check;
alter table sessions add constraint sessions_price_check check (price >= 0);
-- Exactly one of the two: a group, or a student.
alter table sessions drop constraint if exists sessions_group_or_student;
alter table sessions add constraint sessions_group_or_student
  check ((group_id is null) <> (student_id is null));


-- ───────────────────────── Charges: the price of a private class
alter table charges add column if not exists session_id bigint references sessions(id);
alter table charges drop constraint if exists charges_kind_check;
alter table charges add constraint charges_kind_check check (kind in ('fee', 'materials', 'private'));

-- One fee per student per month still holds, but a student can have
-- several private classes in a month: one charge per class instead.
drop index if exists charges_one_per_month;
create unique index charges_one_per_month
  on charges (student_id, month, kind)
  where deleted_at is null and month >= '2026-10-01' and kind <> 'private';
create unique index if not exists charges_one_per_private_class
  on charges (session_id)
  where deleted_at is null;


-- ───────────────────────── Keep the charge in step with its class
-- Runs after a private class is added or changed.
--   * cancelled (or price 0) → its charge is removed, unless something was paid
--   * otherwise              → its charge exists, in the class's month,
--                              with the class price (unless she changed it by hand)
create or replace function sync_private_charge()
returns trigger language plpgsql as $$
declare
  c          charges%rowtype;
  class_month date := date_trunc('month', new.date)::date;
  has_paid   boolean;
begin
  if new.student_id is null then
    return new;
  end if;

  -- The latest charge of this class, removed or not (so un-cancelling brings it back).
  select * into c from charges where session_id = new.id order by id desc limit 1;
  has_paid := c.id is not null and exists (
    select 1 from payments p where p.charge_id = c.id and p.deleted_at is null
  );

  if new.cancelled or coalesce(new.price, 0) = 0 then
    if c.id is not null and c.deleted_at is null and not has_paid then
      update charges set deleted_at = now() where id = c.id;
    end if;
  elsif c.id is null then
    insert into charges (student_id, month, kind, amount, session_id)
    values (new.student_id, class_month, 'private', new.price, new.id);
  else
    update charges set
      deleted_at = null,
      student_id = new.student_id,
      month      = class_month,
      amount     = case when amount_edited then amount else new.price end
    where id = c.id;
  end if;
  return new;
end $$;

drop trigger if exists sync_private_charge on sessions;
create trigger sync_private_charge
  after insert or update of student_id, date, price, cancelled on sessions
  for each row execute function sync_private_charge();


-- ───────────────────────── ensure_charges: leave private classes alone
-- Same as in 06-fees.sql, except the two clean-ups now skip
-- kind = 'private' (those charges belong to their class, not the fee).
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
    where c.month = p_month and c.deleted_at is null and not c.amount_edited and c.kind <> 'private'
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
    where c.month = p_month and c.deleted_at is null and not c.amount_edited and c.kind <> 'private'
      and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null)
      and not exists (select 1 from fees_due(p_month) f where f.student_id = c.student_id and f.kind = c.kind);
  end if;
end $$;
