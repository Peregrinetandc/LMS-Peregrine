-- Atomic coupon usage counter. Replaces a non-atomic read-then-write in the
-- Razorpay verify and webhook routes that could push used_count past max_uses
-- under concurrent purchases.

create or replace function public.increment_coupon_usage(p_coupon_id uuid)
returns table (used_count integer, capped boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  select c.max_uses, c.used_count
    into v_max, v_count
  from public.coupons c
  where c.id = p_coupon_id
  for update;

  if not found then
    return query select 0, true;
    return;
  end if;

  if v_max is not null and v_count >= v_max then
    return query select v_count, true;
    return;
  end if;

  update public.coupons
     set used_count = used_count + 1,
         updated_at = now()
   where id = p_coupon_id
   returning public.coupons.used_count into v_count;

  return query select v_count, false;
end;
$$;

revoke all on function public.increment_coupon_usage(uuid) from public;
grant execute on function public.increment_coupon_usage(uuid) to service_role;
