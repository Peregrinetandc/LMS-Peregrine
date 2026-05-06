-- Coupons + redemption tracking for course checkout.

create table if not exists public.coupons (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  discount_type         text not null check (discount_type in ('percent','flat')),
  discount_value        numeric(10,2) not null check (discount_value > 0),
  max_uses              integer,
  used_count            integer not null default 0,
  applicable_course_ids uuid[],
  expires_at            timestamptz,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists coupons_code_idx on public.coupons (lower(code));
create index if not exists coupons_active_idx on public.coupons (is_active) where is_active;

alter table public.course_payments
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists discount_paise integer not null default 0,
  add column if not exists original_amount_paise integer;

create table if not exists public.coupon_redemptions (
  id                uuid primary key default gen_random_uuid(),
  coupon_id         uuid not null references public.coupons(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete cascade,
  course_payment_id uuid references public.course_payments(id) on delete set null,
  discount_paise    integer not null,
  created_at        timestamptz not null default now(),
  unique (coupon_id, user_id, course_id)
);

create index if not exists coupon_redemptions_user_idx
  on public.coupon_redemptions (user_id, course_id);

-- RLS: coupons are managed server-side only. No client SELECT to avoid code enumeration.
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "users read own redemptions" on public.coupon_redemptions;
create policy "users read own redemptions" on public.coupon_redemptions
  for select using (auth.uid() = user_id);
