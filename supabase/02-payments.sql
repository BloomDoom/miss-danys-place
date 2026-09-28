-- Phase 4: monthly charges.
-- Run once in Supabase → SQL Editor (after schema.sql).
--
-- The app calls ensure_charges('2026-09-01') every time the Payments
-- screen opens a month. It's safe to run any number of times.
--
-- "Untouched" charge = no payments and not edited by hand. Only those
-- are ever changed automatically; anything she touched stays as it is.


-- The price of a group for a month: the latest price starting on or
-- before that month. If the group's first price starts later, use that
-- first price (so months before the app was set up still get charged).
create or replace function price_for(p_group bigint, p_month date)
returns int language sql stable as $$
  select amount
  from group_prices
  where group_id = p_group
  order by
    (effective_month <= p_month) desc,                           -- prices that apply first...
    case when effective_month <= p_month then effective_month end desc, -- ...the latest of those
    effective_month asc                                          -- otherwise the earliest price
  limit 1
$$;


create or replace function ensure_charges(p_month date)
returns void language plpgsql as $$
declare
  month_end  date := (p_month + interval '1 month' - interval '1 day')::date;
  this_month date := date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date;
  skipped    boolean;
begin
  -- Months without fees (Settings → "No fees in these months").
  select extract(month from p_month)::int = any (skip_months) into skipped from settings where id = 1;
  if skipped then
    update charges c set deleted_at = now()
    where c.month = p_month and c.deleted_at is null and not c.amount_edited
      and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null);
    return;
  end if;

  -- 1. A charge for every active student in an active group that month.
  --    The amount is copied (a "snapshot"), not linked to the price.
  insert into charges (student_id, group_id, month, amount)
  select distinct e.student_id, e.group_id, p_month, price_for(e.group_id, p_month)
  from enrollments e
  join students s on s.id = e.student_id and s.active
  join groups g on g.id = e.group_id and g.active
  where e.start_date <= month_end
    and (e.end_date is null or e.end_date > p_month)
    and price_for(e.group_id, p_month) is not null
  on conflict (student_id, group_id, month) do update
    -- a charge removed automatically before (e.g. month was skipped) comes back
    set deleted_at = null, amount = excluded.amount
    where charges.deleted_at is not null;

  -- 2. Untouched charges follow price changes for their month.
  update charges c set amount = price_for(c.group_id, p_month)
  where c.month = p_month and c.deleted_at is null and not c.amount_edited
    and price_for(c.group_id, p_month) is not null
    and price_for(c.group_id, p_month) <> c.amount
    and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null);

  -- 3. Next month only: remove untouched charges of students who have
  --    left meanwhile. (Current and past months are never cleaned up:
  --    someone who leaves mid-month still owes that month.)
  if p_month > this_month then
    update charges c set deleted_at = now()
    where c.month = p_month and c.deleted_at is null and not c.amount_edited
      and not exists (select 1 from payments p where p.charge_id = c.id and p.deleted_at is null)
      and not exists (
        select 1 from enrollments e
        join students s on s.id = e.student_id and s.active
        join groups g on g.id = e.group_id and g.active
        where e.student_id = c.student_id and e.group_id = c.group_id
          and e.start_date <= month_end and (e.end_date is null or e.end_date > p_month)
      );
  end if;
end $$;

-- Only the logged-in teacher may run these (Postgres lets everyone by default).
revoke execute on function price_for(bigint, date) from public, anon;
revoke execute on function ensure_charges(date) from public, anon;
grant execute on function price_for(bigint, date) to authenticated;
grant execute on function ensure_charges(date) to authenticated;
